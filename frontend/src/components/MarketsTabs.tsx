'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Flame, TrendingUp, Compass, Ruler, ScanSearch } from 'lucide-react';
import clsx from 'clsx';

/**
 * One section, five views.
 *
 * Markets, Movers and Discover were three top-level nav items answering the
 * same question — "what is happening out there, and what should I look at?" —
 * and they had drifted into duplicating each other: /markets rendered the exact
 * IdeaCard grid, off the exact /api/discover payload, with the exact tag
 * filters that /discover's Ideas tab did. A user who found setups on one page
 * had no way to know the other page was the same thing.
 *
 * So the three routes now present as one section with a persistent view strip.
 * The routes are unchanged (each still owns its own fetch, cache and polling
 * behaviour — Movers alone polls every 4s against an NSE-wide scan, which does
 * not belong inside a shared shell), but the user reads them as tabs.
 *
 * Each view is a real page, so these are <Link>s, not buttons: middle-click,
 * cmd-click and the back button all behave. `prefetch` is left on Next's
 * default, which warms each view as the strip scrolls into range.
 */

type View = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** What this view answers, in the user's words. Shown as the strip's caption. */
  blurb: string;
  /** Route this view lives on, for active matching. */
  route: string;
  /** Search param that selects it within that route, when the route has several. */
  tab?: string;
};

const VIEWS: View[] = [
  {
    href: '/markets',
    route: '/markets',
    label: 'Heat',
    icon: <Flame size={13} />,
    blurb: 'every market at a glance, coloured by the day',
  },
  {
    href: '/movers',
    route: '/movers',
    label: 'Movers',
    icon: <TrendingUp size={13} />,
    blurb: 'the whole NSE ranked by single-day change',
  },
  {
    href: '/discover?tab=ideas',
    route: '/discover',
    tab: 'ideas',
    label: 'Ideas',
    icon: <Compass size={13} />,
    blurb: 'tagged setups with the numbers that fired',
  },
  {
    href: '/discover?tab=levels',
    route: '/discover',
    tab: 'levels',
    label: 'Levels',
    icon: <Ruler size={13} />,
    blurb: 'names sitting on support or resistance',
  },
  {
    href: '/discover?tab=screens',
    route: '/discover',
    tab: 'screens',
    label: 'Screens',
    icon: <ScanSearch size={13} />,
    blurb: 'run a saved screen across a universe',
  },
];

/**
 * useSearchParams opts the subtree into client rendering, and the App Router
 * requires a Suspense boundary around it or prerendering bails for the whole
 * page. Owning the boundary here means no caller can forget it — and the
 * fallback is the strip's own silhouette, so nothing shifts when it resolves.
 */
export default function MarketsTabs({ className }: { className?: string }) {
  return (
    <Suspense
      fallback={
        <div className={clsx('mb-6', className)}>
          <div className="h-[46px] w-[420px] max-w-full rounded-xl border border-borderSubtle bg-white/[0.03]" />
          <div className="mt-2 h-4" />
        </div>
      }
    >
      <MarketsTabsInner className={className} />
    </Suspense>
  );
}

function MarketsTabsInner({ className }: { className?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // /discover with no ?tab= is Ideas, matching the page's own default. Without
  // this the strip would show nothing active on a bare /discover visit.
  const activeTab = searchParams.get('tab') || 'ideas';

  const isActive = (v: View) =>
    pathname === v.route && (v.tab === undefined || v.tab === activeTab);

  const current = VIEWS.find(isActive);

  return (
    <div className={clsx('mb-6', className)}>
      <div
        // The strip scrolls rather than wraps on narrow screens: five views
        // wrapping to two rows would push the page content below the fold on a
        // phone, and a wrapped tab strip stops reading as one control.
        // `-mx-*` + matching padding lets the scroll run edge-to-edge instead
        // of clipping inside the content column.
        className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <nav
          aria-label="Market views"
          className="inline-flex min-w-max items-center gap-0.5 rounded-xl border border-borderSubtle bg-white/[0.03] p-1"
        >
          {VIEWS.map((v) => {
            const active = isActive(v);
            return (
              <Link
                key={v.href}
                href={v.href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  // min-h-9 keeps every tab on one comfortable touch row; the
                  // icon is sized to the label rather than floating above it.
                  'flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors duration-150',
                  active
                    ? 'bg-white/[0.09] text-textPrimary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]'
                    : 'text-textSecondary hover:bg-white/[0.04] hover:text-textPrimary',
                )}
              >
                <span className={active ? 'text-accentGreen' : 'text-textMuted'}>{v.icon}</span>
                {v.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {current && (
        // The caption is the payoff of merging these: standing on any view, you
        // can read what the neighbouring views are for without visiting them.
        <p className="mt-2 text-xs text-textMuted">{current.blurb}</p>
      )}
    </div>
  );
}
