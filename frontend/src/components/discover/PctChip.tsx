import clsx from 'clsx';

/**
 * Signed day-change chip. The sign is always explicit (+ / -) so direction
 * survives without color — non-color redundancy is a hard requirement.
 */
export default function PctChip({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) return <span className="text-xs text-textMuted">—</span>;
  return (
    <span
      className={clsx(
        'whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold tabular',
        value >= 0 ? 'bg-emerald-400/10 text-accentGreen' : 'bg-red-400/10 text-accentRed',
      )}
    >
      {value >= 0 ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}
