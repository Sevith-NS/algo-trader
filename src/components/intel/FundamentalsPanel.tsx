"use client";
import { FileSearch, AlertTriangle, CheckCircle2, Scale } from 'lucide-react';
import clsx from 'clsx';
import { fmtBig, fmtPrice, gradeColor } from './format';

function ScoreBar({ label, value, max = 25 }: { label: string; value: number; max?: number }) {
  const pct = Math.min(value / max, 1) * 100;
  const color = pct >= 75 ? '#34D399' : pct >= 50 ? '#60A5FA' : pct >= 30 ? '#FBBF24' : '#F87171';
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-24 shrink-0 text-[10px] capitalize text-textMuted">{label.replace('_', ' ')}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="w-8 text-right text-[10px] tabular text-textSecondary">{value}/{max}</span>
    </div>
  );
}

/**
 * Fundamental X-Ray: health score, 5-year statement trajectory, red/green
 * flags, and valuation computed from raw statements vs the stock's own history.
 * Honest footer states what is NOT covered (concalls, MD&A, pledge data).
 */
export default function FundamentalsPanel({ data, currency }: { data: any; currency: string }) {
  if (!data) return null;
  if (data.error) {
    return (
      <div className="glass-panel p-5">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-textPrimary">
          <FileSearch size={15} className="text-accentPurple" /> Fundamental X-Ray
        </h3>
        <p className="text-sm text-textSecondary">{data.error}</p>
      </div>
    );
  }

  const { health, years, trends, valuation: val, red_flags, green_flags, quarterly_momentum: qm } = data;
  const gColor = gradeColor(health.grade);

  return (
    <div className="glass-panel p-5" style={{ borderTop: '2px solid #A78BFA' }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-borderSubtle pb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-textPrimary">
          <FileSearch size={15} className="text-accentPurple" /> Fundamental X-Ray
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-textMuted">
            {years.length} fiscal years · derived from raw statements
          </span>
        </h3>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-textMuted">Health</div>
            <div className="text-lg font-bold tabular text-textPrimary">{health.score}<span className="text-xs text-textMuted">/100</span></div>
          </div>
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black"
            style={{ color: gColor, background: `${gColor}1a`, border: `1px solid ${gColor}40` }}
          >
            {health.grade}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* Left: trajectory table + score components */}
        <div>
          <div className="mb-3">
            {Object.entries(health.components).map(([k, v]) => (
              <ScoreBar key={k} label={k} value={v as number} />
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-borderSubtle text-left text-[10px] uppercase tracking-wider text-textMuted">
                  <th className="py-2 pr-2 font-medium">FY</th>
                  <th className="py-2 pr-2 font-medium">Revenue</th>
                  <th className="py-2 pr-2 font-medium">Net profit</th>
                  <th className="py-2 pr-2 font-medium">Net mgn</th>
                  <th className="py-2 pr-2 font-medium">ROE</th>
                  <th className="py-2 pr-2 font-medium" title="Operating cash flow ÷ net profit">CFO/PAT</th>
                  <th className="py-2 font-medium">D/E</th>
                </tr>
              </thead>
              <tbody>
                {years.map((y: any) => (
                  <tr key={y.fiscal_year} className="border-b border-white/[0.03]">
                    <td className="py-1.5 pr-2 font-semibold text-textPrimary">{y.fiscal_year}</td>
                    <td className="py-1.5 pr-2 tabular text-textSecondary">{fmtBig(y.revenue, currency)}</td>
                    <td className="py-1.5 pr-2 tabular text-textSecondary">{fmtBig(y.net_income, currency)}</td>
                    <td className="py-1.5 pr-2 tabular text-textSecondary">{y.net_margin !== null ? `${y.net_margin}%` : '—'}</td>
                    <td className={clsx('py-1.5 pr-2 tabular', y.roe !== null && y.roe >= 15 ? 'text-accentGreen' : y.roe !== null && y.roe < 10 ? 'text-accentAmber' : 'text-textSecondary')}>
                      {y.roe !== null ? `${y.roe}%` : '—'}
                    </td>
                    <td className={clsx('py-1.5 pr-2 tabular', y.cash_conversion !== null && y.cash_conversion < 0.7 ? 'text-accentRed' : 'text-textSecondary')}>
                      {y.cash_conversion !== null ? `${y.cash_conversion}x` : '—'}
                    </td>
                    <td className={clsx('py-1.5 tabular', y.debt_to_equity !== null && y.debt_to_equity > 1.5 ? 'text-accentRed' : 'text-textSecondary')}>
                      {y.debt_to_equity !== null ? `${y.debt_to_equity}x` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-textMuted">
            {trends.revenue_cagr_pct !== null && (
              <span>Revenue CAGR ({trends.window_years}y): <span className={clsx('tabular font-medium', trends.revenue_cagr_pct >= 10 ? 'text-accentGreen' : 'text-textPrimary')}>{trends.revenue_cagr_pct}%</span></span>
            )}
            {trends.profit_cagr_pct !== null && (
              <span>Profit CAGR: <span className={clsx('tabular font-medium', trends.profit_cagr_pct >= 10 ? 'text-accentGreen' : 'text-textPrimary')}>{trends.profit_cagr_pct}%</span></span>
            )}
            {qm?.revenue_yoy !== undefined && (
              <span>Last qtr rev YoY: <span className={clsx('tabular font-medium', qm.revenue_yoy >= 0 ? 'text-accentGreen' : 'text-accentRed')}>{qm.revenue_yoy}%</span></span>
            )}
            {qm?.net_income_yoy !== undefined && (
              <span>Last qtr profit YoY: <span className={clsx('tabular font-medium', qm.net_income_yoy >= 0 ? 'text-accentGreen' : 'text-accentRed')}>{qm.net_income_yoy}%</span></span>
            )}
          </div>
        </div>

        {/* Right: valuation + flags */}
        <div className="space-y-4">
          <div className="rounded-xl border border-borderSubtle bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-textMuted">
              <Scale size={11} /> Valuation vs its own history
            </div>
            <div className="mb-2 flex items-end gap-3">
              <div>
                <div className="text-xl font-bold tabular text-textPrimary">{val.pe ?? '—'}<span className="ml-1 text-[10px] font-normal text-textMuted">P/E {val.eps_basis}</span></div>
              </div>
              {val.premium_to_own_history_pct !== null && (
                <span className={clsx(
                  'rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular',
                  val.premium_to_own_history_pct > 5 ? 'bg-red-400/10 text-accentRed' : val.premium_to_own_history_pct < -5 ? 'bg-emerald-400/10 text-accentGreen' : 'bg-white/5 text-textSecondary'
                )}>
                  {val.premium_to_own_history_pct > 0 ? '+' : ''}{val.premium_to_own_history_pct}% vs {val.pe_hist_avg} avg
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/[0.03] py-1.5">
                <div className="text-[9px] uppercase text-textMuted">P/B</div>
                <div className="text-sm font-semibold tabular text-textPrimary">{val.pb ?? '—'}</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] py-1.5">
                <div className="text-[9px] uppercase text-textMuted">EV/EBITDA</div>
                <div className="text-sm font-semibold tabular text-textPrimary">{val.ev_ebitda ?? '—'}</div>
              </div>
              <div className="rounded-lg bg-white/[0.03] py-1.5">
                <div className="text-[9px] uppercase text-textMuted">Fair @ hist P/E</div>
                <div className="text-sm font-semibold tabular text-textPrimary">{val.fair_price_at_hist_pe ? fmtPrice(val.fair_price_at_hist_pe, currency) : '—'}</div>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-textSecondary">{val.verdict}</p>
          </div>

          {red_flags.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accentRed">
                <AlertTriangle size={11} /> Red flags
              </div>
              <div className="space-y-1.5">
                {red_flags.map((f: any, i: number) => (
                  <div key={i} className="rounded-lg border border-red-400/15 bg-red-400/5 p-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-textPrimary">
                      {f.title}
                      {f.severity === 'high' && <span className="rounded bg-red-400/20 px-1 text-[9px] font-bold uppercase text-accentRed">high</span>}
                    </div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-textSecondary">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {green_flags.length > 0 && (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-accentGreen">
                <CheckCircle2 size={11} /> Green flags
              </div>
              <div className="space-y-1.5">
                {green_flags.map((f: any, i: number) => (
                  <div key={i} className="rounded-lg border border-emerald-400/15 bg-emerald-400/5 p-2">
                    <div className="text-[11px] font-semibold text-textPrimary">{f.title}</div>
                    <p className="mt-0.5 text-[10px] leading-relaxed text-textSecondary">{f.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <p className="mt-4 border-t border-borderSubtle pt-2 text-[10px] leading-relaxed text-textMuted">
        Not covered by this automated x-ray (needs manual reading): {data.not_covered?.join(' · ')}.
        All figures derived from public filings data; paper-trading research, not investment advice.
      </p>
    </div>
  );
}
