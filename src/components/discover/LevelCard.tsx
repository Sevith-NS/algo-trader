import Link from 'next/link';
import clsx from 'clsx';
import { Layers, RefreshCw } from 'lucide-react';
import type { LevelRow } from '../../types/discover';
import { fmtPrice } from '../intel/format';
import Sparkline from './Sparkline';

/**
 * One name sitting at a respected level.
 *
 * The hero here is the DISTANCE — how far price is from the level is the whole
 * reason the row exists, so it gets the largest type, and the level price sits
 * directly under it. Side is carried by an explicit "SUPPORT"/"RESISTANCE"
 * word as well as color, per the non-color-redundancy requirement.
 */

const SIDE_STYLES = {
  resistance: {
    chip: 'border-red-400/30 bg-red-400/10 text-accentRed',
    rail: 'bg-accentRed',
    label: 'Resistance',
  },
  support: {
    chip: 'border-emerald-400/30 bg-emerald-400/10 text-accentGreen',
    rail: 'bg-accentGreen',
    label: 'Support',
  },
} as const;

export default function LevelCard({ row }: { row: LevelRow }) {
  const side = SIDE_STYLES[row.side];
  // The level is above spot for resistance, below for support — say which way
  // in words rather than relying on the sign of a number.
  const direction = row.distance_pct >= 0 ? 'above' : 'below';

  return (
    <Link
      href={`/screener?q=${encodeURIComponent(row.symbol)}`}
      className="glass-panel relative block overflow-hidden p-4 transition-colors hover:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-accentCyan/50"
    >
      {/* Side rail: the one place color alone is used, and it is decorative —
          every fact it encodes is also written out below. */}
      <span className={clsx('absolute left-0 top-0 h-full w-0.5', side.rail)} aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-textPrimary">{row.symbol}</div>
          <div className="truncate text-xs text-textMuted">{row.name}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular text-textPrimary">
            {fmtPrice(row.price, row.currency)}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-textMuted">spot</div>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-bold tabular leading-none text-textPrimary">
            {Math.abs(row.distance_pct).toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-textSecondary">
            {direction} · {side.label.toLowerCase()} at{' '}
            <span className="tabular text-textPrimary">{fmtPrice(row.level, row.currency)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular text-textPrimary">
            {row.distance_sigmas.toFixed(1)}σ
          </div>
          <div className="text-[10px] text-textMuted">of a daily move</div>
        </div>
      </div>

      <div className="mt-3">
        <Sparkline data={row.spark} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className={clsx('rounded border px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider', side.chip)}>
          {side.label}
        </span>
        <span className="rounded border border-borderSubtle bg-white/5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-textSecondary">
          {row.timeframe}
        </span>
        <span className="rounded border border-borderSubtle bg-white/5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-textSecondary">
          <span className="tabular">{row.touches}</span> touches
        </span>
        {row.confluence && (
          <span
            title="A level at this price exists on both the daily and the weekly"
            className="flex items-center gap-1 rounded border border-accentCyan/30 bg-accentCyan/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-accentCyan"
          >
            <Layers size={9} /> D+W
          </span>
        )}
        {row.flipped && (
          <span
            title="Has acted as both support and resistance"
            className="flex items-center gap-1 rounded border border-accentPurple/30 bg-accentPurple/10 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-accentPurple"
          >
            <RefreshCw size={9} /> Flip
          </span>
        )}
      </div>

      <p className="mt-2 text-[11px] leading-snug text-textMuted">{row.reason}</p>

      <div className="mt-2 flex items-center gap-2 border-t border-borderSubtle pt-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-textMuted">Level quality</span>
        {/* The bar is a redundant read of the number beside it, not the only one. */}
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
          <div
            className="h-full rounded-full bg-accentCyan/70"
            style={{ width: `${Math.max(0, Math.min(100, row.score))}%` }}
          />
        </div>
        <span className="tabular text-[10px] text-textSecondary">{row.score.toFixed(0)}</span>
      </div>
    </Link>
  );
}
