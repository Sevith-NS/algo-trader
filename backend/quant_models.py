"""
Quantitative signal engine inspired by systematic/HFT desk models.

Combines several orthogonal alpha families into a composite score, then derives
executable trade levels (entry, stop, targets) and position sizing:

  1. Mean reversion  - Ornstein-Uhlenbeck z-score with half-life estimation
  2. Momentum/trend  - EMA(12/26) crossover slope + MACD histogram
  3. Microstructure  - price vs rolling VWAP, volume imbalance
  4. Oscillators     - RSI(14), Bollinger %B
  5. Volatility      - ATR(14), realized-vol regime percentile

Trade levels:
  - Entry:  VWAP/ATR-adjusted limit price (avoid crossing the spread on weak signals)
  - Stop:   max(ATR multiple, recent swing level) - volatility-aware
  - Targets: 1.5R and 3R multiples
  - Sizing: half-Kelly fraction capped at 25%, scaled by signal conviction
"""
import numpy as np
import pandas as pd

import data_source


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).ewm(alpha=1 / period, adjust=False).mean()
    loss = (-delta.clip(upper=0)).ewm(alpha=1 / period, adjust=False).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    hl = df['High'] - df['Low']
    hc = (df['High'] - df['Close'].shift(1)).abs()
    lc = (df['Low'] - df['Close'].shift(1)).abs()
    tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / period, adjust=False).mean()


def _half_life(spread: pd.Series) -> float:
    """OU half-life of mean reversion via lag-1 OLS: dx = a + b*x_{t-1}."""
    x = spread.shift(1).dropna()
    dx = spread.diff().dropna()
    x, dx = x.align(dx, join='inner')
    if len(x) < 30 or x.var() == 0:
        return np.nan
    beta = np.cov(dx, x)[0][1] / x.var()
    if beta >= 0:
        return np.nan  # not mean-reverting
    return float(-np.log(2) / beta)


def get_quant_signals(symbol: str):
    try:
        df = data_source.get_history(symbol, period="1y")
        if df.empty or len(df) < 60:
            return {"error": "Not enough historical data for quant models."}

        close = df['Close']
        last_close = float(close.iloc[-1])

        # --- Volatility ---
        atr_series = _atr(df)
        atr = float(atr_series.iloc[-1])
        returns = close.pct_change().dropna()
        realized_vol = float(returns.tail(21).std() * np.sqrt(252))
        vol_series = returns.rolling(21).std().dropna() * np.sqrt(252)
        vol_percentile = float((vol_series <= realized_vol).mean() * 100)

        # --- Mean reversion (OU z-score around 20d mean) ---
        sma20 = close.rolling(20).mean()
        std20 = close.rolling(20).std()
        zscore = float((last_close - sma20.iloc[-1]) / std20.iloc[-1]) if std20.iloc[-1] > 0 else 0.0
        half_life = _half_life(close - sma20)

        # --- Momentum / trend ---
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        macd_line = ema12 - ema26
        macd_signal = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = float(macd_line.iloc[-1] - macd_signal.iloc[-1])
        # Normalize MACD histogram by price for cross-asset comparability
        macd_norm = macd_hist / last_close * 100
        trend_slope = float((ema26.iloc[-1] - ema26.iloc[-6]) / ema26.iloc[-6] * 100)

        # --- Microstructure proxies ---
        typical = (df['High'] + df['Low'] + df['Close']) / 3
        vwap20 = float((typical * df['Volume']).tail(20).sum() / max(df['Volume'].tail(20).sum(), 1))
        vwap_dev = (last_close - vwap20) / vwap20 * 100
        up_vol = df['Volume'].tail(10)[close.diff().tail(10) > 0].sum()
        total_vol = df['Volume'].tail(10).sum()
        volume_imbalance = float(up_vol / total_vol) if total_vol > 0 else 0.5

        # --- Oscillators ---
        rsi = float(_rsi(close).iloc[-1])
        upper_bb = float(sma20.iloc[-1] + 2 * std20.iloc[-1])
        lower_bb = float(sma20.iloc[-1] - 2 * std20.iloc[-1])
        pct_b = (last_close - lower_bb) / (upper_bb - lower_bb) if upper_bb != lower_bb else 0.5

        # --- Composite score: each factor votes in [-1, 1] ---
        factors = {
            "mean_reversion": float(np.clip(-zscore / 2, -1, 1)),
            "momentum": float(np.clip(macd_norm / 1.5 + trend_slope / 3, -1, 1)),
            "rsi": float(np.clip((50 - rsi) / 30, -1, 1)),
            "vwap": float(np.clip(-vwap_dev / 4, -1, 1)),
            "volume_flow": float(np.clip((volume_imbalance - 0.5) * 4, -1, 1)),
        }
        weights = {"mean_reversion": 0.25, "momentum": 0.30, "rsi": 0.15, "vwap": 0.15, "volume_flow": 0.15}
        composite = sum(factors[k] * weights[k] for k in factors)

        if composite >= 0.45:
            signal, action = "STRONG BUY", "buy"
        elif composite >= 0.15:
            signal, action = "BUY", "buy"
        elif composite <= -0.45:
            signal, action = "STRONG SELL", "sell"
        elif composite <= -0.15:
            signal, action = "SELL", "sell"
        else:
            signal, action = "HOLD", "none"
        conviction = float(min(abs(composite) / 0.6, 1.0))

        # --- Executable levels ---
        swing_low = float(df['Low'].tail(10).min())
        swing_high = float(df['High'].tail(10).max())

        if action != "sell":
            # Long plan: passive entry on a pullback toward VWAP, never above market
            entry = min(last_close, max(vwap20, last_close - 0.35 * atr))
            stop = min(entry - 1.8 * atr, swing_low - 0.25 * atr)
            risk = entry - stop
            target_1 = entry + 1.5 * risk
            target_2 = entry + 3.0 * risk
        else:
            # Short plan (or exit-long levels)
            entry = max(last_close, min(vwap20, last_close + 0.35 * atr))
            stop = max(entry + 1.8 * atr, swing_high + 0.25 * atr)
            risk = stop - entry
            target_1 = entry - 1.5 * risk
            target_2 = entry - 3.0 * risk

        # --- Kelly sizing (half-Kelly, conviction-scaled, capped) ---
        wins = returns[returns > 0]
        losses = returns[returns < 0]
        win_rate = float(len(wins) / len(returns)) if len(returns) else 0.5
        payoff = float(wins.mean() / abs(losses.mean())) if len(losses) and losses.mean() != 0 else 1.0
        kelly = win_rate - (1 - win_rate) / payoff if payoff > 0 else 0.0
        position_fraction = float(np.clip(0.5 * kelly * conviction, 0, 0.25))

        return {
            "symbol": symbol,
            "current_price": last_close,
            "signal": signal,
            "action": action,
            "composite_score": round(float(composite), 3),
            "conviction": round(conviction, 2),
            "factors": {k: round(v, 3) for k, v in factors.items()},
            "levels": {
                "entry": round(float(entry), 2),
                "stop_loss": round(float(stop), 2),
                "target_1": round(float(target_1), 2),
                "target_2": round(float(target_2), 2),
                "risk_reward": 1.5,
            },
            "position_sizing": {
                "kelly_fraction": round(float(kelly), 4),
                "recommended_fraction": round(position_fraction, 4),
                "win_rate": round(win_rate, 3),
                "payoff_ratio": round(payoff, 2),
            },
            "indicators": {
                "rsi_14": round(rsi, 1),
                "macd_histogram": round(macd_hist, 3),
                "zscore_20d": round(zscore, 2),
                "half_life_days": round(half_life, 1) if not np.isnan(half_life) else None,
                "vwap_20d": round(vwap20, 2),
                "vwap_deviation_pct": round(float(vwap_dev), 2),
                "atr_14": round(atr, 2),
                "realized_vol_annual": round(realized_vol, 3),
                "vol_regime_percentile": round(vol_percentile, 0),
                "bollinger_pct_b": round(float(pct_b), 2),
                "volume_imbalance": round(volume_imbalance, 2),
            },
            # Back-compat with the old advanced-signals consumers
            "stop_loss": round(float(stop), 2),
            "take_profit": round(float(target_2), 2),
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e)}
