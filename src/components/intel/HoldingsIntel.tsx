"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BrainCircuit, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { API_BASE } from '../../lib/api';
import {
  stanceColor, callColor, gradeColor, phaseColor, PHASE_LABELS,
} from './format';

/**
 * Holdings Intelligence: the same teardown engine that powers the screener,
 * run across every open position — health grade, news stance, market phase
 * and the two-horizon verdict, so a deteriorating holding surfaces itself.
 */
export default function HoldingsIntel({ positions }: { positions: { symbol: string }[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const symbolsKey = positions.map(p => p.symbol).sort().join(',');
  const lastFetched = useRef('');

  const fetchIntel = async (force = false) => {
    if (!symbolsKey) { setData([]); return; }
    if (!force && lastFetched.current === symbolsKey) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/holdings-intel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: positions.map(p => ({ symbol: p.symbol })) }),
      });
      const d = await res.json();
      if (d.holdings) {
        setData(d.holdings);
        lastFetched.current = symbolsKey;
      } else {
        setError(d.error || 'No intel returned');
      }
    } catch {
      setError('Holdings intel unavailable — ensure the Python backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbolsKey]);

  if (positions.length === 0) return null;

  return (
    <section className="glass-panel mb-6 p-5" style={{ borderTop: '2px solid #A78BFA' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
          <BrainCircuit size={15} className="text-accentPurple" /> Holdings Intelligence
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-textMuted">
            news sweep · fundamentals · phase · verdict
          </span>
        </h2>
        <button
          onClick={() => fetchIntel(true)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-borderSubtle px-3 py-1.5 text-[11px] text-textSecondary transition-colors hover:bg-white/[0.03] hover:text-textPrimary disabled:opacity-50"
        >
          <RefreshCw size={11} className={clsx(loading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {loading && data.length === 0 ? (
        <p className="text-sm text-textSecondary">
          Sweeping news sources and statements for {positions.length} holding{positions.length > 1 ? 's' : ''} —
          the first run takes ~10s per symbol, cached after that…
        </p>
      ) : error ? (
        <p className="text-sm text-accentRed">{error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((h: any) => {
            if (h.error) {
              return (
                <div key={h.symbol} className="rounded-xl border border-borderSubtle bg-white/[0.02] p-4">
                  <div className="font-bold text-textPrimary">{h.symbol}</div>
                  <p className="mt-1 text-xs text-textMuted">Intel unavailable: {h.error}</p>
                </div>
              );
            }
            const sColor = stanceColor(h.news_stance);
            const pColor = phaseColor(h.phase);
            const lt = h.verdict?.long_term;
            const st = h.verdict?.short_term;
            return (
              <div key={h.symbol} className="flex flex-col rounded-xl border border-borderSubtle bg-white/[0.02] p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-textPrimary">{h.symbol}</div>
                    <div className="truncate text-[10px] text-textMuted">{h.company}</div>
                  </div>
                  {h.health_grade && (
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black"
                      style={{ color: gradeColor(h.health_grade), background: `${gradeColor(h.health_grade)}1a` }}
                      title={`Fundamental health ${h.health_score}/100`}
                    >
                      {h.health_grade}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ color: sColor, background: `${sColor}1a` }}>
                    {h.news_stance} {h.news_rating}/100
                  </span>
                  {h.phase && (
                    <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: pColor, background: `${pColor}1a` }}>
                      {(PHASE_LABELS[h.phase] || h.phase).split(' ·')[0]}
                    </span>
                  )}
                  {h.valuation_premium_pct !== null && h.valuation_premium_pct !== undefined && (
                    <span className={clsx(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular',
                      h.valuation_premium_pct > 5 ? 'bg-red-400/10 text-accentRed' : h.valuation_premium_pct < -5 ? 'bg-emerald-400/10 text-accentGreen' : 'bg-white/5 text-textSecondary'
                    )}>
                      P/E {h.valuation_premium_pct > 0 ? '+' : ''}{h.valuation_premium_pct}% vs hist
                    </span>
                  )}
                </div>

                {(lt || st) && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {lt && (
                      <div className="rounded-lg bg-white/[0.03] p-2">
                        <div className="text-[9px] uppercase tracking-wider text-textMuted">Long term</div>
                        <div className="text-sm font-black" style={{ color: callColor(lt.call) }}>
                          {lt.call} <span className="text-[10px] font-medium text-textMuted">{lt.conviction_10}/10</span>
                        </div>
                      </div>
                    )}
                    {st && (
                      <div className="rounded-lg bg-white/[0.03] p-2">
                        <div className="text-[9px] uppercase tracking-wider text-textMuted">Short term</div>
                        <div className="text-sm font-black" style={{ color: callColor(st.call) }}>
                          {st.call} <span className="text-[10px] font-medium text-textMuted">{st.conviction_10}/10</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {h.top_red_flag && (
                  <div className="mt-2 flex items-center gap-1.5 text-[10px] text-accentAmber">
                    <AlertTriangle size={10} className="shrink-0" />
                    <span className="truncate">{h.top_red_flag}{h.red_flag_count > 1 ? ` +${h.red_flag_count - 1} more` : ''}</span>
                  </div>
                )}

                {h.top_headline && (h.top_headline.link ? (
                  <a
                    href={h.top_headline.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group mt-2 block border-t border-borderSubtle pt-2"
                  >
                    <p className="line-clamp-2 text-[11px] leading-snug text-textSecondary transition-colors group-hover:text-textPrimary">
                      {h.top_headline.title}
                      <ExternalLink size={9} className="ml-1 inline opacity-0 group-hover:opacity-60" />
                    </p>
                  </a>
                ) : (
                  <p className="mt-2 line-clamp-2 border-t border-borderSubtle pt-2 text-[11px] leading-snug text-textSecondary">
                    {h.top_headline.title}
                  </p>
                ))}

                <div className="mt-auto pt-3">
                  <Link
                    href={`/screener?q=${encodeURIComponent(h.symbol)}`}
                    className="text-[11px] font-medium text-accentBlue hover:underline"
                  >
                    Full teardown →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 border-t border-borderSubtle pt-2 text-[10px] text-textMuted">
        Same engine as the Terminal teardown, batched across your book. Educational paper-trading
        research — not investment advice.
      </p>
    </section>
  );
}
