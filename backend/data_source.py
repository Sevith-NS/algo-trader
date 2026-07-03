"""
Resilient market-data layer.

yfinance's internal session/crumb handshake gets flagged behind some corporate
proxies ("Too Many Requests" even when the network is fine), so the primary
source here is Yahoo's public chart/spark JSON API called directly with plain
`requests` — the same endpoints yfinance wraps — used politely:

  - Global throttle: minimum spacing between outbound calls
  - In-memory TTL cache + JSON disk cache (survives restarts)
  - Stale-if-error: when upstream fails, serve last good data instead of erroring
  - Batched spark endpoint (one request for N symbols) for the market overview
  - yfinance kept as a secondary fallback

No auth bypass or scraping tricks — standard public JSON endpoints, browser UA,
low request volume.
"""
import os
import json
import time
import threading

import pandas as pd
import requests
import yfinance as yf

CACHE_FILE = os.path.join(os.path.dirname(__file__), ".market_cache.json")

_UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
_SPARK_URL = "https://query1.finance.yahoo.com/v8/finance/spark"

FRESH_TTL = {
    "history": 30 * 60,   # 30 min
    "quote": 60,          # 1 min
    "overview": 5 * 60,   # 5 min
}
STALE_TTL = 7 * 24 * 3600  # serve stale data up to 7 days old rather than nothing

_MIN_CALL_SPACING = 1.5  # seconds between outbound calls
_last_call = {"ts": 0.0}
_throttle_lock = threading.Lock()
_cache_lock = threading.Lock()

_mem_cache: dict = {}


def _load_disk() -> dict:
    try:
        with open(CACHE_FILE) as f:
            return json.load(f)
    except Exception:
        return {}


_disk_cache = _load_disk()


def _save_disk():
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(_disk_cache, f)
    except Exception:
        pass


def _cache_get(key: str, fresh_ttl: float):
    """Returns (data, is_fresh) or (None, False)."""
    now = time.time()
    with _cache_lock:
        entry = _mem_cache.get(key) or _disk_cache.get(key)
        if not entry:
            return None, False
        age = now - entry["ts"]
        if age > STALE_TTL:
            return None, False
        return entry["data"], age <= fresh_ttl


def _cache_put(key: str, data):
    entry = {"ts": time.time(), "data": data}
    with _cache_lock:
        _mem_cache[key] = entry
        _disk_cache[key] = entry
        _save_disk()


def _throttled(fn):
    """Space out outbound calls so we never burst."""
    with _throttle_lock:
        wait = _MIN_CALL_SPACING - (time.time() - _last_call["ts"])
        if wait > 0:
            time.sleep(wait)
        _last_call["ts"] = time.time()
    return fn()


def _get_json(url: str, params: dict | None = None) -> dict:
    resp = _throttled(lambda: requests.get(url, params=params, headers=_UA, timeout=15))
    resp.raise_for_status()
    return resp.json()


# ------------------------------------------------------- chart API parsing ---

def _fetch_chart(symbol: str, range_: str = "1y", interval: str = "1d"):
    """Returns (records, meta) from Yahoo's public v8 chart API."""
    data = _get_json(_CHART_URL.format(symbol=symbol),
                     {"range": range_, "interval": interval})
    result = data["chart"]["result"][0]
    meta = result.get("meta", {})
    timestamps = result.get("timestamp") or []
    quote = (result.get("indicators", {}).get("quote") or [{}])[0]

    records = []
    opens, highs = quote.get("open") or [], quote.get("high") or []
    lows, closes = quote.get("low") or [], quote.get("close") or []
    vols = quote.get("volume") or []
    for i, ts in enumerate(timestamps):
        try:
            o, h, l, c = opens[i], highs[i], lows[i], closes[i]
        except IndexError:
            continue
        if None in (o, h, l, c):
            continue
        records.append({
            "t": pd.Timestamp(ts, unit="s", tz="UTC").isoformat(),
            "o": float(o), "h": float(h), "l": float(l), "c": float(c),
            "v": float(vols[i] or 0) if i < len(vols) else 0.0,
        })
    return records, meta


# ---------------------------------------------------------------- history ---

def get_history(symbol: str, period: str = "1y") -> pd.DataFrame:
    """Daily OHLCV DataFrame. Cached; serves stale data when upstream fails."""
    key = f"hist:{symbol}:{period}"
    cached, fresh = _cache_get(key, FRESH_TTL["history"])
    if cached is not None and fresh:
        return _records_to_df(cached)

    # Primary: public chart API
    try:
        records, _ = _fetch_chart(symbol, range_=period)
        if records:
            _cache_put(key, records)
            return _records_to_df(records)
    except Exception:
        pass

    # Secondary: yfinance
    try:
        df = _throttled(lambda: yf.Ticker(symbol).history(period=period))
        if df is not None and not df.empty:
            _cache_put(key, _df_to_records(df))
            return df
    except Exception:
        pass

    if cached is not None:
        return _records_to_df(cached)
    return pd.DataFrame()


def _df_to_records(df: pd.DataFrame) -> list:
    out = []
    for date, row in df.iterrows():
        out.append({
            "t": date.isoformat(),
            "o": float(row["Open"]), "h": float(row["High"]),
            "l": float(row["Low"]), "c": float(row["Close"]),
            "v": float(row.get("Volume", 0) or 0),
        })
    return out


def _records_to_df(records: list) -> pd.DataFrame:
    if not records:
        return pd.DataFrame()
    df = pd.DataFrame([
        {"Open": r["o"], "High": r["h"], "Low": r["l"], "Close": r["c"], "Volume": r["v"]}
        for r in records
    ], index=pd.to_datetime([r["t"] for r in records]))
    df.index.name = "Date"
    return df


def get_close_series(symbol: str, period: str = "1y") -> pd.Series:
    """Tz-naive, date-normalized Close series — safe to align across symbols."""
    df = get_history(symbol, period)
    if df.empty:
        return pd.Series(dtype=float)
    close = df["Close"].copy()
    idx = pd.to_datetime(close.index)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    close.index = idx.normalize()
    return close[~close.index.duplicated(keep="last")]


def get_sector(symbol: str) -> str:
    """Sector for allocation charts. Cached forever — worth one `.info` call once."""
    key = f"sector:{symbol}"
    cached, _ = _cache_get(key, STALE_TTL)
    if cached is not None:
        return cached
    try:
        info = _throttled(lambda: yf.Ticker(symbol).info)
        sector = info.get("sector") or info.get("quoteType") or "Other"
    except Exception:
        return "Other"  # don't cache failures
    _cache_put(key, sector)
    return sector


# ------------------------------------------------------------------ quote ---

def get_quote(symbol: str) -> dict:
    """Quote from the chart API meta + last candles (avoids `.info` entirely)."""
    key = f"quote:{symbol}"
    cached, fresh = _cache_get(key, FRESH_TTL["quote"])
    if cached is not None and fresh:
        return cached

    quote = None
    try:
        records, meta = _fetch_chart(symbol, range_="5d")
        price = meta.get("regularMarketPrice")
        closes = [r["c"] for r in records]
        if price is None and closes:
            price = closes[-1]
        # previous session close: last candle before today's
        prev = None
        if len(closes) >= 2:
            prev = closes[-2] if abs(closes[-1] - (price or 0)) < 1e-9 else closes[-1]
        prev = meta.get("previousClose") or prev or meta.get("chartPreviousClose")
        quote = {
            "symbol": symbol,
            "shortName": meta.get("shortName") or symbol,
            "longName": meta.get("longName") or meta.get("shortName") or symbol,
            "currency": meta.get("currency") or "USD",
            "regularMarketPrice": price,
            "previousClose": prev,
            "regularMarketChangePercent": ((price - prev) / prev * 100) if price and prev else 0,
            "regularMarketVolume": meta.get("regularMarketVolume") or (records[-1]["v"] if records else None),
            "fiftyTwoWeekHigh": meta.get("fiftyTwoWeekHigh"),
            "fiftyTwoWeekLow": meta.get("fiftyTwoWeekLow"),
            "marketCap": None,
        }
        # enrich from cached yearly history if available (no extra network call)
        hist_cached, _ = _cache_get(f"hist:{symbol}:1y", STALE_TTL)
        if hist_cached:
            vols = [r["v"] for r in hist_cached[-63:] if r["v"]]
            if vols:
                quote["averageDailyVolume3Month"] = sum(vols) / len(vols)
            if not quote["fiftyTwoWeekHigh"]:
                quote["fiftyTwoWeekHigh"] = max(r["h"] for r in hist_cached)
            if not quote["fiftyTwoWeekLow"]:
                quote["fiftyTwoWeekLow"] = min(r["l"] for r in hist_cached)
    except Exception:
        quote = None

    if quote is None:
        df = get_history(symbol, "1y")
        if df.empty or len(df) < 2:
            if cached is not None:
                return cached
            return {"error": "Market data temporarily unavailable (rate limited)."}
        last, prev = float(df["Close"].iloc[-1]), float(df["Close"].iloc[-2])
        quote = {
            "symbol": symbol,
            "shortName": symbol,
            "longName": symbol,
            "currency": "USD",
            "regularMarketPrice": last,
            "previousClose": prev,
            "regularMarketChangePercent": (last - prev) / prev * 100 if prev else 0,
            "regularMarketVolume": float(df["Volume"].iloc[-1]),
            "averageDailyVolume3Month": float(df["Volume"].tail(63).mean()),
            "fiftyTwoWeekHigh": float(df["High"].max()),
            "fiftyTwoWeekLow": float(df["Low"].min()),
            "marketCap": None,
            "stale": True,
        }

    _cache_put(key, quote)
    return quote


# --------------------------------------------------------------- overview ---

OVERVIEW_SYMBOLS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'GOOGL',
                    'JPM', 'V', 'WMT', 'JNJ', 'PG', 'XOM', 'BAC', 'MA']

# Static approximate caps (USD) used only for heatmap tile sizing when live
# caps are unavailable — sizing is cosmetic, not displayed as data.
_APPROX_CAPS = {
    'AAPL': 3.4e12, 'MSFT': 3.6e12, 'NVDA': 3.5e12, 'AMZN': 2.3e12,
    'GOOGL': 2.4e12, 'META': 1.6e12, 'TSLA': 1.1e12, 'JPM': 8e11,
    'V': 7e11, 'WMT': 8e11, 'JNJ': 4e11, 'PG': 4e11, 'XOM': 5e11,
    'BAC': 3.5e11, 'MA': 5e11,
}


def get_market_overview() -> dict:
    key = "overview"
    cached, fresh = _cache_get(key, FRESH_TTL["overview"])
    if cached is not None and fresh:
        return cached

    results = []
    try:
        # ONE batched spark request for all symbols
        data = _get_json(_SPARK_URL, {
            "symbols": ",".join(OVERVIEW_SYMBOLS),
            "range": "5d",
            "interval": "1d",
        })
        for sym in OVERVIEW_SYMBOLS:
            try:
                series = data.get(sym) or {}
                closes = [c for c in (series.get("close") or []) if c is not None]
                if len(closes) < 2:
                    continue
                curr, prev = float(closes[-1]), float(closes[-2])
                results.append({
                    "symbol": sym,
                    "price": curr,
                    "change": (curr - prev) / prev * 100,
                    "volume": 0,
                    "marketCap": _APPROX_CAPS.get(sym),
                })
            except Exception:
                continue
    except Exception:
        results = []

    if not results:
        if cached is not None:
            return cached
        return {"error": "Market data temporarily unavailable (rate limited)."}

    results = sorted(results, key=lambda x: x["change"], reverse=True)
    overview = {
        "top_gainers": results[:5],
        "top_losers": results[-5:],
        "most_active": sorted(results, key=lambda x: abs(x["change"]), reverse=True)[:5],
        "all_assets": results,
    }
    _cache_put(key, overview)
    return overview


# --------------------------------------------------------------- trending ---

def get_trending() -> list:
    """Trending US tickers with quotes; cached, stale-if-error."""
    key = "trending"
    cached, fresh = _cache_get(key, FRESH_TTL["overview"])
    if cached is not None and fresh:
        return cached

    try:
        data = _get_json("https://query1.finance.yahoo.com/v1/finance/trending/US",
                         {"count": 10})
        results = data.get('finance', {}).get('result', [{}])[0].get('quotes', [])
        symbols = [q.get('symbol') for q in results if q.get('symbol')][:8]
        quotes = []
        for sym in symbols:
            q = get_quote(sym)
            if 'error' not in q:
                quotes.append(q)
        if quotes:
            _cache_put(key, quotes)
            return quotes
    except Exception:
        pass

    return cached if cached is not None else []
