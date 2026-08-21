// Fixed horizon-tag palette for the Discovery surface (product doctrine —
// same tag, same color, everywhere): long_term=blue, swing=purple,
// short_term=cyan, intraday=amber. Static class strings so Tailwind's
// scanner picks them up.

import type { HorizonTagId } from '../../types/discover';

export const TAG_ORDER: HorizonTagId[] = ['long_term', 'swing', 'short_term', 'intraday'];

export const TAG_LABELS: Record<HorizonTagId, string> = {
  long_term: 'Long Term',
  swing: 'Swing',
  short_term: 'Short Term',
  intraday: 'Intraday',
};

export const TAG_STYLES: Record<HorizonTagId, { chip: string; dot: string }> = {
  long_term: { chip: 'border-accentBlue/25 bg-accentBlue/10 text-accentBlue', dot: 'bg-accentBlue' },
  swing: { chip: 'border-accentPurple/25 bg-accentPurple/10 text-accentPurple', dot: 'bg-accentPurple' },
  short_term: { chip: 'border-accentCyan/25 bg-accentCyan/10 text-accentCyan', dot: 'bg-accentCyan' },
  intraday: { chip: 'border-accentAmber/25 bg-accentAmber/10 text-accentAmber', dot: 'bg-accentAmber' },
};
