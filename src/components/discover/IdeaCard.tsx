import Link from 'next/link';
import clsx from 'clsx';
import type { DiscoverCard } from '../../types/discover';
import { fmtPrice } from '../intel/format';
import { TAG_STYLES } from './tagStyles';
import Sparkline from './Sparkline';
import PctChip from './PctChip';

/**
 * One horizon-tagged idea card. Purely descriptive — the tag reasons are the
 * evidence, the click-through lands on the Terminal for the full readout.
 */
export default function IdeaCard({ card }: { card: DiscoverCard }) {
  return (
    <Link
      href={`/screener?q=${encodeURIComponent(card.symbol)}`}
      className="glass-panel block p-4 transition-colors hover:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-accentCyan/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold text-textPrimary">{card.symbol}</div>
          <div className="truncate text-xs text-textMuted">{card.name}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular text-textPrimary">
            {fmtPrice(card.price, card.currency)}
          </div>
          <div className="mt-0.5">
            <PctChip value={card.change_1d_pct} />
          </div>
        </div>
      </div>

      <div className="mt-2">
        <Sparkline data={card.spark} />
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {card.tags.map((tag) => (
          <span
            key={tag.id}
            className={clsx(
              'rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
              TAG_STYLES[tag.id].chip,
            )}
          >
            {tag.label}
          </span>
        ))}
      </div>

      <div className="mt-2 space-y-1">
        {card.tags.map((tag) => (
          <div key={tag.id} className="flex items-start gap-1.5">
            <span className={clsx('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', TAG_STYLES[tag.id].dot)} />
            <span className="text-[11px] leading-snug text-textMuted">{tag.reason}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}
