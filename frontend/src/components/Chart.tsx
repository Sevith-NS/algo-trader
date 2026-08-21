"use client";
import { useEffect, useRef, useState } from 'react';
import {
  createChart, ColorType, IChartApi, ISeriesApi, IPriceLine, LineStyle,
  CandlestickSeries, LineSeries, HistogramSeries, LineSeriesPartialOptions, Time,
} from 'lightweight-charts';
import { ema, bollinger, macd, rsi } from '../lib/indicators';
import { CHART_INTERACTION_FREE, DrawingHint, DrawingRail, useChartDrawings } from './ChartDrawings';
import { migrateLegacyStorageKeys } from '../lib/legacyStorage';

// ---------------------------------------------------------------------------
// Indicator configuration
// ---------------------------------------------------------------------------

interface IndicatorConfig {
  ema: { on: boolean; period: number };
  ribbon: { on: boolean; periods: [number, number, number, number] };
  bb: { on: boolean; period: number; mult: number };
  macd: { on: boolean; fast: number; slow: number; signal: number };
  rsi: { on: boolean; period: number };
}

type IndicatorKey = keyof IndicatorConfig;

const STORAGE_KEY = 'flint.chart.indicators.v1';

const DEFAULT_CONFIG: IndicatorConfig = {
  ema: { on: false, period: 21 },
  ribbon: { on: false, periods: [20, 50, 100, 200] },
  bb: { on: false, period: 20, mult: 2 },
  macd: { on: false, fast: 12, slow: 26, signal: 9 },
  rsi: { on: false, period: 14 },
};

const PERIOD_MIN = 2;
const PERIOD_MAX = 500;
const MULT_MIN = 0.5;
const MULT_MAX = 4;

const clampPeriod = (v: number) =>
  Math.min(PERIOD_MAX, Math.max(PERIOD_MIN, Math.round(v)));
const clampMult = (v: number) => Math.min(MULT_MAX, Math.max(MULT_MIN, v));

// One accent per indicator so the toolbar chip, its overlay, and its pane all
// read as the same object (colors from tailwind.config.js accents).
const CHIP_META: { key: IndicatorKey; label: string; color: string }[] = [
  { key: 'ema', label: 'EMA', color: '#FBBF24' },      // accentAmber
  { key: 'ribbon', label: 'EMA Ribbon', color: '#34D399' }, // accentGreen
  { key: 'bb', label: 'Bollinger', color: '#22D3EE' },  // accentCyan
  { key: 'macd', label: 'MACD', color: '#60A5FA' },     // accentBlue
  { key: 'rsi', label: 'RSI', color: '#A78BFA' },       // accentPurple
];

const RIBBON_COLORS = ['#34D399', '#60A5FA', '#A78BFA', '#F87171'];

// ---------------------------------------------------------------------------
// Wheel-to-zoom (TradingView behaviour)
// ---------------------------------------------------------------------------

/** Never let the view collapse below this many bars, or zoom past ~50x the series. */
const MIN_VISIBLE_BARS = 8;
const MAX_VISIBLE_BARS_FACTOR = 50;

/** How aggressively one wheel notch zooms. Tuned so a standard 100px notch is ~15%. */
const ZOOM_SENSITIVITY = 0.0015;

/**
 * Wheel deltas arrive in three different units depending on the device and OS.
 * Normalising to pixels first is what keeps a Magic Mouse, a Logitech notch
 * wheel and a Windows "scroll by page" setting all zooming at a sane rate.
 */
function wheelPixels(delta: number, mode: number): number {
  if (mode === 1) return delta * 16;   // DOM_DELTA_LINE
  if (mode === 2) return delta * 400;  // DOM_DELTA_PAGE
  return delta;                        // DOM_DELTA_PIXEL
}

function loadStoredConfig(): IndicatorConfig {
  try {
    migrateLegacyStorageKeys();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const p = JSON.parse(raw);
    // Deep-merge over defaults so a stale or hand-edited payload can never
    // crash rendering — every field falls back to a known-good value.
    const num = (v: unknown, fallback: number, clamp: (n: number) => number) =>
      typeof v === 'number' && Number.isFinite(v) ? clamp(v) : fallback;
    return {
      ema: {
        on: !!p?.ema?.on,
        period: num(p?.ema?.period, DEFAULT_CONFIG.ema.period, clampPeriod),
      },
      ribbon: {
        on: !!p?.ribbon?.on,
        periods: DEFAULT_CONFIG.ribbon.periods.map((d, i) =>
          num(p?.ribbon?.periods?.[i], d, clampPeriod)
        ) as [number, number, number, number],
      },
      bb: {
        on: !!p?.bb?.on,
        period: num(p?.bb?.period, DEFAULT_CONFIG.bb.period, clampPeriod),
        mult: num(p?.bb?.mult, DEFAULT_CONFIG.bb.mult, clampMult),
      },
      macd: {
        on: !!p?.macd?.on,
        fast: num(p?.macd?.fast, DEFAULT_CONFIG.macd.fast, clampPeriod),
        slow: num(p?.macd?.slow, DEFAULT_CONFIG.macd.slow, clampPeriod),
        signal: num(p?.macd?.signal, DEFAULT_CONFIG.macd.signal, clampPeriod),
      },
      rsi: {
        on: !!p?.rsi?.on,
        period: num(p?.rsi?.period, DEFAULT_CONFIG.rsi.period, clampPeriod),
      },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

// Compact parameter summary shown on the settings affordance, e.g. "EMA 21".
function chipSummary(key: IndicatorKey, config: IndicatorConfig): string {
  switch (key) {
    case 'ema': return `EMA ${config.ema.period}`;
    case 'ribbon': return config.ribbon.periods.join('·');
    case 'bb': return `${config.bb.period}, ${config.bb.mult}σ`;
    case 'macd': return `${config.macd.fast}·${config.macd.slow}·${config.macd.signal}`;
    case 'rsi': return `RSI ${config.rsi.period}`;
  }
}

// Uncontrolled number input that commits on blur/Enter; invalid text keeps
// the previous value (the input snaps back), out-of-range values clamp.
function ParamInput({ label, value, min, max, step, onCommit }: {
  label: string; value: number; min: number; max: number; step?: number;
  onCommit: (v: number) => void;
}) {
  const commit = (el: HTMLInputElement) => {
    const parsed = parseFloat(el.value);
    if (!Number.isFinite(parsed)) {
      el.value = String(value);
      return;
    }
    const clamped = Math.min(max, Math.max(min, step === undefined ? Math.round(parsed) : parsed));
    el.value = String(clamped);
    if (clamped !== value) onCommit(clamped);
  };
  return (
    <label className="flex items-center justify-between gap-3 py-1">
      <span className="text-[11px] text-textSecondary">{label}</span>
      <input
        type="number"
        defaultValue={value}
        min={min}
        max={max}
        step={step ?? 1}
        onBlur={(e) => commit(e.currentTarget)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className="w-20 rounded border border-borderSubtle bg-black/30 px-2 py-1 text-right text-xs tabular text-textPrimary focus:border-white/30"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

interface ChartProps {
  /**
   * Full series INCLUDING warm-up bars that sit before the intended view.
   * Indicators are computed over all of it, which is what makes a long overlay
   * (EMA 200) continuous across every visible bar instead of starting 200 bars
   * into the chart.
   */
  data: { time: Time; open: number; high: number; low: number; close: number }[];
  /**
   * How many trailing bars to actually show. The bars before this are loaded
   * purely to warm the indicators up and are scrolled off-screen (the user can
   * still pan back into them). Omit to fit the whole series.
   */
  visibleBars?: number;
  height?: number;
  /**
   * Instrument the drawings belong to. Drawings are stored in (time, price)
   * space under this key, so they follow the symbol across timeframe switches
   * and reloads — and never bleed from one ticker onto another. Omit and they
   * fall into a shared scratch scope.
   */
  symbol?: string;
  /** Set false to drop the drawing rail + overlay (e.g. a thumbnail widget). */
  drawingTools?: boolean;
  colors?: {
    backgroundColor?: string;
    textColor?: string;
    upColor?: string;
    downColor?: string;
    borderUpColor?: string;
    borderDownColor?: string;
    wickUpColor?: string;
    wickDownColor?: string;
    priceLines?: any[];
  };
}

export default function Chart({
  data, visibleBars, height = 400, symbol, drawingTools = true, colors = {},
}: ChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartWrapRef = useRef<HTMLDivElement>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const priceLineRefs = useRef<IPriceLine[]>([]);

  const [config, setConfig] = useState<IndicatorConfig>(DEFAULT_CONFIG);
  // Bumped after every chart rebuild so the price-line effect re-applies its
  // lines to the FRESH candlestick series — without this, quant levels
  // (ENTRY/STOP/T1/T2) vanish on any indicator toggle/param edit because the
  // rebuild replaces the series but [colors.priceLines, data] never changed.
  const [rebuildEpoch, setRebuildEpoch] = useState(0);
  // Rehydration happens in an effect (not a lazy initializer) so the server
  // and first client render agree — reading localStorage during render would
  // make the chip styling mismatch the SSR HTML.
  const [hydrated, setHydrated] = useState(false);
  const [openPopover, setOpenPopover] = useState<IndicatorKey | null>(null);

  useEffect(() => {
    setConfig(loadStoredConfig());
    setHydrated(true);
  }, []);

  useEffect(() => {
    // Guard on hydrated so the pre-rehydration default state can't clobber
    // what the user previously saved.
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch { /* storage full or blocked — config just won't persist */ }
  }, [config, hydrated]);

  // Close the open popover on outside click / Escape. Clicks inside the open
  // chip group (its popover, its settings button) are left alone so the
  // settings button's own onClick can toggle it closed.
  useEffect(() => {
    if (!openPopover) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target?.closest(`[data-chip-group="${openPopover}"]`)) setOpenPopover(null);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenPopover(null);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openPopover]);

  const setIndicator = <K extends IndicatorKey>(key: K, patch: Partial<IndicatorConfig[K]>) =>
    setConfig(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  // The drawing layer reads chartRef/seriesRef per frame rather than holding
  // them, so it rides out the chart rebuilds that indicator edits trigger;
  // rebuildEpoch tells it to re-apply the pan/zoom lock to the new instance.
  const draw = useChartDrawings({
    chartRef,
    seriesRef,
    wrapRef: chartWrapRef,
    canvasRef: drawCanvasRef,
    data,
    symbol,
    epoch: rebuildEpoch,
    enabled: drawingTools,
  });

  const {
    backgroundColor = 'transparent',
    textColor = '#94A3B8',
    upColor = '#00FF88',
    downColor = '#FF3366',
    borderUpColor = '#00FF88',
    borderDownColor = '#FF3366',
    wickUpColor = '#00FF88',
    wickDownColor = '#FF3366',
  } = colors;

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: backgroundColor },
        textColor,
      },
      // autoSize: the chart runs its own ResizeObserver on the container, so
      // it tracks react-grid-layout widget resizes, not just window resizes.
      // `height` is only the fallback if ResizeObserver is unavailable — the
      // real height comes from the container div's explicit style height.
      autoSize: true,
      height,
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      timeScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.1)',
      },
      // Wheel zoom is driven by our own handler on the wrapper (see the wheel
      // effect below) rather than by the library. The library binds its
      // listener to ITS canvas, which the drawing overlay covers whenever a
      // tool is active — so with the built-in handler the wheel would silently
      // stop zooming the moment you picked up the trendline tool.
      ...CHART_INTERACTION_FREE,
    });

    // Candles live in pane 0 (v5: addSeries(definition, options, paneIndex)).
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor,
      downColor,
      borderVisible: false,
      wickUpColor,
      wickDownColor,
    });
    candleSeries.setData(data);

    const closes = data.map(d => d.close);

    // Skip warm-up bars entirely — substituting the close price here is the
    // old head-padding bug indicators.ts exists to kill.
    const toLineData = (values: (number | undefined)[]) => {
      const points: { time: Time; value: number }[] = [];
      for (let i = 0; i < values.length; i++) {
        const v = values[i];
        if (v !== undefined) points.push({ time: data[i].time, value: v });
      }
      return points;
    };

    const addOverlayLine = (
      points: { time: Time; value: number }[],
      options: LineSeriesPartialOptions,
      paneIndex = 0,
    ) => {
      const series = chart.addSeries(LineSeries, {
        crosshairMarkerVisible: false,
        priceLineVisible: false,
        lastValueVisible: false,
        ...options,
      }, paneIndex);
      series.setData(points);
      return series;
    };

    // ---- Pane 0 overlays ----
    if (config.ema.on) {
      addOverlayLine(toLineData(ema(closes, config.ema.period)), {
        color: '#FBBF24', lineWidth: 2, title: `EMA ${config.ema.period}`,
      });
    }

    if (config.ribbon.on) {
      config.ribbon.periods.forEach((period, i) => {
        addOverlayLine(toLineData(ema(closes, period)), {
          color: RIBBON_COLORS[i], lineWidth: 1, title: `EMA ${period}`,
        });
      });
    }

    if (config.bb.on) {
      const bands = bollinger(closes, config.bb.period, config.bb.mult);
      const bbColor = 'rgba(34, 211, 238, 0.6)'; // accentCyan @ 60%
      addOverlayLine(toLineData(bands.upper), { color: bbColor, lineWidth: 1 });
      addOverlayLine(toLineData(bands.middle), { color: bbColor, lineWidth: 1, lineStyle: LineStyle.Dashed });
      addOverlayLine(toLineData(bands.lower), { color: bbColor, lineWidth: 1 });
    }

    // ---- Sub-panes (indices assigned in display order) ----
    // A pane is only created when its indicator has at least one drawable
    // point: a period >= the data length yields zero points, and an empty
    // pane would still steal ~25% of the chart height as a dead strip.
    let nextPane = 1;

    if (config.rsi.on) {
      const rsiPoints = toLineData(rsi(closes, config.rsi.period));
      if (rsiPoints.length > 0) {
        const rsiSeries = addOverlayLine(rsiPoints, {
          color: '#A78BFA', lineWidth: 2, title: `RSI ${config.rsi.period}`,
          lastValueVisible: true,
        }, nextPane++);
        // Overbought/oversold guides drawn as price lines on the RSI series.
        for (const level of [30, 70]) {
          rsiSeries.createPriceLine({
            price: level,
            color: 'rgba(167, 139, 250, 0.45)',
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: '',
          });
        }
      }
    }

    if (config.macd.on) {
      const result = macd(closes, config.macd.fast, config.macd.slow, config.macd.signal);
      // The signal/histogram are warm-up subsets of the MACD line, so the
      // line's points decide whether this pane exists at all.
      const macdPoints = toLineData(result.macd);
      if (macdPoints.length > 0) {
        const macdPane = nextPane++;
        const histSeries = chart.addSeries(HistogramSeries, {
          priceLineVisible: false,
          lastValueVisible: false,
        }, macdPane);
        const histData: { time: Time; value: number; color: string }[] = [];
        result.histogram.forEach((v, i) => {
          if (v !== undefined) {
            histData.push({
              time: data[i].time,
              value: v,
              color: v >= 0 ? 'rgba(52, 211, 153, 0.55)' : 'rgba(248, 113, 113, 0.55)',
            });
          }
        });
        histSeries.setData(histData);
        addOverlayLine(macdPoints, { color: '#60A5FA', lineWidth: 2, title: 'MACD', lastValueVisible: true }, macdPane);
        addOverlayLine(toLineData(result.signal), { color: '#FBBF24', lineWidth: 1, title: 'Signal' }, macdPane);
      }
    }

    // Keep the price pane dominant: ~70% with one sub-pane, ~2/3 with both
    // (v5 stretch factors are proportional shares of the total height).
    const panes = chart.panes();
    if (panes.length > 1) {
      panes[0].setStretchFactor(panes.length === 2 ? 2.4 : 4);
      for (let i = 1; i < panes.length; i++) panes[i].setStretchFactor(1);
    }

    // Show only the trailing window when the caller supplied warm-up bars.
    // fitContent() would zoom out to include them, defeating the point: the
    // warm-up exists so the indicator line is already established at the left
    // edge of the VIEW, not so the user has to look at 4 extra years of price.
    if (visibleBars && visibleBars < data.length) {
      chart.timeScale().setVisibleLogicalRange({
        from: data.length - visibleBars,
        to: data.length,
      });
    } else {
      chart.timeScale().fitContent();
    }

    chartRef.current = chart;
    seriesRef.current = candleSeries;
    priceLineRefs.current = [];
    // Tell the price-line effect a fresh series exists so it re-applies the
    // quant levels — its own deps (priceLines identity, data) don't change on
    // an indicator toggle, so without this bump the lines would just vanish.
    setRebuildEpoch(e => e + 1);

    return () => {
      chartRef.current = null;
      seriesRef.current = null;
      priceLineRefs.current = [];
      chart.remove();
    };
    // NOTE: priceLines deliberately excluded — applying them is handled by the
    // effect below. Including the (new-identity-every-render) array here used
    // to tear down and rebuild the whole chart on every parent re-render,
    // resetting the user's pan/zoom while they typed in the trade form.
    // `config` IS included: a toggle/param change rebuilds the chart, which is
    // the accepted behavior (same as the old SMA button).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, visibleBars, height, backgroundColor, textColor, upColor, downColor, borderUpColor, borderDownColor, wickUpColor, wickDownColor, config]);

  // ---- Wheel: zoom the chart, never the page ----------------------------
  // Bound to the WRAPPER (not the library's canvas) so it keeps working when
  // the drawing overlay sits on top, and registered once for the component's
  // lifetime — it reads chartRef per event, so chart rebuilds don't affect it.
  //
  // Two things have to be stopped for the page to stay put: the browser's own
  // scroll (preventDefault, which needs a non-passive listener — hence the
  // manual addEventListener instead of React's onWheel) and Lenis, whose
  // smooth-scroll rig runs its own wheel listener on window and is opted out
  // of by the data-lenis-prevent-wheel attribute on the wrapper below.
  useEffect(() => {
    const wrap = chartWrapRef.current;
    if (!wrap) return;

    const onWheel = (e: WheelEvent) => {
      const chart = chartRef.current;
      if (!chart) return;
      e.preventDefault();

      const timeScale = chart.timeScale();
      const range = timeScale.getVisibleLogicalRange();
      if (!range) return;

      const dx = wheelPixels(e.deltaX, e.deltaMode);
      const dy = wheelPixels(e.deltaY, e.deltaMode);

      // Horizontal intent (trackpad two-finger sideways, shift+wheel) pans
      // instead of zooming — matching what the gesture means everywhere else.
      if (Math.abs(dx) > Math.abs(dy) || e.shiftKey) {
        const pan = (e.shiftKey ? dy : dx) / 12; // ~1 bar per 12px
        if (pan) {
          timeScale.setVisibleLogicalRange({
            from: range.from + pan,
            to: range.to + pan,
          });
        }
        return;
      }
      if (!dy) return;

      // Exponential so zoom feels symmetric: N notches in then N notches out
      // lands exactly back where you started. Down/away = zoom out.
      const factor = Math.exp(dy * ZOOM_SENSITIVITY);

      // Anchor on the bar under the cursor so the chart zooms into what you
      // are pointing at, not into the middle of the viewport.
      const x = e.clientX - wrap.getBoundingClientRect().left;
      const anchor = timeScale.coordinateToLogical(x) ?? (range.from + range.to) / 2;

      const from = anchor - (anchor - range.from) * factor;
      const to = anchor + (range.to - anchor) * factor;

      const span = to - from;
      const maxSpan = Math.max(data.length * MAX_VISIBLE_BARS_FACTOR, MIN_VISIBLE_BARS);
      if (span < MIN_VISIBLE_BARS || span > maxSpan) return; // at a clamp: hold still

      timeScale.setVisibleLogicalRange({ from, to });
    };

    wrap.addEventListener('wheel', onWheel, { passive: false });
    return () => wrap.removeEventListener('wheel', onWheel);
  }, [data.length]);

  // Apply price lines in place: cheap remove/re-add on the live series,
  // preserving the chart instance and the user's viewport. rebuildEpoch is a
  // dep so a chart rebuild (which discards the old series and its lines)
  // re-applies them to the new series; pure priceLines changes still take
  // this cheap in-place path without touching the chart itself.
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;
    priceLineRefs.current.forEach(line => {
      try { series.removePriceLine(line); } catch { /* series torn down */ }
    });
    priceLineRefs.current = (colors.priceLines ?? [])
      .filter(line => line && line.price !== null && line.price !== undefined)
      .map(line => series.createPriceLine(line));
  }, [colors.priceLines, data, rebuildEpoch]);

  return (
    <div className="relative w-full">
      {/* Indicator toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {CHIP_META.map(({ key, label, color }) => {
          const active = config[key].on;
          return (
            <div key={key} className="relative flex items-center gap-1" data-chip-group={key}>
              <button
                onClick={() => {
                  setIndicator(key, { on: !active });
                  if (active && openPopover === key) setOpenPopover(null);
                }}
                className={`rounded border px-2 py-1 text-xs transition-colors ${
                  active ? '' : 'border-borderSubtle bg-black/40 text-textSecondary hover:text-textPrimary'
                }`}
                style={active ? { borderColor: color, backgroundColor: `${color}1a`, color } : undefined}
              >
                {label}
              </button>
              {active && (
                <button
                  onClick={() => setOpenPopover(openPopover === key ? null : key)}
                  className="rounded border border-borderSubtle bg-black/40 px-1.5 py-1 text-[10px] tabular text-textMuted transition-colors hover:text-textPrimary"
                  title={`${label} settings`}
                >
                  {chipSummary(key, config)}
                </button>
              )}
              {openPopover === key && (
                <div className="glass-panel absolute left-0 top-full z-20 mt-2 w-52 p-3">
                  <div className="mb-1 text-[11px] font-semibold font-mono uppercase tracking-wider text-textMuted">
                    {label}
                  </div>
                  {key === 'ema' && (
                    <ParamInput
                      label="Period" value={config.ema.period}
                      min={PERIOD_MIN} max={PERIOD_MAX}
                      onCommit={(v) => setIndicator('ema', { period: v })}
                    />
                  )}
                  {key === 'ribbon' && config.ribbon.periods.map((p, i) => (
                    <ParamInput
                      key={i}
                      label={`EMA ${i + 1}`} value={p}
                      min={PERIOD_MIN} max={PERIOD_MAX}
                      onCommit={(v) => {
                        const periods = [...config.ribbon.periods] as [number, number, number, number];
                        periods[i] = v;
                        setIndicator('ribbon', { periods });
                      }}
                    />
                  ))}
                  {key === 'bb' && (
                    <>
                      <ParamInput
                        label="Period" value={config.bb.period}
                        min={PERIOD_MIN} max={PERIOD_MAX}
                        onCommit={(v) => setIndicator('bb', { period: v })}
                      />
                      <ParamInput
                        label="Std-dev mult" value={config.bb.mult}
                        min={MULT_MIN} max={MULT_MAX} step={0.5}
                        onCommit={(v) => setIndicator('bb', { mult: v })}
                      />
                    </>
                  )}
                  {key === 'macd' && (
                    <>
                      <ParamInput
                        label="Fast" value={config.macd.fast}
                        min={PERIOD_MIN} max={PERIOD_MAX}
                        onCommit={(v) => setIndicator('macd', { fast: v })}
                      />
                      <ParamInput
                        label="Slow" value={config.macd.slow}
                        min={PERIOD_MIN} max={PERIOD_MAX}
                        onCommit={(v) => setIndicator('macd', { slow: v })}
                      />
                      <ParamInput
                        label="Signal" value={config.macd.signal}
                        min={PERIOD_MIN} max={PERIOD_MAX}
                        onCommit={(v) => setIndicator('macd', { signal: v })}
                      />
                    </>
                  )}
                  {key === 'rsi' && (
                    <ParamInput
                      label="Period" value={config.rsi.period}
                      min={PERIOD_MIN} max={PERIOD_MAX}
                      onCommit={(v) => setIndicator('rsi', { period: v })}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Rail sits outside the chart box so it never overlaps the price axis
          or eats crosshair hits; the chart flexes into whatever's left. */}
      <div className="flex w-full items-stretch" style={{ height }}>
        {drawingTools && (
          <DrawingRail
            activeTool={draw.activeTool}
            onSelectTool={draw.selectTool}
            canDelete={!!draw.selectedId}
            onDelete={draw.deleteSelected}
            onClearAll={draw.clearAll}
          />
        )}
        {/* autoSize follows the chart div's box, which fills this wrapper —
            the wrapper carries the explicit height, width flexes with the
            parent (grid widget, panel, etc.). */}
        <div
          ref={chartWrapRef}
          // Opts this box out of Lenis' smooth-scroll wheel handling so the
          // wheel effect above owns the gesture outright. Touch is deliberately
          // NOT prevented — a finger drag on mobile still scrolls the page,
          // which is the only way to get past a full-width chart.
          data-lenis-prevent-wheel=""
          className="relative min-w-0 flex-1"
        >
          <div ref={chartContainerRef} className="absolute inset-0" />
          {drawingTools && (
            <canvas
              ref={drawCanvasRef}
              aria-hidden="true"
              className="absolute left-0 top-0 z-10"
              style={{
                // Transparent in cursor mode so the chart keeps its crosshair
                // and panning; selection/drag is handled by a capture-phase
                // listener on the wrapper instead.
                pointerEvents: draw.activeTool === 'cursor' ? 'none' : 'auto',
                cursor: 'crosshair',
              }}
              {...draw.canvasHandlers}
            />
          )}
          {drawingTools && <DrawingHint tool={draw.activeTool} />}
        </div>
      </div>
    </div>
  );
}
