"""
Offline fixture tests for the discovery engine (PRD Part II, H3/H4 v1 slice).

No network: everything runs over synthetic close series and hand-built metric
dicts. Covers the acceptance parentheticals the PRD records as shipped —
classifier reproducibility on identical bars, fail-closed behavior on missing
metrics, screen-spec integrity (the published conditions string comes from the
same objects the evaluator runs), and the volume-confirm session guard.

Run directly (`python test_screener_engine.py`) or via pytest.
"""
import datetime as dt

import numpy as np
import pandas as pd

import data_source
import screener_engine as se


# ------------------------------------------------------------- fixtures ---

def _series(values, freq="B", end="2026-08-07"):
    """Close series with the same index shape the spark loader produces."""
    idx = pd.date_range(end=end, periods=len(values), freq=freq)
    return pd.Series([float(v) for v in values], index=idx)


def _uptrend(n=260, start=100.0, daily=0.0013, freq="B"):
    """Deterministic linear-ish uptrend: +0.13%/bar, no noise."""
    return _series([start * (1 + daily) ** i for i in range(n)], freq=freq)


def _rich_metrics():
    """Metrics from a long healthy series + the cross-sectional/confirm keys,
    used to prove every screen column key actually resolves somewhere."""
    m = se._metrics_for(_uptrend())
    m["vol_top30"] = True
    m["ret60_top_decile"] = True
    return m, {"rvol": 2.0, "range_pos": 0.9}


# ------------------------------------------------------------- metrics ----

def test_metrics_basics():
    closes = _uptrend()
    m = se._metrics_for(closes)
    assert m is not None
    assert abs(m["price"] - float(closes.iloc[-1])) < 1e-9
    assert abs(m["change_1d_pct"] - 0.13) < 0.01
    assert m["new_20d_high"] is True and m["new_20d_low"] is False
    assert m["above_sma200"] is True and m["sma50"] > m["sma200"]
    # 260 business bars span > 1 calendar year -> calendar-based 1y return
    assert m["ret_1y_pct"] is not None and 30 < m["ret_1y_pct"] < 45
    assert m["dist_52w_high_pct"] is not None and m["days_since_52w_high"] == 0
    assert m["last_bar_date"] == closes.index[-1].date()


def test_metrics_fail_closed_on_short_history():
    m = se._metrics_for(_uptrend(n=50))
    assert m is not None
    # < 300 calendar days of coverage: no 1y claim, no 52w family, no SMA200
    assert m["ret_1y_pct"] is None
    assert m["high_52w"] is None and m["days_since_52w_high"] is None
    assert m["sma200"] is None
    # ...and the screens that need them refuse to match (fail closed)
    scr = se._SCREEN_INDEX["near_52w_high"]
    assert not all(c.ok(m) for c in scr["conditions"])


def test_metrics_crypto_calendar_honesty():
    # 7-day-week asset: 380 daily bars, alternating ±1% around a flat drift.
    vals, price = [], 100.0
    for i in range(380):
        price *= 1.01 if i % 2 == 0 else 0.99
        vals.append(price)
    closes = _series(vals, freq="D")
    m = se._metrics_for(closes, periods_per_year=365)
    # annualization must scale by sqrt(365), not sqrt(252)
    expected = float(closes.pct_change().dropna().tail(20).std() * np.sqrt(365) * 100)
    assert abs(m["vol_ann_pct"] - expected) < 1e-6
    # 1y return measured by calendar date: base is the bar at/after (last - 365d)
    window = closes[closes.index >= closes.index[-1] - pd.Timedelta(days=365)]
    expected_1y = (float(closes.iloc[-1]) / float(window.iloc[0]) - 1) * 100
    assert abs(m["ret_1y_pct"] - expected_1y) < 1e-6


# ----------------------------------------------------------- classifier ---

def test_classifier_exact_tags_from_series():
    # A clean monotonic uptrend is long-term only: RSI ~100 blocks short_term's
    # breakout branch, +0.7% 5d misses the surge branch, 0.13%/day is calm.
    tags = se._classify(se._metrics_for(_uptrend()))
    assert [t["id"] for t in tags] == ["long_term"]
    assert "1y" in tags[0]["reason"] and "200-DMA" in tags[0]["reason"]


def test_classifier_rule_boundaries():
    base, _ = _rich_metrics()

    swing = dict(base, rsi_14=44.0, dist_sma20_pct=5.0, dist_sma50_pct=1.2)
    ids = [t["id"] for t in se._classify(swing)]
    assert "swing" in ids
    reason = next(t for t in se._classify(swing) if t["id"] == "swing")["reason"]
    assert "RSI 44" in reason and "50-DMA" in reason  # nearest MA named, numbers shown

    surge = dict(base, ret_5d_pct=6.3, rsi_14=68.0)
    assert "short_term" in [t["id"] for t in se._classify(surge)]

    mover = dict(base, change_1d_pct=3.1)
    intraday = next(t for t in se._classify(mover) if t["id"] == "intraday")
    assert "+3.1% today" in intraday["reason"]

    # fail closed: no SMA200 -> neither long_term nor swing can fire
    dark = dict(base, sma200=None)
    ids = [t["id"] for t in se._classify(dark)]
    assert "long_term" not in ids and "swing" not in ids


def test_classifier_intraday_vol_floor():
    """vol_top30 is within-universe relative — a sleepy bond-ETF universe's
    "top 30%" (~8% ann vol) must not read as day-tradeable. The relative flag
    only promotes symbols clearing the absolute floor."""
    base, _ = _rich_metrics()
    sleepy = dict(base, vol_top30=True, vol_ann_pct=8.0, change_1d_pct=0.1)
    assert "intraday" not in [t["id"] for t in se._classify(sleepy)]
    lively = dict(base, vol_top30=True, vol_ann_pct=35.0, change_1d_pct=0.1)
    tags = se._classify(lively)
    assert "intraday" in [t["id"] for t in tags]
    reason = next(t for t in tags if t["id"] == "intraday")["reason"]
    assert "35% ann vol" in reason


def test_momentum_leaders_positive_gate():
    """Top decile of a falling universe is still a loser — ret60_top_decile
    only matches alongside an actually positive 60d return."""
    scr = se._SCREEN_INDEX["momentum_leaders"]
    base, _ = _rich_metrics()
    leader = dict(base, ret60_top_decile=True, ret_60d_pct=12.0, rsi_14=65.0)
    assert all(c.ok(leader) for c in scr["conditions"])
    laggard = dict(base, ret60_top_decile=True, ret_60d_pct=-3.0, rsi_14=65.0)
    assert not all(c.ok(laggard) for c in scr["conditions"])
    # the published rule says what the evaluator does
    assert "(and positive)" in se._screen_public(scr)["conditions"]


def test_classifier_reproducible_on_identical_bars():
    closes = _uptrend()
    a = se._metrics_for(closes.copy())
    b = se._metrics_for(closes.copy())
    assert a == b
    assert se._classify(a) == se._classify(b)


# ------------------------------------------------------------- universes ---

def test_universe_shapes_and_currency_override():
    expected_counts = {
        "us_large": 48, "nifty50": 50, "crypto": 12,
        "bonds": 12, "commodities": 12, "indices": 13,
    }
    assert set(se.UNIVERSES) == set(expected_counts)
    for uid, count in expected_counts.items():
        assert len(se.UNIVERSES[uid]["symbols"]) == count, uid

    # Global Indices mixes currencies: the per-symbol override wins where
    # present, and everything else falls back to the universe default.
    indices = se.UNIVERSES["indices"]
    assert indices["currency"] == "USD"
    assert se._symbol_currency(indices, "^NSEI") == "INR"
    assert se._symbol_currency(indices, "^N225") == "JPY"
    assert se._symbol_currency(indices, "^GSPC") == "USD"  # not in the map
    # single-currency universes (no "currencies" map) resolve to the default
    assert se._symbol_currency(se.UNIVERSES["bonds"], "TLT") == "USD"
    assert se._symbol_currency(se.UNIVERSES["nifty50"], "TCS.NS") == "INR"


def test_discover_include_untagged(monkeypatch=None):
    """all=1 must emit a card for every parsed symbol, tags allowed empty.

    Offline: _universe_metrics is stubbed with two synthetic symbols — one
    that classifies (clean uptrend -> long_term) and one dead-flat series
    that fires no tag — so no network and no live get_discover scan.
    """
    tagged = se._metrics_for(_uptrend())
    flat = se._metrics_for(_series([100.0] * 260))
    assert se._classify(tagged) and not se._classify(flat)  # fixture sanity

    metrics = {"BTC-USD": tagged, "ETH-USD": flat}
    real = se._universe_metrics
    se._universe_metrics = lambda universe_id: (metrics, "2026-08-07")
    try:
        base = se.get_discover("crypto")
        allc = se.get_discover("crypto", include_untagged=True)
    finally:
        se._universe_metrics = real
        # drop the memoised test payloads — distinct keys, but keep it clean
        with se._results_lock:
            se._results.pop(("discover", "crypto", False), None)
            se._results.pop(("discover", "crypto", True), None)

    assert [c["symbol"] for c in base["cards"]] == ["BTC-USD"]
    assert [c["symbol"] for c in allc["cards"]] == ["BTC-USD", "ETH-USD"]
    untagged = next(c for c in allc["cards"] if c["symbol"] == "ETH-USD")
    assert untagged["tags"] == [] and untagged["price"] == 100.0


# -------------------------------------------------------- screen registry --

def test_screen_registry_integrity():
    screens = se.list_screens()["screens"]
    assert len(screens) == 12
    assert se.list_screens()["categories"] == se.CATEGORIES
    assert {s["category"] for s in screens} == set(se.CATEGORIES)

    rich, conf = _rich_metrics()
    for spec in se._SCREENS:
        pub = se._screen_public(spec)
        # the published conditions string is the evaluator's own labels
        labels = [c.label for c in spec["conditions"] + spec["confirm"]]
        assert pub["conditions"] == " · ".join(labels), spec["id"]
        assert pub["volume_confirmed"] == bool(spec["confirm"]), spec["id"]
        # every advertised column resolves to a metric or a confirm value
        for key, _label in spec["columns"]:
            assert key in rich or key in conf, (spec["id"], key)


def test_conditions_fail_closed_on_none():
    cond = se._Cond("RSI(14) > 50", lambda m: m["rsi_14"] > 50)
    assert cond.ok({"rsi_14": None}) is False   # TypeError -> False
    assert cond.ok({}) is False                 # KeyError  -> False


# ------------------------------------------------- volume-confirm guard ---

def test_confirm_values_session_guard(monkeypatch=None):
    """RVOL from a different session than the scanned bar must be refused."""
    idx = pd.date_range(end="2026-08-07", periods=30, freq="B")
    df = pd.DataFrame({
        "Open": 100.0, "High": 110.0, "Low": 100.0, "Close": 109.0,
        "Volume": [1000.0] * 29 + [2000.0],
    }, index=idx)

    real = data_source.get_history
    data_source.get_history = lambda symbol, period="1y": df
    try:
        good = se._confirm_values("TEST", dt.date(2026, 8, 7))
        assert good is not None
        assert abs(good["rvol"] - 2.0) < 1e-9        # 2000 vs mean(prior 20)=1000
        assert abs(good["range_pos"] - 0.9) < 1e-9   # (109-100)/(110-100)
        # session mismatch -> None -> caller degrades to volume_confirmed:false
        assert se._confirm_values("TEST", dt.date(2026, 8, 6)) is None
        # no expectation supplied (non-confirm path safety) -> still computes
        assert se._confirm_values("TEST", None) is not None
    finally:
        data_source.get_history = real


if __name__ == "__main__":
    failures = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS  {name}")
            except AssertionError as e:
                failures += 1
                print(f"FAIL  {name}: {e}")
    raise SystemExit(1 if failures else 0)
