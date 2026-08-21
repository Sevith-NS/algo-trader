// Types for the India movers board (/movers) — mirrors the backend contract
// exactly: GET /api/movers, GET /api/movers/scopes.

/**
 * `unranked` is not a cap tier. It is every NSE cash-EQ company that sits below
 * the Total Market 750 line, where the exchange publishes no size index — and
 * it is where the 20% circuit moves actually happen, so it is a first-class
 * segment rather than an "other" bucket.
 */
export type CapSegment =
  | 'largecap'
  | 'midcap'
  | 'smallcap'
  | 'microcap'
  | 'unranked';

/** How a scope selects its members. `ranked` = member of any NSE size index. */
export type ScopeKind = 'all' | 'ranked' | 'index' | 'segment' | 'flag';

export interface ScopeMeta {
  id: string;
  label: string;
  kind: ScopeKind;
  /** Which picker group the scope belongs to in the UI. */
  group: 'index' | 'segment';
  count: number;
}

/**
 * How much the backend is entitled to claim about a circuit hit.
 * - `confirmed`  — close sits at a band AND the session's 5-minute series shows
 *                  the close pinned to the day's extreme, as a locked book does.
 * - `inferred`   — close sits at a band but intraday data does not corroborate,
 *                  so the round number may be coincidence.
 * - `unverified` — no intraday data warm yet; band match alone.
 */
export type CircuitConfidence = 'confirmed' | 'inferred' | 'unverified';

export interface MoverRow {
  /** NSE trading symbol, e.g. "TDPOWERSYS". */
  symbol: string;
  /** Yahoo form used for pricing, e.g. "TDPOWERSYS.NS". */
  yahoo: string;
  name: string;
  industry: string;
  segment: CapSegment;
  segment_label: string;
  /** Index ids this symbol belongs to. Empty for `unranked` names. */
  indices: string[];
  /** null when the Groww instrument master was unavailable. */
  fno: boolean | null;
  /** MIS (intraday margin) eligibility, from the Groww instrument master. */
  intraday_eligible: boolean | null;
  lot_size: number | null;
  currency: string;
  price: number;
  prev_close: number;
  change_abs: number;
  change_pct: number;
  /** null when fewer than 6 bars are available. */
  ret_5d_pct: number | null;
  /** Last ~20 closes, oldest first. */
  spark: number[];
  last_bar: string;
  /** true when this row came from a cached chunk past its fresh window. */
  stale_chunk: boolean;

  // ---- circuit inference -------------------------------------------------
  /** The standard NSE band (20/10/5) this close sits at, or null. */
  circuit_band: number | null;
  circuit_confidence?: CircuitConfidence;

  // ---- intraday enrichment (present only for the enriched shortlist) ------
  /** Session the intraday figures belong to; always equal to `as_of` when set. */
  session?: string;
  /** 5-minute bars that traded. A handful implies a locked book. */
  bars?: number;
  intraday_open?: number;
  intraday_low?: number;
  intraday_high?: number;
  /** (high − low) / prev_close, as a percentage. */
  intraday_range_pct?: number;
  close_at_high?: boolean;
  close_at_low?: boolean;
}

export interface MoversBreadth {
  advancing: number;
  declining: number;
  unchanged: number;
}

/** One cap-segment column in the Top Movers section. */
export interface SegmentSection {
  segment: CapSegment;
  label: string;
  priced: number;
  advancing: number;
  declining: number;
  /** Top names by ABSOLUTE move, so the biggest moves either way lead. */
  movers: MoverRow[];
}

export interface CircuitSections {
  upper: MoverRow[];
  lower: MoverRow[];
  upper_count: number;
  lower_count: number;
  /** Bands the backend is willing to infer, widest first. */
  bands: number[];
  band_tolerance: number;
  /** How many hits carry intraday corroboration. */
  confirmed_count: number;
}

export interface IntradaySection {
  rows: MoverRow[];
  /** MIS-eligible names in scope. */
  eligible_count: number;
  /** Of those, how many carry a measured 5-minute range. */
  measured_count: number;
  ranked_by: 'intraday_range_pct' | 'change_pct';
  interval: string;
  /** Ceiling on how many names get a 5-minute fetch per warm cycle. */
  enrich_cap: number;
}

export interface MoversResponse {
  scope: string;
  scope_label: string;
  scopes: ScopeMeta[];
  min_move_pct: number;
  /** Date of the newest bar seen anywhere in the scan; null when nothing priced. */
  as_of: string | null;
  computed_at: string;
  /** Symbols in the selected scope. */
  scanned: number;
  /** Symbols actually priced. Less than `scanned` while the cache warms. */
  priced: number;
  coverage_pct: number;
  /** true when priced < scanned — the board is an incomplete view. */
  partial: boolean;
  /** true while a background warmer is still filling the price cache. */
  warming: boolean;
  warm_progress: {
    done: number;
    total: number;
    /** Which pass is running: the daily scan, or intraday enrichment. */
    phase: 'daily' | 'intraday' | null;
  } | null;
  breadth: MoversBreadth;
  gainers: MoverRow[];
  losers: MoverRow[];
  /** Every row with |change| >= min_move_pct, largest absolute move first. */
  big_movers: MoverRow[];
  big_mover_count: number;

  // ---- the three sections -------------------------------------------------
  segments: SegmentSection[];
  circuits: CircuitSections;
  intraday: IntradaySection;

  // ---- honesty about what was thrown away ---------------------------------
  /** Rows dropped as suspected unadjusted corporate actions. */
  excluded_implausible: number;
  excluded_examples: { symbol: string; change_pct: number }[];
  sanity_max_move_pct: number;
  warnings: string[];
}

export interface MoversScopesResponse {
  scopes: ScopeMeta[];
  segment_order: CapSegment[];
  segment_labels: Record<CapSegment, string>;
  counts: Record<CapSegment, number>;
  index_counts: Record<string, number>;
  built_at: string | null;
  warnings: string[];
}
