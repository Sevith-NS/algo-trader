/**
 * Chart drawing primitives — geometry, hit-testing, canvas rendering, storage.
 *
 * Everything here is pure and DOM-free apart from the 2D context it paints
 * into, so the React layer (`ChartDrawings.tsx`) only has to own state and
 * pointer plumbing.
 *
 * Drawings are stored in (time, price) space — never pixels — which is what
 * lets them survive pan, zoom, resize, a timeframe switch and a reload. The
 * pixel projection is supplied per frame by a `Projector`.
 */
import type { Time } from 'lightweight-charts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToolId = 'cursor' | 'trend' | 'ray' | 'hline' | 'rect' | 'fib';
export type DrawingType = Exclude<ToolId, 'cursor'>;

/** A point in chart space: unix seconds + price. */
export interface Pt { t: number; p: number }
export interface XY { x: number; y: number }

export interface Drawing {
  id: string;
  type: DrawingType;
  points: Pt[];
}

/** Which grab handle (if any) a pointer is over. */
export type HitPart = 'move' | 'end0' | 'end1';

export interface Projector {
  /** chart-space point -> canvas pixels, or null when off the projectable range */
  toXY(pt: Pt): XY | null;
  /** price -> canvas y, or null */
  priceToY(price: number): number | null;
  /** width of the price pane (excludes the right price axis) */
  paneW: number;
  /** height of pane 0 (excludes sub-panes and the time axis) */
  paneH: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Points a completed drawing of each type carries. */
export const POINT_COUNT: Record<DrawingType, 1 | 2> = {
  hline: 1, trend: 2, ray: 2, rect: 2, fib: 2,
};

export const DRAW_COLORS: Record<DrawingType, string> = {
  trend: '#60A5FA',  // accentBlue
  ray: '#60A5FA',
  hline: '#FBBF24',  // accentAmber
  rect: '#60A5FA',
  fib: '#94A3B8',    // textSecondary
};

export const FIB_LEVELS: { r: number; color: string }[] = [
  { r: 0, color: '#94A3B8' },
  { r: 0.236, color: '#F87171' },
  { r: 0.382, color: '#FBBF24' },
  { r: 0.5, color: '#34D399' },
  { r: 0.618, color: '#22D3EE' },
  { r: 0.786, color: '#A78BFA' },
  { r: 1, color: '#94A3B8' },
];

/** Pointer slop, in CSS px, for grabbing a line. Endpoints get a little more. */
const TOL = 6;
const ENDPOINT_TOL = 9;
const HANDLE_R = 4;
/**
 * Fib level labels on the canvas.
 *
 * Canvas2D takes a font shorthand string and cannot resolve CSS custom
 * properties, so the app's mono family has to be read out of the cascade and
 * handed over literally. It also cannot be hardcoded: next/font/local mints a
 * hashed family name at build time, so naming the face here would silently
 * fall through to the system monospace and drift from every other readout.
 *
 * Resolved lazily on first paint (not at module load) because the stylesheet
 * may not have applied yet during SSR hydration, then cached.
 */
const LABEL_FALLBACK = 'ui-monospace, SFMono-Regular, Menlo, monospace';
let labelFont: string | null = null;

function getLabelFont(): string {
  if (labelFont) return labelFont;
  let family = '';
  if (typeof window !== 'undefined') {
    family = getComputedStyle(document.documentElement)
      .getPropertyValue('--font-mono')
      .trim();
  }
  labelFont = `10px ${family || LABEL_FALLBACK}`;
  return labelFont;
}

const STORAGE_PREFIX = 'flint.chart.drawings.v1';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Normalize any lightweight-charts `Time` to unix seconds.
 *
 * This codebase feeds BOTH shapes: intraday bars carry a numeric unix-seconds
 * time, daily and coarser carry a 'YYYY-MM-DD' string. Assuming either one
 * silently misplaces every drawing on the other set of timeframes.
 */
export function timeToUnix(t: Time): number {
  if (typeof t === 'number') return t;
  if (typeof t === 'string') {
    // Bare dates are UTC midnight; anything longer is already a full stamp.
    const ms = t.length === 10 ? Date.parse(`${t}T00:00:00Z`) : Date.parse(t);
    return Number.isFinite(ms) ? ms / 1000 : 0;
  }
  // BusinessDay
  return Date.UTC(t.year, t.month - 1, t.day) / 1000;
}

export function fmtPrice(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1000) return v.toFixed(0);
  if (abs >= 1) return v.toFixed(2);
  return v.toFixed(4);
}

let idSeq = 0;
/** crypto.randomUUID is unavailable on insecure origins — fall back rather than throw. */
export function newDrawingId(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  idSeq += 1;
  return `d${Date.now().toString(36)}-${idSeq}`;
}

function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Unix time -> fractional bar index.
 *
 * lightweight-charts can only map times that exist as bars, but drawing
 * endpoints land between bars and past the last one. Interpolating over the
 * logical index handles the interior; `spacing` (the median bar gap)
 * extrapolates either end, so a line dragged into the right-hand gutter still
 * carries a sane timestamp instead of clamping onto the final candle.
 */
export function timeToLogical(t: number, times: number[], spacing: number): number {
  if (!times.length) return 0;
  const last = times.length - 1;
  if (t <= times[0]) return (t - times[0]) / spacing;
  if (t >= times[last]) return last + (t - times[last]) / spacing;
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid; else hi = mid;
  }
  const span = times[hi] - times[lo];
  return span > 0 ? lo + (t - times[lo]) / span : lo;
}

/** Fractional bar index -> unix time. Inverse of {@link timeToLogical}. */
export function logicalToTime(l: number, times: number[], spacing: number): number {
  if (!times.length) return 0;
  const last = times.length - 1;
  if (l <= 0) return times[0] + l * spacing;
  if (l >= last) return times[last] + (l - last) * spacing;
  const i = Math.floor(l);
  return times[i] + (times[i + 1] - times[i]) * (l - i);
}

/**
 * Median gap between bars. The median (not the mean) because sessions,
 * weekends and holidays leave outlier gaps that would otherwise stretch the
 * extrapolation well past a realistic bar width.
 */
export function medianSpacing(times: number[], fallback: number): number {
  const diffs: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > 0) diffs.push(gap);
  }
  if (!diffs.length) return fallback;
  diffs.sort((a, b) => a - b);
  return diffs[diffs.length >> 1];
}

/** Perpendicular distance from (px,py) to the segment a-b. */
export function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  const u = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
  return Math.hypot(px - (x1 + u * dx), py - (y1 + u * dy));
}

/**
 * Where a ray from `a` through `b` leaves the pane. Extending by the pane's
 * own span (rather than a magic constant) keeps the line off-screen-long at
 * every zoom level without producing coordinates big enough to lose precision.
 */
export function rayEndpoint(a: XY, b: XY, paneW: number, paneH: number): XY {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1e-6) return b;
  const k = ((paneW + paneH) * 2) / dist;
  return { x: a.x + dx * k, y: a.y + dy * k };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function drawingsStorageKey(symbol?: string): string {
  const s = (symbol ?? '').trim().toUpperCase();
  return `${STORAGE_PREFIX}:${s || '__scratch'}`;
}

function isPt(v: unknown): v is Pt {
  const p = v as Pt | null;
  return !!p && typeof p.t === 'number' && Number.isFinite(p.t)
    && typeof p.p === 'number' && Number.isFinite(p.p);
}

/**
 * Coerce whatever is in storage into drawable shapes. A hand-edited or
 * half-written payload must never be able to crash the render loop, so
 * anything that doesn't typecheck is dropped rather than repaired.
 */
export function sanitizeDrawings(raw: unknown): Drawing[] {
  if (!Array.isArray(raw)) return [];
  const out: Drawing[] = [];
  for (const item of raw) {
    const d = item as Partial<Drawing> | null;
    const type = d?.type as DrawingType | undefined;
    if (!type || !(type in POINT_COUNT)) continue;
    const need = POINT_COUNT[type];
    const pts = Array.isArray(d?.points) ? d!.points.filter(isPt) : [];
    if (pts.length < need) continue;
    out.push({
      id: typeof d?.id === 'string' && d.id ? d.id : newDrawingId(),
      type,
      points: pts.slice(0, need).map(p => ({ t: p.t, p: p.p })),
    });
  }
  return out;
}

export function loadDrawings(key: string): Drawing[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? sanitizeDrawings(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveDrawings(key: string, list: Drawing[]): void {
  try {
    if (list.length === 0) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(list));
  } catch { /* storage blocked or full — drawings just won't survive reload */ }
}

// ---------------------------------------------------------------------------
// Hit-testing
// ---------------------------------------------------------------------------

function fibPrice(d: Drawing, r: number): number {
  return d.points[0].p + (d.points[1].p - d.points[0].p) * r;
}

/** Which part of `d`, if any, is under (x, y). Endpoints win over bodies. */
export function hitTestDrawing(x: number, y: number, d: Drawing, proj: Projector): HitPart | null {
  if (d.type === 'hline') {
    const yy = proj.priceToY(d.points[0].p);
    return yy != null && Math.abs(y - yy) < TOL ? 'move' : null;
  }

  const a = proj.toXY(d.points[0]);
  const b = proj.toXY(d.points[1]);
  if (!a || !b) return null;

  if (Math.hypot(x - a.x, y - a.y) < ENDPOINT_TOL) return 'end0';
  if (Math.hypot(x - b.x, y - b.y) < ENDPOINT_TOL) return 'end1';

  if (d.type === 'trend') {
    return distToSegment(x, y, a.x, a.y, b.x, b.y) < TOL ? 'move' : null;
  }

  if (d.type === 'ray') {
    const e = rayEndpoint(a, b, proj.paneW, proj.paneH);
    return distToSegment(x, y, a.x, a.y, e.x, e.y) < TOL ? 'move' : null;
  }

  const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);

  if (d.type === 'rect') {
    const y1 = Math.min(a.y, b.y), y2 = Math.max(a.y, b.y);
    const onVertEdge = (Math.abs(x - x1) < TOL || Math.abs(x - x2) < TOL) && y > y1 - TOL && y < y2 + TOL;
    const onHorzEdge = (Math.abs(y - y1) < TOL || Math.abs(y - y2) < TOL) && x > x1 - TOL && x < x2 + TOL;
    return onVertEdge || onHorzEdge ? 'move' : null;
  }

  if (d.type === 'fib') {
    if (x < x1 - TOL || x > x2 + TOL) return null;
    for (const lvl of FIB_LEVELS) {
      const yy = proj.priceToY(fibPrice(d, lvl.r));
      if (yy != null && Math.abs(y - yy) < TOL) return 'move';
    }
  }
  return null;
}

/** Topmost drawing under (x, y) — later drawings sit above earlier ones. */
export function hitTestDrawings(
  x: number, y: number, list: Drawing[], proj: Projector,
): { drawing: Drawing; part: HitPart } | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const part = hitTestDrawing(x, y, list[i], proj);
    if (part) return { drawing: list[i], part };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface RenderState {
  selected?: boolean;
  hovered?: boolean;
  /** in-progress drawing that hasn't been committed yet */
  preview?: boolean;
}

function drawHandle(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.setLineDash([]);
  ctx.fillStyle = '#0D1220';   // bgSecondary
  ctx.strokeStyle = '#F1F5F9'; // textPrimary
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, HANDLE_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Keep a right-hand label on-pane; flip it to the left of `xRight` if it won't fit. */
function labelX(ctx: CanvasRenderingContext2D, text: string, xRight: number, paneW: number): number {
  const w = ctx.measureText(text).width;
  return xRight + 6 + w > paneW - 2 ? Math.max(2, xRight - 6 - w) : xRight + 6;
}

export function renderDrawing(
  ctx: CanvasRenderingContext2D,
  d: Drawing,
  proj: Projector,
  state: RenderState = {},
): void {
  const { selected = false, hovered = false, preview = false } = state;
  const color = DRAW_COLORS[d.type];

  ctx.save();
  ctx.globalAlpha = preview ? 0.7 : 1;
  ctx.lineWidth = selected || hovered ? 2 : 1.5;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.font = getLabelFont();
  ctx.setLineDash([]);

  if (d.type === 'hline') {
    const y = proj.priceToY(d.points[0].p);
    if (y == null) { ctx.restore(); return; }
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(proj.paneW, y);
    ctx.stroke();
    ctx.fillText(fmtPrice(d.points[0].p), 6, y - 4);
    if (selected) drawHandle(ctx, proj.paneW / 2, y);
    ctx.restore();
    return;
  }

  const a = proj.toXY(d.points[0]);
  const b = proj.toXY(d.points[1]);
  if (!a || !b) { ctx.restore(); return; }

  if (d.type === 'trend' || d.type === 'ray') {
    const end = d.type === 'ray' ? rayEndpoint(a, b, proj.paneW, proj.paneH) : b;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  } else if (d.type === 'rect') {
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    ctx.fillStyle = withAlpha(color, 0.08);
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = withAlpha(color, 0.85);
    ctx.strokeRect(x, y, w, h);
  } else if (d.type === 'fib') {
    const x1 = Math.min(a.x, b.x), x2 = Math.max(a.x, b.x);
    for (const lvl of FIB_LEVELS) {
      const price = fibPrice(d, lvl.r);
      const y = proj.priceToY(price);
      if (y == null) continue;
      const isBound = lvl.r === 0 || lvl.r === 1;
      ctx.strokeStyle = lvl.color;
      ctx.fillStyle = lvl.color;
      ctx.globalAlpha = preview ? 0.5 : 0.85;
      ctx.setLineDash(isBound ? [] : [4, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
      ctx.stroke();
      const text = `${(lvl.r * 100).toFixed(1)}%  ${fmtPrice(price)}`;
      ctx.fillText(text, labelX(ctx, text, x2, proj.paneW), y - 3);
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = preview ? 0.7 : 1;
  }

  if (selected) {
    drawHandle(ctx, a.x, a.y);
    drawHandle(ctx, b.x, b.y);
  }
  ctx.restore();
}
