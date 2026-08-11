"use client";
import { useState } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { stanceColor } from './format';

/**
 * Multi-source news intelligence panel: every headline the sweep found across
 * Google News / Bing / Yahoo feeds, each scored, plus the aggregate stance
 * (bullish / bearish / neutral), 0-100 rating and confidence.
 */
export default function NewsIntelPanel({ data }: { data: any }) {
  const [expanded, setExpanded] = useState(false);
  if (!data || data.error || !data.articles) return null;

  const color = stanceColor(data.stance);
  const Icon = data.stance === 'bullish' ? TrendingUp : data.stance === 'bearish' ? TrendingDown : Minus;
  const shown = expanded ? data.articles : data.articles.slice(0, 6);

  return (
    <div className="glass-panel p-5" style={{ borderTop: `2px solid ${color}` }}>
      <h3 className="mb-3 flex items-center gap-2 border-b border-borderSubtle pb-3 text-sm font-semibold text-textPrimary">
        <Newspaper size={15} style={{ color }} /> News Intelligence
        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-textMuted">
          {data.distinct_outlets} outlets · {data.article_count} stories
        </span>
      </h3>

      {/* Aggregate stance */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-borderSubtle bg-white/[0.02] p-3">
        <div className="flex items-center gap-2">
          <Icon size={18} style={{ color }} />
          <div>
            <div className="text-sm font-bold uppercase tracking-wide" style={{ color }}>
              {data.stance}
            </div>
            <div className="text-[10px] text-textMuted">
              confidence: {data.confidence} · recency-weighted
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular" style={{ color }}>{data.rating}<span className="text-xs text-textMuted">/100</span></div>
          <div className="text-[10px] text-textMuted">news rating</div>
        </div>
      </div>

      {/* Bull / bear split */}
      <div className="mb-1 flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        {data.article_count > 0 && (
          <>
            <div className="h-full bg-accentGreen" style={{ width: `${(data.breakdown.bullish / data.article_count) * 100}%` }} />
            <div className="h-full bg-accentAmber/60" style={{ width: `${(data.breakdown.neutral / data.article_count) * 100}%` }} />
            <div className="h-full bg-accentRed" style={{ width: `${(data.breakdown.bearish / data.article_count) * 100}%` }} />
          </>
        )}
      </div>
      <div className="mb-3 flex justify-between text-[10px] text-textMuted">
        <span className="text-accentGreen">{data.breakdown.bullish} bullish</span>
        <span>{data.breakdown.neutral} neutral</span>
        <span className="text-accentRed">{data.breakdown.bearish} bearish</span>
      </div>

      {/* Headlines */}
      <div className="space-y-2.5">
        {shown.map((a: any, i: number) => {
          const body = (
            <div className="flex items-start gap-2">
              <span
                className={clsx(
                  'mt-0.5 shrink-0 rounded px-1 py-px text-[9px] font-bold uppercase',
                  a.sentiment === 'bullish' && 'bg-emerald-400/10 text-accentGreen',
                  a.sentiment === 'bearish' && 'bg-red-400/10 text-accentRed',
                  a.sentiment === 'neutral' && 'bg-white/5 text-textMuted',
                )}
              >
                {a.sentiment === 'bullish' ? 'BULL' : a.sentiment === 'bearish' ? 'BEAR' : 'NEUT'}
              </span>
              <div className="min-w-0">
                <p className="text-xs leading-snug text-textSecondary transition-colors group-hover:text-textPrimary">
                  {a.title}
                  {a.link && <ExternalLink size={10} className="ml-1 inline opacity-0 group-hover:opacity-60" />}
                </p>
                <p className="mt-0.5 text-[10px] text-textMuted">
                  {a.source}{a.age_days !== null && a.age_days !== undefined ? ` · ${a.age_days < 1 ? 'today' : `${Math.round(a.age_days)}d ago`}` : ''}
                </p>
              </div>
            </div>
          );
          // Some feeds omit the link — don't render a hover-affordant dead anchor
          return a.link ? (
            <a key={i} href={a.link} target="_blank" rel="noopener noreferrer" className="group block">
              {body}
            </a>
          ) : (
            <div key={i} className="block">{body}</div>
          );
        })}
      </div>

      {data.articles.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-borderSubtle py-1.5 text-[11px] text-textSecondary transition-colors hover:bg-white/[0.03] hover:text-textPrimary"
        >
          {expanded ? 'Show less' : `Show all ${data.articles.length} stories`}
          <ChevronDown size={12} className={clsx('transition-transform', expanded && 'rotate-180')} />
        </button>
      )}

      <p className="mt-3 border-t border-borderSubtle pt-2 text-[10px] leading-relaxed text-textMuted">
        Sources swept: {data.sources_scanned?.join(' · ')}. Sentiment is headline-level
        (finance-tuned VADER), recency-weighted with a 3-day decay.
      </p>
    </div>
  );
}
