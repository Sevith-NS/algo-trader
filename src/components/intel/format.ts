// Shared formatting + palette helpers for the intelligence panels.

export const fmtPrice = (val: number | null | undefined, currency = 'USD') =>
  val === null || val === undefined
    ? '—'
    : new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
        style: 'currency',
        currency,
      }).format(val);

/** Large statement figures: ₹ Cr / L Cr for INR, $B/$M elsewhere. */
export const fmtBig = (val: number | null | undefined, currency = 'USD') => {
  if (val === null || val === undefined) return '—';
  const abs = Math.abs(val);
  if (currency === 'INR') {
    if (abs >= 1e12) return `₹${(val / 1e12).toFixed(2)} L Cr`;
    if (abs >= 1e7) return `₹${Math.round(val / 1e7).toLocaleString('en-IN')} Cr`;
    return `₹${Math.round(val).toLocaleString('en-IN')}`;
  }
  if (abs >= 1e12) return `$${(val / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(val / 1e6).toFixed(1)}M`;
  return `$${Math.round(val).toLocaleString('en-US')}`;
};

export const stanceColor = (stance: string | undefined) =>
  stance === 'bullish' ? '#34D399' : stance === 'bearish' ? '#F87171' : '#FBBF24';

export const callColor = (call: string | undefined) =>
  call === 'BUY' ? '#34D399' : call === 'AVOID' ? '#F87171' : '#FBBF24';

export const gradeColor = (grade: string | undefined) => {
  if (!grade) return '#64748B';
  if (grade.startsWith('A')) return '#34D399';
  if (grade === 'B') return '#60A5FA';
  if (grade === 'C') return '#FBBF24';
  return '#F87171';
};

export const PHASE_LABELS: Record<string, string> = {
  markup: 'Markup · uptrend',
  markdown: 'Markdown · downtrend',
  accumulation: 'Accumulation · basing',
  distribution: 'Distribution · topping',
  transition: 'Transition · no regime',
};

export const phaseColor = (phase: string | undefined) =>
  phase === 'markup' ? '#34D399'
  : phase === 'markdown' ? '#F87171'
  : phase === 'accumulation' ? '#22D3EE'
  : phase === 'distribution' ? '#FBBF24'
  : '#94A3B8';
