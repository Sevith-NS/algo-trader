// Pure indicator math over close-price arrays for the terminal chart.
//
// CONTRACT: every returned array is the SAME LENGTH as the input, with
// `undefined` for warm-up bars. Never pad with price, never truncate —
// the old Chart.tsx SMA substituted the close price during warm-up, which
// drew a fake "indicator" hugging the candles for the first N bars.
// Renderers filter the `undefined` points out; they must never fill them in.

export function sma(values: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined);
  if (period < 1 || values.length < period) return out;
  // Rolling sum instead of re-slicing each window: O(n) not O(n·period).
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined);
  if (period < 1 || values.length < period) return out;
  // Seed with the SMA of the first `period` values (the standard convention),
  // then recurse. Seeding from values[0] instead would bias the early line.
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  const k = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

export function bollinger(
  values: number[],
  period: number,
  mult: number,
): {
  upper: (number | undefined)[];
  middle: (number | undefined)[];
  lower: (number | undefined)[];
} {
  const middle = sma(values, period);
  const upper: (number | undefined)[] = new Array(values.length).fill(undefined);
  const lower: (number | undefined)[] = new Array(values.length).fill(undefined);
  for (let i = period - 1; i < values.length; i++) {
    const mean = middle[i];
    if (mean === undefined) continue;
    // Population std-dev (ddof=0) — the classic Bollinger definition.
    let sqSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - mean;
      sqSum += d * d;
    }
    const std = Math.sqrt(sqSum / period);
    upper[i] = mean + mult * std;
    lower[i] = mean - mult * std;
  }
  return { upper, middle, lower };
}

export function macd(
  values: number[],
  fast: number,
  slow: number,
  signal: number,
): {
  macd: (number | undefined)[];
  signal: (number | undefined)[];
  histogram: (number | undefined)[];
} {
  const n = values.length;
  const fastEma = ema(values, fast);
  const slowEma = ema(values, slow);
  const macdLine: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = 0; i < n; i++) {
    const f = fastEma[i];
    const s = slowEma[i];
    if (f !== undefined && s !== undefined) macdLine[i] = f - s;
  }

  // Signal = EMA of the MACD line. The MACD line has its own warm-up, so run
  // the EMA over the defined tail only, then map back to original indices —
  // feeding `undefined` gaps into ema() would poison the recursion.
  const signalLine: (number | undefined)[] = new Array(n).fill(undefined);
  const start = macdLine.findIndex((v) => v !== undefined);
  if (start !== -1) {
    const defined = macdLine.slice(start) as number[];
    const sig = ema(defined, signal);
    for (let i = 0; i < sig.length; i++) signalLine[start + i] = sig[i];
  }

  const histogram: (number | undefined)[] = new Array(n).fill(undefined);
  for (let i = 0; i < n; i++) {
    const m = macdLine[i];
    const s = signalLine[i];
    if (m !== undefined && s !== undefined) histogram[i] = m - s;
  }
  return { macd: macdLine, signal: signalLine, histogram };
}

export function rsi(values: number[], period: number): (number | undefined)[] {
  const out: (number | undefined)[] = new Array(values.length).fill(undefined);
  if (period < 1 || values.length <= period) return out;
  // Wilder smoothing via the same recursion the backend uses
  // (quant_models._rsi: ewm(alpha=1/period, adjust=False)):
  //   avg[t] = avg[t-1] + (x[t] - avg[t-1]) / period, seeded from the first delta.
  const alpha = 1 / period;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    if (i === 1) {
      avgGain = gain;
      avgLoss = loss;
    } else {
      avgGain += alpha * (gain - avgGain);
      avgLoss += alpha * (loss - avgLoss);
    }
    // The recursion runs from bar 1 but early values carry almost no history;
    // report only once `period` bars have been folded in.
    if (i >= period) {
      // Wilder: an all-gain window (avgLoss 0, avgGain > 0) is RSI 100; only
      // a truly flat window (0/0) has no defined value. Backend _rsi mirrors
      // this exactly (loss==0 & gain>0 -> 100.0, 0/0 -> NaN).
      if (avgLoss > 0) out[i] = 100 - 100 / (1 + avgGain / avgLoss);
      else if (avgGain > 0) out[i] = 100;
    }
  }
  return out;
}
