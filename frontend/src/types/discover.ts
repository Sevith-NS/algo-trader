// Types for the Discovery feature (/discover) — mirrors the backend contract
// exactly: GET /api/discover, GET /api/screens, GET /api/screens/run.

export type HorizonTagId = 'long_term' | 'swing' | 'short_term' | 'intraday';

export interface HorizonTag {
  id: HorizonTagId;
  label: string;
  /** Human-readable evidence line, e.g. "+28% 1y · above 200-DMA · 50>200 DMA". */
  reason: string;
}

export interface UniverseMeta {
  id: string;
  label: string;
  count: number;
  /** Option group in the picker: "US" | "India" | "Global" | "Crypto" | "Commodities". */
  group?: string;
  /**
   * false when a dynamically-built universe (the NIFTY index families) could
   * not resolve its membership — the NSE constituent feed is down. Listed but
   * not selectable, because silently dropping NIFTY 50 from the dropdown would
   * read as a bug rather than an outage.
   */
  available?: boolean;
}

/**
 * Freshness of the newest bar in a scan. The backend serves cached data for up
 * to 7 days when upstream is unreachable, so without this a scan can keep
 * returning the same names for days with nothing on screen saying why.
 */
export interface Freshness {
  as_of_age_days: number | null;
  /** true past a normal weekend gap (> 2 calendar days). */
  stale: boolean;
}

export interface DiscoverCardMetrics {
  rsi_14: number | null;
  ret_5d_pct: number | null;
  ret_1y_pct: number | null;
  vol_ann_pct: number | null;
  above_sma200: boolean | null;
}

export interface DiscoverCard {
  symbol: string;
  name: string;
  /** Nullable: the backend emits null for non-finite/unavailable values. */
  price: number | null;
  change_1d_pct: number | null;
  currency: string;
  /**
   * Only symbols with >= 1 tag appear, unless the request set all=1 (the
   * Markets hub) — then every parsed symbol gets a card and tags may be [].
   * Cards are always sorted alphabetically (no ranking).
   */
  tags: HorizonTag[];
  /** Last ~30 closes, oldest first. */
  spark: number[];
  metrics: DiscoverCardMetrics;
}

export interface DiscoverResponse extends Freshness {
  universe: string;
  universe_label: string;
  currency: string;
  universes: UniverseMeta[];
  /** Date of the latest bar in the data (YYYY-MM-DD). */
  as_of: string;
  computed_at: string;
  scanned: number;
  /** Symbols whose series actually parsed; 0 means upstream outage (not cached). */
  parsed: number;
  cards: DiscoverCard[];
}

export interface ScreenMeta {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Generated from the evaluator's own spec (one source of truth), " · "-joined. */
  conditions: string;
  direction: 'long' | 'short';
  horizon: HorizonTagId;
  volume_confirmed: boolean;
}

export interface ScreensListResponse {
  screens: ScreenMeta[];
  categories: string[];
}

export interface ScreenColumn {
  key: string;
  label: string;
}

export interface ScreenMatch {
  symbol: string;
  name: string;
  /** Nullable: the backend emits null for non-finite/unavailable values. */
  price: number | null;
  change_1d_pct: number | null;
  currency: string;
  /** Last ~30 closes, oldest first. */
  spark: number[];
  /** Keyed by ScreenRunResponse.columns[].key; null renders as "—". */
  values: Record<string, number | null>;
  /** false when OHLCV confirm data was unavailable (close-only match). */
  volume_confirmed: boolean;
}

export interface ScreenRunResponse extends Freshness {
  screen: ScreenMeta;
  universe: string;
  universe_label: string;
  currency: string;
  as_of: string;
  computed_at: string;
  scanned: number;
  /** Symbols whose series actually parsed; 0 means upstream outage (not cached). */
  parsed: number;
  matched: number;
  columns: ScreenColumn[];
  /** Sorted alphabetically by symbol. */
  matches: ScreenMatch[];
}

// ---------------------------------------------------------------------------
// Levels — GET /api/levels
// ---------------------------------------------------------------------------

export type LevelSide = 'support' | 'resistance';
export type LevelTimeframe = 'daily' | 'weekly';

export interface LevelRow {
  symbol: string;
  name: string;
  currency: string;
  price: number;
  /** The support/resistance price itself. */
  level: number;
  timeframe: LevelTimeframe;
  side: LevelSide;
  /** Signed: negative means the level sits below spot. */
  distance_pct: number;
  /** Distance in daily sigmas — the comparable measure across volatilities. */
  distance_sigmas: number;
  touches: number;
  last_touch_bars: number;
  /** Pre-formatted, e.g. "3w ago" — bars mean different things per timeframe. */
  last_touch_label: string;
  /** Level quality alone, 0-100. */
  strength: number;
  /** Level quality x proximity x confluence bonus, 0-100. Drives the rank. */
  score: number;
  /** A level of the same price exists on the other timeframe. */
  confluence: boolean;
  /** Has acted as both support and resistance. */
  flipped: boolean;
  daily_sigma_pct: number;
  /** Auditable evidence line — every number in it was used by the scan. */
  reason: string;
  /** Last ~30 closes, oldest first. */
  spark: number[];
}

export interface LevelsResponse extends Freshness {
  universe: string;
  universe_label: string;
  currency: string;
  universes: UniverseMeta[];
  side: LevelSide | 'all';
  as_of: string;
  computed_at: string;
  scanned: number;
  /** Symbols whose series actually parsed; 0 means upstream outage. */
  parsed: number;
  matched: number;
  /** "close" — pivots are close-based; wick-defended levels are not included. */
  basis: string;
  /** Ranked best-first, unlike Ideas. */
  rows: LevelRow[];
}
