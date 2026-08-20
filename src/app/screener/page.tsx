"use client";
import { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Crosshair, ShieldAlert, Target, Gauge, BrainCircuit, WifiOff, Eye, EyeOff, RotateCw,
} from 'lucide-react';
import clsx from 'clsx';
import Navigation from '../../components/Navigation';
import SearchInput from '../../components/SearchInput';
import Chart from '../../components/Chart';
import NewsIntelPanel from '../../components/intel/NewsIntelPanel';
import DeepAnalysisSection from '../../components/intel/DeepAnalysisSection';
import { usePortfolio } from '../../context/PortfolioContext';
import { API_BASE } from '../../lib/api';

const fmtUsd = (val: number | undefined | null, currency = 'USD') =>
  val === undefined || val === null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(val);

function StatRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-textSecondary">{label}</span>
      <span className={clsx('text-[13px] font-medium tabular text-textPrimary', valueClass)}>{value}</span>
    </div>
  );
}

function Panel({ title, icon, children, accent }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; accent?: string;
}) {
  return (
    <div className="glass-panel p-5" style={accent ? { borderTop: `2px solid ${accent}` } : undefined}>
      <h3 className="mb-3 flex items-center gap-2 border-b border-borderSubtle pb-3 text-sm font-semibold text-textPrimary">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function FactorBar({ label, value }: { label: string; value: number }) {
  // value in [-1, 1]
  const pct = Math.min(Math.abs(value), 1) * 50;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-28 shrink-0 text-[11px] capitalize text-textMuted">{label.replace('_', ' ')}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-white/5">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
        <div
          className={clsx('absolute top-0 h-full rounded-full', value >= 0 ? 'bg-accentGreen' : 'bg-accentRed')}
          style={value >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
        />
      </div>
      <span className={clsx('w-10 text-right text-[11px] tabular', value >= 0 ? 'text-accentGreen' : 'text-accentRed')}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

/**
 * Terminal timeframes.
 *
 * `range` is deliberately LARGER than `visibleBars` implies: the extra history
 * is warm-up so long overlays (EMA 200) are already established at the left edge
 * of the view instead of only appearing 200 bars in. Chart.tsx loads all of it
 * and scrolls the warm-up off-screen.
 *
 * Ranges respect Yahoo's measured per-interval ceilings (1m caps at 7d, 5m/15m
 * at 1mo, 60m at 2y); the backend clamps anything over and reports it, so these
 * never 422.
 */
const TIMEFRAMES = [
  { id: '1m', label: '1m', range: '7d', visibleBars: 375 },   // ~1 NSE session
  { id: '5m', label: '5m', range: '1mo', visibleBars: 375 },  // ~5 sessions
  { id: '15m', label: '15m', range: '1mo', visibleBars: 250 },
  { id: '30m', label: '30m', range: '1mo', visibleBars: 160 },
  { id: '60m', label: '1h', range: '2y', visibleBars: 500 },
  { id: '1d', label: '1D', range: '5y', visibleBars: 252 },   // 1y visible, 4y warm-up
  { id: '1wk', label: '1W', range: 'max', visibleBars: 260 },
] as const;

type TimeframeId = (typeof TIMEFRAMES)[number]['id'];

const DEFAULT_TIMEFRAME: TimeframeId = '1d';

/* ==========================================================================
   Quant levels: entry, stop, targets.

   The solver's four levels are drawn on the chart as price lines. All four at
   once is right when you are reading the plan and wrong when you are reading
   price: on a 1m timeframe whose visible range is a fraction of a percent,
   four horizontal rules and their axis labels sit on top of the candles you
   came to look at, and a stop 6% below simply pins the y-axis open.

   So each level toggles. The choice persists, because it is a working
   preference ("I trade the entry, I don't want to see T2 all day"), not a
   per-symbol one — the same reasoning, and the same storage shape, as the
   chart's own indicator config.
   ========================================================================== */

type LevelKey = 'entry' | 'stop' | 't1' | 't2';

const LEVEL_META: {
  key: LevelKey;
  /** Field on the quant-signals `levels` payload. */
  field: 'entry' | 'stop_loss' | 'target_1' | 'target_2';
  label: string;
  /** Spoken form for the toggle's accessible name — "T2" alone tells a screen reader nothing. */
  longLabel: string;
  color: string;
  /** lightweight-charts LineStyle: 0 solid, 3 large-dashed. */
  lineStyle: 0 | 3;
  lineWidth: 1 | 2;
  /** Axis title. Kept short — it renders inside the price scale gutter. */
  title: string;
}[] = [
  { key: 'entry', field: 'entry', label: 'Entry', longLabel: 'entry', color: '#60A5FA', lineStyle: 0, lineWidth: 2, title: 'ENTRY' },
  { key: 'stop', field: 'stop_loss', label: 'Stop', longLabel: 'stop loss', color: '#F87171', lineStyle: 3, lineWidth: 2, title: 'STOP' },
  { key: 't1', field: 'target_1', label: 'T1', longLabel: 'target 1', color: '#34D399', lineStyle: 3, lineWidth: 1, title: 'T1' },
  { key: 't2', field: 'target_2', label: 'T2', longLabel: 'target 2', color: '#34D399', lineStyle: 3, lineWidth: 2, title: 'T2' },
];

const LEVELS_STORAGE_KEY = 'vanguard.terminal.levels.v1';

const ALL_LEVELS_ON: Record<LevelKey, boolean> = { entry: true, stop: true, t1: true, t2: true };

function loadStoredLevels(): Record<LevelKey, boolean> {
  try {
    const raw = window.localStorage.getItem(LEVELS_STORAGE_KEY);
    if (!raw) return ALL_LEVELS_ON;
    const parsed = JSON.parse(raw);
    // Merge over the defaults rather than trusting the payload: a stored blob
    // from an older build (or hand-edited storage) must not be able to drop a
    // key and make `visible[key]` undefined downstream.
    return LEVEL_META.reduce(
      (acc, { key }) => ({ ...acc, [key]: typeof parsed?.[key] === 'boolean' ? parsed[key] : true }),
      {} as Record<LevelKey, boolean>,
    );
  } catch {
    return ALL_LEVELS_ON;
  }
}

/**
 * The chart's level legend, and its control.
 *
 * It reads as a legend — swatch, name, price — because that is what it is
 * doing most of the time; the toggling is the same gesture a chart legend has
 * carried since before the web. Each chip states its own price so the plan is
 * legible without cross-referencing the panel below, and a level the solver
 * did not return is dropped rather than shown dead.
 */
function LevelToggles({ levels, visible, onToggle, onSetAll, currency }: {
  /** The quant-signals `levels` payload. Only the four price fields are read here. */
  levels: Partial<Record<(typeof LEVEL_META)[number]['field'], number | null>> | null | undefined;
  visible: Record<LevelKey, boolean>;
  onToggle: (key: LevelKey) => void;
  onSetAll: (on: boolean) => void;
  currency: string;
}) {
  if (!levels) return null;
  // A level the solver did not return has no chip: an "Entry —" toggle that
  // controls nothing is worse than one fewer control.
  const available = LEVEL_META.filter((m) => levels[m.field] != null);
  if (available.length === 0) return null;

  const shownCount = available.filter((m) => visible[m.key]).length;
  const allOn = shownCount === available.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-textMuted">
        Levels
      </span>
      {available.map((m) => {
        const on = visible[m.key];
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onToggle(m.key)}
            aria-pressed={on}
            // The visible label is "T1"; the accessible name says what it is
            // and what pressing does.
            aria-label={`${m.longLabel} line, ${on ? 'showing' : 'hidden'}`}
            title={`${on ? 'Hide' : 'Show'} ${m.longLabel} on the chart`}
            className={clsx(
              'group inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium transition-colors duration-150',
              on
                ? 'text-textPrimary'
                : 'border-borderSubtle bg-white/[0.02] text-textMuted hover:bg-white/[0.05] hover:text-textSecondary',
            )}
            style={on ? { borderColor: `${m.color}59`, backgroundColor: `${m.color}14` } : undefined}
          >
            {/* Swatch doubles as the state channel, so the on/off read does not
                rest on the border tint alone: a drawn rule when the line is on
                the chart, a hollow ring when it is not. It mirrors the actual
                line — dashed levels get a dashed swatch. */}
            <span
              aria-hidden
              className="h-0 w-3.5 shrink-0 rounded-full"
              style={{
                borderTopWidth: m.lineWidth,
                borderTopStyle: m.lineStyle === 3 ? 'dashed' : 'solid',
                borderTopColor: on ? m.color : 'rgba(148,163,184,0.35)',
              }}
            />
            {m.label}
            <span className={clsx('tabular', on ? 'text-textSecondary' : 'text-textMuted')}>
              {fmtUsd(levels[m.field], currency)}
            </span>
          </button>
        );
      })}
      {/* One control for the common case: clear the chart to read price, then
          put the plan back. Labelled by what it will DO, not by current state. */}
      <button
        type="button"
        onClick={() => onSetAll(!allOn)}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-medium text-textMuted transition-colors duration-150 hover:bg-white/[0.05] hover:text-textPrimary"
      >
        {allOn ? <EyeOff size={12} /> : <Eye size={12} />}
        {allOn ? 'Hide all' : 'Show all'}
      </button>
    </div>
  );
}

function ScreenerContent() {
  const searchParams = useSearchParams();
  const symbol = searchParams.get('q') || 'AAPL';
  const [timeframe, setTimeframe] = useState<TimeframeId>(DEFAULT_TIMEFRAME);
  const tf = TIMEFRAMES.find((t) => t.id === timeframe) ?? TIMEFRAMES[5];
  const [quote, setQuote] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [rangeNote, setRangeNote] = useState<string | null>(null);
  const [mlInsights, setMlInsights] = useState<any>(null);
  const [quantSignals, setQuantSignals] = useState<any>(null);
  const [tickerNews, setTickerNews] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  // Bumped by the error panel's Retry so the fetch effect re-runs without the
  // user having to re-navigate to the same symbol.
  const [retryNonce, setRetryNonce] = useState(0);

  // Which quant levels are drawn on the chart. Rehydrated in an effect rather
  // than a lazy initializer so the server and first client render agree —
  // reading localStorage during render would make the chips mismatch the SSR
  // HTML. `levelsHydrated` also guards the write-back, so the pre-rehydration
  // default can't clobber a saved preference.
  const [visibleLevels, setVisibleLevels] = useState<Record<LevelKey, boolean>>(ALL_LEVELS_ON);
  const [levelsHydrated, setLevelsHydrated] = useState(false);

  useEffect(() => {
    setVisibleLevels(loadStoredLevels());
    setLevelsHydrated(true);
  }, []);

  useEffect(() => {
    if (!levelsHydrated) return;
    try {
      window.localStorage.setItem(LEVELS_STORAGE_KEY, JSON.stringify(visibleLevels));
    } catch { /* storage full or blocked — the choice just won't persist */ }
  }, [visibleLevels, levelsHydrated]);

  const toggleLevel = (key: LevelKey) =>
    setVisibleLevels((prev) => ({ ...prev, [key]: !prev[key] }));
  const setAllLevels = (on: boolean) =>
    setVisibleLevels({ entry: on, stop: on, t1: on, t2: on });

  const { executeTrade, balance, positions } = usePortfolio();
  const [tradeShares, setTradeShares] = useState(1);
  const [tradeMessage, setTradeMessage] = useState('');
  const tradeMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const heldPosition = positions.find(p => p.symbol === symbol);

  const handleTrade = (type: 'BUY' | 'SELL') => {
    if (!quote?.regularMarketPrice) return;
    const result = executeTrade(symbol, type, tradeShares, quote.regularMarketPrice);
    setTradeMessage(result.message);
    // Track the timer so a rapid second trade doesn't get its confirmation
    // wiped early by the first trade's stale timeout.
    if (tradeMsgTimer.current) clearTimeout(tradeMsgTimer.current);
    tradeMsgTimer.current = setTimeout(() => setTradeMessage(''), 3000);
  };
  useEffect(() => () => { if (tradeMsgTimer.current) clearTimeout(tradeMsgTimer.current); }, []);

  useEffect(() => {
    // Cancellation guard: rapid symbol switches leave earlier batches in
    // flight; without this, a slow prior response overwrites the new symbol's
    // data — and a trade could execute at the WRONG symbol's price.
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      // Reset before fetching so a partial failure can never leave the
      // previous symbol's chart/signals rendered under the new symbol's name.
      setQuote(null);
      setChartData([]);
      setMlInsights(null);
      setQuantSignals(null);
      setTickerNews(null);
      setFetchError('');
      try {
        const [quoteRes, chartRes, mlRes, quantRes, newsRes] = await Promise.all([
          fetch(`${API_BASE}/api/quote?symbol=${symbol}`),
          fetch(`${API_BASE}/api/chart?symbol=${symbol}&interval=${tf.id}&range=${tf.range}`),
          fetch(`${API_BASE}/api/ml-insights?symbol=${symbol}`).catch(() => null),
          fetch(`${API_BASE}/api/quant-signals?symbol=${symbol}`).catch(() => null),
          fetch(`${API_BASE}/api/news-intel?symbol=${symbol}`).catch(() => null),
        ]);
        if (cancelled) return;

        const quoteData = await quoteRes.json();
        const chartRaw = await chartRes.json().catch(() => null);
        const mlData = mlRes ? await mlRes.json().catch(() => null) : null;
        const quantData = quantRes ? await quantRes.json().catch(() => null) : null;
        const newsData = newsRes ? await newsRes.json().catch(() => null) : null;
        if (cancelled) return;

        if (quoteRes.status === 429) {
          // Header first; JSON body as fallback (CORS now exposes Retry-After,
          // but the body works even without it)
          const retryAfter = quoteRes.headers.get('Retry-After')
            || (quoteData?.retry_after_seconds != null ? String(Math.ceil(quoteData.retry_after_seconds)) : null);
          setFetchError(`Rate limited. Too many requests. Try again in ${retryAfter || 'a few'} seconds.`);
        } else if (quoteData?.error) {
          setFetchError(`No market data for “${symbol}”. Check the symbol (NSE tickers need the .NS suffix) or try again shortly.`);
        } else {
          setQuote(quoteData);
        }
        setMlInsights(mlData && !mlData.error ? mlData : null);
        setQuantSignals(quantData && !quantData.error ? quantData : null);
        setTickerNews(newsData && !newsData.error ? newsData : null);

        if (chartRaw?.quotes) {
          // Intraday bars carry a NUMERIC unix seconds `time`; daily and coarser
          // carry a 'YYYY-MM-DD' string. Sorting both with new Date(time) is
          // wrong for the numeric case (Date treats a number as MILLIseconds),
          // so order on a normalized key instead.
          const sortKey = (t: unknown) =>
            typeof t === 'number' ? t : new Date(t as string).getTime() / 1000;

          const formattedData = chartRaw.quotes
            .filter((q: any) => q.close !== null && q.open !== null && q.time != null)
            .map((q: any) => ({
              time: q.time as any,
              open: q.open,
              high: q.high,
              low: q.low,
              close: q.close,
            }))
            .sort((a: any, b: any) => sortKey(a.time) - sortKey(b.time));

          // Dedupe adjacent equal timestamps in ONE pass. The previous
          // findIndex-inside-filter was O(n^2), which is fine for 252 daily bars
          // but not for the ~2500 bars a 1m timeframe returns.
          const deduped = formattedData.filter(
            (q: any, i: number) => i === 0 || q.time !== formattedData[i - 1].time,
          );
          setChartData(deduped);
          setRangeNote(
            chartRaw.range_clamped
              ? `${chartRaw.interval} data is capped at ${chartRaw.range} by the upstream (asked for ${chartRaw.requested_range})`
              : null,
          );
        }
      } catch (err) {
        console.error("Failed to fetch data", err);
        if (!cancelled) {
          setFetchError('Market data backend unreachable. Start it with: cd backend && python app.py');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (symbol) fetchData();
    return () => { cancelled = true; };
    // Switching timeframe refetches: interval and warm-up range both change.
  }, [symbol, tf.id, tf.range, retryNonce]);

  const levels = quantSignals?.levels;
  const sizing = quantSignals?.position_sizing;
  const ind = quantSignals?.indicators;
  const isBuy = quantSignals?.action === 'buy';
  const isSell = quantSignals?.action === 'sell';
  const signalColor = isBuy ? '#34D399' : isSell ? '#F87171' : '#FBBF24';
  const currency = quote?.currency || 'USD';

  // Stable identity so Chart's price-line effect only runs when the levels or
  // their visibility change, not on every keystroke in the trade form.
  const priceLines = useMemo(() => levels
    ? LEVEL_META
        .filter((m) => visibleLevels[m.key])
        .map((m) => ({
          price: levels[m.field],
          color: m.color,
          lineWidth: m.lineWidth,
          lineStyle: m.lineStyle,
          title: m.title,
          axisLabelVisible: true,
        }))
    : undefined, [levels, visibleLevels]);

  const suggestedShares = levels && sizing && quote?.regularMarketPrice
    ? Math.floor((balance * sizing.recommended_fraction) / quote.regularMarketPrice)
    : null;

  /* ------------------------------------------------------------------
     Trade guards.

     BUY and SELL previously took every click and reported the refusal
     afterwards, in a message that cleared itself after three seconds. The
     conditions are all knowable before the click, so the buttons state them:
     disabled, with the reason on the button and in the status line under it.

     `executeTrade` still validates — this is the interface agreeing with the
     rule, not replacing it.
     ------------------------------------------------------------------ */
  const price: number | undefined = quote?.regularMarketPrice;
  const orderValue = price != null ? price * tradeShares : 0;
  const heldShares = heldPosition?.shares ?? 0;

  const buyBlockedReason =
    price == null ? 'No live price for this symbol yet.'
    : orderValue > balance ? `Not enough cash — ${fmtUsd(orderValue, currency)} needed, ${fmtUsd(balance)} available.`
    : null;

  const sellBlockedReason =
    price == null ? 'No live price for this symbol yet.'
    : heldShares === 0 ? `You hold no ${symbol} to sell.`
    : tradeShares > heldShares ? `You hold ${heldShares} ${symbol}, fewer than the ${tradeShares} entered.`
    : null;

  const canBuy = buyBlockedReason === null;
  const canSell = sellBlockedReason === null;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 sm:px-6 lg:px-8">
      <div className="mb-6 flex justify-center">
        <SearchInput />
      </div>

      {loading ? (
        // Skeleton, not a spinner in an empty box. Five requests land at
        // different times and the page is tall, so a centred spinner both
        // understates how much is coming and collapses to nothing the instant
        // the first response arrives. These blocks stand where the real chart
        // panel and the panel grid will be, so nothing jumps on arrival.
        <div className="space-y-5" aria-busy="true" aria-label={`Loading ${symbol}`}>
          <div className="glass-panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="h-6 w-48 rounded bg-white/[0.07] motion-safe:animate-pulse" />
                <div className="h-3 w-24 rounded bg-white/[0.05] motion-safe:animate-pulse" />
              </div>
              <div className="h-9 w-40 rounded bg-white/[0.07] motion-safe:animate-pulse" />
            </div>
            <div className="mt-4 flex gap-2 border-t border-borderSubtle pt-3">
              <div className="h-8 w-56 rounded-lg bg-white/[0.05] motion-safe:animate-pulse" />
            </div>
            <div className="mt-4 h-[420px] rounded-lg bg-white/[0.04] motion-safe:animate-pulse" />
          </div>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="glass-panel h-56 motion-safe:animate-pulse" />
            ))}
          </div>
          <p className="text-center text-sm text-textSecondary">
            Loading market data and quant models for {symbol}…
          </p>
        </div>
      ) : fetchError ? (
        // An error state with no action is a dead end. Retry re-runs the same
        // effect via the nonce; the symbol is named so it is obvious what will
        // be retried.
        <div className="glass-panel flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
          <WifiOff size={22} className="text-accentAmber" />
          <p className="max-w-md text-sm leading-relaxed text-textSecondary">{fetchError}</p>
          <button
            type="button"
            onClick={() => setRetryNonce((n) => n + 1)}
            className="mt-1 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-borderSubtle px-3 text-xs font-medium text-textSecondary transition-colors duration-150 hover:bg-white/5 hover:text-textPrimary"
          >
            <RotateCw size={12} /> Retry {symbol}
          </button>
        </div>
      ) : fetchError ? (
        <div className="glass-panel flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
          <WifiOff size={22} className="text-accentAmber" />
          <p className="max-w-md text-sm leading-relaxed text-textSecondary">{fetchError}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* ---- Full-width chart ---- */}
          <div className="glass-panel p-5">
            {/* Two rows, not one.
                The header used to run identity → timeframe → price as three
                peers in a single wrap row, which put the largest number on the
                page in the middle of two control groups and let it reflow to a
                new line first on any narrow viewport. Identity and price are
                what you read; timeframe and levels are what you operate. So
                the readout owns the top row and the controls own the one under
                it, separated by a hairline. */}
            <div className="mb-4">
              <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-semibold text-textPrimary">
                    {quote?.shortName || symbol}
                  </h2>
                  <span className="font-mono text-xs uppercase tracking-widest text-textMuted">{symbol}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
                  <span className="text-3xl font-bold tabular text-textPrimary">
                    {fmtUsd(quote?.regularMarketPrice, currency)}
                  </span>
                  {quote?.regularMarketChangePercent !== undefined && (
                    <span className={clsx(
                      'whitespace-nowrap rounded-md px-2 py-1 text-sm font-semibold tabular',
                      quote.regularMarketChangePercent >= 0
                        ? 'bg-emerald-400/10 text-accentGreen'
                        : 'bg-red-400/10 text-accentRed'
                    )}>
                      {quote.regularMarketChangePercent >= 0 ? '+' : ''}
                      {quote.regularMarketChangePercent?.toFixed(2)}%
                    </span>
                  )}
                  {quantSignals && (
                    <span
                      className="whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-bold"
                      style={{ color: signalColor, background: `${signalColor}1a` }}
                    >
                      {quantSignals.signal}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-borderSubtle pt-3">
                {/* Timeframe selector. Mono + tabular so the widths don't jitter
                    between labels as the active chip changes. */}
                <div
                  role="group"
                  aria-label="Chart timeframe"
                  className="flex items-center gap-0.5 rounded-lg border border-borderSubtle bg-white/[0.03] p-0.5"
                >
                  {TIMEFRAMES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTimeframe(t.id)}
                      aria-pressed={timeframe === t.id}
                      className={clsx(
                        'min-h-8 rounded-md px-2.5 font-mono text-[11px] font-semibold tabular transition-colors duration-150',
                        timeframe === t.id
                          ? 'bg-accentGreen/15 text-accentGreen'
                          : 'text-textSecondary hover:bg-white/[0.05] hover:text-textPrimary',
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Level legend + visibility control. Lives with the chart
                    because it governs what the chart draws — the plan panel
                    below states the same numbers but is a readout, not a
                    control surface. */}
                <LevelToggles
                  levels={levels}
                  visible={visibleLevels}
                  onToggle={toggleLevel}
                  onSetAll={setAllLevels}
                  currency={currency}
                />
              </div>
            </div>
            {rangeNote && (
              <p className="mb-2 font-mono text-[11px] text-textMuted">{rangeNote}</p>
            )}
            {chartData.length > 0 ? (
              <Chart
                data={chartData}
                visibleBars={tf.visibleBars}
                height={560}
                symbol={symbol}
                colors={{
                  upColor: '#34D399',
                  downColor: '#F87171',
                  priceLines,
                }}
              />
            ) : (
              <p className="py-12 text-center text-textSecondary">No chart data available.</p>
            )}
          </div>

          {/* Quant Trade Plan */}
          {quantSignals && levels && (
            <div className="glass-panel p-5" style={{ borderTop: `2px solid ${signalColor}` }}>
              <div className="mb-4 flex items-center justify-between border-b border-borderSubtle pb-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
                  <Crosshair size={15} style={{ color: signalColor }} /> Quant Trade Plan
                  <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-textMuted">
                    Systematic multi-factor
                  </span>
                </h3>
                <div className="text-xs text-textMuted">
                  Conviction <span className="font-semibold tabular text-textPrimary">{(quantSignals.conviction * 100).toFixed(0)}%</span>
                  {' · '}Score <span className="font-semibold tabular" style={{ color: signalColor }}>{quantSignals.composite_score > 0 ? '+' : ''}{quantSignals.composite_score}</span>
                </div>
              </div>

              {/* Four cards, one per level, driven off LEVEL_META so the colour,
                  line style and chart wiring can't drift from the legend above.
                  R multiples come from the solver, not fixed at 1.5/3 — printing
                  constants here would misreport the actual plan. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {LEVEL_META.map((m) => {
                  const price = levels[m.field];
                  if (price == null) return null;
                  const on = visibleLevels[m.key];

                  const heading =
                    m.key === 'entry' ? 'Entry (limit)'
                    : m.key === 'stop' ? 'Stop Loss'
                    : m.key === 't1' ? `Target 1${levels.r_multiple_1 != null ? ` (${levels.r_multiple_1.toFixed(2)}R)` : ''}`
                    : `Target 2${levels.r_multiple_2 != null ? ` (${levels.r_multiple_2.toFixed(2)}R)` : ''}`;

                  const icon =
                    m.key === 'entry' ? <Crosshair size={11} />
                    : m.key === 'stop' ? <ShieldAlert size={11} />
                    : <Target size={11} />;

                  // The one number under each level that says how the solver
                  // got there: fill odds for a limit, the ATR multiple for a
                  // stop, hit probability for T1, expectancy for T2.
                  const footnote =
                    m.key === 'entry' && levels.fill_probability != null ? (
                      <><span className="tabular">{(levels.fill_probability * 100).toFixed(0)}%</span> fill in 5d</>
                    ) : m.key === 'stop' && levels.atr_stop_mult != null ? (
                      <><span className="tabular">{levels.atr_stop_mult.toFixed(2)}</span>× ATR / swing</>
                    ) : m.key === 't1' && levels.win_probability != null ? (
                      <><span className="tabular">{(levels.win_probability * 100).toFixed(0)}%</span> hit before stop</>
                    ) : m.key === 't2' && levels.expectancy_r != null ? (
                      <>expectancy <span className="tabular">{levels.expectancy_r > 0 ? '+' : ''}{levels.expectancy_r.toFixed(2)}</span>R</>
                    ) : null;

                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => toggleLevel(m.key)}
                      aria-pressed={on}
                      aria-label={`${m.longLabel}, ${on ? 'showing on chart' : 'hidden from chart'}`}
                      title={`${on ? 'Hide' : 'Show'} ${m.longLabel} on the chart`}
                      className={clsx(
                        // A card that toggles has to look pressable, so it is a
                        // real button with a hover state — not a div with an
                        // onClick, which reaches neither Tab nor Enter.
                        'group relative rounded-xl border p-3 text-left transition-colors duration-150',
                        on ? 'hover:brightness-110' : 'border-borderSubtle bg-white/[0.02] hover:bg-white/[0.05]',
                      )}
                      style={on ? { borderColor: `${m.color}40`, backgroundColor: `${m.color}0d` } : undefined}
                    >
                      <div
                        className="flex items-center gap-1.5 text-[11px]"
                        style={{ color: on ? m.color : 'var(--text-muted)' }}
                      >
                        {icon} {heading}
                      </div>
                      {/* The number stays at full strength when the line is
                          hidden. Hiding a rule on the chart is a viewport
                          decision; it does not make the level less true, and
                          dimming the figure would say otherwise. */}
                      <div className="mt-1 text-lg font-bold tabular text-textPrimary">
                        {fmtUsd(price, currency)}
                      </div>
                      {footnote && <div className="mt-0.5 text-[10px] text-textMuted">{footnote}</div>}

                      {/* State marker, top-right: a filled dot when the level is
                          on the chart, an empty ring when it is not. Pairs with
                          the legend chips above so both affordances read the
                          same state at a glance. */}
                      <span
                        aria-hidden
                        className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full border transition-colors duration-150"
                        style={{
                          backgroundColor: on ? m.color : 'transparent',
                          borderColor: on ? m.color : 'rgba(148,163,184,0.4)',
                        }}
                      />
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[11px] text-textMuted">
                Select a level to show or hide its line on the chart.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold font-mono uppercase tracking-wider text-textMuted">Factor votes</h4>
                  {quantSignals.factors && Object.entries(quantSignals.factors).map(([k, v]) => (
                    <FactorBar key={k} label={k} value={v as number} />
                  ))}
                </div>
                <div>
                  <h4 className="mb-1.5 text-[11px] font-semibold font-mono uppercase tracking-wider text-textMuted">Position sizing (half-Kelly)</h4>
                  <StatRow label="Kelly fraction" value={`${(sizing.kelly_fraction * 100).toFixed(1)}%`} />
                  <StatRow label="Recommended allocation" value={`${(sizing.recommended_fraction * 100).toFixed(1)}% of equity`} valueClass="text-accentCyan" />
                  <StatRow label="Historical win rate" value={`${(sizing.win_rate * 100).toFixed(1)}%`} />
                  <StatRow label="Payoff ratio" value={`${sizing.payoff_ratio}×`} />
                  {suggestedShares !== null && suggestedShares > 0 && (
                    <StatRow label="Suggested size" value={`≈ ${suggestedShares} shares`} valueClass="text-accentGreen" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---- Secondary panels ---- */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {/* Paper trading */}
            <Panel title="Paper Trading" icon={<Gauge size={15} className="text-accentGreen" />} accent="#34D399">
              <StatRow label="Available Cash" value={fmtUsd(balance)} valueClass="text-accentGreen font-bold" />
              {heldPosition && (
                <StatRow
                  label={`Held (${heldPosition.shares} sh)`}
                  value={`avg ${fmtUsd(heldPosition.averagePrice)}`}
                />
              )}
              <div className="mt-3">
                <label
                  htmlFor="trade-shares"
                  className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-textMuted"
                >
                  Size
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="trade-shares"
                    type="number"
                    min="1"
                    value={tradeShares}
                    onChange={(e) => setTradeShares(Math.max(1, parseInt(e.target.value) || 1))}
                    // min-h-11 matches the BUY/SELL buttons below: an input one
                    // size down from the button it sits above is the classic
                    // form-tuning tell, and it was 38px against their 44px.
                    className="min-h-11 w-full rounded-lg border border-borderSubtle bg-black/30 px-3 text-sm tabular text-textPrimary transition-colors duration-150 hover:border-borderStrong focus:border-accentGreen/50"
                  />
                  <span className="text-sm text-textMuted">shares</span>
                </div>
              </div>
              {suggestedShares !== null && suggestedShares > 0 && (
                <button
                  type="button"
                  onClick={() => setTradeShares(suggestedShares)}
                  className="mt-2 min-h-9 w-full rounded-lg border border-accentCyan/30 bg-accentCyan/5 text-xs text-accentCyan transition-colors duration-150 hover:bg-accentCyan/10"
                >
                  Use quant-suggested size ({suggestedShares} shares)
                </button>
              )}

              {/* Order cost, stated before the button rather than discovered
                  after it. This is the number that decides whether BUY is even
                  possible, so it belongs in front of the decision. */}
              {quote?.regularMarketPrice != null && (
                <div className="mt-3 flex items-baseline justify-between border-t border-borderSubtle pt-3 text-[13px]">
                  <span className="text-textSecondary">Order value</span>
                  <span
                    className={clsx(
                      'font-semibold tabular',
                      orderValue > balance ? 'text-accentAmber' : 'text-textPrimary',
                    )}
                  >
                    {fmtUsd(orderValue, currency)}
                  </span>
                </div>
              )}

              <div className="mt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => handleTrade('BUY')}
                  disabled={!canBuy}
                  // Three channels on disabled, not opacity alone: the native
                  // attribute (so it leaves the tab order and cannot fire), the
                  // not-allowed cursor, and a flattened surface. `blockedReason`
                  // is the title so hovering says WHY, and the line under the
                  // pair says it without a hover.
                  title={buyBlockedReason ?? 'Buy at the current market price'}
                  className={clsx(
                    'min-h-11 flex-1 rounded-lg font-bold transition-[filter,background-color,color] duration-150',
                    canBuy
                      ? 'bg-accentGreen text-black hover:brightness-110 active:brightness-95'
                      : 'cursor-not-allowed bg-accentGreen/20 text-black/40',
                  )}
                >
                  BUY
                </button>
                <button
                  type="button"
                  onClick={() => handleTrade('SELL')}
                  disabled={!canSell}
                  title={sellBlockedReason ?? 'Sell at the current market price'}
                  className={clsx(
                    'min-h-11 flex-1 rounded-lg font-bold transition-[filter,background-color,color] duration-150',
                    canSell
                      ? 'bg-accentRed text-black hover:brightness-110 active:brightness-95'
                      : 'cursor-not-allowed bg-accentRed/20 text-black/40',
                  )}
                >
                  SELL
                </button>
              </div>

              {/* One reserved slot for the status line, so an arriving message
                  never pushes the panel's height and shifts the grid under it.
                  A blocked reason shows here when nothing has been submitted
                  yet — naming the problem before the click, not after. */}
              <p
                aria-live="polite"
                className={clsx(
                  'mt-3 min-h-[1.25rem] text-center text-xs',
                  tradeMessage
                    ? tradeMessage.includes('Success') ? 'text-accentGreen' : 'text-accentRed'
                    : 'text-textMuted',
                )}
              >
                {tradeMessage || buyBlockedReason || sellBlockedReason || ''}
              </p>
            </Panel>

            {/* Technical indicators */}
            {ind && (
              <Panel title="Technical Readout" icon={<Gauge size={15} className="text-accentBlue" />}>
                <StatRow
                  label="RSI (14)"
                  value={ind.rsi_14}
                  valueClass={ind.rsi_14 >= 70 ? 'text-accentRed' : ind.rsi_14 <= 30 ? 'text-accentGreen' : undefined}
                />
                <StatRow label="Z-Score (20d)" value={ind.zscore_20d} valueClass={Math.abs(ind.zscore_20d) > 2 ? 'text-accentAmber' : undefined} />
                {ind.half_life_days && <StatRow label="Mean-reversion half-life" value={`${ind.half_life_days}d`} />}
                <StatRow label="VWAP (20d)" value={fmtUsd(ind.vwap_20d, currency)} />
                <StatRow
                  label="VWAP deviation"
                  value={`${ind.vwap_deviation_pct > 0 ? '+' : ''}${ind.vwap_deviation_pct}%`}
                  valueClass={ind.vwap_deviation_pct >= 0 ? 'text-accentGreen' : 'text-accentRed'}
                />
                <StatRow label="ATR (14)" value={fmtUsd(ind.atr_14, currency)} />
                <StatRow label="Realized vol (ann.)" value={`${(ind.realized_vol_annual * 100).toFixed(1)}%`} />
                <StatRow label="Vol regime percentile" value={`${ind.vol_regime_percentile}%`} />
                <StatRow label="Bollinger %B" value={ind.bollinger_pct_b} />
                <StatRow label="Volume imbalance (10d)" value={ind.volume_imbalance} valueClass={ind.volume_imbalance > 0.5 ? 'text-accentGreen' : 'text-accentRed'} />
              </Panel>
            )}

            {/* ML insights */}
            {mlInsights && (
              <Panel title="ML Forecasts" icon={<BrainCircuit size={15} className="text-accentPurple" />} accent="#A78BFA">
                <StatRow
                  label="Next-day direction (XGBoost)"
                  value={`${(mlInsights.xgboost_probability * 100).toFixed(1)}% ${mlInsights.xgboost_probability >= 0.5 ? 'UP' : 'DOWN'}`}
                  valueClass={mlInsights.xgboost_probability >= 0.5 ? 'text-accentGreen' : 'text-accentRed'}
                />
                <StatRow
                  label="7-day forecast (Prophet)"
                  value={fmtUsd(mlInsights.prophet_7d_forecast, currency)}
                  valueClass={mlInsights.prophet_7d_forecast > quote?.regularMarketPrice ? 'text-accentGreen' : 'text-accentRed'}
                />
                <div className="mt-3">
                  <div className="mb-1.5 flex justify-between text-[11px] text-textMuted">
                    <span>News sentiment index</span>
                    <span className="font-bold text-textPrimary">{mlInsights.fear_greed_index}/100</span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-700"
                      style={{
                        width: `${mlInsights.fear_greed_index}%`,
                        background: 'linear-gradient(90deg, #F87171 0%, #FBBF24 50%, #34D399 100%)',
                      }}
                    />
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-textMuted">
                    <span>Fear</span><span>Greed</span>
                  </div>
                </div>
              </Panel>
            )}

            {/* Key stats */}
            <Panel title="Key Statistics" icon={<Gauge size={15} className="text-textSecondary" />}>
              <StatRow label="Market Cap" value={quote?.marketCap ? (quote.marketCap / 1e9).toFixed(2) + 'B' : '—'} />
              <StatRow label="Volume" value={quote?.regularMarketVolume ? (quote.regularMarketVolume / 1e6).toFixed(2) + 'M' : '—'} />
              <StatRow label="Avg Volume (3mo)" value={quote?.averageDailyVolume3Month ? (quote.averageDailyVolume3Month / 1e6).toFixed(2) + 'M' : '—'} />
              <StatRow label="52W High" value={fmtUsd(quote?.fiftyTwoWeekHigh, currency)} />
              <StatRow label="52W Low" value={fmtUsd(quote?.fiftyTwoWeekLow, currency)} />
            </Panel>

            {/* Multi-source news intelligence */}
            <NewsIntelPanel data={tickerNews} />
          </div>
        </div>
      )}

      {/* ---- Deep analysis: verdict, fundamentals x-ray, AI research note ----
          Gated on !fetchError too: an unknown symbol or outage must not render
          a contradictory HOLD verdict beneath the error panel. */}
      {!loading && !fetchError && (
        <div className="mt-5">
          <DeepAnalysisSection symbol={symbol} currency={currency} />
        </div>
      )}
    </div>
  );
}

export default function ScreenerPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="pt-28">
        <Suspense fallback={<div className="p-8 text-center text-textSecondary">Loading…</div>}>
          <ScreenerContent />
        </Suspense>
      </div>
    </div>
  );
}
