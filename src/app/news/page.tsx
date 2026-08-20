'use client';

import { useEffect, useMemo, useState } from 'react';
import { Newspaper, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import clsx from 'clsx';
import Navigation from '../../components/Navigation';
import { PageShell, PageHeader } from '../../components/PageHeader';
import { apiGet } from '../../lib/api';

interface Article {
  title: string;
  link: string;
  source: string | null;
  published: string | null;
  sentiment_score: number;
  sentiment: string;
  category: string;
}

interface CategoryData {
  articles: Article[];
  avg_sentiment: number;
  mood_index: number;
}

interface NewsData {
  overall_mood_index: number;
  overall_sentiment: string;
  categories: Record<string, CategoryData>;
  latest: Article[];
}

const CATEGORY_LABELS: Record<string, string> = {
  markets: 'Markets',
  economy: 'Economy',
  crypto: 'Crypto',
  commodities: 'Commodities',
  forex: 'Forex',
  asia: 'Asia',
  europe: 'Europe',
  tech: 'Tech',
};

function SentimentBadge({ sentiment, score }: { sentiment: string; score: number }) {
  const bullish = sentiment.includes('bullish');
  const bearish = sentiment.includes('bearish');
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular',
      bullish && 'bg-emerald-400/10 text-accentGreen',
      bearish && 'bg-red-400/10 text-accentRed',
      !bullish && !bearish && 'bg-white/5 text-textMuted',
    )}>
      {bullish ? <TrendingUp size={11} /> : bearish ? <TrendingDown size={11} /> : <Minus size={11} />}
      {score > 0 ? '+' : ''}{score.toFixed(2)}
    </span>
  );
}

function MoodGauge({ value, label }: { value: number; label: string }) {
  const color = value >= 60 ? '#34D399' : value <= 40 ? '#F87171' : '#FBBF24';
  return (
    <div className="glass-panel flex flex-col items-center gap-4 p-6">
      <div className="text-sm font-medium text-textSecondary">Global Market Mood</div>
      <div className="relative h-32 w-64">
        <svg viewBox="0 0 200 110" className="h-full w-full">
          <path d="M 15 100 A 85 85 0 0 1 185 100" fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="14" strokeLinecap="round" />
          <path
            d="M 15 100 A 85 85 0 0 1 185 100"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(value / 100) * 267} 267`}
            style={{ transition: 'stroke-dasharray 1s ease, stroke 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <div className="text-4xl font-bold tabular" style={{ color }}>{value}</div>
          <div className="text-xs font-mono uppercase tracking-widest text-textMuted">{label.replace('-', ' ')}</div>
        </div>
      </div>
      <div className="flex w-64 justify-between text-[11px] text-textMuted">
        <span>Extreme Fear</span>
        <span>Neutral</span>
        <span>Extreme Greed</span>
      </div>
    </div>
  );
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return `${Math.max(1, Math.floor(diff / 60000))}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NewsPage() {
  const [data, setData] = useState<NewsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const fetchNews = async () => {
    setLoading(true);
    try {
      const json = await apiGet<NewsData>('/api/news');
      if (!(json as any).error) setData(json);
    } catch (e) {
      console.error('Failed to fetch news', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNews(); }, []);

  const articles = useMemo(() => {
    if (!data) return [];
    if (activeCategory === 'all') return data.latest;
    return data.categories[activeCategory]?.articles ?? [];
  }, [data, activeCategory]);

  return (
    <div className="flex min-h-screen flex-col">
      <Navigation />
      <PageShell className="flex-1">
        <PageHeader
          icon={<Newspaper className="text-accentBlue" size={26} />}
          title="News & Sentiment"
          description="Live headlines scored with NLP sentiment across eight market categories."
          actions={
            <button
              onClick={fetchNews}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-borderSubtle bg-white/[0.03] px-4 py-2 text-sm text-textSecondary transition-colors hover:border-accentGreen/40 hover:text-textPrimary disabled:opacity-50"
            >
              <RefreshCw size={14} className={clsx(loading && 'animate-spin')} /> Refresh
            </button>
          }
        />

        {loading && !data ? (
          <div className="glass-panel flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-accentGreen" />
          </div>
        ) : !data ? (
          <div className="glass-panel p-8 text-center text-textSecondary">
            Failed to load news. Ensure the Python backend is running on port 5000.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
            {/* Left rail: mood gauge + category moods */}
            <div className="space-y-6">
              <MoodGauge value={data.overall_mood_index} label={data.overall_sentiment} />
              <div className="glass-panel p-5">
                <h3 className="mb-4 text-sm font-semibold text-textSecondary">Sentiment by Category</h3>
                <div className="space-y-3">
                  {Object.entries(data.categories).map(([key, cat]) => (
                    <button
                      key={key}
                      onClick={() => setActiveCategory(key === activeCategory ? 'all' : key)}
                      className={clsx(
                        'flex w-full items-center gap-3 rounded-lg px-2 py-1.5 transition-colors',
                        activeCategory === key ? 'bg-white/5' : 'hover:bg-white/[0.03]'
                      )}
                    >
                      <span className="w-24 text-left text-xs font-medium text-textSecondary">
                        {CATEGORY_LABELS[key] ?? key}
                      </span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={clsx(
                            'h-full rounded-full transition-[width] duration-700',
                            cat.mood_index >= 55 ? 'bg-accentGreen' : cat.mood_index <= 45 ? 'bg-accentRed' : 'bg-accentAmber'
                          )}
                          style={{ width: `${cat.mood_index}%` }}
                        />
                      </div>
                      <span className="w-8 text-right text-xs font-semibold tabular text-textPrimary">
                        {cat.mood_index}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Feed */}
            <div>
              <div className="mb-4 flex flex-wrap gap-2">
                {['all', ...Object.keys(data.categories)].map(key => (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key)}
                    className={clsx(
                      'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
                      activeCategory === key
                        ? 'bg-emerald-400/15 text-accentGreen'
                        : 'border border-borderSubtle text-textSecondary hover:text-textPrimary'
                    )}
                  >
                    {key === 'all' ? 'All' : CATEGORY_LABELS[key] ?? key}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5">
                {articles.map((a, i) => (
                  <a
                    key={`${a.link}-${i}`}
                    href={a.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-panel hover-lift group flex items-start justify-between gap-4 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-[11px] text-textMuted">
                        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono uppercase tracking-wide">
                          {CATEGORY_LABELS[a.category] ?? a.category}
                        </span>
                        {a.source && <span>{a.source}</span>}
                        {a.published && <span>· {timeAgo(a.published)}</span>}
                      </div>
                      <p className="mt-1.5 text-sm font-medium leading-snug text-textPrimary group-hover:text-textPrimary">
                        {a.title}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <SentimentBadge sentiment={a.sentiment} score={a.sentiment_score} />
                      <ExternalLink size={12} className="text-textMuted opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                  </a>
                ))}
                {articles.length === 0 && (
                  <div className="glass-panel p-8 text-center text-sm text-textSecondary">
                    No articles in this category right now.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </PageShell>
    </div>
  );
}
