"use client";
import { useEffect, useState } from 'react';
import {
  Microscope, Sparkles, Hourglass, Quote, Gavel,
  Building2, Receipt, Scale, Swords, Users,
  CandlestickChart, CalendarClock, TrendingUp, TrendingDown, Calculator, WifiOff,
} from 'lucide-react';
import clsx from 'clsx';
import { API_BASE } from '../../lib/api';
import FundamentalsPanel from './FundamentalsPanel';
import { fmtPrice, callColor, phaseColor, PHASE_LABELS } from './format';

// The model is instructed to return strings, but a partial or mis-shaped JSON
// response must never take down the page — coerce arrays to prose, drop the rest.
/** 429 message with Retry-After from the header, or the JSON body as fallback. */
function rateLimitMessage(res: Response, body: any): string {
  const retryAfter = res.headers.get('Retry-After')
    || (body?.retry_after_seconds != null ? String(Math.ceil(body.retry_after_seconds)) : null);
  return `Rate limited. Too many requests. Try again in ${retryAfter || 'a few'} seconds.`;
}

const asText = (v: unknown): string | null =>
  typeof v === 'string' && v.trim()
    ? v
    : Array.isArray(v)
      ? v.filter((x) => typeof x === 'string').join(' ') || null
      : null;

function PillarBar({ label, value }: { label: string; value: number }) {
  // value in [-1, 1], center-anchored like the quant factor bars
  const pct = Math.min(Math.abs(value), 1) * 50;
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-24 shrink-0 text-[10px] capitalize text-textMuted">{label.replace('_', ' ')}</span>
      <div className="relative h-1.5 flex-1 rounded-full bg-white/5">
        <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" />
        <div
          className={clsx('absolute top-0 h-full rounded-full', value >= 0 ? 'bg-accentGreen' : 'bg-accentRed')}
          style={value >= 0 ? { left: '50%', width: `${pct}%` } : { right: '50%', width: `${pct}%` }}
        />
      </div>
      <span className={clsx('w-10 text-right text-[10px] tabular', value >= 0 ? 'text-accentGreen' : 'text-accentRed')}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

function VerdictChip({ horizon, verdict }: { horizon: string; verdict: any }) {
  const color = callColor(verdict.call);
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-borderSubtle bg-white/[0.02] p-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-textMuted">{horizon}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-xl font-black tracking-tight" style={{ color }}>{verdict.call}</span>
        <span className="whitespace-nowrap text-[11px] tabular text-textSecondary">conviction {verdict.conviction_10}/10</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${verdict.conviction_10 * 10}%`, background: color }} />
      </div>
    </div>
  );
}

/**
 * The full teardown: composite verdict split by horizon (short vs long term —
 * they are different questions), pillar attribution, technical phase, and an
 * on-demand 11-section Gemini deep dive — figures grounded in the computed
 * numbers, qualitative context from the model's knowledge of the company,
 * with an explicit BUY/HOLD/AVOID call checked against the deterministic verdict.
 */
export default function DeepAnalysisSection({ symbol, currency }: { symbol: string; currency: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [narrative, setNarrative] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setNarrative(null);
    setError('');
    setAiError('');
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/deep-analysis?symbol=${encodeURIComponent(symbol)}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        // A 429 or 5xx must not silently unmount the section — surface why
        // the teardown is missing instead of rendering nothing.
        if (res.status === 429) {
          setError(rateLimitMessage(res, d));
        } else if (!res.ok || d?.error) {
          setError(d?.error || `Deep analysis failed (${res.status}).`);
        } else {
          setData(d);
        }
      } catch {
        if (!cancelled) setError('Deep analysis unavailable. Is the backend running?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  const runAiTeardown = async () => {
    setAiLoading(true);
    setAiError('');
    try {
      const res = await fetch(`${API_BASE}/api/deep-analysis?symbol=${encodeURIComponent(symbol)}&ai=1`);
      const d = await res.json().catch(() => null);
      if (res.status === 429) {
        // Not a key problem — say when to try again instead of misdiagnosing.
        setAiError(rateLimitMessage(res, d));
      } else if (d?.narrative) {
        setNarrative(d.narrative);
      } else {
        setAiError('AI narrative unavailable. Check GEMINI_API_KEY in backend/.env');
      }
    } catch {
      setAiError('AI narrative failed. Is the backend running?');
    } finally {
      setAiLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel flex items-center gap-3 p-5">
        <Hourglass size={16} className="animate-pulse-soft text-accentPurple" />
        <p className="text-sm text-textSecondary">
          Running deep analysis for {symbol}: statements, valuation history, phase &amp; news sweep…
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="glass-panel flex items-center gap-3 p-5">
        <WifiOff size={16} className="shrink-0 text-accentAmber" />
        <p className="text-sm leading-relaxed text-textSecondary">{error}</p>
      </div>
    );
  }
  // Only vanish when there is genuinely nothing to show and nothing to explain.
  if (!data) return null;

  const { verdict, technical: tech, fundamentals } = data;
  const hasTech = tech && !tech.error;
  const pColor = phaseColor(tech?.phase);

  return (
    <div className="space-y-5">
      {/* ---- Verdict banner ---- */}
      <div className="glass-panel p-5" style={{ borderTop: `2px solid ${callColor(verdict.long_term.call)}` }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-borderSubtle pb-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
            <Microscope size={15} className="text-accentPurple" /> Analyst Verdict
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-textMuted">
              fundamentals · valuation · technicals · news
            </span>
          </h3>
          {hasTech && (
            <span
              className="rounded-md px-2 py-1 text-[11px] font-semibold font-mono uppercase tracking-wide"
              style={{ color: pColor, background: `${pColor}1a` }}
            >
              {PHASE_LABELS[tech.phase] || tech.phase}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1.2fr]">
          {/* Stack below 480px — two chips side-by-side clip on small phones */}
          <div className="flex flex-col gap-3 min-[480px]:flex-row sm:col-span-2 lg:col-span-2">
            <VerdictChip horizon="Long term (1y+)" verdict={verdict.long_term} />
            <VerdictChip horizon="Short term (weeks)" verdict={verdict.short_term} />
          </div>
          <div>
            <h4 className="mb-1 text-[11px] font-semibold font-mono uppercase tracking-wider text-textMuted">Pillar attribution</h4>
            {Object.entries(verdict.pillars).map(([k, v]) => (
              <PillarBar key={k} label={k} value={v as number} />
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-borderSubtle pt-3 sm:grid-cols-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-textMuted">Gets interesting at</div>
            <div className="text-base font-bold tabular text-accentCyan">
              {verdict.interesting_price ? fmtPrice(verdict.interesting_price, currency) : '—'}
            </div>
          </div>
          {hasTech && (
            <>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-textMuted">Support / Resistance</div>
                <div className="text-sm font-semibold tabular text-textPrimary">
                  {fmtPrice(tech.support?.near, currency)} · {fmtPrice(tech.resistance?.near, currency)}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-textMuted">Volume</div>
                <div className={clsx('text-sm font-semibold', tech.volume_read === 'confirming' ? 'text-accentGreen' : 'text-accentAmber')}>
                  {tech.volume_read}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-textMuted">52-week position</div>
                <div className="text-sm font-semibold tabular text-textPrimary">{Math.round((tech.pos_52w ?? 0) * 100)}%</div>
              </div>
            </>
          )}
        </div>
        {hasTech && (
          <p className="mt-2 text-[11px] leading-relaxed text-textSecondary">{tech.phase_note} {tech.volume_note}</p>
        )}
      </div>

      {/* ---- Fundamentals X-Ray ---- */}
      <FundamentalsPanel data={fundamentals} currency={currency} />

      {/* ---- AI research note ---- */}
      <div className="glass-panel p-5" style={{ borderTop: '2px solid #22D3EE' }}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
            <Sparkles size={15} className="text-accentCyan" /> AI Deep Dive
            <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-textMuted">
              figures from computed data · context from model knowledge
            </span>
          </h3>
          {!narrative && (
            <button
              onClick={runAiTeardown}
              disabled={aiLoading}
              className="rounded-lg border border-accentCyan/30 bg-accentCyan/5 px-4 py-2 text-xs font-semibold text-accentCyan transition-colors hover:bg-accentCyan/10 disabled:opacity-50"
            >
              {aiLoading ? 'Writing the teardown…' : 'Generate teardown'}
            </button>
          )}
        </div>

        {aiError && <p className="text-xs text-accentRed">{aiError}</p>}

        {!narrative && !aiError && !aiLoading && (
          <p className="text-xs text-textSecondary">
            One click produces the full 11-section teardown: business model, latest quarter,
            balance sheet, competitive position, management, technical setup, catalysts, the bull
            and bear cases, valuation, and an explicit BUY / HOLD / AVOID call checked against
            the computed verdict above.
          </p>
        )}

        {narrative && (() => {
          // Coerce every section defensively — a missing key just skips its block.
          const oneLiner = asText(narrative.one_liner);
          const fv = narrative.final_verdict && typeof narrative.final_verdict === 'object'
            ? narrative.final_verdict : null;
          const aiCall = typeof fv?.call === 'string' ? fv.call.toUpperCase() : null;
          const aiColor = callColor(aiCall ?? undefined);
          const sections = [
            { icon: <Building2 size={13} />, title: 'Business model', text: asText(narrative.business_model) },
            { icon: <Receipt size={13} />, title: 'Quarterly results', text: asText(narrative.quarterly_results) },
            { icon: <Scale size={13} />, title: 'Balance sheet', text: asText(narrative.balance_sheet) },
            { icon: <Swords size={13} />, title: 'Competitive position', text: asText(narrative.competitive_position) },
            { icon: <Users size={13} />, title: 'Management quality', text: asText(narrative.management_quality) },
            { icon: <CandlestickChart size={13} />, title: 'Technical setup', text: asText(narrative.technical_setup) },
            { icon: <CalendarClock size={13} />, title: 'Catalysts', text: asText(narrative.catalysts) },
          ].filter(s => s.text);
          const bull = asText(narrative.bull_case);
          const bear = asText(narrative.bear_case);
          const valuation = asText(narrative.valuation);
          return (
            <div className="space-y-4">
              {oneLiner && (
                <div className="rounded-xl border border-accentCyan/20 bg-accentCyan/5 p-4">
                  <Quote size={14} className="mb-1 text-accentCyan" />
                  <p className="text-sm font-medium leading-relaxed text-textPrimary">{oneLiner}</p>
                </div>
              )}

              {/* ---- Final verdict banner ---- */}
              {aiCall && (
                <div
                  className="flex flex-wrap items-start gap-3 rounded-xl p-4"
                  // Same tinted-panel treatment as the quote / bull / bear panels,
                  // keyed to the call color (hex + alpha suffix).
                  style={{ border: `1px solid ${aiColor}40`, background: `${aiColor}0d` }}
                >
                  <Gavel size={16} className="mt-1 shrink-0" style={{ color: aiColor }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-md px-2.5 py-0.5 text-lg font-black tracking-tight"
                        style={{ color: aiColor, background: `${aiColor}1a` }}
                      >
                        {aiCall}
                      </span>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-textMuted">
                        AI call · long horizon
                      </span>
                      {verdict?.long_term?.call && (
                        <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-textMuted">
                          vs computed:{' '}
                          <span className="font-semibold" style={{ color: callColor(verdict.long_term.call) }}>
                            {verdict.long_term.call}
                          </span>
                        </span>
                      )}
                    </div>
                    {asText(fv?.rationale) && (
                      <p className="mt-1.5 text-xs leading-relaxed text-textSecondary">{asText(fv?.rationale)}</p>
                    )}
                  </div>
                </div>
              )}

              {/* ---- Sections 1-7 in template order ---- */}
              {sections.length > 0 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {sections.map((s, i) => (
                    <div key={i}>
                      <h4 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold font-mono uppercase tracking-wider text-textMuted">
                        {s.icon} {s.title}
                      </h4>
                      <p className="text-xs leading-relaxed text-textSecondary">{s.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ---- Bull vs bear, side by side ---- */}
              {(bull || bear) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {bull && (
                    <div className="rounded-xl border border-accentGreen/25 bg-emerald-400/5 p-4">
                      <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold font-mono uppercase tracking-wider text-accentGreen">
                        <TrendingUp size={12} /> Bull case
                      </h4>
                      <p className="text-xs leading-relaxed text-textSecondary">{bull}</p>
                    </div>
                  )}
                  {bear && (
                    <div className="rounded-xl border border-accentRed/25 bg-red-400/5 p-4">
                      <h4 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold font-mono uppercase tracking-wider text-accentRed">
                        <TrendingDown size={12} /> Bear case
                      </h4>
                      <p className="text-xs leading-relaxed text-textSecondary">{bear}</p>
                    </div>
                  )}
                </div>
              )}

              {valuation && (
                <div>
                  <h4 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold font-mono uppercase tracking-wider text-textMuted">
                    <Calculator size={13} /> Valuation
                  </h4>
                  <p className="text-xs leading-relaxed text-textSecondary">{valuation}</p>
                </div>
              )}
            </div>
          );
        })()}

        <p className="mt-4 border-t border-borderSubtle pt-2 text-[10px] leading-relaxed text-textMuted">
          Figures are grounded in the computed data above. Qualitative context, including business model,
          competitors and catalysts, comes from the model&apos;s general knowledge of the company:
          verify it independently. Educational analysis on a paper-trading platform, not
          investment advice.
        </p>
      </div>
    </div>
  );
}
