import { useMemo } from 'react';
import type { UniverseMeta } from '../../types/discover';

/**
 * Grouped universe dropdown.
 *
 * Replaces the old chip row, which worked at three universes and does not at
 * twelve — the NIFTY index families alone are five entries, and a wrapping
 * two-line chip row buries the market you actually want. A native <select>
 * with <optgroup> gets the OS picker on mobile for free and stays one line.
 *
 * A universe whose membership could not be built (the NIFTY families depend on
 * the NSE constituent feed) stays visible but disabled, labelled as such:
 * dropping it silently would read as a bug rather than as an upstream outage.
 */

const GROUP_ORDER = ['US', 'India', 'Global', 'Crypto', 'Commodities'];

export default function UniversePicker({
  universes,
  value,
  onChange,
  id = 'universe-select',
}: {
  universes: UniverseMeta[];
  value: string;
  onChange: (id: string) => void;
  id?: string;
}) {
  const groups = useMemo(() => {
    const byGroup = new Map<string, UniverseMeta[]>();
    for (const u of universes) {
      const key = u.group || 'Other';
      const bucket = byGroup.get(key);
      if (bucket) bucket.push(u);
      else byGroup.set(key, [u]);
    }
    // Known groups in the documented order, then anything the backend adds
    // later that this list has not caught up with.
    const ordered = [
      ...GROUP_ORDER.filter((g) => byGroup.has(g)),
      ...[...byGroup.keys()].filter((g) => !GROUP_ORDER.includes(g)),
    ];
    return ordered.map((group) => ({ group, items: byGroup.get(group)! }));
  }, [universes]);

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-[10px] font-mono uppercase tracking-wider text-textMuted">
        Universe
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[190px] rounded-lg border border-borderSubtle bg-black/30 px-3 py-1.5 text-sm text-textPrimary transition-colors focus:border-accentCyan/50"
      >
        {groups.map(({ group, items }) => (
          <optgroup key={group} label={group}>
            {items.map((u) => (
              <option key={u.id} value={u.id} disabled={u.available === false}>
                {u.label}
                {u.available === false
                  ? ' — unavailable'
                  : u.count > 0 && ` (${u.count})`}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
