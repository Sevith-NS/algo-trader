'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { WifiOff, RotateCw } from 'lucide-react';
import clsx from 'clsx';
import Navigation from '../../components/Navigation';
import IdeaCard from '../../components/discover/IdeaCard';
import PctChip from '../../components/discover/PctChip';
import { TAG_ORDER, TAG_LABELS, TAG_STYLES } from '../../components/discover/tagStyles';
import { fmtPrice } from '../../components/intel/format';
import { API_BASE } from '../../lib/api';
import type { DiscoverCard, DiscoverResponse, HorizonTagId } from '../../types/discover';

const BACKEND_DOWN = 'Market data backend unreachable — start it with: cd backend && python app.py';

// Session-cache TTL — matches the backend's Cache-Control max-age=300, so a
// long-lived tab doesn't render prices frozen at first fetch all session.
const CACHE_TTL_MS = 300_000;

// The hub's tab strip is a fixed product surface (short labels for the strip),
// not the backend's universe index — every id must exist in UNIVERSES.
const MARKETS = [
  { id: 'us_large', label: 'US Equities' },
  { id: 'nifty50', label: 'India' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'bonds', label: 'Govt Bonds' },
  { id: 'commodities', label: 'Commodities' },
  { id: 'indices', label: 'Indices' },
] as const;

/** 429 message with Retry-After from the header, or the JSON body as fallback. */
function rateLimitMessage(res: Response, body: any): string {
  const retryAfter = res.headers.get('Retry-After')
    || (body?.retry_after_seconds != null ? String(Math.ceil(body.retry_after_seconds)) : null);
  return `Rate limited — too many requests. Try again in ${retryAfter || 'a few'} seconds.`;
}

/**
 * Heat band for a tile: the old page's 5% / 2% / >0 banding, re-expressed as
 * committed-token colors at alpha steps so intensity reads on the dark theme.
 * The signed % on every tile is the non-color channel — direction survives
 * without hue.
 */
function heatClass(change: number | null): string {
  if (change === null) return 'bg-white/[0.06]';
  if (change >= 5) return 'bg-emerald-500/80';
  if (change >= 2) return 'bg-emerald-500/60';
  if (change > 0) return 'bg-emerald-500/40';
  if (change <= -5) return 'bg-red-500/80';
  if (change <= -2) return 'bg-red-500/60';
  if (change < 0) return 'bg-red-500/40';
  return 'bg-white/10'; // exactly flat
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-textSecondary">{title}</h2>
      {hint && <span className="text-xs text-textMuted">{hint}</span>}
    </div>
  );
}

function MoverList({ title, accent, items }: {
  title: string;
  accent: 'green' | 'red';
  items: DiscoverCard[];
}) {
  return (
    <div className="glass-panel p-5">
      <h3
        className={clsx(
          'mb-3 border-b border-borderSubtle pb-2 text-sm font-semibold',
          accent === 'green' ? 'text-accentGreen' : 'text-accentRed',
        )}
      >
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="py-4 text-center text-xs text-textMuted">No data</p>
      ) : (
        <div className="space-y-1">
          {items.map((c) => (
            <Link
              key={c.symbol}
              href={`/screener?q=${encodeURIComponent(c.symbol)}`}
              className="flex items-center justify-between gap-3 rounded p-2 transition-colors hover:bg-white/5 focus-visible:ring-1 focus-visible:ring-accentCyan/50"
            >
              <div className="min-w-0">
                <div className="font-semibold text-textPrimary">{c.symbol}</div>
                <div className="truncate text-xs text-textMuted">{c.name}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm tabular text-textPrimary">{fmtPrice(c.price, c.currency)}</div>
                <div className="mt-0.5"><PctChip value={c.change_1d_pct} /></div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketsPage() {
  const [market, setMarket] = useState<string>('us_large');
  const [data, setData] = useState<DiscoverResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryNonce, setRetryNonce] = useState(0);
  const [tagFilter, setTagFilter] = useState<HorizonTagId | 'all'>('all');

  // Per-universe response cache: tab flips within a session render instantly
  // instead of re-hitting the backend (which is itself only 5-min memoised).
  // Entries carry a timestamp and expire after CACHE_TTL_MS.
  const cacheRef = useRef<Record<string, { body: DiscoverResponse; at: number }>>({});

  const switchMarket = (id: string) => {
    setMarket(id);
    setTagFilter('all'); // the new market may not contain the active tag
  };

  // A tab backgrounded past the TTL comes back with frozen prices — drop the
  // stale entry for the visible market and refetch via the existing nonce.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const entry = cacheRef.current[market];
      if (entry && Date.now() - entry.at >= CACHE_TTL_MS) {
        delete cacheRef.current[market];
        setRetryNonce((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [market]);

  useEffect(() => {
    const cached = cacheRef.current[market];
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      setData(cached.body);
      setLoading(false);
      setError('');
      return;
    }
    let cancelled = false;

    async function fetchMarket() {
      setLoading(true);
      setData(null);
      setError('');
      try {
        // all=1: every parsed symbol gets a card (tags may be []) — the heat
        // grid and movers need the whole universe, not just tagged setups.
        const res = await fetch(
          `${API_BASE}/api/discover?universe=${encodeURIComponent(market)}&all=1`
        );
        const body = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.status === 429) {
          setError(rateLimitMessage(res, body));
        } else if (!res.ok || body?.error) {
          setError(body?.error || `Markets request failed (${res.status}).`);
        } else {
          setData(body as DiscoverResponse);
          // parsed: 0 means upstream outage — caching it would pin the empty
          // payload for the whole session with no recovery path.
          if ((body as DiscoverResponse).parsed !== 0) {
            cacheRef.current[market] = { body: body as DiscoverResponse, at: Date.now() };
          }
        }
      } catch (err) {
        console.error('Failed to fetch market data', err);
        if (!cancelled) setError(BACKEND_DOWN);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMarket();
    return () => { cancelled = true; };
  }, [market, retryNonce]);

  const cards = data?.cards ?? [];

  // Movers: factual top/bottom of the day. Fewer than 10 symbols with change
  // data (12-symbol universes, partial outages) would make fixed slices of 5
  // overlap — cap each list at half the pool so a symbol never appears in both.
  const { gainers, losers } = useMemo(() => {
    const withChange = cards.filter((c) => c.change_1d_pct !== null);
    const sorted = [...withChange].sort(
      (a, b) => (b.change_1d_pct as number) - (a.change_1d_pct as number)
    );
    const n = Math.min(5, Math.floor(sorted.length / 2));
    // slice(-0) would return the whole array — guard the empty case explicitly.
    return { gainers: sorted.slice(0, n), losers: n === 0 ? [] : sorted.slice(-n).reverse() };
  }, [cards]);

  // Horizon setups: the tagged subset — same doctrine as /discover.
  const tagged = useMemo(() => cards.filter((c) => c.tags.length > 0), [cards]);
  const tagCounts = useMemo(() => {
    const counts = {} as Record<HorizonTagId, number>;
    for (const card of tagged) {
      for (const tag of card.tags) counts[tag.id] = (counts[tag.id] || 0) + 1;
    }
    return counts;
  }, [tagged]);
  const presentTags = TAG_ORDER.filter((id) => tagCounts[id] > 0);
  const filteredTagged = tagFilter === 'all'
    ? tagged
    : tagged.filter((c) => c.tags.some((t) => t.id === tagFilter));

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <div className="pt-28">
        <div className="mx-auto w-full max-w-[1500px] px-4 pb-16 sm:px-6 lg:px-8">

          {/* ---- Header ---- */}
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-textPrimary">Markets</h1>
              <p className="mt-1 text-sm text-textSecondary">
                Every market, one lens — heat, movers, and horizon setups.
                Descriptive, not advice · paper trading only.
              </p>
            </div>
            <div className="flex flex-col items-start gap-1.5 sm:items-end">
              <div className="flex flex-wrap gap-1.5">
                {MARKETS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => switchMarket(m.id)}
                    aria-pressed={m.id === market}
                    className={clsx(
                      'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      m.id === market
                        ? 'border-white/20 bg-white/10 text-textPrimary'
                        : 'border-borderSubtle text-textSecondary hover:bg-white/5 hover:text-textPrimary'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              {data?.as_of && <span className="text-xs text-textMuted">as of {data.as_of}</span>}
            </div>
          </div>

          {market === 'bonds' && (
            <p className="mb-5 rounded-lg border border-borderSubtle bg-white/[0.03] px-3 py-2 text-xs text-textMuted">
              US-listed bond ETFs — Indian G-Sec series has no reliable keyless source yet (PRD A11).
            </p>
          )}

          {loading ? (
            <div className="space-y-8">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="h-[92px] rounded-md bg-white/5 motion-safe:animate-pulse" />
                ))}
              </div>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="glass-panel h-64 motion-safe:animate-pulse" />
                <div className="glass-panel h-64 motion-safe:animate-pulse" />
              </div>
            </div>
          ) : error ? (
            <div className="glass-panel flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              <WifiOff size={22} className="text-accentAmber" />
              <p className="max-w-md text-sm leading-relaxed text-textSecondary">{error}</p>
              <button
                onClick={() => { setError(''); setRetryNonce((n) => n + 1); }}
                className="mt-1 flex items-center gap-1.5 rounded-lg border border-borderSubtle px-3 py-1.5 text-xs font-medium text-textSecondary transition-colors hover:bg-white/5 hover:text-textPrimary"
              >
                <RotateCw size={12} /> Retry
              </button>
            </div>
          ) : cards.length === 0 ? (
            <div className="glass-panel flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
              <WifiOff size={22} className="text-accentAmber" />
              <p className="max-w-md text-sm leading-relaxed text-textSecondary">
                No data parsed for {data?.universe_label ?? 'this market'} right now — the upstream
                feed may be down. Data refreshes as the cache recovers (~30 min).
              </p>
              <button
                // Belt-and-braces: outage payloads aren't cached, but drop any
                // entry for this market anyway before refetching.
                onClick={() => { delete cacheRef.current[market]; setRetryNonce((n) => n + 1); }}
                className="mt-1 flex items-center gap-1.5 rounded-lg border border-borderSubtle px-3 py-1.5 text-xs font-medium text-textSecondary transition-colors hover:bg-white/5 hover:text-textPrimary"
              >
                <RotateCw size={12} /> Retry
              </button>
            </div>
          ) : (
            <div className="space-y-10">

              {/* ---- Section 1: Heat ---- */}
              <section>
                <SectionHeading
                  title="Heat"
                  hint={`${cards.length} of ${data?.scanned ?? cards.length} symbols · 1-day change`}
                />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {cards.map((c) => (
                    <Link
                      key={c.symbol}
                      href={`/screener?q=${encodeURIComponent(c.symbol)}`}
                      className={clsx(
                        heatClass(c.change_1d_pct),
                        'flex min-h-[92px] flex-col justify-between rounded-md p-3 transition-[filter] hover:brightness-110 focus-visible:ring-1 focus-visible:ring-accentCyan/50'
                      )}
                    >
                      <div className="truncate text-sm font-bold tracking-wide text-white">{c.symbol}</div>
                      <div>
                        <div className="truncate text-sm font-medium tabular text-white/90">
                          {fmtPrice(c.price, c.currency)}
                        </div>
                        <div className="text-xs font-bold tabular text-white/80">
                          {c.change_1d_pct === null
                            ? '—'
                            : `${c.change_1d_pct >= 0 ? '+' : ''}${c.change_1d_pct.toFixed(2)}%`}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>

              {/* ---- Section 2: Movers ---- */}
              <section>
                <SectionHeading title="Movers" hint="top 5 by 1-day change, each way" />
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <MoverList title="Top gainers" accent="green" items={gainers} />
                  <MoverList title="Top losers" accent="red" items={losers} />
                </div>
              </section>

              {/* ---- Section 3: Horizon setups ---- */}
              <section>
                <SectionHeading
                  title="Horizon setups"
                  hint="descriptive tags with the numbers that fired — candidates, not calls"
                />
                {tagged.length === 0 ? (
                  <p className="glass-panel px-6 py-10 text-center text-sm text-textMuted">
                    No horizon setups in {data?.universe_label ?? 'this market'} right now —
                    tags re-evaluate as cached data refreshes (~30 min).
                  </p>
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
                        All ({tagged.length})
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
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {filteredTagged.map((card) => (
                        <IdeaCard key={card.symbol} card={card} />
                      ))}
                    </div>
                  </>
                )}
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
