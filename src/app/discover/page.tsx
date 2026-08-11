'use client';
import { useEffect, useMemo, useRef, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Compass, ScanSearch, WifiOff, SearchX, RotateCw } from 'lucide-react';
import clsx from 'clsx';
import Navigation from '../../components/Navigation';
import IdeaCard from '../../components/discover/IdeaCard';
import PctChip from '../../components/discover/PctChip';
import { TAG_ORDER, TAG_LABELS, TAG_STYLES } from '../../components/discover/tagStyles';
import { fmtPrice } from '../../components/intel/format';
import { API_BASE } from '../../lib/api';
import type {
  DiscoverResponse,
  HorizonTagId,
  ScreenMeta,
  ScreensListResponse,
  ScreenRunResponse,
  UniverseMeta,
} from '../../types/discover';

const BACKEND_DOWN = 'Market data backend unreachable — start it with: cd backend && python app.py';

// Shown while the first /api/discover response is in flight.
const FALLBACK_UNIVERSES: UniverseMeta[] = [
  { id: 'us_large', label: 'US Large Cap', count: 0 },
  { id: 'nifty50', label: 'NIFTY 50', count: 0 },
  { id: 'crypto', label: 'Crypto Majors', count: 0 },
];

const DEFAULT_SCREEN = 'short_term_breakout';

/** 429 message with Retry-After from the header, or the JSON body as fallback. */
function rateLimitMessage(res: Response, body: any): string {
  const retryAfter = res.headers.get('Retry-After')
    || (body?.retry_after_seconds != null ? String(Math.ceil(body.retry_after_seconds)) : null);
  return `Rate limited — too many requests. Try again in ${retryAfter || 'a few'} seconds.`;
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="glass-panel flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff size={22} className="text-accentAmber" />
      <p className="max-w-md text-sm leading-relaxed text-textSecondary">{message}</p>
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();

  const [tab, setTab] = useState<'ideas' | 'screens'>('ideas');
  const [universe, setUniverse] = useState('us_large');
  const [tagFilter, setTagFilter] = useState<HorizonTagId | 'all'>('all');

  // Ideas
  const [discover, setDiscover] = useState<DiscoverResponse | null>(null);
  const [ideasLoading, setIdeasLoading] = useState(true);
  const [ideasError, setIdeasError] = useState('');
  // Kept out of `discover` so the switcher chips survive a universe change.
  const [universes, setUniverses] = useState<UniverseMeta[]>(FALLBACK_UNIVERSES);

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
  const asOf = discover?.as_of ?? currentRun?.as_of;

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="pt-28">
        <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 sm:px-6 lg:px-8">

          {/* ---- Header ---- */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-textPrimary">Discover</h1>
              <p className="mt-1 text-sm text-textSecondary">
                Candidates, not calls — descriptive setups and screens on delayed data. Paper trading only.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <div className="flex flex-wrap gap-1.5">
                {universes.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => switchUniverse(u.id)}
                    aria-pressed={u.id === universe}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      u.id === universe
                        ? 'border-white/20 bg-white/10 text-textPrimary'
                        : 'border-borderSubtle text-textSecondary hover:bg-white/5 hover:text-textPrimary'
                    )}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
              {asOf && <span className="text-xs text-textMuted">as of {asOf}</span>}
            </div>
          </div>

          {/* ---- Tabs ---- */}
          <div className="mb-5 inline-flex rounded-lg border border-borderSubtle bg-white/5 p-1">
            <button
              onClick={() => setTab('ideas')}
              aria-pressed={tab === 'ideas'}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                tab === 'ideas' ? 'bg-white/10 text-textPrimary' : 'text-textSecondary hover:text-textPrimary'
              )}
            >
              <Compass size={14} /> Ideas
            </button>
            <button
              onClick={() => setTab('screens')}
              aria-pressed={tab === 'screens'}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors',
                tab === 'screens' ? 'bg-white/10 text-textPrimary' : 'text-textSecondary hover:text-textPrimary'
              )}
            >
              <ScanSearch size={14} /> Screens
            </button>
          </div>

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
                      'rounded border px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors',
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
                        'rounded border px-2.5 py-1 text-[11px] uppercase tracking-wider transition-colors',
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
                      className="w-full rounded-lg border border-borderSubtle bg-black/30 px-3 py-2.5 text-sm text-textPrimary outline-none focus:border-accentCyan/50"
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
                          <div className="mb-1 mt-3 px-2.5 text-[10px] uppercase tracking-wider text-textMuted first:mt-0">
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
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-textMuted">
                          {activeMeta.category}
                        </span>
                        <span
                          className={clsx(
                            'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
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
                              <tr className="text-left text-[11px] uppercase tracking-wider text-textMuted">
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
                                  keyboard/screen-reader path) is the symbol anchor — a
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
                                        title="volume data unavailable — close-only match"
                                        className="ml-1.5 rounded border border-accentAmber/30 px-1 py-px text-[9px] uppercase tracking-wide text-accentAmber"
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
