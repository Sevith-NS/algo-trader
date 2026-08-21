import clsx from 'clsx';
import { AlertTriangle } from 'lucide-react';
import type { Freshness } from '../../types/discover';

/**
 * "as of <date>", and a warning when that date has stopped moving.
 *
 * The backend serves cached market data for up to seven days when upstream is
 * unreachable — the right call, since a stale board beats no board. But it
 * means a scan can keep returning the same names day after day with nothing on
 * screen explaining why, which reads as "the app is broken" rather than "the
 * feed is down". This is the missing explanation.
 */
export default function FreshnessNote({
  asOf,
  freshness,
  className,
}: {
  asOf?: string;
  freshness?: Partial<Freshness>;
  className?: string;
}) {
  if (!asOf) return null;
  const age = freshness?.as_of_age_days;
  const stale = freshness?.stale === true;

  if (!stale) {
    return <span className={clsx('text-xs text-textMuted', className)}>as of {asOf}</span>;
  }

  return (
    <span
      className={clsx(
        'flex items-center gap-1.5 rounded border border-accentAmber/30 bg-accentAmber/10 px-2 py-1 text-xs text-accentAmber',
        className,
      )}
      title="The upstream feed has not returned a newer bar. Cached data is being served."
    >
      <AlertTriangle size={12} />
      Data stale — newest bar is {asOf}
      {age != null && <span className="tabular">({age}d old)</span>}
    </span>
  );
}
