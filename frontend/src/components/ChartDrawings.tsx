"use client";
/**
 * Drawing layer for Chart.tsx — trend line, ray, horizontal line, rectangle
 * and fib retracement, with select / drag-move / endpoint-edit / delete,
 * persisted per symbol.
 *
 * The layer is deliberately decoupled from the chart's own lifecycle: it reads
 * `chartRef`/`seriesRef` fresh every frame, so Chart tearing down and rebuilding
 * the IChartApi (which it does on every indicator toggle) never orphans a
 * drawing. `epoch` tells us a rebuild happened so chart-level options we own
 * (the pan/zoom lock) get re-applied to the new instance.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { IChartApi, ISeriesApi, Logical, Time } from 'lightweight-charts';
import {
  MousePointer2, TrendingUp, MoveUpRight, Minus, Square, Rows3, Eraser, Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import {
  Drawing, DrawingType, HitPart, Projector, Pt, ToolId,
  POINT_COUNT, drawingsStorageKey, hitTestDrawings, loadDrawings, logicalToTime,
  medianSpacing, newDrawingId, renderDrawing, saveDrawings, timeToLogical, timeToUnix,
} from '../lib/drawings';

// ---------------------------------------------------------------------------
// Tool metadata
// ---------------------------------------------------------------------------

const TOOLS: { id: ToolId; icon: React.ReactNode; label: string }[] = [
  { id: 'cursor', icon: <MousePointer2 size={15} />, label: 'Cursor' },
  { id: 'trend', icon: <TrendingUp size={15} />, label: 'Trend line' },
  { id: 'ray', icon: <MoveUpRight size={15} />, label: 'Ray' },
  { id: 'hline', icon: <Minus size={15} />, label: 'Horizontal line' },
  { id: 'rect', icon: <Square size={15} />, label: 'Rectangle' },
  { id: 'fib', icon: <Rows3 size={15} />, label: 'Fib retracement' },
];

const DEFAULT_SPACING = 86400; // one day, used only before any data arrives

/**
 * Interaction options for the cursor (non-drawing) state.
 *
 * `mouseWheel: false` on both is load-bearing, not a preference: Chart owns the
 * wheel gesture with its own listener on the wrapper so that zooming survives
 * this overlay canvas covering the library's. Handing the wheel back to the
 * library here would double-apply every notch. Everything else stays on, so
 * drag-to-pan, pinch and axis scaling behave normally.
 */
export const CHART_INTERACTION_FREE = {
  handleScroll: {
    mouseWheel: false,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true,
  },
  handleScale: {
    mouseWheel: false,
    pinch: true,
    axisPressedMouseMove: true,
    axisDoubleClickReset: true,
  },
} as const;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseChartDrawingsArgs {
  chartRef: RefObject<IChartApi | null>;
  seriesRef: RefObject<ISeriesApi<'Candlestick'> | null>;
  /** positioned wrapper that the chart div and the overlay canvas both fill */
  wrapRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  data: { time: Time }[];
  /** persistence scope — drawings follow the instrument, not the timeframe */
  symbol?: string;
  /** bumped by Chart whenever it rebuilds the IChartApi */
  epoch: number;
  enabled?: boolean;
}

interface DragState {
  mode: HitPart;
  id: string;
  start: Pt;
  orig: Pt[];
}

export function useChartDrawings({
  chartRef, seriesRef, wrapRef, canvasRef, data, symbol, epoch, enabled = true,
}: UseChartDrawingsArgs) {
  const storageKey = useMemo(() => drawingsStorageKey(symbol), [symbol]);

  const [activeTool, setActiveTool] = useState<ToolId>('cursor');
  // Read straight out of storage rather than loading in an effect, so the
  // first painted frame already has the saved drawings on it. Nothing in the
  // rendered DOM depends on this list — it only reaches the overlay canvas —
  // so the server ([]) and the client (loaded) still produce identical HTML.
  const [drawings, setDrawings] = useState<Drawing[]>(
    () => (typeof window === 'undefined' ? [] : loadDrawings(drawingsStorageKey(symbol))),
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Mirrors for the rAF loop and native listeners, which must read the latest
  // values without being re-registered on every state change.
  const activeToolRef = useRef<ToolId>('cursor');
  const drawingsRef = useRef<Drawing[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const versionRef = useRef(0);
  const anchorRef = useRef<Pt | null>(null);   // first click of a 2-point tool
  const hoverPtRef = useRef<Pt | null>(null);  // live pointer, for the preview
  const hoverIdRef = useRef<string | null>(null); // drawing under the cursor
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    activeToolRef.current = activeTool;
    selectedIdRef.current = selectedId;
  });
  useEffect(() => {
    drawingsRef.current = drawings;
    versionRef.current += 1;
  }, [drawings]);

  // -------------------------------------------------------- data time index
  const timesRef = useRef<number[]>([]);
  const spacingRef = useRef(DEFAULT_SPACING);
  useEffect(() => {
    const ts = data.map(d => timeToUnix(d.time));
    timesRef.current = ts;
    spacingRef.current = medianSpacing(ts, DEFAULT_SPACING);
  }, [data]);

  // ---------------------------------------------------------- persistence
  // Chart is not remounted per symbol, so the switch is handled as a
  // render-phase adjustment rather than an effect: an effect would paint the
  // previous symbol's drawings for a frame before swapping them out. It
  // terminates because loadedKey is set to the key it just read.
  const [loadedKey, setLoadedKey] = useState(storageKey);
  if (loadedKey !== storageKey) {
    setLoadedKey(storageKey);
    setDrawings(loadDrawings(storageKey));
    setSelectedId(null);
    setActiveTool('cursor');
  }

  // Refs can't be reset in the adjustment above (renders stay side-effect
  // free), so a drawing left half-placed when the symbol changed dies here.
  useEffect(() => {
    anchorRef.current = null;
    hoverPtRef.current = null;
    hoverIdRef.current = null;
    dragRef.current = null;
  }, [storageKey]);

  // Ref written synchronously so a fast second click reads the committed list
  // rather than the pre-render one.
  const commit = useCallback((next: Drawing[]) => {
    drawingsRef.current = next;
    versionRef.current += 1;
    setDrawings(next);
    saveDrawings(storageKey, next);
  }, [storageKey]);

  // ------------------------------------------------------- chart <-> pixels
  const ptToXY = useCallback((pt: Pt) => {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return null;
    const logical = timeToLogical(pt.t, timesRef.current, spacingRef.current);
    const x = chart.timeScale().logicalToCoordinate(logical as Logical);
    const y = series.priceToCoordinate(pt.p);
    return x == null || y == null ? null : { x, y };
  }, [chartRef, seriesRef]);

  const xyToPt = useCallback((x: number, y: number): Pt | null => {
    const chart = chartRef.current, series = seriesRef.current;
    if (!chart || !series) return null;
    const l = chart.timeScale().coordinateToLogical(x);
    const p = series.coordinateToPrice(y);
    if (l == null || p == null) return null;
    return { t: logicalToTime(l, timesRef.current, spacingRef.current), p };
  }, [chartRef, seriesRef]);

  /** Pane 0's box in CSS px: excludes the right price axis, sub-panes and time axis. */
  const paneBox = useCallback(() => {
    const chart = chartRef.current;
    const wrap = wrapRef.current;
    const fallbackW = wrap?.clientWidth ?? 0;
    const fallbackH = wrap?.clientHeight ?? 0;
    if (!chart) return { paneW: fallbackW, paneH: fallbackH };
    let paneW = fallbackW, paneH = fallbackH;
    try { paneW = chart.timeScale().width() || fallbackW; } catch { /* pre-layout */ }
    try { paneH = chart.panes()[0]?.getHeight() || fallbackH; } catch { /* pre-layout */ }
    return { paneW, paneH };
  }, [chartRef, wrapRef]);

  const projector = useCallback((): Projector => {
    const { paneW, paneH } = paneBox();
    return {
      toXY: ptToXY,
      priceToY: (price: number) => seriesRef.current?.priceToCoordinate(price) ?? null,
      paneW,
      paneH,
    };
  }, [paneBox, ptToXY, seriesRef]);

  const localXY = useCallback((e: { clientX: number; clientY: number }) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, [wrapRef]);

  /** Reject the price axis, sub-panes and the time axis — those belong to the chart. */
  const inPane = useCallback((x: number, y: number) => {
    const { paneW, paneH } = paneBox();
    return x >= 0 && x <= paneW && y >= 0 && y <= paneH;
  }, [paneBox]);

  // ------------------------------------------------------ canvas backing size
  const syncCanvasSize = useCallback(() => {
    const c = canvasRef.current, wrap = wrapRef.current;
    if (!c || !wrap) return;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    if (w <= 0 || h <= 0) return;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (c.width !== bw || c.height !== bh) { c.width = bw; c.height = bh; }
    if (c.style.width !== `${w}px`) c.style.width = `${w}px`;
    if (c.style.height !== `${h}px`) c.style.height = `${h}px`;
  }, [canvasRef, wrapRef]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !enabled) return;
    syncCanvasSize();
    const ro = new ResizeObserver(syncCanvasSize);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [wrapRef, enabled, syncCanvasSize]);

  // ----------------------------------------------------------- render loop
  // Drawings live in chart space, so any pan, zoom, autoscale or resize moves
  // them — none of which emit a single reliable event. A rAF loop with a cheap
  // signature check re-projects when something actually moved and costs
  // nothing (no clear, no paint) on the idle frames in between.
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let lastSig = '';

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const c = canvasRef.current, chart = chartRef.current, series = seriesRef.current;
      if (!c || !chart || !series) return;

      syncCanvasSize();
      const list = drawingsRef.current;
      const anchor = anchorRef.current;
      const busy = !!anchor || !!dragRef.current;
      if (list.length === 0 && !busy && lastSig === 'empty') return;

      const { paneW, paneH } = paneBox();
      let range: { from: number; to: number } | null = null;
      let probeA: number | null = null, probeB: number | null = null;
      try {
        const r = chart.timeScale().getVisibleLogicalRange();
        range = r ? { from: r.from as number, to: r.to as number } : null;
        // Two probes pin down the whole price->pixel affine map, so an
        // autoscale or a price-axis drag invalidates the frame.
        probeA = series.coordinateToPrice(0);
        probeB = series.coordinateToPrice(100);
      } catch { /* chart mid-teardown */ }

      const dpr = window.devicePixelRatio || 1;
      const sig = list.length === 0 && !busy ? 'empty' : [
        paneW, paneH, dpr, range?.from, range?.to, probeA, probeB,
        versionRef.current, selectedIdRef.current, hoverIdRef.current,
        activeToolRef.current, anchor ? `${anchor.t},${anchor.p}` : '',
      ].join('|');
      // A live drag or preview follows the pointer, which the signature can't
      // see — repaint unconditionally until it's committed.
      if (!busy && sig === lastSig) return;
      lastSig = sig;

      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, c.width / dpr, c.height / dpr);
      if (sig === 'empty') return;

      const proj = projector();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, proj.paneW, proj.paneH);
      ctx.clip();

      for (const d of list) {
        renderDrawing(ctx, d, proj, {
          selected: d.id === selectedIdRef.current,
          hovered: d.id === hoverIdRef.current,
        });
      }

      // In-progress preview between the anchor click and the closing click.
      const tool = activeToolRef.current;
      const hoverPt = hoverPtRef.current;
      if (anchor && hoverPt && tool !== 'cursor' && tool !== 'hline') {
        renderDrawing(
          ctx,
          { id: '__preview', type: tool as DrawingType, points: [anchor, hoverPt] },
          proj,
          { preview: true },
        );
      }
      ctx.restore();
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, canvasRef, chartRef, seriesRef, paneBox, projector, syncCanvasSize]);

  // ---------------------------------------------- pan/zoom lock while drawing
  // Re-applied on `epoch` because a chart rebuild resets these to the options
  // Chart passed to createChart.
  useEffect(() => {
    if (!enabled) return;
    const chart = chartRef.current;
    if (!chart) return;
    const free = activeTool === 'cursor';
    try {
      chart.applyOptions(
        free
          ? CHART_INTERACTION_FREE
          : { handleScroll: false, handleScale: false }
      );
    } catch { /* chart mid-teardown */ }
  }, [activeTool, epoch, enabled, chartRef]);

  // ------------------------------------------------- tool clicks (overlay on)
  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    const tool = activeToolRef.current;
    if (tool === 'cursor') return;
    const local = localXY(e);
    if (!local || !inPane(local.x, local.y)) return;
    const pt = xyToPt(local.x, local.y);
    if (!pt) return;

    if (tool === 'hline') {
      commit([...drawingsRef.current, { id: newDrawingId(), type: 'hline', points: [pt] }]);
      setActiveTool('cursor');
      return;
    }
    if (!anchorRef.current) {
      anchorRef.current = pt;
      hoverPtRef.current = pt;
      return;
    }
    commit([...drawingsRef.current, {
      id: newDrawingId(),
      type: tool as DrawingType,
      points: [anchorRef.current, pt].slice(0, POINT_COUNT[tool as DrawingType]),
    }]);
    anchorRef.current = null;
    setActiveTool('cursor');
  }, [commit, inPane, localXY, xyToPt]);

  const onCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    const local = localXY(e);
    if (!local) return;
    const pt = xyToPt(local.x, local.y);
    if (pt) hoverPtRef.current = pt;
  }, [localXY, xyToPt]);

  // -------------------------------- selection + drag-editing in cursor mode
  // The canvas is pointer-transparent in cursor mode so the chart keeps its
  // crosshair and panning; a capture-phase listener on the wrapper gets first
  // refusal on each press and only swallows it when a drawing is actually hit.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || !enabled) return;

    const onDown = (e: PointerEvent) => {
      if (activeToolRef.current !== 'cursor') return;
      const local = localXY(e);
      if (!local || !inPane(local.x, local.y)) return;
      const hit = hitTestDrawings(local.x, local.y, drawingsRef.current, projector());
      if (!hit) {
        if (selectedIdRef.current) setSelectedId(null);
        return;
      }
      e.stopPropagation();
      e.preventDefault();
      setSelectedId(hit.drawing.id);
      const start = xyToPt(local.x, local.y);
      if (!start) return;
      dragRef.current = {
        mode: hit.part,
        id: hit.drawing.id,
        start,
        orig: hit.drawing.points.map(p => ({ ...p })),
      };
    };

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      // This is a window-level listener: bail before any layout read or chart
      // query when there is nothing it could possibly be pointing at.
      if (!drag) {
        if (activeToolRef.current !== 'cursor' || drawingsRef.current.length === 0) {
          hoverIdRef.current = null;
          return;
        }
      }
      const local = localXY(e);
      if (!local) return;

      if (!drag) {
        // Hover highlight: the only affordance that a drawing is grabbable,
        // since the chart owns the CSS cursor inside its own canvases.
        const hit = inPane(local.x, local.y)
          ? hitTestDrawings(local.x, local.y, drawingsRef.current, projector())
          : null;
        hoverIdRef.current = hit?.drawing.id ?? null;
        return;
      }

      const cur = xyToPt(local.x, local.y);
      if (!cur) return;
      const dt = cur.t - drag.start.t;
      const dp = cur.p - drag.start.p;
      setDrawings(prev => prev.map(d => {
        if (d.id !== drag.id) return d;
        if (drag.mode === 'move') {
          return { ...d, points: drag.orig.map(p => ({ t: p.t + dt, p: p.p + dp })) };
        }
        const idx = drag.mode === 'end0' ? 0 : 1;
        const pts = drag.orig.map(p => ({ ...p }));
        if (!pts[idx]) return d;
        pts[idx] = { t: drag.orig[idx].t + dt, p: drag.orig[idx].p + dp };
        return { ...d, points: pts };
      }));
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      saveDrawings(storageKey, drawingsRef.current);
    };

    wrap.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      wrap.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [enabled, wrapRef, localXY, inPane, projector, xyToPt, storageKey]);

  // ------------------------------------------------------------- actions
  const deleteSelected = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id) return;
    commit(drawingsRef.current.filter(d => d.id !== id));
    setSelectedId(null);
  }, [commit]);

  const clearAll = useCallback(() => {
    commit([]);
    setSelectedId(null);
    anchorRef.current = null;
  }, [commit]);

  const selectTool = useCallback((id: ToolId) => {
    anchorRef.current = null;
    hoverPtRef.current = null;
    setActiveTool(id);
    if (id !== 'cursor') setSelectedId(null);
  }, []);

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdRef.current) {
        e.preventDefault();
        deleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        // Only claim Escape when we have something to cancel, so the indicator
        // popover keeps its own dismiss behavior.
        if (activeToolRef.current === 'cursor' && !selectedIdRef.current) return;
        anchorRef.current = null;
        hoverPtRef.current = null;
        setActiveTool('cursor');
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, deleteSelected]);

  return {
    activeTool,
    selectTool,
    drawings,
    selectedId,
    deleteSelected,
    clearAll,
    canvasHandlers: {
      onPointerDown: onCanvasPointerDown,
      onPointerMove: onCanvasPointerMove,
    },
  };
}

// ---------------------------------------------------------------------------
// Rail
// ---------------------------------------------------------------------------

interface DrawingRailProps {
  activeTool: ToolId;
  onSelectTool: (id: ToolId) => void;
  canDelete: boolean;
  onDelete: () => void;
  onClearAll: () => void;
}

export function DrawingRail({
  activeTool, onSelectTool, canDelete, onDelete, onClearAll,
}: DrawingRailProps) {
  return (
    <div
      role="toolbar"
      aria-orientation="vertical"
      aria-label="Drawing tools"
      className="flex w-10 shrink-0 flex-col items-center gap-1 border-r border-borderSubtle bg-black/20 py-2"
    >
      {TOOLS.map(t => (
        <button
          key={t.id}
          type="button"
          title={t.label}
          aria-label={t.label}
          aria-pressed={activeTool === t.id}
          onClick={() => onSelectTool(t.id)}
          className={clsx(
            'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            activeTool === t.id
              ? 'bg-accentBlue/20 text-accentBlue'
              : 'text-textMuted hover:bg-white/5 hover:text-textPrimary',
          )}
        >
          {t.icon}
        </button>
      ))}

      <div className="my-1 h-px w-5 bg-borderSubtle" />

      <button
        type="button"
        title="Delete selected (Del)"
        aria-label="Delete selected drawing"
        disabled={!canDelete}
        onClick={onDelete}
        className={clsx(
          'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
          canDelete
            ? 'text-accentRed hover:bg-accentRed/10'
            : 'cursor-not-allowed text-textMuted/40',
        )}
      >
        <Trash2 size={15} />
      </button>
      {/* Deliberately never disabled: gating it on the drawing count would
          make this button's markup differ between the server render and the
          client's first render, which reads saved drawings synchronously.
          Clearing an empty list is a harmless no-op. */}
      <button
        type="button"
        title="Clear all drawings"
        aria-label="Clear all drawings"
        onClick={onClearAll}
        className="flex h-8 w-8 items-center justify-center rounded-md text-textMuted transition-colors hover:bg-white/5 hover:text-accentAmber"
      >
        <Eraser size={15} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hint
// ---------------------------------------------------------------------------

export function DrawingHint({ tool }: { tool: ToolId }) {
  if (tool === 'cursor') return null;
  return (
    <div className="pointer-events-none absolute bottom-10 left-1/2 z-20 -translate-x-1/2 rounded-md border border-accentBlue/30 bg-black/70 px-3 py-1.5 font-mono text-[11px] text-accentBlue">
      {tool === 'hline'
        ? 'Click to place line · Esc to cancel'
        : 'Click start and end points · Esc to cancel'}
    </div>
  );
}
