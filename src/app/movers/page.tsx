'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import {
  TrendingUp,
  TrendingDown,
  Loader2,
  AlertTriangle,
  Layers,
  Zap,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronRight,
} from 'lucide-react';

import Navigation from '../../components/Navigation';
import { PageShell, PageHeader, Panel } from '../../components/PageHeader';
import MarketsTabs from '../../components/MarketsTabs';
import Sparkline from '../../components/discover/Sparkline';
import { API_BASE } from '../../lib/api';
import type {
  CircuitSections,
  IntradaySection,
  MoverRow,
  MoversResponse,
  SegmentSection,
} from '../../types/movers';

/* ------------------------------- constants ------------------------------- */

/** Threshold presets. 20% is the headline case: a rare, explosive single day. */
const THRESHOLDS = [2, 5, 10, 15, 20];

const ROWS_PER_SIDE = 15;

/** Poll cadence while the price cache warms in the background. */
const POLL_MS = 4000;

const SEGMENT_ACCENT: Record<string, string> = {
  largecap: 'text-accentBlue',
  midcap: 'text-accentPurple',
  smallcap: 'text-accentCyan',
  microcap: 'text-accentAmber',
  unranked: 'text-textSecondary',
};

/* ------------------------------- formatting ------------------------------ */

const inr = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtPrice = (v: number) => `₹${inr.format(v)}`;

const fmtPct = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

/** Deep link into the terminal. It prices off Yahoo, so it wants the .NS form. */
const terminalHref = (row: MoverRow) => `/screener?q=${encodeURIComponent(row.yahoo)}`;

/* ----------------------------- small pieces ----------------------------- */

/**
 * Signed change cell. The sign is always explicit so direction survives without
 * color, and the value is tabular so columns of numbers align.
 */
function Change({ pct, abs }: { pct: number; abs?: number }) {
  const up = pct >= 0;
  return (
    <div className="flex flex-col items-end">
      <span
        className={clsx(
          'tabular text-sm font-semibold',
          up ? 'text-accentGreen' : 'text-accentRed',
        )}
      >
        {fmtPct(pct)}
      </span>
      {abs !== undefined && (
        <span className="tabular text-[11px] text-textMuted">
          {up ? '+' : ''}{inr.format(abs)}
        </span>
      )}
    </div>
  );
}

function SegmentBadge({ segment, label }: { segment: string; label: string }) {
  return (
    <span
      className={clsx(
        'label shrink-0 text-[10px] !tracking-[0.14em]',
        SEGMENT_ACCENT[segment] ?? 'text-textMuted',
      )}
    >
      {label}
    </span>
  );
}

function FnoBadge() {
  return (
    <span
      title="Futures and options available on this underlying"
      className="label shrink-0 rounded border border-borderSubtle px-1 text-[9px] !tracking-wider text-textMuted"
    >
      F&amp;O
    </span>
  );
}

/**
 * Symbol + company name, the shared identity block for every row on this page.
 * The symbol is mono because it is an identifier; the company name is set in
 * the prose face because it is prose.
 */
function Identity({ row, children }: { row: MoverRow; children?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        <span className="ticker truncate text-sm text-textPrimary">{row.symbol}</span>
        {row.fno && <FnoBadge />}
        {children}
      </div>
      <div className="mt-0.5 flex items-center gap-2 truncate">
        <SegmentBadge segment={row.segment} label={row.segment_label} />
        <span className="truncate text-[11px] text-textSecondary">{row.name}</span>
      </div>
    </div>
  );
}

/**
 * Every row on this board is a link into the terminal.
 *
 * A movers board exists to hand a name off for a closer look, so the whole row
 * is the target rather than a trailing "open" affordance — Fitts's law, and it
 * removes the guesswork about what is clickable. The chevron only appears on
 * hover/focus so a dense table is not littered with arrows.
 */
function RowLink({
  row,
  className,
  children,
}: {
  row: MoverRow;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={terminalHref(row)}
        aria-label={`Open ${row.symbol} (${row.name}) in the terminal`}
        className={clsx(
          'group grid items-center gap-3 border-t border-borderSubtle py-3',
          'transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.03]',
          className,
        )}
      >
        {children}
      </Link>
    </li>
  );
}

function Chevron() {
  return (
    <ChevronRight
      size={13}
      aria-hidden="true"
      className="shrink-0 text-textMuted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
    />
  );
}

/** One row of the main movers table. Hairline separated, no per-row card. */
function Row({ row, rank }: { row: MoverRow; rank: number }) {
  return (
    <RowLink
      row={row}
      className="grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_6rem_0.75rem] sm:grid-cols-[1.75rem_minmax(0,1fr)_7rem_6rem_6rem_0.75rem]"
    >
      <span className="tabular text-[11px] text-textMuted">{rank}</span>
      <Identity row={row} />
      <div className="hidden sm:block">
        <Sparkline data={row.spark} className="h-7" />
      </div>
      <span className="tabular text-right text-sm text-textSecondary">
        {fmtPrice(row.price)}
      </span>
      <div className="text-right">
        <Change pct={row.change_pct} abs={row.change_abs} />
      </div>
      <Chevron />
    </RowLink>
  );
}

/** Compact row for the cap-segment columns: no sparkline, no absolute change. */
function CompactRow({ row, rank }: { row: MoverRow; rank: number }) {
  return (
    <RowLink row={row} className="grid-cols-[1.5rem_minmax(0,1fr)_5rem_0.75rem]">
      <span className="tabular text-[11px] text-textMuted">{rank}</span>
      <Identity row={row} />
      <div className="text-right">
        <span
          className={clsx(
            'tabular text-sm font-semibold',
            row.change_pct >= 0 ? 'text-accentGreen' : 'text-accentRed',
          )}
        >
          {fmtPct(row.change_pct)}
        </span>
        <div className="tabular text-[11px] text-textMuted">{fmtPrice(row.price)}</div>
      </div>
      <Chevron />
    </RowLink>
  );
}

/** Skeleton that matches the real row grid, so nothing shifts when data lands. */
function RowSkeleton({ count, compact = false }: { count: number; compact?: boolean }) {
  return (
    <ul>
      {Array.from({ length: count }, (_, i) => (
        <li
          key={i}
          className={clsx(
            'grid items-center gap-3 border-t border-borderSubtle py-3',
            compact
              ? 'grid-cols-[1.5rem_minmax(0,1fr)_5rem_0.75rem]'
              : 'grid-cols-[1.75rem_minmax(0,1fr)_5.5rem_6rem_0.75rem] sm:grid-cols-[1.75rem_minmax(0,1fr)_7rem_6rem_6rem_0.75rem]',
          )}
        >
          <div className="h-3 w-3 rounded bg-white/5" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 rounded bg-white/5" />
            <div className="h-2.5 w-40 rounded bg-white/[0.03]" />
          </div>
          {!compact && <div className="hidden h-6 rounded bg-white/[0.03] sm:block" />}
          <div className="ml-auto h-3 w-16 rounded bg-white/5" />
          {!compact && <div className="ml-auto h-3 w-14 rounded bg-white/5" />}
          <div />
        </li>
      ))}
    </ul>
  );
}

/** Advancing vs declining as a single proportional bar. */
function Breadth({ advancing, declining }: { advancing: number; declining: number }) {
  const total = advancing + declining;
  if (!total) return null;
  const advPct = (advancing / total) * 100;
  return (
    <div className="flex items-center gap-3">
      <span className="tabular text-[11px] text-accentGreen">{advancing} adv</span>
      <div
        className="flex h-1.5 w-32 overflow-hidden rounded-full bg-red-400/25"
        role="img"
        aria-label={`${advancing} advancing, ${declining} declining`}
      >
        <div className="h-full bg-accentGreen" style={{ width: `${advPct}%` }} />
      </div>
      <span className="tabular text-[11px] text-accentRed">{declining} decl</span>
    </div>
  );
}

/** A section heading one level above Panel, so the three sections read as peers. */
function SectionHeading({
  title,
  blurb,
  icon,
  aside,
}: {
  title: string;
  blurb: string;
  icon: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2 border-b border-borderSubtle pb-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-textPrimary">
          {icon}
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-textSecondary">
          {blurb}
        </p>
      </div>
      {aside && (
        <div className="tabular shrink-0 text-[11px] text-textMuted sm:text-right">
          {aside}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- section 1 -------------------------------- */

function TopMoversSection({
  segments,
  loading,
  minMove,
}: {
  segments: SegmentSection[];
  loading: boolean;
  minMove: number;
}) {
  return (
    <section className="mb-12">
      <SectionHeading
        icon={<Layers size={17} className="text-accentAmber" />}
        title="Top movers by cap segment"
        blurb="Biggest absolute moves inside each NSE size bucket, so a 4% day in a largecap is not buried under a 20% day in a nano. Segment membership is the exchange's own constituent list; Unranked means the company trades on NSE but sits below the Total Market 750 line, where NSE publishes no size index."
        aside={
          segments.length > 0 && (
            <>
              {segments.reduce((n, s) => n + s.priced, 0)} priced across{' '}
              {segments.length} segments
            </>
          )
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Panel key={i} title="Loading">
              <RowSkeleton count={5} compact />
            </Panel>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {segments.map((s) => (
            <Panel
              key={s.segment}
              title={s.label}
              icon={
                <span
                  aria-hidden="true"
                  className={clsx(
                    'inline-block h-1.5 w-1.5 rounded-full',
                    s.segment === 'largecap' && 'bg-accentBlue',
                    s.segment === 'midcap' && 'bg-accentPurple',
                    s.segment === 'smallcap' && 'bg-accentCyan',
                    s.segment === 'microcap' && 'bg-accentAmber',
                    s.segment === 'unranked' && 'bg-textMuted',
                  )}
                />
              }
              aside={`${s.priced} priced`}
            >
              <div className="mb-1 flex items-center gap-3">
                <Breadth advancing={s.advancing} declining={s.declining} />
              </div>
              {s.movers.length > 0 ? (
                <ul>
                  {s.movers.map((row, i) => (
                    <CompactRow key={row.yahoo} row={row} rank={i + 1} />
                  ))}
                </ul>
              ) : (
                <EmptyState headline="Nothing priced in this segment yet." />
              )}
            </Panel>
          ))}
        </div>
      )}

      {!loading && segments.length === 0 && (
        <EmptyState
          headline={`No cap segments have priced names above ±${minMove}% yet.`}
          hint="The scan may still be filling in."
        />
      )}
    </section>
  );
}

/* ------------------------------- section 2 -------------------------------- */

/**
 * Bar count is shown because it is evidence, not trivia: a name that traded 2
 * five-minute bars was locked, and its 0% "range" means no trading rather than
 * no volatility. Hiding that would make the two cases look identical.
 */
function IntradaySectionView({
  intraday,
  loading,
}: {
  intraday: IntradaySection | undefined;
  loading: boolean;
}) {
  const measured = intraday?.measured_count ?? 0;
  return (
    <section className="mb-12">
      <SectionHeading
        icon={<Zap size={17} className="text-accentCyan" />}
        title="Top intraday stocks"
        blurb={
          intraday
            ? `Only MIS-eligible names — an intraday board listing stocks you cannot take an intraday position in would be decoration. Eligibility comes from the Groww instrument master; the range is measured from ${intraday.interval} closes as (high − low) ÷ previous close. Measuring all ${intraday.eligible_count} eligible names would cost ${Math.ceil(intraday.eligible_count / 20)} upstream calls per refresh, so the ${intraday.enrich_cap} biggest movers get measured and the rest fall back to their daily move.`
            : 'MIS-eligible names ranked by how far they actually travelled inside the session.'
        }
        aside={
          intraday && (
            <>
              <div>
                {intraday.eligible_count} MIS-eligible
              </div>
              <div>
                {measured} with a measured range
              </div>
            </>
          )
        }
      />

      <Panel
        title={
          intraday?.ranked_by === 'intraday_range_pct'
            ? `Ranked by ${intraday.interval} range`
            : 'Ranked by daily move'
        }
        icon={<Zap size={13} className="text-accentCyan" />}
        aside={
          intraday?.ranked_by === 'change_pct'
            ? 'intraday ranges not warm yet'
            : undefined
        }
      >
        {loading ? (
          <RowSkeleton count={10} />
        ) : intraday && intraday.rows.length > 0 ? (
          <ul>
            {intraday.rows.slice(0, 20).map((row, i) => (
              <RowLink
                key={row.yahoo}
                row={row}
                className="grid-cols-[1.75rem_minmax(0,1fr)_5rem_5.5rem_0.75rem] sm:grid-cols-[1.75rem_minmax(0,1fr)_7rem_5rem_5.5rem_0.75rem]"
              >
                <span className="tabular text-[11px] text-textMuted">{i + 1}</span>
                <Identity row={row} />
                <div className="hidden sm:block">
                  <Sparkline data={row.spark} className="h-7" />
                </div>
                <div className="text-right">
                  {row.intraday_range_pct !== undefined ? (
                    <>
                      <span className="tabular text-sm font-semibold text-accentCyan">
                        {row.intraday_range_pct.toFixed(2)}%
                      </span>
                      <div className="tabular text-[10px] text-textMuted">
                        {row.bars} bars
                      </div>
                    </>
                  ) : (
                    <span
                      className="tabular text-[11px] text-textMuted"
                      title="Outside the enriched shortlist for this warm cycle"
                    >
                      not measured
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <Change pct={row.change_pct} />
                </div>
                <Chevron />
              </RowLink>
            ))}
          </ul>
        ) : (
          <EmptyState
            headline="No MIS-eligible names priced in this scope yet."
            hint="Widen the scope, or wait for the scan to fill in."
          />
        )}
      </Panel>
    </section>
  );
}

/* ------------------------------- section 3 -------------------------------- */

const CONFIDENCE_STYLE: Record<string, { cls: string; title: string }> = {
  confirmed: {
    cls: 'border-accentGreen/40 text-accentGreen',
    title:
      'Close sits at a standard band AND the session’s 5-minute series shows the close pinned to the day’s extreme — what a locked book looks like.',
  },
  inferred: {
    cls: 'border-accentAmber/40 text-accentAmber',
    title:
      'Close sits at a standard band, but intraday data does not corroborate a lock — the round number may be coincidence.',
  },
  unverified: {
    cls: 'border-borderSubtle text-textMuted',
    title: 'Band match only; no intraday data warm yet for this name.',
  },
};

function ConfidenceBadge({ confidence }: { confidence?: string }) {
  const spec = CONFIDENCE_STYLE[confidence ?? 'unverified'];
  return (
    <span
      title={spec.title}
      className={clsx('label shrink-0 rounded border px-1 text-[9px] !tracking-wider', spec.cls)}
    >
      {confidence ?? 'unverified'}
    </span>
  );
}

function CircuitList({ rows, side }: { rows: MoverRow[]; side: 'upper' | 'lower' }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        headline={`No names closed at a ${side} band in this scope.`}
        hint={
          side === 'upper'
            ? 'On a quiet day this is genuinely empty rather than hidden.'
            : undefined
        }
      />
    );
  }
  return (
    <ul>
      {rows.slice(0, 20).map((row) => (
        <RowLink
          key={row.yahoo}
          row={row}
          className="grid-cols-[3rem_minmax(0,1fr)_5.5rem_0.75rem]"
        >
          <span
            className={clsx(
              'tabular text-[11px] font-bold',
              side === 'upper' ? 'text-accentGreen' : 'text-accentRed',
            )}
          >
            {row.circuit_band}%
          </span>
          <Identity row={row}>
            <ConfidenceBadge confidence={row.circuit_confidence} />
          </Identity>
          <div className="text-right">
            <span
              className={clsx(
                'tabular text-sm font-semibold',
                side === 'upper' ? 'text-accentGreen' : 'text-accentRed',
              )}
            >
              {fmtPct(row.change_pct)}
            </span>
            <div className="tabular text-[10px] text-textMuted">
              {row.bars !== undefined ? `${row.bars} bars` : fmtPrice(row.price)}
            </div>
          </div>
          <Chevron />
        </RowLink>
      ))}
    </ul>
  );
}

function CircuitsSection({
  circuits,
  loading,
}: {
  circuits: CircuitSections | undefined;
  loading: boolean;
}) {
  return (
    <section className="mb-12">
      <SectionHeading
        icon={<ArrowUpToLine size={17} className="text-accentGreen" />}
        title="Circuit hits"
        blurb={
          circuits
            ? `Names closing at a standard NSE price band (${circuits.bands
                .map((b) => `${b}%`)
                .join(', ')}). NSE publishes no per-stock band in any feed available here, so a hit is INFERRED from the close and then corroborated against the session's 5-minute series where that is warm — a locked stock closes at its own extreme and often trades a handful of bars. The 2% surveillance band is deliberately excluded: its window swallows too many ordinary closes to be told apart from noise.`
            : 'Names closing pinned at a standard NSE price band.'
        }
        aside={
          circuits && (
            <>
              <div>
                {circuits.upper_count} upper · {circuits.lower_count} lower
              </div>
              <div>{circuits.confirmed_count} corroborated</div>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="Upper circuit"
          icon={<ArrowUpToLine size={13} className="text-accentGreen" />}
          aside={circuits ? `${circuits.upper_count} names` : undefined}
        >
          {loading ? <RowSkeleton count={6} compact /> : (
            <CircuitList rows={circuits?.upper ?? []} side="upper" />
          )}
        </Panel>

        <Panel
          title="Lower circuit"
          icon={<ArrowDownToLine size={13} className="text-accentRed" />}
          aside={circuits ? `${circuits.lower_count} names` : undefined}
        >
          {loading ? <RowSkeleton count={6} compact /> : (
            <CircuitList rows={circuits?.lower ?? []} side="lower" />
          )}
        </Panel>
      </div>
    </section>
  );
}

/* ---------------------------------- page --------------------------------- */

export default function MoversPage() {
  // Defaults to the widest scope on purpose: a 20% circuit is almost never an
  // index constituent, so opening on an index would hide the headline rows.
  const [scope, setScope] = useState('allnse');
  const [minMove, setMinMove] = useState(5);
  const [data, setData] = useState<MoversResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Guards a slow response for an abandoned scope from overwriting a newer one.
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (opts: { showLoading: boolean }) => {
      const id = ++requestIdRef.current;
      if (opts.showLoading) setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/api/movers?scope=${encodeURIComponent(scope)}` +
            `&min_move=${minMove}&limit=${ROWS_PER_SIDE}`,
        );
        const json = await res.json();
        if (id !== requestIdRef.current) return; // a newer request superseded this
        if (!res.ok || json.error) {
          setError(json.error || `Request failed (${res.status})`);
        } else {
          setData(json as MoversResponse);
          setError(null);
        }
      } catch {
        if (id !== requestIdRef.current) return;
        setError('Cannot reach the backend. Start the Flask API on port 5000.');
      } finally {
        if (id === requestIdRef.current) setLoading(false);
      }
    },
    [scope, minMove],
  );

  useEffect(() => {
    load({ showLoading: true });
  }, [load]);

  // While the backend warms its price cache the board is genuinely partial, so
  // poll until coverage settles instead of presenting a fraction of the market
  // as if it were the whole thing.
  useEffect(() => {
    if (!data?.warming) return;
    const t = setTimeout(() => load({ showLoading: false }), POLL_MS);
    return () => clearTimeout(t);
  }, [data, load]);

  const scopes = data?.scopes ?? [];
  const indexScopes = scopes.filter((s) => s.group === 'index');
  const segmentScopes = scopes.filter((s) => s.group === 'segment');
  const showSkeleton = loading && !data;

  // How many names the size indices actually cover, read off the scope picker
  // rather than hardcoded — NSE rebalances these lists semi-annually.
  const rankedCount =
    scopes.find((s) => s.kind === 'ranked')?.count ?? null;

  return (
    <div className="min-h-screen">
      <Navigation />

      <PageShell>
        <PageHeader
          title="Movers"
          description={
            <>
              Every NSE cash-EQ company
              {rankedCount !== null && (
                <>
                  {' '}—{' '}
                  <span className="tabular">{data?.scanned.toLocaleString('en-IN')}</span>{' '}
                  names, not just the{' '}
                  <span className="tabular">{rankedCount.toLocaleString('en-IN')}</span> in
                  the size indices
                </>
              )}
              . The stocks that hit a 20% circuit are almost always the ones below the
              Total Market 750 line, so an index-only scan cannot see them however hard
              it looks.
            </>
          }
          meta={
            data && (
              <>
                {data.as_of && <span>Session {data.as_of}</span>}
                <span className="tabular">
                  {data.priced} of {data.scanned} priced
                  {data.coverage_pct < 100 && ` (${data.coverage_pct}%)`}
                </span>
                <Breadth
                  advancing={data.breadth.advancing}
                  declining={data.breadth.declining}
                />
              </>
            )
          }
        />

        {/* The section's five views, above this page's own scope pickers so
            the hierarchy reads section -> view -> filters. */}
        <MarketsTabs />

        {/* --------------------------- scope pickers ------------------------- */}
        <div className="mb-6 space-y-3">
          <ScopeRow
            label="Index"
            options={indexScopes}
            active={scope}
            onSelect={setScope}
            fallback={[
              { id: 'allnse', label: 'All NSE equity' },
              { id: 'totalmarket', label: 'NIFTY Total Market' },
              { id: 'nifty50', label: 'NIFTY 50' },
            ]}
          />
          <ScopeRow
            label="Segment"
            options={segmentScopes}
            active={scope}
            onSelect={setScope}
            fallback={[
              { id: 'largecap', label: 'Largecap' },
              { id: 'midcap', label: 'Midcap' },
              { id: 'smallcap', label: 'Smallcap' },
              { id: 'microcap', label: 'Microcap' },
            ]}
          />

          <div className="flex flex-wrap items-center gap-2">
            <span className="label w-16 shrink-0 text-[10px] text-textMuted">Moved</span>
            {THRESHOLDS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setMinMove(t)}
                aria-pressed={minMove === t}
                className={clsx(
                  'tabular inline-flex min-h-11 items-center rounded-full border px-3 py-1 text-[11px] transition-colors sm:min-h-0',
                  minMove === t
                    ? 'border-accentAmber/50 bg-accentAmber/10 text-accentAmber'
                    : 'border-borderSubtle text-textSecondary hover:border-borderSubtle hover:text-textPrimary',
                )}
              >
                ±{t}%
              </button>
            ))}
          </div>
        </div>

        {/* ------------------------- status / warnings ----------------------- */}
        {data?.warming && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-accentBlue/25 bg-accentBlue/[0.06] px-4 py-3 text-sm text-textSecondary">
            <Loader2 size={15} className="shrink-0 animate-spin text-accentBlue" />
            <span>
              {data.warm_progress?.phase === 'intraday'
                ? 'Measuring intraday ranges for the biggest movers'
                : 'Pricing the rest of the market'}
              {data.warm_progress &&
                ` (${data.warm_progress.done} of ${data.warm_progress.total} batches)`}
              . Showing {data.priced} names so far; this board is still partial.
            </span>
          </div>
        )}

        {data && data.excluded_implausible > 0 && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-accentPurple/25 bg-accentPurple/[0.06] px-4 py-3 text-sm text-textSecondary">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-accentPurple" />
            <span>
              Dropped{' '}
              <span className="tabular font-semibold text-textPrimary">
                {data.excluded_implausible}
              </span>{' '}
              row{data.excluded_implausible === 1 ? '' : 's'} moving more than{' '}
              <span className="tabular">±{data.sanity_max_move_pct}%</span>. NSE&apos;s
              widest cash band is 20%, so these are unadjusted splits or bonuses in the
              price series rather than sessions
              {data.excluded_examples.length > 0 && (
                <>
                  {' '}
                  —{' '}
                  {data.excluded_examples.map((e, i) => (
                    <span key={e.symbol}>
                      {i > 0 && ', '}
                      <span className="ticker text-textPrimary">{e.symbol}</span>{' '}
                      <span className="tabular">{fmtPct(e.change_pct)}</span>
                    </span>
                  ))}
                </>
              )}
              .
            </span>
          </div>
        )}

        {data && data.warnings.length > 0 && (
          <div className="mb-6 space-y-1 rounded-lg border border-accentAmber/25 bg-accentAmber/[0.06] px-4 py-3 text-sm text-textSecondary">
            {data.warnings.map((w) => (
              <div key={w} className="flex items-start gap-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-accentAmber" />
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-accentRed/30 bg-red-400/[0.06] px-4 py-3 text-sm text-textSecondary">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-accentRed" />
            <div>
              <p className="text-textPrimary">{error}</p>
              <button
                type="button"
                onClick={() => load({ showLoading: true })}
                className="mt-1 text-xs text-accentGreen underline underline-offset-4"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* ======================= the three sections ======================= */}

        <TopMoversSection
          segments={data?.segments ?? []}
          loading={showSkeleton}
          minMove={minMove}
        />

        <IntradaySectionView intraday={data?.intraday} loading={showSkeleton} />

        <CircuitsSection circuits={data?.circuits} loading={showSkeleton} />

        {/* --------------------- reference: the full board ------------------- */}
        <section className="mb-12">
          <SectionHeading
            icon={<Layers size={17} className="text-textSecondary" />}
            title={`Everything that moved ±${minMove}% or more`}
            blurb="The unsegmented board, ranked by absolute move across the whole scope. Use the threshold buttons above to tighten or widen it."
            aside={data ? `${data.big_mover_count} in ${data.scope_label}` : undefined}
          />
          <Panel>
            {showSkeleton ? (
              <RowSkeleton count={8} />
            ) : data && data.big_movers.length > 0 ? (
              <ul>
                {data.big_movers.slice(0, 25).map((row, i) => (
                  <Row key={row.yahoo} row={row} rank={i + 1} />
                ))}
              </ul>
            ) : (
              <EmptyState
                headline={`Nothing moved ±${minMove}% in ${data?.scope_label ?? 'this scope'}.`}
                hint={
                  data?.partial
                    ? 'The scan is still filling in, so check back in a moment.'
                    : 'Lower the threshold, or widen the scope to All NSE equity.'
                }
              />
            )}
          </Panel>
        </section>

        {/* ------------------------ gainers and losers ----------------------- */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel
            title="Top gainers"
            icon={<TrendingUp size={13} className="text-accentGreen" />}
            aside={data ? data.scope_label : undefined}
          >
            {showSkeleton ? (
              <RowSkeleton count={ROWS_PER_SIDE} />
            ) : data && data.gainers.length > 0 ? (
              <ul>
                {data.gainers.map((row, i) => (
                  <Row key={row.yahoo} row={row} rank={i + 1} />
                ))}
              </ul>
            ) : (
              <EmptyState headline="No priced names in this scope yet." />
            )}
          </Panel>

          <Panel
            title="Top losers"
            icon={<TrendingDown size={13} className="text-accentRed" />}
            aside={data ? data.scope_label : undefined}
          >
            {showSkeleton ? (
              <RowSkeleton count={ROWS_PER_SIDE} />
            ) : data && data.losers.length > 0 ? (
              <ul>
                {data.losers.map((row, i) => (
                  <Row key={row.yahoo} row={row} rank={i + 1} />
                ))}
              </ul>
            ) : (
              <EmptyState headline="No priced names in this scope yet." />
            )}
          </Panel>
        </div>

        <p className="mt-8 font-mono text-[11px] leading-relaxed text-textMuted">
          Size-segment membership is the exchange&apos;s own: NIFTY 50, Next 50, Midcap
          150, Smallcap 250 and Microcap 250 constituent lists. Everything else NSE
          lists in the cash EQ series is labelled Unranked rather than assigned a cap
          tier it does not have. ETFs and mutual funds are excluded by ISIN range, and
          MIS eligibility plus F&amp;O flags come from the Groww instrument master.
          Prices are end-of-session daily closes, not a live tick feed; intraday
          figures are 5-minute closes. All trading here is paper. Click any row to open
          it in the{' '}
          <Link
            href="/screener"
            className="underline underline-offset-4 hover:text-textSecondary"
          >
            terminal
          </Link>
          .
        </p>
      </PageShell>
    </div>
  );
}

/* ----------------------------- sub-components ---------------------------- */

function ScopeRow({
  label,
  options,
  active,
  onSelect,
  fallback,
}: {
  label: string;
  options: { id: string; label: string; count: number }[];
  active: string;
  onSelect: (id: string) => void;
  /** Rendered before the first response lands, so the picker is never empty. */
  fallback: { id: string; label: string }[];
}) {
  const items = options.length ? options : fallback.map((f) => ({ ...f, count: 0 }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label w-16 shrink-0 text-[10px] text-textMuted">{label}</span>
      {items.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onSelect(s.id)}
          aria-pressed={active === s.id}
          className={clsx(
            'inline-flex min-h-11 items-center rounded-full border px-3 py-1 font-mono text-[11px] font-medium transition-colors sm:min-h-0',
            active === s.id
              ? 'border-accentGreen/50 bg-emerald-400/10 text-accentGreen'
              : 'border-borderSubtle text-textSecondary hover:text-textPrimary',
          )}
        >
          {s.label}
          {s.count > 0 && (
            <span className="tabular ml-1.5 text-[10px] text-textMuted">{s.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function EmptyState({ headline, hint }: { headline: string; hint?: string }) {
  return (
    <div className="border-t border-borderSubtle py-12 text-center">
      <p className="text-sm text-textSecondary">{headline}</p>
      {hint && <p className="mt-1 text-xs text-textMuted">{hint}</p>}
    </div>
  );
}
