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

export interface DiscoverResponse {
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

export interface ScreenRunResponse {
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
