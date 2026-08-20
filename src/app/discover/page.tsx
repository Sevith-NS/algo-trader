'use client';
import { useEffect, useMemo, useRef, useState, Fragment, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { WifiOff, SearchX, RotateCw } from 'lucide-react';
import clsx from 'clsx';
import Navigation from '../../components/Navigation';
import MarketsTabs from '../../components/MarketsTabs';
import IdeaCard from '../../components/discover/IdeaCard';
import LevelCard from '../../components/discover/LevelCard';
import PctChip from '../../components/discover/PctChip';
import UniversePicker from '../../components/discover/UniversePicker';
import FreshnessNote from '../../components/discover/FreshnessNote';
import { TAG_ORDER, TAG_LABELS, TAG_STYLES } from '../../components/discover/tagStyles';
import { fmtPrice } from '../../components/intel/format';
import { API_BASE } from '../../lib/api';
import type {
  DiscoverResponse,
  HorizonTagId,
  LevelSide,
  LevelsResponse,
  ScreenMeta,
  ScreensListResponse,
  ScreenRunResponse,
  UniverseMeta,
} from '../../types/discover';

const BACKEND_DOWN = 'Market data backend unreachable. Start it with: cd backend && python app.py';

// Shown while the first response is in flight. The real list (with live
// counts, groups and availability) replaces this from any scan payload.
const FALLBACK_UNIVERSES: UniverseMeta[] = [
  { id: 'us_large', label: 'US Large Cap', group: 'US', count: 0, available: true },
  { id: 'nifty50', label: 'NIFTY 50', group: 'India', count: 0, available: true },
  { id: 'crypto', label: 'Crypto Majors', group: 'Crypto', count: 0, available: true },
];

const DEFAULT_SCREEN = 'short_term_breakout';

const LEVEL_SIDES: { id: LevelSide | 'all'; label: string }[] = [
  { id: 'all', label: 'Both' },
  { id: 'resistance', label: 'At resistance' },
  { id: 'support', label: 'At support' },
];

/** 429 message with Retry-After from the header, or the JSON body as fallback. */
function rateLimitMessage(res: Response, body: any): string {
  const retryAfter = res.headers.get('Retry-After')
    || (body?.retry_after_seconds != null ? String(Math.ceil(body.retry_after_seconds)) : null);
  return `Rate limited. Too many requests. Try again in ${retryAfter || 'a few'} seconds.`;
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="glass-panel flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff size={22} className="text-accentAmber" />
      <p className="max-w-md text-sm leading-relaxed text-textSecondary">{message}</p>
    </div>
  );
}

type DiscoverTab = 'ideas' | 'levels' | 'screens';

const TABS: DiscoverTab[] = ['ideas', 'levels', 'screens'];

/**
 * The URL is the source of truth for which view is showing.
 *
 * Discover's three views are three of the five in the Markets section strip
 * (see MarketsTabs), and that strip navigates rather than toggling local
 * state — so the tab has to survive a real navigation, a refresh and a shared
 * link. An unrecognised or absent ?tab= falls back to Ideas rather than
 * rendering nothing.
 */
function DiscoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tabParam = searchParams.get('tab');
  const tab: DiscoverTab = TABS.includes(tabParam as DiscoverTab)
    ? (tabParam as DiscoverTab)
    : 'ideas';
  const [universe, setUniverse] = useState('us_large');
  const [tagFilter, setTagFilter] = useState<HorizonTagId | 'all'>('all');

  // Ideas
  const [discover, setDiscover] = useState<DiscoverResponse | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasError, setIdeasError] = useState('');
  // Kept out of `discover` so the switcher chips survive a universe change.
  const [universes, setUniverses] = useState<UniverseMeta[]>(FALLBACK_UNIVERSES);

  // Levels
  const [levels, setLevels] = useState<LevelsResponse | null>(null);
  const [levelsLoading, setLevelsLoading] = useState(false);
  const [levelsError, setLevelsError] = useState('');
  const [levelSide, setLevelSide] = useState<LevelSide | 'all'>('all');

  // Screens
  const [screensList, setScreensList] = useState<ScreensListResponse | null>(null);
  const [screensError, setScreensError] = useState('');
  const [screensRetryNonce, setScreensRetryNonce] = useState(0);
  const [selectedScreen, setSelectedScreen] = useState(DEFAULT_SCREEN);
  const [run, setRun] = useState<ScreenRunResponse | null>(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runError, setRunError] = useState('');

  // Which universe the current `discover` data was fetched for — lets the
  // ideas effect skip refetching while the Screens tab is active.
  const ideasFetchedFor = useRef<string | null>(null);

  const switchUniverse = (id: string) => {
    setUniverse(id);
    setTagFilter('all'); // the new universe may not contain the active tag
  };

  // ---- Ideas: fetch when the Ideas tab needs data it doesn't have ----
  // Gated on the active tab so a universe switch on the Screens tab doesn't
  // fire a hidden full /api/discover scan for a surface nobody is looking at.
  useEffect(() => {
    if (tab !== 'ideas' || ideasFetchedFor.current === universe) return;
    let cancelled = false;

    async function fetchDiscover() {
      setIdeasLoading(true);
      setDiscover(null);
      setIdeasError('');
      try {
        const res = await fetch(`${API_BASE}/api/discover?universe=${encodeURIComponent(universe)}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.status === 429) {
          setIdeasError(rateLimitMessage(res, data));
        } else if (!res.ok || data?.error) {
          setIdeasError(data?.error || `Discover request failed (${res.status}).`);
        } else {
          setDiscover(data as DiscoverResponse);
          ideasFetchedFor.current = universe; // errors leave this null → retried on tab return
          if (Array.isArray(data.universes) && data.universes.length > 0) {
            setUniverses(data.universes);
          }
        }
      } catch (err) {
        console.error('Failed to fetch discover data', err);
        if (!cancelled) setIdeasError(BACKEND_DOWN);
      } finally {
        if (!cancelled) setIdeasLoading(false);
      }
    }

    fetchDiscover();
    return () => { cancelled = true; };
  }, [tab, universe]);

  // ---- Levels: fetch on universe / side change, only while the tab is open --
  // Gated on the tab for the same reason Ideas is: switching universe from
  // another tab must not fire a scan nobody is looking at.
  useEffect(() => {
    if (tab !== 'levels') return;
    let cancelled = false;

    async function fetchLevels() {
      setLevelsLoading(true);
      setLevels(null);
      setLevelsError('');
      try {
        const res = await fetch(
          `${API_BASE}/api/levels?universe=${encodeURIComponent(universe)}&side=${encodeURIComponent(levelSide)}`
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.status === 429) {
          setLevelsError(rateLimitMessage(res, data));
        } else if (!res.ok || data?.error) {
          setLevelsError(data?.error || `Levels request failed (${res.status}).`);
        } else {
          setLevels(data as LevelsResponse);
          if (Array.isArray(data.universes) && data.universes.length > 0) {
            setUniverses(data.universes);
          }
        }
      } catch (err) {
        console.error('Failed to fetch levels', err);
        if (!cancelled) setLevelsError(BACKEND_DOWN);
      } finally {
        if (!cancelled) setLevelsLoading(false);
      }
    }

    fetchLevels();
    return () => { cancelled = true; };
  }, [tab, universe, levelSide]);

  // ---- Screens: fetch the list once, on first visit to the tab ----
  useEffect(() => {
    if (tab !== 'screens' || screensList) return;
    let cancelled = false;
    void screensRetryNonce; // dep: the Retry button re-arms this effect

    async function fetchScreens() {
      setScreensError('');
      try {
        const res = await fetch(`${API_BASE}/api/screens`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.status === 429) {
          setScreensError(rateLimitMessage(res, data));
        } else if (!res.ok || data?.error) {
          setScreensError(data?.error || `Screens request failed (${res.status}).`);
        } else {
          setScreensList(data as ScreensListResponse);
        }
      } catch (err) {
        console.error('Failed to fetch screens list', err);
        if (!cancelled) setScreensError(BACKEND_DOWN);
      }
    }

    fetchScreens();
    return () => { cancelled = true; };
  }, [tab, screensList, screensRetryNonce]);

  // ---- Screens: run the selected screen on selection/universe change ----
  // Paused while the catalogue itself is errored — running an invisible scan
  // behind the error state would waste rate-limit tokens for nothing.
  useEffect(() => {
    if (tab !== 'screens' || screensError) return;
    let cancelled = false;

    async function fetchRun() {
      setRunLoading(true);
      setRun(null);
      setRunError('');
      try {
        const res = await fetch(
          `${API_BASE}/api/screens/run?id=${encodeURIComponent(selectedScreen)}&universe=${encodeURIComponent(universe)}`
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.status === 429) {
          setRunError(rateLimitMessage(res, data));
        } else if (!res.ok || data?.error) {
          setRunError(data?.error || `Screen run failed (${res.status}).`);
        } else {
          setRun(data as ScreenRunResponse);
        }
      } catch (err) {
        console.error('Failed to run screen', err);
        if (!cancelled) setRunError(BACKEND_DOWN);
      } finally {
        if (!cancelled) setRunLoading(false);
      }
    }

    fetchRun();
    return () => { cancelled = true; };
  }, [tab, selectedScreen, universe, screensError]);

  // ---- Ideas derivations ----
  const cards = discover?.cards ?? [];
  const tagCounts = useMemo(() => {
    const counts = {} as Record<HorizonTagId, number>;
    for (const card of cards) {
      for (const tag of card.tags) counts[tag.id] = (counts[tag.id] || 0) + 1;
    }
    return counts;
  }, [cards]);
  const presentTags = TAG_ORDER.filter((id) => tagCounts[id] > 0);
  const filteredCards = tagFilter === 'all'
    ? cards
    : cards.filter((c) => c.tags.some((t) => t.id === tagFilter));

  // ---- Screens derivations ----
  const groupedScreens = useMemo(() => {
    if (!screensList) return [] as { category: string; screens: ScreenMeta[] }[];
    // Response category order first, then any stragglers the list missed.
    const order = [
      ...screensList.categories,
      ...screensList.screens.map((s) => s.category).filter((c) => !screensList.categories.includes(c)),
    ];
    return [...new Set(order)]
      .map((category) => ({ category, screens: screensList.screens.filter((s) => s.category === category) }))
      .filter((g) => g.screens.length > 0);
  }, [screensList]);

  // A run only "belongs" to the UI when it matches the CURRENT selection —
  // otherwise the previous screen's (or universe's) results would paint
  // under the new selection for a frame before the fetch effect clears them.
  const currentRun =
    run && run.screen.id === selectedScreen && run.universe === universe ? run : null;

  const activeMeta: ScreenMeta | undefined =
    currentRun?.screen ?? screensList?.screens.find((s) => s.id === selectedScreen);

  const goToSymbol = (symbol: string) => router.push(`/screener?q=${encodeURIComponent(symbol)}`);

  // Freshness belongs to whichever scan the user is actually looking at —
  // showing Ideas' as_of while the Levels tab is open would misattribute it.
  const active = tab === 'ideas' ? discover : tab === 'levels' ? levels : currentRun;

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="pt-28">
        <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 sm:px-6 lg:px-8">

          {/* ---- Header ---- */}
          <div className="mb-5">
            <h1 className="text-3xl font-black tracking-tight text-textPrimary sm:text-4xl">Discover</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-textSecondary">
              Candidates, not calls. Setups, price levels and screens on delayed
              data. Paper trading only.
            </p>
          </div>

          {/* The section's five views. Discover owns three of them; the strip
              carries the other two, which is what retired the paragraph that
              used to explain here how Discover differs from Movers. Adjacency
              in one control says it better than prose did. */}
          <MarketsTabs />

          <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <UniversePicker
              universes={universes}
              value={universe}
              onChange={switchUniverse}
            />
            <FreshnessNote asOf={active?.as_of} freshness={active ?? undefined} />
          </div>

          {/* Ranking is a per-tab claim, not a page-wide one: Levels ranks by
              level quality, because "which names are at the best levels" has an
              ordered answer. Ideas and Screens are alphabetical and refuse to
              rank, and saying so where the list actually appears beats a
              disclaimer paragraph in the header nobody reads. */}
          {tab !== 'levels' && (
            <p className="mb-4 text-xs text-textMuted">
              Listed alphabetically — this tab does not rank.
            </p>
          )}

          {/* ================= IDEAS ================= */}
          {tab === 'ideas' && (
            ideasLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="glass-panel h-40 motion-safe:animate-pulse" />
                ))}
              </div>
            ) : ideasError ? (
              <ErrorPanel message={ideasError} />
            ) : (
              <>
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={() => setTagFilter('all')}
                    aria-pressed={tagFilter === 'all'}
                    className={clsx(
                      'rounded border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors',
                      tagFilter === 'all'
                        ? 'border-white/20 bg-white/10 text-textPrimary'
                        : 'border-borderSubtle text-textSecondary hover:bg-white/5'
                    )}
                  >
                    All ({cards.length})
                  </button>
                  {presentTags.map((id) => (
                    <button
                      key={id}
                      onClick={() => setTagFilter(id)}
                      aria-pressed={tagFilter === id}
                      className={clsx(
                        'rounded border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors',
                        tagFilter === id
                          ? TAG_STYLES[id].chip
                          : 'border-borderSubtle text-textSecondary hover:bg-white/5'
                      )}
                    >
                      {TAG_LABELS[id]} ({tagCounts[id]})
                    </button>
                  ))}
                </div>

                {filteredCards.length === 0 ? (
                  <p className="py-12 text-center text-sm text-textMuted">
                    No setups match this filter in {discover?.universe_label ?? 'this universe'} right now.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {filteredCards.map((card) => (
                      <IdeaCard key={card.symbol} card={card} />
                    ))}
                  </div>
                )}
              </>
            )
          )}

          {/* ================= LEVELS ================= */}
          {tab === 'levels' && (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {LEVEL_SIDES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setLevelSide(s.id)}
                      aria-pressed={levelSide === s.id}
                      className={clsx(
                        'rounded border px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors',
                        levelSide === s.id
                          ? 'border-white/20 bg-white/10 text-textPrimary'
                          : 'border-borderSubtle text-textSecondary hover:bg-white/5'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                {levels && (
                  <p className="text-xs text-textMuted">
                    <span className="tabular">{levels.matched}</span> at a level ·{' '}
                    <span className="tabular">{levels.parsed}</span> of{' '}
                    <span className="tabular">{levels.scanned}</span> scanned
                  </p>
                )}
              </div>

              {/* State the method and its limit up front. A level board that
                  does not say what counts as a touch is not auditable. */}
              <p className="mb-4 max-w-3xl text-xs leading-relaxed text-textMuted">
                Swing pivots from the last year of <strong className="font-semibold text-textSecondary">closing</strong> prices,
                clustered into levels on the daily and weekly, then scored by how many
                times each was respected, how recently, and over how long a span.
                Proximity is measured in daily sigmas so a quiet name and a volatile
                one are judged on the same scale. Ranked by level quality × closeness —
                a level defended repeatedly on both timeframes ranks above a single
                stale touch. Intraday wicks are not visible in close data, so this is
                the conservative set, not the complete one.
              </p>

              {levelsError ? (
                <ErrorPanel message={levelsError} />
              ) : levelsLoading || !levels ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="glass-panel h-64 motion-safe:animate-pulse" />
                  ))}
                </div>
              ) : levels.rows.length === 0 ? (
                <div className="glass-panel flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <SearchX size={22} className="text-textMuted" />
                  <p className="text-sm text-textSecondary">
                    Nothing in {levels.universe_label} is sitting at a level right now
                  </p>
                  <p className="max-w-lg text-xs leading-relaxed text-textMuted">
                    Every name is more than {levels.matched === 0 ? '1.75 daily sigmas' : 'the threshold'} away
                    from its nearest respected level. Try another universe, or widen the
                    side filter.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {levels.rows.map((row) => (
                    <LevelCard key={row.symbol} row={row} />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ================= SCREENS ================= */}
          {tab === 'screens' && (
            screensError ? (
              // Catalogue failure is retryable in place — a momentary blip on
              // GET /api/screens must not dead-end the whole tab.
              <div className="glass-panel flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                <WifiOff size={22} className="text-accentAmber" />
                <p className="max-w-md text-sm leading-relaxed text-textSecondary">{screensError}</p>
                <button
                  onClick={() => { setScreensError(''); setScreensRetryNonce((n) => n + 1); }}
                  className="mt-1 flex items-center gap-1.5 rounded-lg border border-borderSubtle px-3 py-1.5 text-xs font-medium text-textSecondary transition-colors hover:bg-white/5 hover:text-textPrimary"
                >
                  <RotateCw size={12} /> Retry
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[280px_1fr]">

                {/* Mobile / stacked: grouped select */}
                {screensList && (
                  <div className="xl:hidden">
                    <label htmlFor="screen-select" className="sr-only">Screen</label>
                    <select
                      id="screen-select"
                      value={selectedScreen}
                      onChange={(e) => setSelectedScreen(e.target.value)}
                      className="w-full rounded-lg border border-borderSubtle bg-black/30 px-3 py-2.5 text-sm text-textPrimary focus:border-accentCyan/50"
                    >
                      {groupedScreens.map((group) => (
                        <optgroup key={group.category} label={group.category}>
                          {group.screens.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                )}

                {/* Desktop: grouped screen list */}
                <div className="hidden self-start xl:block">
                  <div className="glass-panel p-3">
                    {screensList ? (
                      groupedScreens.map((group) => (
                        <Fragment key={group.category}>
                          <div className="mb-1 mt-3 px-2.5 text-[10px] font-mono uppercase tracking-wider text-textMuted first:mt-0">
                            {group.category}
                          </div>
                          {group.screens.map((s) => {
                            const active = s.id === selectedScreen;
                            return (
                              <button
                                key={s.id}
                                onClick={() => setSelectedScreen(s.id)}
                                aria-pressed={active}
                                className={clsx(
                                  'flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-[13px] transition-colors',
                                  active ? 'bg-white/10 text-textPrimary' : 'text-textSecondary hover:bg-white/5'
                                )}
                              >
                                <span className="truncate">{s.name}</span>
                                {active && currentRun && (
                                  <span className="ml-2 shrink-0 rounded bg-white/10 px-1.5 py-px text-[10px] tabular text-textSecondary">
                                    {currentRun.matched}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </Fragment>
                      ))
                    ) : (
                      <div className="space-y-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <div key={i} className="h-7 rounded bg-white/5 motion-safe:animate-pulse" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Results panel */}
                <div className="glass-panel min-w-0 p-5">
                  {activeMeta && (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-textPrimary">{activeMeta.name}</h2>
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-textMuted">
                          {activeMeta.category}
                        </span>
                        <span
                          className={clsx(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold font-mono uppercase tracking-wide',
                            activeMeta.direction === 'long'
                              ? 'bg-emerald-400/10 text-accentGreen'
                              : 'bg-red-400/10 text-accentRed'
                          )}
                        >
                          {activeMeta.direction === 'long' ? 'LONG' : 'SHORT'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-textSecondary">{activeMeta.description}</p>
                      <div className="mt-3 rounded-lg border border-borderSubtle bg-black/30 p-3 font-mono text-xs text-accentCyan/90">
                        {activeMeta.conditions}
                      </div>
                    </>
                  )}

                  {runError ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                      <WifiOff size={22} className="text-accentAmber" />
                      <p className="max-w-md text-sm leading-relaxed text-textSecondary">{runError}</p>
                    </div>
                  ) : runLoading || !currentRun ? (
                    <div className="mt-4 space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-9 rounded bg-white/5 motion-safe:animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <p className="mt-3 text-xs text-textMuted">
                        <span className="tabular">{currentRun.matched}</span> of{' '}
                        <span className="tabular">{currentRun.scanned}</span> matched · as of {currentRun.as_of}
                      </p>

                      {currentRun.matched === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                          <SearchX size={22} className="text-textMuted" />
                          <p className="text-sm text-textSecondary">
                            No matches in {currentRun.universe_label} right now
                          </p>
                          <p className="max-w-lg rounded-lg border border-borderSubtle bg-black/30 p-3 font-mono text-xs text-accentCyan/90">
                            {currentRun.screen.conditions}
                          </p>
                          <p className="text-xs text-textMuted">
                            Screens re-evaluate as cached data refreshes (~30 min).
                          </p>
                        </div>
                      ) : (
                        <div className="mt-3 overflow-x-auto">
                          <table className="w-full min-w-[640px] text-sm">
                            <thead>
                              <tr className="text-left text-[11px] font-mono uppercase tracking-wider text-textMuted">
                                <th className="py-2 pr-3 font-medium">#</th>
                                <th className="py-2 pr-3 font-medium">Symbol</th>
                                <th className="py-2 pr-3 font-medium">Name</th>
                                <th className="py-2 pr-3 text-right font-medium">Price</th>
                                <th className="py-2 pr-3 text-right font-medium">1D %</th>
                                {currentRun.columns.map((col) => (
                                  <th key={col.key} className="py-2 pr-3 text-right font-medium">{col.label}</th>
                                ))}
                                <th className="w-6 py-2" aria-hidden="true" />
                              </tr>
                            </thead>
                            <tbody>
                              {/* Row click is a pointer convenience; the REAL link (and the
                                  keyboard/screen-reader path) is the symbol anchor, a
                                  role="link" on <tr> would break table semantics. */}
                              {currentRun.matches.map((m, i) => (
                                <tr
                                  key={m.symbol}
                                  onClick={() => goToSymbol(m.symbol)}
                                  className="cursor-pointer border-t border-borderSubtle transition-colors hover:bg-white/5"
                                >
                                  <td className="py-2.5 pr-3 tabular text-textMuted">{i + 1}</td>
                                  <td className="whitespace-nowrap py-2.5 pr-3">
                                    <Link
                                      href={`/screener?q=${encodeURIComponent(m.symbol)}`}
                                      aria-label={`Open ${m.symbol} in Terminal`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="rounded font-semibold text-textPrimary focus-visible:ring-1 focus-visible:ring-accentCyan/50"
                                    >
                                      {m.symbol}
                                    </Link>
                                    {m.volume_confirmed === false && (
                                      <span
                                        title="volume data unavailable, close-only match"
                                        className="ml-1.5 rounded border border-accentAmber/30 px-1 py-px text-[9px] font-mono uppercase tracking-wide text-accentAmber"
                                      >
                                        unconfirmed
                                      </span>
                                    )}
                                  </td>
                                  <td className="max-w-[220px] truncate py-2.5 pr-3 text-textSecondary">{m.name}</td>
                                  <td className="py-2.5 pr-3 text-right tabular text-textPrimary">
                                    {fmtPrice(m.price, m.currency)}
                                  </td>
                                  <td className="py-2.5 pr-3 text-right">
                                    <PctChip value={m.change_1d_pct} />
                                  </td>
                                  {currentRun.columns.map((col) => (
                                    <td key={col.key} className="py-2.5 pr-3 text-right tabular text-textSecondary">
                                      {m.values[col.key] ?? '—'}
                                    </td>
                                  ))}
                                  <td className="py-2.5 text-right text-textMuted" aria-hidden="true">→</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col">
          <Navigation />
          <div className="pt-28 text-center text-sm text-textSecondary">Loading…</div>
        </div>
      }
    >
      <DiscoverContent />
    </Suspense>
  );
}
