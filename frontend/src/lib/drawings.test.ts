/**
 * Tests for the chart drawing math.
 *
 * Run with:  npm test
 *
 * These cover the parts you cannot eyeball on a chart: the time<->logical
 * interpolation that keeps a drawing pinned to the right bar across timeframes,
 * and the hit-test tolerances that decide whether a click grabs a line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import type { UTCTimestamp } from 'lightweight-charts';
import {
  Drawing, Projector,
  distToSegment, drawingsStorageKey, hitTestDrawing, hitTestDrawings,
  logicalToTime, medianSpacing, rayEndpoint, sanitizeDrawings,
  timeToLogical, timeToUnix,
} from './drawings';

const DAY = 86400;

// ---------------------------------------------------------------- timeToUnix

test('timeToUnix accepts every shape the backend emits', () => {
  // daily+ bars arrive as 'YYYY-MM-DD'
  assert.equal(timeToUnix('1970-01-02'), DAY);
  assert.equal(timeToUnix('2024-01-01'), Date.UTC(2024, 0, 1) / 1000);
  // intraday bars arrive as numeric unix seconds and must pass through as-is
  assert.equal(timeToUnix(1_700_000_000 as UTCTimestamp), 1_700_000_000);
  // lightweight-charts BusinessDay
  assert.equal(timeToUnix({ year: 2024, month: 3, day: 15 }), Date.UTC(2024, 2, 15) / 1000);
  // a full stamp must not get 'T00:00:00Z' appended onto it
  assert.equal(timeToUnix('2024-01-01T06:30:00Z'), Date.UTC(2024, 0, 1, 6, 30) / 1000);
  // unparseable input degrades to 0 rather than NaN, which would poison the axis
  assert.equal(timeToUnix('not-a-date'), 0);
});

// ------------------------------------------------------ time <-> logical map

const times = [0, DAY, 2 * DAY, 5 * DAY, 6 * DAY]; // a weekend gap after index 2

test('timeToLogical lands exactly on bar indices', () => {
  times.forEach((t, i) => assert.equal(timeToLogical(t, times, DAY), i));
});

test('timeToLogical interpolates inside a gap', () => {
  // halfway across the 3-day weekend gap between index 2 and index 3
  assert.equal(timeToLogical(3.5 * DAY, times, DAY), 2.5);
});

test('timeToLogical extrapolates past both ends by one spacing per bar', () => {
  assert.equal(timeToLogical(-2 * DAY, times, DAY), -2);
  assert.equal(timeToLogical(9 * DAY, times, DAY), 7); // 4 + 3 spacings past the last bar
});

test('time <-> logical round-trips', () => {
  for (const t of [-3 * DAY, 0, 1.25 * DAY, 3.5 * DAY, 6 * DAY, 11 * DAY]) {
    const back = logicalToTime(timeToLogical(t, times, DAY), times, DAY);
    assert.ok(Math.abs(back - t) < 1e-6, `round-trip failed for ${t}: got ${back}`);
  }
});

test('time <-> logical degrade safely with no bars', () => {
  assert.equal(timeToLogical(123, [], DAY), 0);
  assert.equal(logicalToTime(4, [], DAY), 0);
});

test('medianSpacing ignores outlier gaps', () => {
  // four 1-day gaps and one 30-day suspension: the median must stay at a day
  assert.equal(medianSpacing([0, DAY, 2 * DAY, 3 * DAY, 33 * DAY], 999), DAY);
  assert.equal(medianSpacing([], 999), 999);
  // duplicate timestamps produce a zero gap that must not be counted
  assert.equal(medianSpacing([0, 0], 999), 999);
});

// ------------------------------------------------------------------ geometry

test('distToSegment measures to the segment, not the infinite line', () => {
  assert.equal(distToSegment(5, 3, 0, 0, 10, 0), 3);      // perpendicular
  assert.equal(distToSegment(-4, 0, 0, 0, 10, 0), 4);     // past the start cap
  assert.equal(distToSegment(14, 0, 0, 0, 10, 0), 4);     // past the end cap
  assert.equal(distToSegment(1, 1, 5, 5, 5, 5), Math.hypot(4, 4)); // degenerate
});

test('rayEndpoint shoots past the pane and survives a zero-length ray', () => {
  const end = rayEndpoint({ x: 0, y: 0 }, { x: 1, y: 0 }, 800, 400);
  assert.equal(end.x, 2400); // (800 + 400) * 2
  assert.equal(end.y, 0);
  assert.deepEqual(rayEndpoint({ x: 7, y: 7 }, { x: 7, y: 7 }, 800, 400), { x: 7, y: 7 });
});

// --------------------------------------------------------------- hit-testing

/** Identity projection: 1 chart unit = 1 pixel, y inverted like a price axis. */
const proj: Projector = {
  toXY: (pt) => ({ x: pt.t, y: 400 - pt.p }),
  priceToY: (price) => 400 - price,
  paneW: 800,
  paneH: 400,
};

const trend: Drawing = { id: 'a', type: 'trend', points: [{ t: 100, p: 300 }, { t: 300, p: 300 }] };

test('endpoints win over the body', () => {
  assert.equal(hitTestDrawing(100, 100, trend, proj), 'end0');
  assert.equal(hitTestDrawing(300, 100, trend, proj), 'end1');
  assert.equal(hitTestDrawing(200, 100, trend, proj), 'move');
});

test('a trend line is a segment, not a ray', () => {
  assert.equal(hitTestDrawing(200, 103, trend, proj), 'move');  // inside tolerance
  assert.equal(hitTestDrawing(200, 120, trend, proj), null);    // outside it
  assert.equal(hitTestDrawing(500, 100, trend, proj), null);    // beyond the far endpoint
});

test('a ray is grabbable past its second point', () => {
  const ray: Drawing = { ...trend, type: 'ray' };
  assert.equal(hitTestDrawing(500, 100, ray, proj), 'move');
});

test('a horizontal line is grabbable at any x, only near its price', () => {
  const hline: Drawing = { id: 'h', type: 'hline', points: [{ t: 0, p: 250 }] };
  assert.equal(hitTestDrawing(0, 150, hline, proj), 'move');
  assert.equal(hitTestDrawing(799, 150, hline, proj), 'move');
  assert.equal(hitTestDrawing(400, 180, hline, proj), null);
});

test('a rectangle is grabbable on its edges but not through its middle', () => {
  const rect: Drawing = { id: 'r', type: 'rect', points: [{ t: 100, p: 300 }, { t: 300, p: 200 }] };
  assert.equal(hitTestDrawing(200, 100, rect, proj), 'move'); // top edge
  assert.equal(hitTestDrawing(100, 150, rect, proj), 'move'); // left edge
  assert.equal(hitTestDrawing(200, 150, rect, proj), null);   // interior stays click-through
});

test('a fib grid is grabbable on its levels within its horizontal span', () => {
  // levels span price 200..300, so y = 400 - price puts them at y 200..100
  const fib: Drawing = { id: 'f', type: 'fib', points: [{ t: 100, p: 200 }, { t: 300, p: 300 }] };
  assert.equal(hitTestDrawing(200, 100, fib, proj), 'move');  // 100% (price 300)
  assert.equal(hitTestDrawing(200, 150, fib, proj), 'move');  // 50%  (price 250)
  assert.equal(hitTestDrawing(200, 138, fib, proj), 'move');  // 61.8% (price 261.8, y 138.2)
  // widest gap on the grid: between 0% (y 200) and 23.6% (y 176.4)
  assert.equal(hitTestDrawing(200, 188, fib, proj), null);
  assert.equal(hitTestDrawing(600, 150, fib, proj), null);    // outside the span
});

test('the topmost drawing wins when they overlap', () => {
  const under: Drawing = { id: 'under', type: 'hline', points: [{ t: 0, p: 250 }] };
  const over: Drawing = { id: 'over', type: 'hline', points: [{ t: 0, p: 250 }] };
  assert.equal(hitTestDrawings(400, 150, [under, over], proj)?.drawing.id, 'over');
  assert.equal(hitTestDrawings(400, 10, [under, over], proj), null);
});

test('an unprojectable drawing is simply not hit', () => {
  const offscreen: Projector = { ...proj, toXY: () => null, priceToY: () => null };
  assert.equal(hitTestDrawing(200, 100, trend, offscreen), null);
});

// -------------------------------------------------------------- persistence

test('sanitizeDrawings drops anything it cannot draw', () => {
  const out = sanitizeDrawings([
    { id: 'ok', type: 'trend', points: [{ t: 1, p: 2 }, { t: 3, p: 4 }] },
    { id: 'short', type: 'trend', points: [{ t: 1, p: 2 }] },        // needs 2 points
    { id: 'bogus', type: 'spiral', points: [{ t: 1, p: 2 }] },       // unknown type
    { id: 'nan', type: 'hline', points: [{ t: NaN, p: 2 }] },        // NaN would poison the axis
    { id: 'null', type: 'hline', points: [null] },
    'garbage',
    null,
  ]);
  assert.deepEqual(out.map(d => d.id), ['ok']);
});

test('sanitizeDrawings mints an id when one is missing and trims extra points', () => {
  const [d] = sanitizeDrawings([
    { type: 'hline', points: [{ t: 1, p: 2 }, { t: 9, p: 9 }] },
  ]);
  assert.ok(d.id.length > 0);
  assert.equal(d.points.length, 1); // hline stores exactly one point
});

test('sanitizeDrawings rejects non-arrays', () => {
  assert.deepEqual(sanitizeDrawings(null), []);
  assert.deepEqual(sanitizeDrawings({ nope: true }), []);
});

test('storage keys scope drawings to a normalized symbol', () => {
  assert.equal(drawingsStorageKey('reliance.ns'), drawingsStorageKey('  RELIANCE.NS '));
  assert.notEqual(drawingsStorageKey('AAPL'), drawingsStorageKey('MSFT'));
  assert.notEqual(drawingsStorageKey('AAPL'), drawingsStorageKey(undefined));
});
