# Vanguard OS 2.0 — Product Requirements Document

**Status:** Draft for review · **Owner:** Product · **Date:** 2026-07-31 · **Register:** product

---

## 1. Executive Summary

Vanguard OS is a personal quant desk for one self-directed trader. Version 2.0 rebuilds it into a personal portfolio manager that handles nine asset classes — US and international equities, ETFs, crypto, FX, futures, options, commodities, bonds and cash — with **instrument-correct math**, and re-parameterizes every signal, size, and surface across seven trading styles through one **Style Profile** system. All trading remains paper; sizing is evidence-gated.

Today the app is a promising demo: a Next.js terminal over a Flask quant backend with real multi-factor signals, risk analytics, ML forecasts, and an AI assistant — but the portfolio lives in browser localStorage untied to identity, signals have never been backtested, the ML probability is in-sample decoration, "interval" and "period" parameters are silently ignored, the dashboard is mock data, and every number is US/USD-centric. 2.0 replaces that foundation with server-truth persistence (Postgres ledger with tax lots and honest performance math), a provider-agnostic market-data layer with an instrument registry and market calendars, an event-driven backtest engine that validates every signal before it is trusted, a Style Profile system that re-parameterizes the whole desk per trading style, and an AI copilot with read-only tool use over the live quant stack.

The product is a single-user power tool, not a SaaS. Its promise is decision quality: every number on screen is earned, sourced, timestamped, and testable — a disciplined instrument, not a hype machine.

---

## 2. Background & Current State

**What exists.** A two-process app: Next.js 16 App Router frontend (port 3000) and a sync Flask dev server (port 5000). Real capabilities: a composite quant signal engine (`backend/quant_models.py`: mean reversion, momentum, RSI, VWAP deviation, volume flow → weighted composite, ATR/swing trade plans, half-Kelly sizing); risk analytics (`risk_analytics.py`: historical/parametric VaR, CVaR, Sharpe, Sortino, max drawdown, beta vs ^GSPC, HHI, Markowitz optimization); Google News RSS + VADER sentiment; XGBoost direction + Prophet forecasts; a Gemini assistant grounded in portfolio and signals; and a 3D geotrade globe. Surfaces: landing, screener ("Terminal"), portfolio, dashboard, markets, news, geotrade, community, login. Data comes from Yahoo's public JSON APIs through a hand-rolled two-tier cache with a global 1.5s outbound throttle and stale-if-error semantics.

**What is honest to admit.**

- **No database.** The paper portfolio is `localStorage` (`pt_balance`/`pt_positions`/`pt_trades`), per-browser, decoupled from auth; clearing storage destroys the track record. Server persistence is a JSON file (`.data/db.json`) committed to git with real user emails. A Prisma/Postgres migration was attempted and abandoned (fossil `prisma-error*.log`, unused `@prisma/adapter-pg`, `pg`, `bcryptjs` deps).
- **No realized P&L, no lots, no journal, no watchlists, no settings page, no alerts.** All-time return is computed against a hardcoded `100000` (`portfolio/page.tsx:103,122`).
- **Signals are unvalidated.** No backtesting exists. The XGBoost "probability" is trained and scored on the same data (no holdout); Kelly inputs are unconditional daily-return stats, not per-signal edge; `risk_reward` is a hardcoded 1.5. Risk analytics apply *current* weights to a full year of history.
- **Daily-bars-only, US/USD-centric.** `/api/chart` ignores its own `interval`/`period1` params; market overview is 15 hardcoded US mega-caps with fake market caps; `Intl.NumberFormat('en-US','USD')` is hardcoded; the "S&P 500 Heatmap" title is a lie regardless of payload.
- **Architecture debt.** Sync single-process Flask with `debug=True`; errors returned as `{error}` at HTTP 200; five files hardcode `http://127.0.0.1:5000` bypassing `API_BASE`; one confirmed broken endpoint (`/api/analyze-idea`, `app.py:168`); zero tests anywhere; no push channel (fetch-once except one 30s poll); the dashboard is 100% mock ("Save Module" is a no-op); auth accepts any password; `prefers-reduced-motion` — a committed hard requirement — is honored nowhere.

**What is worth keeping.** The design identity (deep-slate `#07090F`, neon accents, Inter + JetBrains Mono, glass panels) is committed and good. The quant factor math is a legitimate starting point. The caching/throttle discipline in `data_source.py` is the seed of a real provider layer. lightweight-charts, react-grid-layout, and the Gemini SDK are the right libraries.

---

## 3. Vision & Product Principles

**North star:** a personal portfolio manager that handles nine asset classes with instrument-correct math, and re-parameterizes every signal, size, and surface across seven trading styles via one profile system — one power user, one docker-compose stack, paper-first, evidence-gated.

**Committed design principles (carried forward, unchanged):**

1. **The number is the hero.** Typography, layout, and motion exist to serve the figure being read.
2. **Discipline over emotion.** The tool enforces process: confirm steps, rule checks, journals, reviews.
3. **Powerful, not intimidating.** Depth is progressive; a long-term investor never wades through scalper chrome.
4. **Motion serves state, not spectacle.** Animation communicates change; `prefers-reduced-motion` is a hard requirement.
5. **Honest about risk.** All trading is paper, and the product says so; uncertainty is displayed, never hidden.

**Product principles that emerged from this design cycle:**

6. **Every number is earned.** No metric ships without provenance (source, age, delay class) and, where it is an estimate, a confidence interval. In-sample results are permanently badged as such.
7. **Evidence before sizing.** Position-size recommendations derive from backtested, out-of-sample trade distributions — or clearly label themselves as fallbacks.
8. **Server truth, local speed.** Ledger, settings, profiles, and journals live in Postgres keyed to the user; localStorage is a cache, never the record.
9. **Keyless by default, pluggable by key.** The full product must run on free data (Yahoo, Binance public, Google News). Paid providers activate only when the user supplies a key; no feature may hard-require one.
10. **AI observes and explains; it never trades.** Every AI answer traces to a tool call; no automation path reaches an execution function.

---

## 4. Personas & Trading-Style Profiles

Seven style profiles ship as first-class configuration objects (§7). Each is a concrete persona whose needs drive requirements:

| Persona | Timeframe / bars | Markets | Sizing & risk | What they need most |
|---|---|---|---|---|
| **Scalper** | 1m–5m, minutes-long holds | Crypto (real-time); equities/FX analysis-only (delayed data) | 0.25–0.5% risk/trade, tight 1.2×ATR stops | Intraday bars (A4), Desk density + hotkeys (F7, F2), real-time spine (F5), momentum/volume-weighted signals (B3) |
| **Day Trader** | 5m–1h, intraday flat | Equities, futures, crypto | 0.5–1% risk, session-aware | Session clocks (A3), alerting (E5), pre-market brief (E6), honest fills (D4), margin modeling (C6) |
| **Swing Trader** | 1h–1d, days–weeks | Equities, ETFs, crypto | 1% risk, 1.5–3R ladders | Trade-plan template (B2), scans (B4), journal + review (C9/E4), backtest evidence (D1–D3) |
| **Position Trader** | 1d–1wk, weeks–months | Equities, futures, commodities, FX | 1–2% risk, wide stops, 3–5R | Regime detection (D7), stress tests (D5), contract-aware futures paper (C10), multi-market overview (A6) |
| **Long-Term Investor** | 1wk+, months–years | Global equities, ETFs, bonds, cash | Fixed-fractional, drift-band rebalancing | TWR/MWR vs benchmarks (C4), dividends (C5), rebalancing (C7), rates & cash yield (A7), Monte Carlo cones (D6) |
| **Options Income** | Daily decisions, 30–45 DTE structures | US equity/ETF options | Delta/premium-based, defined risk | Chains + Greeks + IV rank (A9), payoff builder (D10), income panel (C5), covered-call/CSP paper booking + covered-position awareness (C10) |
| **Systematic Quant** | Any; strategy-defined | All classes | Evidence-based Kelly, capped | Strategy DSL + custom indicators (B5/B6), walk-forward validation (D3), golden-file guarantees (G6), OpenAPI typed client (G3) |

The customization thesis: these seven personas are one product with different **Style Profiles** active — not seven modes, and not a dumbed-down "simple view."

**Data-honesty caveats (committed, not fine print).** The keyless stack quotes US equities and FX ~15 minutes delayed, with paper fills checked every 60 seconds (§8, D4) — a scalping track record built on that data would be fiction, violating principles 6 and 7. The shipped **Scalper preset therefore routes to crypto** (Binance, real-time); under a scalper profile, equity/FX surfaces show a permanent "delayed data — scalping unsupported" state, and intraday-style paper records on delayed classes are excluded from evidence metrics (§11). Both trade directions are first-class: short selling ships as C12. The Options Income persona books single-leg, covered-call, and cash-secured-put positions via C10; multi-leg execution stays analytics-only (D10).

---

## 5. Scope

**In scope (2.0):**

- Paper trading across all listed asset classes with instrument-correct math (multipliers, pips, fractional crypto, currencies, calendars), long and short (C12), including single-leg/covered options booking (C10).
- Server-side persistence: users, portfolios, ledger, lots, journal, settings, profiles, strategies, alerts, snapshots.
- Backtesting, walk-forward validation, honest ML pipeline, evidence-based sizing.
- AI copilot with read-only tool use, explainability, discipline checks, scheduled briefs, deterministic alerting.
- Workspace system: shell, command palette, chart v2, real widget dashboard, watchlists, trade ticket v2.
- Platform: FastAPI migration, Postgres, OpenAPI typed client, scheduler, WebSocket/SSE streaming, tests, docker-compose, backup/restore.

**Out of scope (explicit non-goals):**

- **Real-money order execution — vNext only, behind safeguards.** No order-capable broker integration ships in 2.0. Broker connectivity appears solely as read-only mirroring/CSV import (C11), with a grep-enforced invariant that no alerting/automation/AI module imports any execution function. Any future live path requires separate arming design, typed confirmations, notional caps, and a kill switch — designed, not shipped.
- **Intraday signal computation on delayed data.** Quant signals compute on daily bars in 2.0; intraday charts carry `computed_on` labels (A4). Scalper-grade intraday signals ship only for real-time classes (crypto via Binance) — equity/FX scalping is honestly unsupported until a real-time provider key is present. (This resolves the former open question on intraday signals as a scope decision.)
- **Multi-tenant SaaS plumbing.** No orgs, billing, roles, horizontal scaling, or sharing marketplaces. Auth exists to protect one user's box and bind data to one identity.
- **Tick/L2 infrastructure.** 1m bars are the floor and ceiling; the streaming layer honestly labels its 5–15s polling cadence. No fake ticks.
- **Arbitrary code execution.** Custom indicators are a whitelisted expression DSL first, resource-limited subprocess Python second — never a Pine-Script-scale runtime.
- **Jurisdictional tax filings.** Lots and realized P&L are tracked precisely; a clean CSV export (implemented in C3's acceptance) is the boundary. No Form 8949, no wash-sale engine.
- **Theming beyond the identity.** Density, motion, and semantic accent remapping only. No light mode, no palettes, no TradingView embed.
- **Exhaustive long-tail coverage.** OTC/pink sheets, CUSIP-level bonds, exotic OTC derivatives return "unsupported" with a reason rather than unreliable data presented confidently.

---

## 6. Feature Requirements

Priorities: **P0** = 2.0 cannot ship without it; **P1** = 2.0 target; **P2** = fast-follow/vNext — **by definition, P2 items are not scheduled in any phase (§10)**. Effort, in calendar terms for the single developer this product assumes: **S** ≤ 3 days · **M** ≈ 1 week · **L** ≈ 2–3 weeks · **XL** ≈ 4–6 weeks.

### Epic A — Multi-Market Data Platform

**A1 · Instrument Registry & Symbology (P0, M).** Every symbol resolves once into a canonical record: `{symbol, asset_class, exchange, currency, price_scale, tick_size, contract_multiplier, calendar_id, provider_hints, aliases[]}`, classified from Yahoo symbology (`=X` fx, `-USD` crypto, `=F` future, `^` index, `.L/.NS/.TO/.AS/.T` international) plus `quoteType` from the search payload the frontend currently discards. GBp instruments carry `price_scale: 0.01`. `aliases[]` records prior tickers so a renamed symbol resolves to one instrument (feeds C5's `SYMBOL_CHANGE` handling); delisted instruments carry a typed `delisted` status with a last-price-as-of date.
*User story:* As a systematic quant trading US equities, LSE stocks, and crypto, I want the app to know `VOD.L` is GBp-quoted London equity and `BTC-USD` is 24/7 crypto, so downstream numbers use the right conventions.
*Acceptance:* `GET /api/instrument?symbol=` returns correct class/currency for US equity, `.L/.NS/.TO/.AS`, `BTC-USD`, `EURUSD=X`, `GC=F`, `^GSPC`; 100 GBp renders £1.00; unknown symbols return a typed error; lookups cache-served after first resolution; search dropdown shows asset-class badge + exchange from payload, not string heuristics; an aliased (renamed) ticker resolves to the same instrument id.
*Build:* New `backend/app/marketdata/instruments.py` + route; static suffix table; `SearchInput.tsx` gains `AssetClassBadge` (crypto=amber, fx=cyan, futures=purple, equity=blue) and drops its hardcoded URL. Scheduled at the top of Phase 2, strictly before A2/A4, which consume it.

**A2 · Provider Adapter Layer (P0, L).** Refactor `data_source.py` into `backend/app/marketdata/{base,yahoo,binance,cache,router}.py` behind a `MarketDataProvider` protocol (`get_quote`, `get_ohlcv(instrument, interval, range)`, `get_search`, optional `get_options_chain`, `get_funding_rate`). Yahoo extracted first (keeping raw-requests UA trick, stale-if-error, disk cache); `BinancePublicProvider` (keyless klines/24h ticker/funding) second. Routing by asset class with config-driven ordered fallback; throttles per provider (crypto no longer queues behind equities); every payload names `provider` and cache age. Polygon/Alpaca/OANDA stubs behind env keys.
*User story:* As a crypto day trader, I want crypto candles from Binance with Yahoo fallback, so I'm not trading delayed daily bars while equities keep working exactly as today.
*Acceptance:* Behavioral parity on all existing endpoints for US equities (fixture-verified); killing Binance connectivity falls back to Yahoo with `degraded: true`; adding a provider = implement protocol + one registry entry, zero router-handler changes.
*Build:* Namespace `.market_cache.json` keys by provider; symbol translation (BTC-USD→BTCUSDT) in adapter, driven by A1 (which lands first in the same phase). This is the load-bearing refactor — schedule immediately after A1.

**A3 · Market Hours, Calendars & Timezones (P0, M).** `exchange_calendars`-backed `market_clock.py` maps `calendar_id` → `{state: open|closed|pre|post|24x7, next_open, next_close, tz}`, embedded in every quote. FX gets the 24/5 pseudo-calendar; crypto is `24x7`. Frontend: session badge on the Terminal ("LSE · OPEN · closes 16:30 GMT"), closed-market chips on portfolio rows, and the portfolio poll skips closed-market symbols.
*Acceptance:* Correct open/closed + next transition for NYSE, LSE, NSE, and crypto, honoring a known holiday; crypto never shows "closed"; all timestamps render in local TZ with exchange TZ on hover; closed positions show a muted chip, not implied live pricing.
*Build:* `SessionBadge.tsx` in screener header and portfolio rows; JetBrains Mono countdown.

**A4 · Real Intraday Intervals + Volume (P0, L).** `/api/chart` honors `interval` (1m/5m/15m/1h/1d/1wk) and `range` (Yahoo v8 serves these; Binance klines for crypto), emits volume, and gets per-interval cache TTLs (1m: 60s; 1d: 30min). Chart gains an interval switcher filtered by class/provider capability (asset-class resolution from A1, same phase, lands first); screener stops hardcoding `interval=1d`; unavailable combos are disabled with a tooltip, never silently substituted. Quant payloads annotate `computed_on: "1d"` when signals and chart interval diverge.
*User story:* As a day trader, I want to flip between 5-minute and daily candles with volume so I can time entries from the plan the daily engine produced.
*Acceptance:* 5m bars are genuinely 5m (timestamp-verified); volume pane renders with existing up/down tokens; quant price lines survive interval switches (fix unstable `colors.priceLines` dep, `Chart.tsx:135` — update via `setData`, no teardown); chosen interval persists across symbol change and reload. Payload changes land after G1's swap, with documented golden-file deltas (G6).

**A5 · Multi-Currency Portfolio & FX Normalization (P0, L).** Positions carry `currency` (captured at trade time; legacy migrates as USD). User-selectable base currency drives aggregation via `{CCY}{BASE}=X` rates; P&L decomposes into local return and FX return ("+4.2% local · −1.1% FX"). `risk_analytics` converts each close series to base currency **using historical FX close series** (Yahoo `=X` daily history) joined date-by-date, forward-filled across holiday mismatches, GBp ÷100 before conversion — a single spot rate would merely rescale the series and show zero FX volatility. FX series come from the G4 `bars` table once it exists (live fetch until then); cold-path budget: a 10-position, 4-currency book adds 4 history fetches ≈ 6s under the 1.5s throttle, then cache-warm. `formatMoney(value, currency)` in `src/lib/format.ts` replaces every hardcoded `en-US/USD` formatter; hardcoded `100000` baseline replaced by ledger-derived deposits (C1).
*Acceptance:* Buying `SAP.DE` records EUR; switching base currency reprices without touching positions; mixed-currency test book shows measurably different VaR than an all-USD book; a constant-spot conversion fixture produces zero FX vol and fails the test (guarding the date-aligned join); GBp values divide by 100 before conversion; legacy portfolios migrate losslessly.

**A6 · Configurable Multi-Market Overview & Universes (P1, M).** Replace the hardcoded 15-megacap list and static `_APPROX_CAPS` with universes: ≥6 shipped presets (US Large Cap, Europe, Asia, Crypto Top 20, FX Majors, Commodities, Rates) plus user-defined lists persisted server-side. `/markets` becomes tabbed; the heatmap title names the actual universe; tile sizing uses real market cap where available, equal-size otherwise. Fixes `top_losers.reverse()` render mutation (`markets/page.tsx:118`) and the hardcoded backend URL in passing.
*Acceptance:* Presets load via batched spark within throttle budget; custom universes validate against A1 and survive restart; non-equity tabs never claim "S&P 500"; every tile links to `/screener?q=` and works for all classes.

**A7 · Rates & Cash as a First-Class Sleeve (P2, S).** Yield strip (2s/5s/10s/30s from `^IRX/^FVX/^TNX/^TYX`), 2s10s spread with inversion state (amber), on `/markets` and `/portfolio`. Optional paper-cash accrual at the 3-month bill rate, lazily computed from a last-accrual timestamp, booked as `INTEREST` ledger events — never conflated with trading P&L.
*Acceptance:* Accrual off by default, toggleable, survives reload; interest appears as a separate ledger line; risk analytics continue to exclude cash (documented in-panel).

**A8 · Data Provenance & Health Surface (P1, M).** Every priced surface carries a provenance chip: provider, cache age, delay class (real-time / 15-min / EOD), and stale state — the backend's existing `stale: true` flag finally rendered (unmissable amber, not silence). `GET /api/providers/status` reports per-adapter last success, error counts, throttle depth; a `/settings/data` panel shows key presence booleans (never the key).
*Acceptance:* A 7-day-old stale-if-error price is visually unmistakable wherever it appears; delay classes correct per provider/class; zero secrets in status payloads.

**A9 · Options Chains with Greeks & IV Rank (P1, L after split — the IV snapshot job ships early under G4).** New screener Options tab for optionable US underlyings: chains via Yahoo `v7/finance/options` through the provider layer (cached 5min, throttled), our own Black-Scholes Greeks (`scipy.stats.norm`, unit-tested: ATM call delta ≈ 0.5), expiry selector, ATM-highlighted, delta-shaded strike ladder in mono type. **IV rank** built honestly: the daily ATM-IV snapshot job into `iv_history` starts in Phase 3 under G4 — two phases before the UI — so history accumulates while the chains surface is built; IV rank appears only after ≥60 snapshots ("IV rank available in 38 days" until then). All data labeled 15-min delayed; BSM caveat ("mid-price, no dividend adjustment") in a persistent footnote. Payoff analytics live in D10; multi-leg paper execution is out of scope (single-leg/covered booking is C10).
*Acceptance:* Non-optionable symbols get a typed "no options" state; 200+ strike chains scroll/filter (±N around ATM default) without jank; Greeks recomputed by us, not trusted blindly; snapshot job idempotent per day.

**A10 · Batched Quotes Endpoint (P1, S).** `GET /api/quotes?symbols=A,B,C` looping cached `get_quote` (spark-batched upstream), serving watchlists, universes, and the streaming poller within the throttle budget.
*Acceptance:* A 25-symbol request produces exactly one spark-batched upstream call; per-symbol failures return typed per-symbol errors and never fail the batch; N widgets on one symbol produce one in-flight request (client dedup, F5).

### Epic B — Trading-Style & Customization Engine

**B1 · Style Profiles (P0, L).** A `StyleProfile` is a named, versioned JSON document: `{id, name, base_preset, timeframe, factor_weights, signal_thresholds, risk_per_trade_pct, sizing_rule, kelly_cap, stop_logic, targets[], max_position_pct, default_workspace_id}`. Seven shipped presets (§4) plus unlimited clones; exactly one active, switched from the shell; switching re-parameterizes screener signals, chart interval, suggested size, and workspace globally. The Scalper preset ships scoped to crypto (real-time data — §4 caveats); activating it on delayed-data classes surfaces the "scalping unsupported" state, never silent delayed fills.
*User story:* As a swing trader who occasionally day-trades earnings, I want to flip between two named profiles so every signal, size, and stop is computed for the style I'm actually trading — without re-entering settings.
*Acceptance:* Profile switch changes factor weights, interval, and suggested size within one refetch, with a visible "Profile: Swing" badge on the plan panel; setting momentum weight to 0 removes its vote from the factor bars (round-trip verifiable); deleting the active profile falls back to Swing, never a broken state; presets ship with distinct documented parameters.
*Build:* `src/context/StyleProfileContext.tsx`, presets in `src/lib/stylePresets.ts`; backend parameterization shared with B2 — build the params schema once. Persisted via B7.

**B2 · Configurable Trade-Plan Template (P0, M).** Lift every hardcoded constant in `quant_models.py` into profile params: which factors vote (any of the 5 toggleable; weights auto-renormalize), Kelly multiplier (0–1.0×) and cap, entry style (passive VWAP pullback / at-market / breakout), stop logic (ATR multiple / swing buffer / fixed %), and an editable R-multiple target ladder replacing hardcoded 1.5R/3R. `risk_reward` computed from the actual ladder, never the hardcoded 1.5.
*Acceptance:* Disabling a factor removes its bar and renormalizes weights (sum shown = 100%); adding a 3rd target renders a 3rd price line and tile; Kelly=0 switches sizing to fixed-fractional `risk_per_trade_pct / (entry − stop)` with the formula on hover; no client-side recomputation drift (server payload is truth).
*Build:* `quant_models.get_quant_signals(symbol, params)`; `TradePlanEditor.tsx`; keep the "unconditional Kelly inputs" caveat surfaced until D9 lands.

**B3 · Per-Asset-Class Quant Profiles (P1, M).** An `AssetClassProfile` from the registry conditions the engine: annualization (252 equities/FX vs 365 crypto — current crypto `realized_vol` is wrong by ≈1.2×), ATR stop multipliers (crypto 2.5× default), rolling-window VWAP for 24/7 assets, **volume_flow disabled for FX** (Yahoo FX volume is synthetic — it currently emits garbage votes on `EURUSD=X`; remaining weights renormalize), per-class Kelly caps, and a crypto funding-rate contrarian factor when Binance is routed. The plan panel names the applied profile ("CRYPTO PROFILE · 365d vol · funding −0.012%").
*Acceptance:* `BTC-USD` vol uses √365, `AAPL` √252 (unit-tested); FX hides the volume factor rather than rendering 0-as-neutral; equity outputs bit-identical under the default profile (regression fixture).

**B4 · No-Code Scan Builder (P1, XL).** A "Scan" mode on the Terminal: compose `indicator · comparator · value|indicator` rows in AND/OR groups (e.g., `RSI(14) < 30 AND close > SMA(50) AND volume_imbalance > 0.6`), vocabulary = exactly what `quant_models` computes plus quote fields. Scans run server-side as a single batched background job over a chosen universe/watchlist with progress, returning matches **with the triggering values** (the number is the hero). Saveable, nameable, re-runnable; results deep-link to the Terminal. Optionally authored from natural language: Gemini translates prose to the same DSL, **shown as editable filter chips before running** — the stored artifact is always the DSL, never the prose; execution is deterministic (LLM at authoring time only).
*Acceptance:* A 3-condition scan over 20 symbols completes with per-condition actual values; re-running with unchanged data returns identical results; invalid rules blocked with inline errors, not 500s; unparseable NL returns "couldn't translate: reason" with supported fields listed; saved scans survive export/import.
*Build:* `backend/app/screener_engine.py` reusing `_rsi`/`_atr` over cached history; `POST /api/scan`, `/api/scan/translate`; `ScanBuilder.tsx`.

**B5 · Strategy DSL & Factor Registry (P1, XL).** The customization backbone, staged. **Stage 1:** the five built-in factors refactor into a `FactorRegistry` with declared params (RSI period, z-score window); a `Strategy` row holds a versioned JSON spec (factors, weights, thresholds, trade-plan params). `/api/quant-signals?strategy_id=` evaluates any saved strategy; the default becomes a seeded row. Every edit creates an immutable `StrategyVersion` so signal snapshots and backtests always reference the exact math that produced them. **Stage 2:** Python indicators (`def compute(bars, params) -> Series`) in a resource-limited subprocess (RLIMIT_CPU/RLIMIT_AS caps, kill-on-timeout) register into the same registry. This is **crash/resource isolation, honestly framed — not a security sandbox**: import allowlists are bypassable and "no network" is unenforceable from a plain subprocess; the docker-compose backend container (G8) is the actual isolation boundary, and the code being run is the user's own.
*Acceptance:* A custom strategy produces different, deterministic signals from the default on the same bars, both selectable on the Terminal; old snapshots re-render with their original math via `strategy_version_id`; an infinite-loop indicator is killed within budget with a clean error; invalid DSL rejected with field-level 422s; default strategy bit-identical pre/post refactor (golden files, G6).

**B6 · Custom Indicators (expression DSL) (P1, L).** User-defined formulas over OHLCV with built-in functions — `sma`, `ema`, `rsi`, `atr`, `stdev`, `highest/lowest(n)`, `crossover` — parsed by a whitelisted AST evaluator (`backend/app/indicator_engine.py`; no `eval`, unknown names rejected). Usable as chart overlays/sub-panes (replacing the client SMA hack and its head-padding bug, `Chart.tsx:109–117` — NaN warm-up omitted, not padded), scan vocabulary (B4), and weighted custom factors (B5).
*Acceptance:* One saved indicator produces consistent values on chart and in scans; `__import__` and friends rejected at parse; definitions round-trip through export as plain JSON.

**B7 · Settings Store, Export/Import (P0, M).** One server-side settings surface keyed to the authenticated user: `style_profiles[]`, `workspaces[]`, `scans[]`, `custom_indicators[]`, `watchlists[]`, `appearance`, `keymap`, `active_profile_id` — Postgres via G2, with a write-through localStorage mirror for offline/logged-out. **Export** = one schema-versioned `vanguard-config.json` (no secrets, no balances — config ≠ account state, stated in the dialog); **Import** validates with zod, previews a diff ("3 profiles, 2 workspaces, 1 conflict"), merges or replaces. (Filename tracks the product-name decision, §13.)
*Acceptance:* Any setting survives reload, restart, and login from a second browser (server wins); export → wipe → import restores everything byte-for-byte modulo ids; malformed imports rejected with field-level errors; a reserved `broker` namespace is rejected on import (live-trading stays walled off).

**B8 · Density, Motion & Semantic Accent Mapping (P1, L).** Within the committed identity: (a) density modes (Comfortable/Compact/Terminal) via `data-density` CSS-variable scales in `globals.css` — token-driven, no component forks; primary numbers never shrink below 16px equivalent; (b) global motion preference (`system/reduced/off`) — see F6; (c) semantic accent remapping: choose which committed neon means "primary action," and an up/down color convention swap (green/red vs blue/amber for color-blind users) through single-source tokens (`--color-up`, `--color-down`) consumed by chart, P&L, factor bars, and heatmap. **No new palettes** (anti-goal).
*Acceptance:* Density affects all product surfaces without breakage at 1366×768; swapping up/down re-colors candles, P&L, factor bars, and heatmap consistently from one token source.

**B9 · Profile-Aware AI Framing (P2, S).** `ai_assistant._build_context` receives the active profile so answers respect the trader's own rules ("your swing profile risks 1%; this position implies 2.3%"). Assistant-proposed parameter changes render as an explicit "Apply to profile?" diff card — never silent mutation.
*Acceptance:* "Should I take this trade?" cites the profile's risk-per-trade and timeframe (verifiable in context logs); declining a proposed change changes nothing; no profile = today's behavior.

### Epic C — Portfolio Core

**C1 · Transaction Ledger (event-sourced) (P0, L).** Replace the localStorage snapshot model with an append-only ledger of typed events — `BUY, SELL, SHORT_OPEN, SHORT_COVER, DIVIDEND, SPLIT, SYMBOL_CHANGE, ADJUSTMENT, FEE, DEPOSIT, WITHDRAWAL, INTEREST, FX_CONVERT` — persisted in Postgres keyed to the NextAuth user. Positions, cash, and cost basis are derived state (memoized fold). The Terminal writes ledger events (UUID ids, replacing `Math.random().toString(36)`); events carry configurable paper fees (flat/bps). One-time importer migrates existing localStorage portfolios as synthetic events. **Manual entry:** a form books any event type at a historical date (historical price prefetched from cached closes) — recording "I bought 10 VOO in 2023" or a missed dividend is table stakes for a real track record.
*User story:* As a systematic swing trader, I want every buy, sell, dividend, and fee recorded as an immutable event, so my P&L is auditable and survives a cleared cache or a second device.
*Acceptance:* A Terminal trade creates a server-side row; positions/cash recomputed from the ledger alone are byte-identical to the displayed state; clearing localStorage + re-login restores everything; two browsers see the same ledger; deletion only via reversing entries (append-only enforced at the API); migration preserves trade count and cash exactly; a backdated BUY correctly re-derives lots and realized-P&L ordering and triggers valuation-snapshot backfill from the new earliest date.
*Build:* Prisma schema (G2); `PortfolioContext.tsx` becomes a thin client over `src/app/actions/ledger.ts` with optimistic updates. Flask stays stateless for analytics.

**C2 · Multiple Named Portfolios & Net Worth (P0, M).** Named portfolios ("Swing — US Equities", "Crypto Scalps") with own starting cash, base currency, and style tag; switcher in the shell; Terminal ticket gets a "book into" selector. Consolidated net worth sums portfolios with FX conversion (A5). All-time return computes against each portfolio's actual `DEPOSIT` events — the hardcoded 100000 dies here.
*Acceptance:* Events carry `portfolioId`; trades in book A never appear in book B; consolidated header reprices on display-currency toggle; active selection persists server-side across devices; analytics endpoints called per-portfolio with unchanged payloads.

**C3 · Tax Lots & Realized P&L (P0, L).** Every BUY opens a lot; every SELL consumes lots per configured method (FIFO default, LIFO, highest-cost, specific-lot via a sell dialog listing open lots with per-lot unrealized P&L). Each consumption writes a `RealizedPnL` record (proceeds − basis − fees, holding period, long/short-term flag at 365 days). `/portfolio` gains realized P&L: MTD/YTD/all-time, win rate, avg win/loss, largest win/loss. A **realized-P&L/lots CSV export** implements the §5 tax boundary.
*Acceptance:* FIFO/LIFO/specific-lot unit-tested on the canonical two-lot fixture; invariant holds: Σ realized + Σ unrealized + cash − Σ deposits = total return; method changes affect only future sells; long/short-term flags correct across split-adjusted open dates; the CSV export matches `RealizedPnL` rows exactly, including method, holding period, and LT/ST flag.
*Build:* Lot engine as pure TypeScript in `src/lib/lots.ts` — the first genuinely unit-testable module (vitest lands here), and **the only lot/realized-P&L implementation in the codebase**: per the §9 writer matrix, D4's Python fill checker computes fill price/qty only and round-trips every fill through the Next.js ledger action that owns lots; an import-graph test forbids a second lot implementation in either language. (D1's backtest engine tracks simple per-trade positions, not tax lots — no overlap.)

**C4 · TWR, MWR & Benchmarks (P0, L).** Replace the misleading current-weights equity curve with truth from the ledger: per-portfolio daily valuation snapshots (`{date, marketValue, netCashFlow}`, backfilled from earliest event using cached closes), chain-linked TWR (Modified Dietz within flow days) and XIRR-based MWR, overlaid against 1–3 user-chosen benchmark symbols (default `^GSPC`; any Yahoo symbol). A visible TWR/MWR toggle with a one-line explainer — the tool never shows one ambiguous "return."
*Acceptance:* A mid-period deposit leaves TWR unchanged and moves MWR (golden-file fixture); numbers match spreadsheet XIRR to 4dp; period pickers (1M/3M/6M/YTD/1Y/All) recompute both; the risk strip now feeds `risk_analytics` the *actual* snapshot return series (optional `returns` field on the POST body; falls back to current behavior).
*Build:* `src/lib/performance.ts` (pure, tested) for the display math; snapshot *writes* belong to the backend (§9 writer matrix) via a backfill endpoint invoked on portfolio load — no scheduler dependency.

**C5 · Corporate Actions: Dividends, Splits, Symbol Changes & Income (P1, M).** Request `events=div,splits` on the Yahoo chart call (supported today, never requested); a reconciliation pass proposes `DIVIDEND`/`SPLIT` events for holdings held across ex-dates — user confirms with one click, nothing enters the ledger unconfirmed. Beyond dividends/splits: `SYMBOL_CHANGE` events (via A1 `aliases[]`) migrate a position to its new ticker preserving lots and history; a generic manual `ADJUSTMENT` event covers mergers/spinoffs honestly (user-entered, journal-linkable); delisted symbols get a typed "delisted — last price as of" state, never stale-if-error forever. Income panel: trailing-12m dividends, forward projected income (with "based on trailing payments" caveat), yield-on-cost, monthly calendar strip.
*Acceptance:* A 4:1 split adjusts shares ×4 and lot basis ÷4 leaving total basis and unrealized P&L unchanged (invariant test); a renamed ticker preserves lot basis and TWR continuity (fixture test); proposals are dismissible and re-proposable; crypto/FX show a clean empty state, not zeros pretending to be data.

**C6 · Cash & Margin Modeling (P1, M).** Per-currency cash balances derived from the ledger. Optional per-portfolio paper margin (Reg-T-like 50/25 defaults, configurable APR): buying power replaces raw cash in affordability checks; daily `INTEREST` accrues on debit balances via the snapshot pass (computed by the G4 job, booked through the internal ledger route — §9 writer matrix); a margin-health meter (safe/warning/call) banners the portfolio. A "call" state turns E3's pre-trade check **red** for new opening trades — the same re-type-to-override doctrine, with the override permanently recorded — flagged for review, never auto-liquidated, never a separate hard block.
*Acceptance:* Margin off (default) = today's behavior exactly; buying-power boundary-tested; Kelly-suggested sizing labels when leverage contributes; a margin-call override lands in `overridden_rules[]` and journal insights like any other red check.

**C7 · Rebalancing: Targets, Drift, Trade List (P1, M).** Per-portfolio target allocations by symbol/sector/class with drift bands (±5% default). Panel shows current-vs-target bars, drift badges on breach (live prices), and a generated trade list respecting cash and a minimum-trade threshold ("3 trades under $50 skipped"). One click adopts the existing Markowitz max-Sharpe weights as editable targets. Each suggested trade deep-links to `/screener?q=SYM&qty=` — manual confirmation per trade, no batch execution.
*Acceptance:* Targets sum to ≤100% (validation); executing all suggestions brings every allocation within band without overdrawing buying power (property test).

**C8 · Statement Import (CSV) (P1, L).** `/portfolio/import` wizard: column mapping with saved presets (IBKR Flex, Schwab, Fidelity, Robinhood, Coinbase, generic), per-row validation preview, symbol normalization via `/api/search`, idempotent dedup (hash of `{date, symbol, type, qty, price}`), booked as an atomically-revertible tagged batch. Real history enters the paper system read-only — no broker credentials. (Single backdated entries use C1's manual form; this is the bulk path.)
*Acceptance:* IBKR and Schwab fixtures import end-to-end with correct event counts, cash, and positions; re-import yields "n duplicates skipped, 0 new"; batch revert restores pre-import state exactly; unknown symbols prompt interactive mapping remembered per preset.

**C9 · Trade Journal & Review Workflow (P1, M).** Every trade can carry rationale, tags (setup/mistake/emotion), an image attachment (stored per §9's attachment decision: local volume, 5 MB cap, included in G8 backups), and — captured automatically — a frozen snapshot of the quant plan on screen at execution (composite, factor votes, levels). `/journal` lists entries filterable by tag/symbol/portfolio/outcome with per-tag expectancy (win rate, avg R from C3 realizations; n<10 badged "not yet significant"). A weekly review queue surfaces closed-unreviewed trades with three fixed questions (followed plan? exit quality? lesson) — review completion tracked. Rule-override flags from E3 appear here.
*Acceptance:* Snapshot captured even when the note is skipped; closed round-trips link journal ↔ realized P&L via FIFO lots; deleting a note never deletes the trade; the copilot's `get_journal(filters)` tool answers "show my last 5 losers and what I wrote."

**C10 · Contract-Aware Paper Positions incl. Single-Leg Options (P1, XL).** Extend paper trading beyond shares×price using A1's specs: futures book real notional (`GC=F` × 100) with tick value and a static per-contract margin table (~20 liquid contracts); FX in units/lots with pip value; crypto quantities to 8dp (the integer input can't buy 0.05 BTC today). **Single-leg options booking:** option contracts resolve through A1 as instruments (multiplier 100); the ticket books long/short single legs, covered calls, and cash-secured puts as paper positions, with covered/secured detection against existing share and cash positions — the Options Income persona's "covered-position awareness" lives here. Multi-leg spreads remain analytics-only (D10). The ticket adapts per class; Kelly fraction converts to contracts/lots/coins correctly; positions/trades migrate untouched (`multiplier: 1`).
*Acceptance:* 1 `GC=F` at 2400 books ≈ $240,000 notional and a $1 move changes P&L by $100; selling a call against 100 held shares books as covered (margin-exempt) while a naked short call requires C6 margin and is labeled; over-leverage rejected with a clear message; equities remain integer-share unless fractional is toggled.

**C11 · Read-Only Broker/CSV Mirroring (P2, vNext, XL).** Real holdings imported (CSV first; read-only aggregator or exchange keys later) into portfolios tagged `mirrored: true` — visibly badged, **no BUY/SELL affordances rendered at all**, server rejects ledger writes for mirror ids (403). Full analytics (TWR, lots, income, journal) run on mirrors. Keys encrypted at rest, never in JSON exports or API responses; disconnect purges credentials.
*Acceptance:* CI grep gate proves no order-capable broker SDK import exists anywhere in the repo; scope list displayed and stored with the connection.

**C12 · Short Selling (equities & crypto) (P1, L).** The personas trade both directions and the plan panel already produces SHORT badges (F6) — 2.0 makes them real. `SHORT_OPEN`/`SHORT_COVER` ledger events open negative-quantity lots consumed on cover by the same lot methods (C3); realized P&L = open proceeds − cover cost − fees. Shorts require margin enabled (C6) and consume buying power at the configured requirement; borrow cost is **not modeled**, and every short position carries an honest "no borrow fee modeled" label. E3 rules (max weight, "no adding to losers") apply symmetrically to short positions. FX and futures shorts are already covered by C10's contract model — this ID covers equities and crypto.
*Acceptance:* Short round-trip golden fixture (open 100 @ 50, cover @ 45 → +$500 − fees, sign-correct through the C3 invariant); shorts rejected with a clear message when margin is off; unrealized P&L sign-correct on portfolio rows and in VaR inputs; the plan panel's SHORT badge routes to a working short ticket.

### Epic D — Quant Analytics & Backtesting

**D1 · Event-Driven Backtest Engine ("The Lab") (P0, XL).** `backend/app/backtest/{engine,fills,costs,metrics}.py`: an event loop over daily OHLCV (history extended to 5y); orders fill on the *next* bar under explicit rules — limits fill only if the bar trades through the price, stops fill at stop-or-worse with gap penalty, intrabar stop-vs-target ambiguity resolves conservatively (stop first). Costs: `k × ATR` slippage (default 0.05×) + commission + spread; never silently ignored. First strategy: the composite signal, refactored so factor math computes on any historical window (forcing the lookahead audit) — live and backtested logic share one code path. Runs execute as background jobs with progress polling; results persist (`backtest_runs`, `backtest_trades`, `backtest_equity` tables). The engine tracks simple per-trade positions — tax-lot accounting stays solely in C3's TS engine.
*User story:* As a swing trader, I want to run the composite signal over 5 years of AAPL with realistic fills and costs, so I know whether the plans I've been paper-trading had positive expectancy before I keep following them.
*Acceptance:* Deterministic re-runs (seeded, byte-identical); synthetic-fixture tests prove limits don't fill when `low > limit` and stops fill at `min(stop, next_open)` on gaps; an automated lookahead test asserts every decision at bar *t* used only data ≤ *t*; run metadata (params, costs, range, engine version) stored and displayed.

**D2 · Strategy Performance Report (P0, L).** `/lab` page (added to nav): hero strip — net return, max drawdown, expectancy in R, profit factor, trade count — then equity curve with drawdown underlay, R-multiple histogram, MAE/MFE scatter (computed bar-by-bar in the engine), win rate with Wilson CI, rolling 12-month Sharpe. **Every estimated stat carries its uncertainty inline** ("Expectancy +0.31R · 95% CI [+0.05, +0.57] · n=64"); <30 trades triggers an "insufficient sample" banner instead of confident numbers. Any two runs diff side-by-side.
*Acceptance:* Zero mock data; MAE/MFE match hand computation on a 3-trade fixture; CI math computed server-side (`metrics.py`) — the frontend never invents statistics; page honors reduced motion (no count-ups).

**D3 · Walk-Forward Validation & Overfitting Guards (P0, L).** Parameterized backtests run walk-forward: optimize on rolling in-sample windows (grid capped at ≤200 combinations, cap explained in UI), stitch only out-of-sample segments into the reported curve. Three guards: **deflated Sharpe** (Bailey–López de Prado, from actual trial count — raw Sharpe never shown without it on optimized runs), **parameter-sensitivity heatmap** (sharp isolated peak = fragile, plateau = robust), and **IS-vs-OOS degradation %**. Runs that skip walk-forward are permanently badged **"IN-SAMPLE — NOT EVIDENCE"** in amber everywhere they appear.
*Acceptance:* A test that poisons OOS data asserts parameter choice is unchanged; deflated Sharpe reflects `n_trials` stored per run; badge appears in report, run list, and comparisons.

**D4 · Honest Fill Engine for Paper Trading (P0, L).** Port the backtest fill model to live paper: place the *plan* (limit entry + OCO stop/targets) from the Terminal, not just market-at-last-quote. Orders persist server-side in the `Order` table (§9 — designed into the Phase 1 schema so the ledger's most sensitive tables never migrate late); a 60s checker fills them against cached quotes with the same slippage/fee model as backtests (shared `fills.py` — import-graph test forbids duplicated fill logic). Each fill POSTs to the internal service-token-authed Next.js ledger route (§9 writer matrix), which books the event, consumes lots via the single TS lot engine (C3), and writes realized P&L with per-trade R-multiples. UI is explicit: "fills simulated on 60s quotes."
*User story:* As a day trader, I want paper orders to fill the way my backtest assumed — limits that can miss, stops that can gap — so my paper record is evidence about the strategy, not instant-fill fantasy.
*Acceptance:* A pending limit does not fill while price > limit (long); a filled bracket auto-arms stop/targets; a stop hit writes a realized ledger entry with R; market orders display modeled cost before confirm; the fill checker never writes ledger tables directly (asserted by the writer-matrix test).

**D5 · Scenario & Stress Testing (P1, M).** `POST /api/portfolio-stress`: (1) historical replays — GFC 2008, COVID 2020, 2022 rate shock, Aug-2024 vol spike — **shipped as static, versioned fixture files checked into the repo** (they predate the 5y bars store and never change; this also makes the warm SLO and G8 offline mode trivial), applied to current weights per holding (beta-proxied via ^GSPC where the asset didn't exist, visibly flagged), returning P&L path and trough-$ (hero number, loss-red); (2) parametric shock grid (market ±5/10/20%, rates ±100bp via duration proxy, USD ±5%, crypto ±30%). Every row carries its caveat inline ("assumes today's weights held throughout").
*Acceptance:* 100% SPY reproduces the index's actual scenario drawdown within 1%; warm response <3s (crisis windows are checked-in fixtures — no fetch); empty portfolio gets a designed empty state, not an error-at-200.

**D6 · Monte Carlo Cones (P1, M).** Block-bootstrap (5-day blocks) of the portfolio's historical returns → percentile cones (5/25/50/75/95) over 30/90/252-day horizons, probability of hitting a user-set drawdown threshold, terminal-value distribution. Existing VaR/CVaR tiles gain bootstrap CIs ("VaR₉₅ $2,340 [1,900–2,900]"); <60 observations shows a "low confidence" state instead of bare numbers. Labeled "resampled history, not a prediction."
*Acceptance:* Seeded/reproducible; breach probability monotonically increases in horizon (property test); 2000×252 paths compute <2s (vectorized).

**D7 · Factor Exposures, Correlation Regimes, Liquidity & Market Regime (P1, L).** One "Exposures" panel plus a regime service. (a) OLS factor betas vs liquid ETF proxies (SPY, IWM−SPY, IWD−IWF, MTUM−SPY, IEF, UUP, BTC-USD where held) **with standard errors** — |β| < 2 SE renders "not significant"; 100% SPY yields market β 1.0 ± 0.05. (b) 60d-vs-1y correlation comparison; a threshold rise flags "correlation regime shift — diversification degrading" with paired heatmaps. (c) Days-to-liquidate per position (size ÷ 10% ADV; >1d amber, >5d red) from the volume field quotes already carry. (d) `backend/app/regime.py`: two interpretable axes (trend t-stat × vol percentile) classify each symbol and ^GSPC into trending/ranging × calm/volatile — shown as a Terminal badge with the axis numbers visible, conditioning factor weights per regime (raw and adjusted weights both in the payload), and feeding a per-regime breakdown table in backtest reports (<10-trade cells greyed).
*Acceptance:* Synthetic trend/OU fixtures classify correctly; regime is pure computation on cached history (no new outbound calls); per-factor fetch failures degrade gracefully with a note.

**D8 · Honest ML Pipeline (ml v2) (P0, L).** Kill the in-sample decoration. `backend/app/ml/`: stationary feature store (returns, vol, RSI, z-score, volume imbalance — no raw price levels; parquet-cached, versioned); walk-forward retraining (expanding window, retrain every 21 bars, predict strictly next-bar) producing a genuine OOS prediction series; isotonic calibration with reliability curve + Brier score; models persisted (no per-request refits). The panel replaces the bare "62.5%" with "P(up) 56% · calibrated · OOS hit rate 53.1% ± 2.4% (n=310)" — and when the CI includes 50%, an explicit amber **"no demonstrated edge"** state, which also flows into the AI context. Prophet shows its interval band or is cut — no naked point forecasts anywhere.
*Acceptance:* Lookahead test: every OOS prediction at date *t* came from a model trained on data ending before *t*; warm requests <1s; cold builds run as background jobs with a "building evaluation…" state; payload includes `oos_hit_rate, oos_n, hit_rate_ci, brier_score, calibrated`.

**D9 · Evidence-Based Kelly Sizing (P1, M).** `recommended_fraction` derives from the linked backtest's OOS trade distribution (win rate, payoff, joint uncertainty) with Bayesian shrinkage toward zero edge at small n — Kelly shrinks automatically as evidence weakens. Provenance on the tile: "½-Kelly 4.2% · from 64 OOS trades · shrunk from 7.1% for small sample," with a one-click "Run backtest to size this" link to `/lab`. Without evidence: a clearly-labeled fixed-fractional fallback (1% risk on the plan's stop distance), never called "Kelly." Hard cap ≤25%, stated.
*Acceptance:* Shrinkage monotonic in n (property test at n=10/30/100 with identical raw stats); payload names `{run_id, n_trades, raw_kelly, shrunk_kelly, mode}`; "Use quant-suggested size" consumes the new field unchanged.

**D10 · Options Payoff & Income Analytics (P2, L).** On top of A9's chains: a payoff-diagram builder for the standard set (long call/put, covered call, cash-secured put, verticals, iron condor, straddle/strangle) — select legs → P&L-at-expiry curve with breakevens, max profit/loss, net theta as hero numbers. Analytical only; multi-leg paper execution deferred (single-leg/covered booking is C10).
*Acceptance:* A 2-leg vertical's breakeven and max P/L match hand computation on a fixture chain; deep-ITM call delta ≈ 1.0, ATM ≈ 0.5 (sanity bounds).

### Epic E — AI Copilot & Automation

**E1 · Copilot Tool-Use Engine (P0, L).** Rebuild `ai_assistant.py` from context-stuffing to Gemini function calling over a registered, **read-only** tool belt: `get_quote`, `get_quant_signals`, `get_portfolio_analytics`, `get_ticker_news`, `get_market_overview`, `run_screen`, `get_journal`, `compare_symbols` — capped at 5 calls/turn. Every reply footer lists tools called ("Grounded in: quant-signals AAPL, portfolio-analytics"); the system prompt refuses price/sizing answers without a successful tool call.
*User story:* As a swing trader mid-conversation, I want "how does NVDA compare to my AMD position?" to actually pull both signal sets and my cost basis, so answers reflect live data, not whatever was stuffed into the first message.
*Acceptance:* Off-page symbols trigger visible tool calls; repeated portfolio questions after a position change return updated numbers; all-tools-failed → "cannot ground the answer," never an estimated price; a test enumerates the registry and asserts no tool mutates state.
*Build:* Response gains `{reply, tool_calls[]}`; `AIAssistant.tsx` renders grounding chips; short-TTL caching of derived signals keeps 5-tool turns cheap under the throttle.

**E2 · "Explain This Number" (P0, M).** Every metric tile gets a quiet `?` affordance opening the copilot pre-seeded with a structured packet: metric id, value, exact inputs, and — for risk metrics — a delta decomposition (`GET /api/explain?metric=var_95`: component VaR per position from the covariance already computed, plus what changed since the last snapshot). Wired first to the risk strip, factor bars, Kelly stats, and the fear/greed gauge.
*Acceptance:* Clicking VaR names the top-2 contributing positions with component-VaR $ matching independent recomputation within rounding; with Gemini unset, the raw decomposition table still renders ("AI narration unavailable"); no prior snapshot → "first measurement — no comparison basis," never an invented trend.
*Build:* `backend/app/explainers.py`; shared `<ExplainableStat>` wrapper; imperative open-with-context API on the assistant. The daily risk-metric snapshot E2's deltas read is written by a small scheduled G4 job (landing two phases earlier) — not by E6, which merely consumes the same snapshot.

**E3 · Pre-Trade Discipline Check (P0, L).** User-authored trading rules — structured (max position weight, max open positions, min R:R, max daily loss, "no adding to losers," asset-class limits) plus free-text — evaluated on every order: a deterministic client-side engine (`src/lib/rulesEngine.ts`, <300ms, no LLM in the hot path) grades structured rules green/amber/red with one factual line each ("This order is 31% of equity; your rule caps positions at 20%"); AI critique of free-text rules streams in after, non-blocking. **Red never blocks** (personal tool) — but proceeding requires re-typing the quantity, and the override is permanently recorded on the trade and surfaced in journal insights. This doctrine is universal: C6's margin-call state is one of these red checks, not a separate hard block.
*Acceptance:* A weight-violating order shows the computed weight before execution; overrides store `overridden_rules[]`; zero rules configured = three built-in sanity checks + a prompt to define rules; rules persist server-side.

**E4 · Journal Pattern Insights (P1, M).** A weekly job runs deterministic queries over the journal (win rate by tag/day-of-week/hold-time, R captured vs planned, override rate vs outcome) and hands the **statistics** — never hunches — to Gemini to narrate the top 3 findings ("In 14 trades tagged 'momentum', you exited winners at 0.7R against a 1.5R plan; Friday exits account for 9"). Each finding cites n; n<10 badged low-sample.
*Acceptance:* Every narrative cites its underlying statistic; findings appear on `/journal` and in the EOD review; insights render (numbers-only) even when Gemini is down.

**E5 · Deterministic Alerting Engine (P0 engine + price/indicator; P1 risk/news/strategy + email, XL).** The first push-shaped system. Trigger types: price (cross, % move), indicator (RSI/z-score/composite/%B), risk (VaR $ above X, drawdown, position weight — from server-held portfolios), news (mood-index bound), strategy (symbol enters/exits a saved scan). Every alert is a small schema-validated JSON/YAML document ("alert-as-code") — form-generated, directly editable in a mono editor; the copilot may draft one from NL but the user reviews the code before arming. Evaluation: scheduler ticks (60s quotes from cache, 15min indicators/news, EOD risk). Delivery: in-app inbox + toast (P0); web push/email (P1). Latency labeled honestly ("checked every 60s, delayed data") — never implied tick-level.
*Acceptance:* A price cross fires within one cycle (≤90s) and never twice without re-arm/cooldown; form ↔ code round-trips losslessly; invalid documents cannot be armed (line-level errors); firings persist trigger value vs threshold and link to the relevant view; backend restart preserves armed alerts without replaying old firings.

**E6 · Pre-Market Brief & EOD Review (P1, M).** Two built-in automations rendered as dated, archived documents in a `/briefs` inbox (optional email). **Brief (weekdays, user time):** overnight moves on positions/watchlists, signal-threshold crossings since yesterday's snapshot ("NVDA composite 0.31→0.52, crossed BUY"), alerts near trigger, top holdings-relevant headlines, and today's rule checklist. **EOD review:** day P&L, fills vs journaled plans (entry slippage, R captured), risk-metric deltas (read from the daily G4 risk snapshot — the same one E2's deltas consume), overrides taken, one journal prompt. Template-first: every number computed in Python; Gemini writes only a 3-sentence cited summary and is omitted with a note if down. A generic NL-automation platform is explicitly deferred (anti-goal).
*Acceptance:* Generation at configured time ±5min with permanent history; signal section lists only threshold-band crossings; disabling stops generation without deleting history; weekends/holidays skipped.

**E7 · Holdings-Aware News Digest (P1, M).** "My Feed" on `/news`: per-ticker RSS for held + watchlisted symbols, deduplicated, ranked by position-weight × |sentiment| × recency, near-duplicates clustered (title similarity, no LLM). Daily digest: ≤5 copilot bullets, each linking source articles and naming the affected holding; <2-source clusters labeled "single source." Per-ticker mood deltas ("AAPL mood 61→44 over 3d") become sparklines and alertable via E5. Fixes the uncached `get_ticker_news` (per-call RSS fetch today).
*Acceptance:* Feed reflects position changes on next refresh; no bullet without underlying linked articles; title-only sentiment labeled as such.

**E8 · Streaming, Persistent, Page-Aware Copilot UX (P1, M).** SSE streaming for `/api/ai-chat` (first token <2s warm; tool chips appear as tools execute); chat sessions persist and restore across reloads (listable, deletable; anonymous sessions stay local with a "not synced" badge); a declarative per-page context registry (portfolio registers its analytics payload, journal its filtered entries) replaces `?q=` sniffing so "what am I looking at?" works everywhere.
*Acceptance:* Reload mid-conversation restores history; streamed markdown goes through the existing escaped renderer (no new XSS surface).

### Epic F — Workspace & UX

**F1 · Workspace Shell & IA v2 (P0, L).** Replace flat nav with a slim grouped icon rail — **Trade** (Terminal, Dashboard, Watchlists), **Manage** (Portfolio, Journal, Lab, Risk), **Discover** (Markets, News, Geotrade, Community) — plus a persistent top strip: global search, live account equity (consistent with portfolio math), connection pill, session clock. A `default_landing` preference routes `/` post-login per style (Terminal / Dashboard / Portfolio); the landing page remains brand-register marketing for logged-out visitors. Fix the five hardcoded `127.0.0.1:5000` URLs as part of this work — the connection pill needs one canonical base.
*Acceptance:* No orphaned routes; rail collapses to icons below 1280px; `g` then `t/p/d/m/n` jumps surfaces; top-strip equity matches `/portfolio` header exactly.

**F2 · Command Palette & Keyboard Ergonomics (P0, M).** Global ⌘K with merged groups — Symbols (debounced `/api/search`, hook extracted from `SearchInput.tsx`), Navigation, Actions ("Buy 10 shares (paper)", "Switch to Desk view", "New journal entry", "Ask AI about NVDA"). Trade actions always open the confirm flow — never silent execution. Terminal single-keys: `/` search, `b/s` ticket, `1–5` timeframes, `?` shortcut sheet; all suppressed inside inputs; combobox ARIA pattern.
*Acceptance:* Symbol results show price + signed day% and route on Enter; results <150ms cached; focus trapped and returned; fully screen-reader operable.

**F3 · Chart Engine v2 (P0, XL).** Rebuild `Chart.tsx` on lightweight-charts v5 multi-pane: candles + quant price lines, volume histogram, toggleable RSI/MACD panes (client `src/lib/indicators.ts`; warm-up returns `undefined`, fixing the SMA head-padding bug). Timeframe/interval switcher (fed by A4; unsupported combos disabled, never silently substituted). Drawing tools (horizontal, trendline, rectangle zone) serialized per symbol and rehydrated across sessions and timeframes. Compare mode: up to 3 normalized %-change overlays in distinct committed accents. Create-once/update-data lifecycle — indicator toggles cause zero chart re-instantiation.
*User story:* As a swing trader, I want to draw my support zone on the daily and find it still there next week on any timeframe, so my levels — not vibes — drive entries.
*Acceptance:* Volume from real payload; drawings survive reload and symbol round-trips; re-render test proves instance identity across a toast.

**F4 · Widget SDK & Real Dashboard (P0, XL).** De-Potemkinize `/dashboard`: keep react-grid-layout, replace every mock. Widget contract `{id, type, symbol?, settings}` + registry of live widgets extracted from existing surfaces (Chart, Quant Plan panel, Positions, Ticker News, Watchlist, Risk strip, Notes — 7 types at launch; the Scan-results widget registers when B4 lands, a cheap registry addition and the SDK's whole point). **Linked symbol groups** (A/B/C color-dot + letter in each header): changing the symbol in any group member updates the group. Add/remove via a gallery drawer; layouts + configs persist as multiple **named workspaces** ("Scalp AM", "Weekly Review"), optionally bound to a Style Profile so profile switch swaps workspace. "Save Module" and the cosmetic symbol input die.
*Acceptance:* Grep confirms the random-walk candle generator (`dashboard/page.tsx:44–64`) is gone; ≥6 widget types; ≥3 workspaces creatable/renamable/deletable/switchable; symbol propagation within one render cycle; every widget has loading/error/stale states — never blank glass.

**F5 · Real-Time Spine & Data Honesty (P0, L).** A shared `useQuote(symbol)` store replaces fetch-once: smart polling (5s on-screen, 30s background; later, once G5 lands: SSE `/api/stream/quotes` serving cache-fresh quotes, ~10s TTL for subscribed symbols — SSE serves cache, never multiplies upstream calls). Freshness states everywhere (live <10s / delayed / stale / error); the backend's `stale: true` finally surfaced (amber icon + "as of HH:MM"); a global connection pill (green streaming / amber delayed / red backend-offline with retry). Tick pulse ≤300ms, suppressed under reduced motion. Risk strip re-triggers on a debounced 5-minute cadence. Error-body sniffing (`{error}` at 200) centralized in the store until G1 fixes the contract.
*Acceptance:* Zero one-shot `/api/quote` fetches remain in page components; killing Flask turns the pill red within 15s and panels show cached values with "as of" labels — not spinners, not crashes; N widgets on one symbol = 1 in-flight request.

**F6 · Reduced Motion & Non-Color Risk Signaling (P0, M).** *The committed hard requirement, currently violated everywhere.* `useReducedMotion()` (matchMedia + settings override) + a global `@media (prefers-reduced-motion: reduce)` block: landing R3F field renders a static frame, GSAP choreography becomes instant reveals, meteors/SplitText/CountUp disabled (final values immediate), marquee paused, globe auto-rotate off, chart/tick animations off. Second half: every green/red value gains a redundant channel — +/− signs and ▲/▼ glyphs, LONG/SHORT text on badges, intensity labels on heatmap cells; JetBrains Mono tabular numbers wherever P&L renders. Shared `<SignedValue>` component prevents regressions.
*Acceptance:* With OS reduced-motion on, the landing page has zero autonomous animation (verified per section) and the globe holds still; the manual toggle produces identical behavior; a grayscale screenshot makes the direction of every value determinable; axe/Lighthouse pass on Terminal and Portfolio with no color-only violations.

**F7 · Terminal Views: Focus & Desk (P1, M).** On top of B8 density tokens: **Focus** (today's layout — discretionary swing/position) and **Desk** (compact: smaller chart, tape-style readout row, tighter factor bars, visible keyboard-hint chips — scalpers/day traders). Switchable from ⌘K, persisted. Prop/CSS-driven — zero forked component trees. Long-term-investor simplicity comes from workspaces and default landing, not a dumbed-down mode.
*Acceptance:* View switch changes density and layout with zero component remounts (instance-identity test — the chart never re-instantiates); the choice persists per profile across reload and devices; keyboard-hint chips render only in Desk; both views pass the B8 1366×768 breakage check.

**F8 · Onboarding, Empty States & Honesty Sweep (P1, M).** Consistent designed empty states (portfolio: "Your desk is clear" + three working CTAs; dashboard: gallery open by default). Skippable 4-step first run: choose style → seeds `default_landing` + a workspace template, explains paper $100k, shows ⌘K, points at the risk strip. Kill remaining honesty leaks: the landing page's fake static ticker tape either consumes cached `/api/trending` quotes or is visibly stylized as decoration; fix the "Email Label" typo.
*Acceptance:* No surface ever shows fabricated numbers styled as live data; first run never reappears after dismissal; style selection provably changes home route and seeded workspace.

**F9 · Watchlists (P1, M).** Multiple named watchlists (symbol + optional target-price note) in three places: collapsible shell rail (price, signed day%, freshness, inline SVG sparkline), a dashboard widget, and ⌘K actions ("add NVDA to Momentum"). j/k/Enter traversal, drag reorder, JSON export/import. Server-persisted (B7); batched quotes via A10.
*Acceptance:* A 25-symbol list stays within the shared poller budget; order and lists survive reload and second-device login.

**F10 · Trade Ticket v2 (P1, L core + L with D4).** Split across two phases so no order type ships before the engine that fills it. **Core (Phase 3):** class-aware market-order ticket (C10/C12 aware); "Load plan" fills qty = suggested size with the plan's levels displayed; an explicit risk readout before confirm ("Risk if stopped: $412 · 0.9% of account · R:R 1.5"); a required single-keystroke confirm — never one-click execution; SELL is position-aware with a "Close position" shortcut. **With D4 (Phase 5):** order-type selector (Market/Limit/Stop), resting orders in an Open Orders panel filled by D4's server-side engine, lifecycle toasts (placed → filled → canceled).
*Acceptance:* No zero-qty or insufficient-buying-power submission possible; `b` focuses the ticket; (D4 stage) order type recorded on every fill and the Open Orders panel reflects lifecycle transitions within one 60s cycle.

**F11 · Chart Replay Mode (P2, L).** Pick a past date; the chart truncates and space steps one bar (autoplay 1–5 bars/s, reduced-motion aware); trades go to a sandboxed replay ledger, never the real paper book; a persistent unmistakable banner while active; session summary (trades, win rate, cumulative R) at exit. Daily bars v1; intraday free once A4 lands.
*Acceptance:* Future bars provably hidden in every panel while active; exiting restores the live chart cleanly.

**F12 · PWA Companion: Monitor + Journal (P2, XL).** Responsive shell (rail → bottom tabs <768px) with portfolio monitor, watchlist, news, and quick journal capture. **No trade ticket on mobile** — impulse-blocking is a principle, and no execution path is reachable below 768px. Heavy surfaces (globe, grid, landing 3D) show a "desk-only surface" card. Manifest + app-shell-only service worker; offline shows last-known values labeled "offline, as of HH:MM" — stale-honesty rules apply offline. Gated on C1 (server portfolio) so phone and desktop see one book.
*Acceptance:* No route below 768px renders a trade ticket or reaches any execution path (asserted in E2E); offline shows last-known values with "as of" labels, never spinners or fabricated freshness; heavy surfaces show the desk-only card, never a broken canvas; Lighthouse reports an installable PWA.

### Epic G — Platform & Infrastructure

**G1 · FastAPI Migration & Error Contract (P0, L).** `backend/app.py` → `backend/app/main.py` + per-domain routers with Pydantic request/response models, dependency-injected services, uvicorn workers. Async where it pays: geotrade's 12 RSS fetches go concurrent (`httpx` + `gather`; cold path <8s vs ~20s+ today); CPU-bound work (XGBoost/Prophet/SLSQP) in a `ProcessPoolExecutor` or the scheduler — never blocking the event loop. **Errors return real status codes** with a typed `{error: {code, message}}` envelope — zero routes return `{error}` at 200. The confirmed `/api/analyze-idea` AttributeError (`app.py:168`) dies via startup smoke tests + a regression test.
*Acceptance:* All 16 endpoints byte-compatible **on success paths** (or documented-delta) under FastAPI; the error contract is an intentional, coordinated breaking change — absorbed by F5's store shim and the G3 generated client, with golden-file deltas documented (G6's characterization suite is written first; A4's payload changes land only after the swap); quote requests answer in milliseconds during a Prophet refit; no Werkzeug debugger in any runnable entrypoint; `run.sh` TLS-bundle workaround preserved.

**G2 · Postgres Persistence & Real Auth (P0, XL).** Activate the abandoned Prisma migration: Postgres 16 (compose service; SQLite rejected — pg is half-installed and JSONB fits layouts/strategy configs). Prisma schema owned by Next.js; Python reads the same DB (asyncpg) for analytics needing trade history, and owns its compute tables per the §9 writer matrix. The full schema — including the `Order` table D4 first writes in Phase 5 — is designed here, so the ledger's most sensitive tables never migrate late. Auth becomes real: bcrypt-verified passwords (bcryptjs finally imported), explicit sign-up, `NEXTAUTH_SECRET` required at boot. `.data/db.json` and `storage.ts` deleted; community posts/users migrated by script; **the committed PII purged from git history**. One-click localStorage-portfolio import; dead deps (`yahoo-finance2`) removed.
*Acceptance:* `prisma migrate dev` produces the schema (§9); a Terminal trade writes `Transaction` + `Lot` rows visible from a second browser; login requires the correct password; migration prompt preserves the user's current paper history exactly.

**G3 · OpenAPI Contract + Generated TS Client (P0, M).** `/openapi.json` committed as a checked artifact; `openapi-typescript` generates `src/lib/api/generated/` behind a thin wrapper (single configurable base URL from `NEXT_PUBLIC_API_URL`, retry-with-backoff, staleness passthrough, request-ID surfacing). CI fails on spec drift. Lands in two slices: Phase 1 ships the minimal slice (the thin wrapper + one canonical base URL — hardcoded hosts die immediately); the generated client and drift gate land with G1's OpenAPI surface in Phase 2.
*Acceptance:* `grep -r "127.0.0.1:5000" src/` returns zero hits (Phase 1); backend payload-shape changes surface as compile-time TypeScript errors, not `undefined` in a P&L cell (Phase 2).

**G4 · Job Scheduler (P1, L).** APScheduler in-process (Celery explicitly rejected for one user) with a `job_runs` history table. Jobs: EOD bar ingest per followed exchange into a `bars` table (analytics stop re-downloading 1y per request; also the FX close series A5 consumes); post-EOD signal precompute into `signal_snapshots` (Terminal renders instantly **and** the historical signal record backtests need starts accumulating — today signals vanish on computation); a daily risk-metric snapshot (the comparison basis E2's deltas and E6's review both read); daily ATM-IV snapshots into `iv_history` (started here, two phases before A9's UI, so IV rank's 60-day warm-up is calendar time already spent); nightly ML fit/cache (joblib artifacts; `/api/ml-insights` <300ms p95, `computed_inline: true` for cold symbols); alert evaluation (E5); margin-interest accrual computation (C6 — booked via the internal ledger route, §9); 30-min geotrade sweep (that endpoint becomes a pure read). Manually triggerable from settings.
*Acceptance:* Restart resumes the schedule without duplicate runs; failed jobs retry once and log, never crash the app; a 30-day-old signal is queryable with the price that followed it.

**G5 · Streaming Gateway (P1, L).** FastAPI WebSocket `/ws` with `{subscribe: ["quote:AAPL", "alerts"]}` multiplexing; one poller loop per subscribed symbol set (5–15s upstream cadence within throttle budget — honest granularity, no fake ticks); alert firings pushed. Frontend `useMarketStream` feeds F5's store; disconnect shows reconnecting with exponential backoff.
*Acceptance:* ≥50 concurrent symbol subscriptions within throttle budget (spark-batched); an alert fires exactly once per arm, over WS and persisted.

**G6 · Golden-File Test Harness + CI (P0, M).** Zero → three tiers. **Golden files (the heart):** fixture OHLCV series (trending, mean-reverting, gappy, short-history, NaN-holed, frozen real pulls) with tolerance-pinned expected outputs for every factor, composite, trade-plan level, Kelly, `_rsi`/`_atr`/`_half_life`, and ≥8 risk metrics — written against **current** behavior first (characterization, strictly before G1's swap), then diverged deliberately with documented deltas as A4/B/D land. **Integration:** TestClient over every route with recorded provider JSON (respx), asserting schemas and the non-200 error contract. **E2E smoke:** compose-boot, execute a paper trade, assert `Transaction`/`Lot` rows. GitHub Actions gate merges; vitest covers `lots.ts`, `performance.ts`, `rulesEngine.ts`, `rebalance.ts`.
*Acceptance:* ≥80% line coverage on strategies + risk_analytics; edge fixtures included (<60 rows, all-negative returns, zero-volume days, no-data symbol); integration suite runs with zero live network calls.

**G7 · Typed Config & Secrets (P0, S).** `pydantic-settings` config validated at boot, fail-fast with named missing fields; a committed `.env.example` documenting every variable (`DATABASE_URL`, `GEMINI_API_KEY` split per consumer, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_API_URL`, optional provider keys, cadences, flags); boot preflight prints a masked config table; no module reads `os.environ` outside `config.py` (lint-enforced).
*Acceptance:* Fresh clone + `cp .env.example .env` + two required values = booting stack; Gemini-dependent features degrade to a named "AI disabled — set GEMINI_API_KEY" state.

**G8 · docker-compose, Backup & Offline (P1, M).** `docker compose up` boots db/backend/web (optional redis profile) with healthchecks; the macOS TLS trick baked into the backend entrypoint. `make backup` = pg_dump + model artifacts + journal attachments (§9) + a **schema-versioned portable JSON export** (portfolios, transactions, lots, journals, strategies, settings) so the track record outlives any schema; `make restore` round-trips it. Geotrade geojson and globe textures self-hosted in `public/geo/` (killing the raw.githubusercontent/unpkg runtime deps).
*Acceptance:* `down && up` loses zero data; wipe-volumes + restore reproduces identical positions/journals/strategies including attachments (e2e-verified); landing, Terminal (cached), portfolio, and globe render with network unplugged, staleness badges shown.

**G9 · Observability & Data Quality (P1, M).** structlog JSON logs with request IDs (echoed in error responses and frontend toasts), per-request timing, provider-call logs (symbol, latency, cache disposition, throttle wait). **Data-quality checks as first-class:** OHLCV validation on ingest/serve (high≥low, non-negative volume, gap/duplicate/staleness, >40% single-bar moves) quarantining bad bars into `data_quality_events` and stamping affected signals `data_quality: degraded` for a UI badge — honesty about input data. `/api/health` (DB, cache, providers, last EOD job) + a small ops panel. Zero bare `except: pass` remain (lint-enforced).
*Acceptance:* An injected high<low fixture quarantines, logs, and badges that symbol's signals.

**G10 · Execution-Adapter Scaffold (P2, vNext, L).** An interface (`place_order`, `cancel`, `get_fills`, order lifecycle over the §9 `Order` model) with exactly two implementations: the internal paper engine (D4) and an Alpaca-**paper** adapter passing the same contract tests. Live mode is architecturally gated — separate credential namespace, typed arming confirmation, notional caps, kill switch — **designed now, none shipped enabled**; the live adapter class is absent from the registry.
*Acceptance:* No code path can place a live order (registry + CI grep gate); a resting limit fills only when the polled price crosses; day-expiry honored.

---

## 7. Customization Model

"Infinite customization" is one coherent system, not a pile of toggles. Five layers, each exportable as JSON, each independently useful, composing top-down:

1. **Style Profile (B1/B2)** — the trader's identity object. Selects timeframe, factor weights, thresholds, sizing rule, stop logic, R-ladder, and a default workspace. Exactly one is active; switching it re-parameterizes everything below.
2. **Strategy DSL (B5)** — the math. Named, immutably versioned compositions of registry factors (built-in + custom) with weights, thresholds, and plan parameters. A profile points at a strategy; signal snapshots and backtests reference exact `strategy_version_id`s forever.
3. **Custom indicators (B6)** — the vocabulary. Whitelisted-AST expressions become chart overlays, scan predicates, and DSL factors. No arbitrary code; resource-isolated Python is the stage-2 escape hatch.
4. **Workspaces & scans (F4/B4)** — the cockpit. Named widget layouts with linked symbol groups, bound to profiles; saved scans as deterministic JSON rules (NL-authored, chip-reviewed).
5. **Appearance & input (B8/F2/F7)** — the surface. Density, motion preference, semantic accent mapping, view presets, rebindable keys — all within the committed identity.

Everything round-trips through one schema-versioned `vanguard-config.json` (B7). Config explicitly excludes account state (ledger, balances) and rejects any `broker` namespace on import.

**Example — Style Profile:**

```json
{
  "id": "sp_swing_default", "name": "Swing", "base_preset": "swing",
  "timeframe": { "interval": "1d", "chart_range": "6mo" },
  "strategy_id": "strat_composite_v3",
  "factor_weights": { "mean_reversion": 0.30, "momentum": 0.25, "rsi": 0.15, "vwap": 0.15, "volume_flow": 0.15 },
  "signal_thresholds": { "strong": 0.45, "act": 0.15 },
  "sizing_rule": "half_kelly", "kelly_cap": 0.15, "risk_per_trade_pct": 1.0,
  "stop_logic": { "type": "atr", "atr_mult": 1.8, "swing_buffer_atr": 0.25 },
  "targets_r": [1.5, 3.0], "max_position_pct": 20,
  "default_workspace_id": "ws_weekly_review"
}
```

**Example — Screener rule (scan DSL):**

```json
{
  "name": "Oversold pullback in uptrend",
  "universe": "watchlist:momentum-candidates",
  "logic": "AND",
  "conditions": [
    { "left": "rsi(14)", "op": "<", "right": 30 },
    { "left": "close", "op": ">", "right": "sma(close, 50)" },
    { "left": "volume_imbalance(10)", "op": ">", "right": 0.6 }
  ]
}
```

---

## 8. Data & Provider Strategy

**Principle:** keyless by default; paid providers pluggable behind user-supplied keys; every payload names its provider, cache age, and delay class; stale-if-error is preserved but loudly labeled.

| Asset class | Primary (keyless) | Fallback | Delay class | Notes / limits |
|---|---|---|---|---|
| US equities/ETFs | Yahoo v8 chart/spark | yfinance | delayed (~15m) | 1.5s courtesy throttle; 1m≈7d, 5m≈60d, 1h≈730d range caps |
| International equities | Yahoo (suffix symbology) | yfinance | delayed/EOD | GBp `price_scale`; calendar per exchange |
| Crypto | Binance public (klines, 24h, funding) | Yahoo `-USD` | real-time | per-provider throttle; symbol translation in adapter |
| FX | Yahoo `=X` | — | delayed | volume synthetic → volume factor disabled (B3) |
| Futures | Yahoo `=F` | — | delayed | static contract-spec table (multiplier, tick, margin) |
| Indices/rates | Yahoo `^` (^GSPC, ^TNX…) | — | delayed | rates strip via spark batch |
| Options (US) | Yahoo v7 options | — | 15-min delayed | labeled; IV rank self-built from daily snapshots |
| News/sentiment | Google News RSS + VADER | — | minutes | title-only sentiment, labeled as such; 5-min caches |
| Paid (opt-in stubs) | Polygon / Alpaca / OANDA / CoinGecko / FRED | — | per plan | activate only when the user supplies a key; nothing hard-requires one |

**Abstraction:** the `MarketDataProvider` protocol (A2) with per-class ordered fallback chains, per-provider throttles, and a shared two-tier cache (in-process + disk; TTLs per data type: quote 60s→10s subscribed, intraday bars 60s, daily 30min, chains 5min; crisis windows are checked-in fixtures, D5). Degraded fallbacks mark `provider` + `degraded: true`. Data-quality checks (G9) quarantine bad bars before they feed any signal.

**Cost posture:** $0 mandatory spend. The only recurring external cost is Gemini (assistant, geotrade, narration) — keys split per consumer (G7) so either can be rotated or disabled independently; all Gemini features degrade to computed-numbers-only states.

---

## 9. System Architecture

**Target topology:** three containers plus optional cache — `web` (Next.js standalone: UI, NextAuth, Prisma, server actions for ledger/settings), `backend` (FastAPI/uvicorn: market data, quant, risk, ML, backtests, alerts, scheduler, WS/SSE), `db` (Postgres 16, named volume), `redis` (optional profile). Write ownership is per-table, exactly one writer each — see the matrix below.

**Core tables (~14, key fields):**

| Table | Key fields |
|---|---|
| `User` | id, email, password_hash (bcrypt), created_at |
| `Portfolio` | id, user_id, name, base_currency, style_tag, margin_config JSONB, mirrored bool |
| `LedgerEvent` | id (uuid), portfolio_id, type (BUY/SELL/SHORT_OPEN/SHORT_COVER/DIVIDEND/SPLIT/SYMBOL_CHANGE/ADJUSTMENT/FEE/DEPOSIT/WITHDRAWAL/INTEREST/FX_CONVERT), symbol, qty, price, fees, currency, multiplier, ts, batch_id, order_id? |
| `Order` | id, portfolio_id, symbol, side, type (market/limit/stop), limit_price, stop_price, qty, status (pending/filled/canceled/expired), oco_group_id, fill_event_id, placed_at, expires_at |
| `Lot` | id, portfolio_id, symbol, qty_open, qty_remaining (negative for shorts, C12), price, fees, currency, multiplier, opened_at |
| `RealizedPnL` | id, lot_id, sell_event_id, proceeds, basis, fees, holding_days, lt_flag |
| `ValuationSnapshot` | portfolio_id, date, market_value, net_cash_flow |
| `JournalEntry` | id, event_id?, rationale, tags[], emotion, plan_snapshot JSONB, attachment_path?, reviewed_at |
| `Strategy` / `StrategyVersion` | id, name, spec JSONB, version, created_at (immutable versions) |
| `Setting` | user_id, key, value JSONB (profiles, workspaces, watchlists, scans, indicators, keymap, appearance) |
| `Alert` / `AlertFiring` | id, spec JSONB, armed, cooldown; firing: trigger_value, threshold, ts |
| `Bars` / `SignalSnapshot` | symbol, interval, ohlcv, quality_flags; snapshot: symbol, date, strategy_version_id, payload JSONB |
| `BacktestRun` / `BacktestTrade` | run: params, costs, mode, n_trials, engine_version; trade: entry/exit, R, MAE, MFE |

(Supporting: `ImportBatch`, `job_runs`, `data_quality_events`, `iv_history`, `chat_sessions`, `CommunityPost`.)

**Attachments:** journal images (C9) store on a local volume (`data/attachments/`), path referenced from `JournalEntry.attachment_path`, 5 MB cap, images only; included in `make backup`/`restore` (G8).

**Write ownership (one writer per table — enforced, not implied):**

| Writer | Sole writer of |
|---|---|
| `web` — Next.js server actions / Prisma | `User`, `Portfolio`, `LedgerEvent`, `Lot`, `RealizedPnL`, `JournalEntry`, `Setting`, `Alert` (spec/armed), `ImportBatch`, `CommunityPost` |
| `backend` — FastAPI / asyncpg (append-mostly) | `Order`, `Bars`, `SignalSnapshot`, `ValuationSnapshot`, `BacktestRun`/`BacktestTrade`, `AlertFiring`, `iv_history`, `job_runs`, `data_quality_events`, `chat_sessions` |

Python never writes a Prisma-owned table directly. Backend-originated account writes — D4's fills, C6's margin interest, confirmed corporate-action bookings — round-trip through **one internal, service-token-authed Next.js ledger route**, so the ledger, lots, and realized P&L keep exactly one writer and exactly one lot engine (C3, TypeScript). The `Order` table is backend-owned (placed via `POST /api/orders`, filled by D4's 60s checker) and is designed into the Phase 1 schema even though it is first written in Phase 5 — the ledger's most sensitive tables never migrate late. A CI test asserts the matrix (no cross-writer table access in either codebase).

**Streaming:** WS `/ws` (quotes + alert push) and SSE for AI chat; both serve from cache — upstream cadence stays within throttle budgets. **Jobs:** APScheduler in-process (EOD ingest, signal precompute, risk snapshot, IV snapshots, ML cache, alert eval, geotrade sweep, weekly insights, backups).

**Migration path (3 stages):**

1. **Stage 1 — Parallel truth.** Postgres + Prisma land (G2); ledger/settings server actions ship with a one-click localStorage import; `PortfolioContext` dual-reads (server truth, localStorage fallback). Flask untouched; five hardcoded URLs routed through `API_BASE`.
2. **Stage 2 — Backend swap.** FastAPI replaces Flask route-by-route behind the committed OpenAPI spec (G1/G3), preserving success-path payload compatibility; provider layer (A2) and error contract land together; frontend flips to the generated client. Golden files (G6), written first as characterization tests, guard the swap.
3. **Stage 3 — Retire the shims.** localStorage keys (`pt_*`, `vanguard_layout`) become caches only; `.data/db.json` deleted and PII purged from history; scheduler, streaming, and backup jobs assume Postgres as sole truth.

---

## 10. Phased Roadmap

**Calendar honesty.** Effort tags are defined in §6 (S ≤ 3 days · M ≈ 1 week · L ≈ 2–3 weeks · XL ≈ 4–6 weeks, single developer). Phase durations below are critical-path estimates with ~30% buffer — roughly **a year of sequential solo work in total**. Each phase is an independently shippable milestone, not a stage of one big-bang release; **Phase 1 is a walking skeleton and 2.0-minimal ships at its exit.**

| Phase | Theme | Duration | Delivers (requirement IDs) | Exit criteria |
|---|---|---|---|---|
| **1 — Walking Skeleton** | Server truth + the committed a11y debt, nothing else | ~6 weeks | G2 (schema incl. `Order`), G7 · C1 (incl. manual/backdated entry) · F6 · G3 (minimal slice: wrapper + one base URL) | **2.0-minimal ships here:** trade on Terminal → ledger row visible from a second browser; login requires a real password; committed PII purged from git history; localStorage import verified; reduced-motion verified on landing + globe; zero hardcoded backend URLs |
| **2 — Honest Plumbing** | Backend swap + performance truth | ~10 weeks | G6 → G1 → G3 (full) · A1 → A2 → A4 (strict order: characterization goldens before the swap; payload changes after, with documented deltas; registry before the adapters that consume it) · C2, C3, C4 · F1, F2, F5 · B7 · E3 | TWR/MWR golden tests green; zero `{error}`-at-200 routes; 5m bars genuinely 5m; realized P&L + lots CSV export working; CI required to merge |
| **3 — All Markets** | Any symbol, both directions | ~12 weeks | A3, A5, A6, A8, A10 · B3 · C5, C6, C7, C8, C10, C12 · F9, F10 (core ticket) · G4 (incl. risk + IV snapshot jobs), G8 | `VOD.L`, `BTC-USD`, `EURUSD=X`, `GC=F` each show correct currency, session, and class-correct signals; mixed-currency VaR uses date-aligned historical FX; a short round-trips with sign-correct realized P&L; a renamed ticker preserves basis and TWR; `docker compose up` + `make backup/restore` round-trip verified |
| **4 — Infinite Customization** | The desk molds to the trader | ~10 weeks | B1, B2, B4, B5 (stage 1), B6, B8 · F3, F4, F7, F8 · G5 · E5 (P0 tier) · C9 | Seven presets ship with distinct verified parameter sets; profile switch re-parameterizes signals/interval/size in one refetch; a saved custom strategy runs on the Terminal; config export→wipe→import restores everything; first alert fires within one cycle; dashboard has zero mock data |
| **5 — Intelligence** | Evidence, explanation, automation | ~12 weeks | D1–D9 · F10 (resting orders + Open Orders, with D4) · E1, E2, E4, E6, E7, E8 · A9 (chains + Greeks; IV rank lights up on the history G4 has been accumulating since Phase 3) · B5 (stage 2) · G9 · F11 | A walk-forward backtest with deflated Sharpe renders on `/lab`; paper fills share `fills.py` with backtests and round-trip through the single ledger route; ML panel shows calibrated OOS evidence or "no demonstrated edge"; Kelly tile cites its run ID; copilot answers carry tool-call grounding chips; pre-market brief generates on schedule |

**P2/vNext — by rule, not scheduled in any phase:** A7, B9, C11, D10, F12, G10. Real-money execution remains outside all phases.

---

## 11. Success Metrics

Decision-quality metrics, per the product ethos — no DAU/engagement vanity. Two kinds, explicitly separated: **product capability metrics** (the build controls these; they gate phases) and **personal targets** (the product's single user controls these; the product's job is to instrument them perfectly, not to hit them — n=1 numbers measure the trader, not the software).

**Discipline & process (personal targets — surfaced on the dashboard, fully instrumented, not build-success criteria):**
- **Plan-match rate:** % of executed trades whose entry is within 0.25×ATR of the staged plan entry. Target: >70% within 60 days of D4 shipping.
- **Rule-adherence score:** 1 − (overridden red checks ÷ orders placed). Target: >0.9 sustained; every override journaled.
- **Review completion:** % of closed trades reviewed within 7 days via the C9 queue. Target: >80%.
- *Product responsibility:* 100% of these behaviors instrumented and measurable from day one of the underlying feature — the numbers themselves belong to the trader.

**Customization adoption (the differentiating thesis, measured):**
- ≥50% of executed trades placed under a non-default (cloned or edited) Style Profile within 60 days of Phase 4 shipping.
- ≥3 saved strategies with completed OOS backtests (evidence-attached customization, D9-linked) by the end of Phase 5.
- Per-profile expectancy delta vs its base preset surfaced on `/journal` at n≥30 — customization must be judgeable, not merely possible.

**Evidence quality:**
- **Backtest-to-live gap:** |paper expectancy − OOS backtest expectancy| for the active strategy, in R. Target: <0.3R at n≥30 paper trades. (Intraday styles on delayed-data classes are excluded — their records are labeled non-evidence, §4.)
- **Sized-by-evidence rate:** >60% of sized trades use OOS-evidence Kelly within 60 days of D9 shipping; fallback-sized trades always labeled (audited).
- **Zero naked estimates:** 100% of displayed model outputs carry CI/provenance (lint + report audit); 0 in-sample results shown without the amber badge.

**Data honesty SLOs:**
- Quote freshness: subscribed symbols ≤15s from cache write in open sessions; stale-if-error always visually flagged (0 silent stale renders — UI audit).
- Precomputed signals p95 <300ms; warm ML <1s; portfolio-stress warm <3s.
- Data-quality quarantine: 100% of injected bad-bar fixtures caught before feeding signals (G9 test).

**Ledger integrity:**
- Reconciliation invariant (Σ realized + Σ unrealized + cash − Σ deposits = total return) holds on every snapshot — a violation is a P0 bug.
- Backup restore drill: quarterly `make restore` reproduces identical state (automated e2e).

**Platform health:** CI green required to merge; golden-file coverage ≥80% on strategies + risk_analytics; zero `{error}`-at-200 responses; zero bare `except: pass`; writer-matrix test green (no second writer on any table).

---

## 12. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Yahoo endpoint fragility** (unofficial APIs change/throttle without notice) | Data blackouts across most asset classes | Provider abstraction (A2) with per-class fallback chains; stale-if-error with loud labeling (A8); disk cache + full offline mode (G8); Binance as an independent second keyless source; paid adapters ready behind keys |
| **Quant overfitting** — a solo trader with no risk department curve-fits and trades it | The product manufactures false confidence, its worst failure mode | Walk-forward-only evidence, deflated Sharpe, permanent IN-SAMPLE badges, ≤200-combination grid caps (D3); Kelly shrinkage at small n (D9); "no demonstrated edge" states (D8); anti-goal: no AutoML/strategy mining |
| **Scope creep** — 7 dimensions of ambition on one codebase | Nothing ships; foundations rot | Calendar-honest roadmap (§10) whose Phase 1 is a six-week walking skeleton shipping 2.0-minimal; hard exit criteria per phase; P2 = unscheduled by rule; explicit anti-goals in §5; every feature keyed to existing files/modules |
| **Single-dev maintainability** | Refactors silently corrupt VaR/Kelly/P&L math | Golden-file harness written *before* refactors (G6); one lot engine, one writer per table (§9, C3); OpenAPI drift gate (G3); typed config fail-fast (G7); structured logs with request IDs (G9); compose-reproducible environment (G8) |
| **Product-name collision** — "Vanguard" is one of the world's largest asset managers, in this exact domain | Trademark exposure; user confusion; rename cost grows as config filenames, backup formats, and manifests bake it in | Naming decision raised as §13 Q1 with a recommendation to rename before Phase 1 — the cheapest possible moment |
| **Gemini cost/availability** | AI features degrade or bill surprises | Deterministic engines never depend on the LLM (rules, alerts, scans, briefs compute without it); LLM used at authoring/narration time only; per-consumer keys, disable-able; tool loops capped at 5 calls/turn; all AI surfaces have numbers-only fallbacks |
| **Paper-fill realism ceiling** (60s quotes, daily bars) | Paper record flatters strategies | Conservative fill rules, modeled costs shown pre-confirm, explicit "simulated on 60s quotes" labeling (D4); scalping scoped to real-time classes only (§4/§5); backtest-to-live gap tracked as a first-class metric (§11) |
| **PII/security debt** (committed emails, passwordless auth) | Real personal data exposed | G2: bcrypt, `NEXTAUTH_SECRET` required, git-history purge, `.env.example`; keys never in exports or API responses |
| **Migration data loss** (localStorage → Postgres) | User's existing track record destroyed | One-click importer with count/balance verification (C1); dual-read period (Stage 1); backups as a feature (G8) |

---

## 13. Open Questions

1. **Product name:** "Vanguard OS" collides directly with The Vanguard Group — one of the world's largest asset managers, operating in the identical domain. **Recommendation: rename before Phase 1**, while it is cheap — B7's `vanguard-config.json`, G8's backup format, and F12's PWA manifest will otherwise entrench the name. If kept, an explicit trademark-risk position belongs in §12.
2. **Backtest store location:** backtest tables in the main Postgres (single backup story) vs a backend-local file DB (isolation)? Current lean: Postgres, one truth, one backup.
3. **Universe scans:** B4 caps at watchlists/universes (~50 symbols) because keyless data can't sweep an exchange. Is a paid provider (Polygon grouped daily) worth introducing for full-market scans, and in which phase?
4. **Community feature:** keep (migrate posts to Postgres, fix likes/comments) or cut to reduce surface? It's the one feature that conflicts with "single power-user product." Recommend: keep read-only-minimal in 2.0, decide by Phase 4.
5. **Geotrade:** the 12-country LLM layer is expensive and unvalidated. Keep as a scheduled snapshot (G4 makes it cheap) or demote to P2 experiment?
6. **Cash accrual default (A7):** off by default is honest, but on-by-default better prices the cash-vs-invested decision. Decide with the persona review.
7. **Mobile PWA timing (F12):** gate strictly on C1 server portfolios, or ship earlier with a "this device's paper account" label?
8. **NextAuth version:** stay on v4 or take the v5 migration during G2 while auth is already open-heart?

---

## 14. Appendix: Glossary

- **ATR (Average True Range):** volatility measure from the EWM of true range; used for stop distances (e.g., 1.8×ATR) and slippage proxies.
- **Beta:** sensitivity of an asset/portfolio's returns to a benchmark (cov/var vs ^GSPC here).
- **Block bootstrap:** resampling historical returns in multi-day blocks to preserve short-range autocorrelation when simulating forward paths.
- **Bollinger %B:** position of price within its Bollinger bands (0 = lower band, 1 = upper).
- **Brier score:** mean squared error of probabilistic predictions; lower = better calibrated.
- **Component VaR:** each position's additive contribution to total portfolio VaR, from the covariance decomposition.
- **CVaR (Conditional VaR / Expected Shortfall):** mean loss on the days worse than the VaR threshold.
- **Deflated Sharpe Ratio:** Sharpe adjusted for the number of strategy variants tried, penalizing selection bias (Bailey & López de Prado).
- **Expectancy:** average result per trade, expressed in R; the core edge statistic.
- **FIFO/LIFO/specific-lot:** cost-basis methods choosing which purchase lots a sale consumes.
- **Half-life (Ornstein–Uhlenbeck):** estimated time for a mean-reverting spread to close half its deviation, from a lag-1 regression.
- **HHI (Herfindahl–Hirschman Index):** Σw²; concentration measure; 1−HHI scales the diversification score.
- **IV rank / IV percentile:** where current implied volatility sits within its own trailing history — the "is premium rich?" number; requires accumulated IV snapshots.
- **Kelly criterion / half-Kelly:** bet-sizing fraction maximizing log growth from win rate and payoff ratio; half-Kelly halves it for estimation-error safety.
- **MAE / MFE (Maximum Adverse/Favorable Excursion):** the worst drawdown and best unrealized gain each trade experienced before exit; diagnoses stop and target placement.
- **Modified Dietz:** an approximation of time-weighted return within a period containing cash flows, weighting flows by time held.
- **OCO (One-Cancels-Other):** a linked pair of resting orders (stop + target) where a fill on one cancels the other; the bracket structure D4 fills.
- **Profit factor:** gross wins ÷ gross losses.
- **R / R-multiple:** result measured in units of initial risk (entry-to-stop distance); a 2R win made twice what it risked.
- **Sharpe / Sortino:** excess return per unit of volatility; Sortino penalizes downside volatility only.
- **TWR vs MWR (XIRR):** time-weighted return isolates decision skill from deposit timing; money-weighted (internal rate of return over actual cash flows) reflects the account's lived experience.
- **VaR (Value at Risk):** loss threshold not exceeded with a given confidence over a horizon (here: historical & parametric 95%, 1-day, in $).
- **Vol percentile:** current realized volatility's rank within its own rolling history.
- **VWAP:** volume-weighted average price; deviation from it drives a mean-reversion factor.
- **Walk-forward validation:** optimizing parameters on rolling in-sample windows and reporting only the stitched out-of-sample segments — the standard against curve-fitting.
- **Wilson interval:** a confidence interval for a proportion (win rate) that behaves correctly at small sample sizes.
- **Z-score:** standardized distance from a rolling mean (here, close vs SMA20 in SD units).

---
---

# Part II — Vanguard OS 2.1 Addendum: Discovery, Screening & Brand Register

**Status:** Adopted · **Owner:** Product · **Date:** 2026-08-10 · **Register:** product
**Applies to:** Part I (*Vanguard OS 2.0 PRD*, 2026-07-31). This is a drop-in addendum — new principles (11–13), a new Epic H, new IDs inside Epics A/C/E/F, roadmap deltas, risks, open questions, glossary terms, and (§E.5) the v1 slice shipped 2026-08-10. Nothing here supersedes §3 principles 1–10 or the §5 anti-goals; where this document creates tension with them, the tension is named and resolved in §A.3.

**Revisions adopted 2026-08-10 (product decision, supersede the 2026-08-10 draft where they conflict):**

1. **Chartink take corrected.** What we borrow from Chartink is the *screener page experience* — a named, prebuilt scan (e.g. `chartink.com/screener/short-term-breakouts`) that runs on demand over a universe and lists the matching stocks with the numbers that triggered them — **not** the clause-language editor/importer. H4 is rewritten as the **Screen Runner**; the clause grammar and paste-in importer are demoted to vNext as **H4b**.
2. **INDmoney take corrected.** What we borrow from INDmoney is *horizon suitability presented as cards*: each surfaced stock renders as a **card** carrying deterministic tags — **Long Term / Swing / Short Term / Intraday** — each tag with its reason numbers visible, and **clicking a card opens that symbol in the Terminal**. H3 is rewritten accordingly; the dip/extension boards fold into the H5 library as four screens.
3. **Acid squares cut.** F14's ReactBits `Squares` field is dropped entirely — no animated grid on the landing. F14 is rewritten; the component inventory and Phase 6 exit criteria are updated to match.
4. **Placement decided.** Discovery ships as a new top-level **`/discover`** surface — "Discover" in the nav beside Terminal — with two tabs: **Ideas** (horizon cards) and **Screens** (screen runner). When F1's grouped rail lands, `/discover` moves into the **Trade** group and H2's radar joins it as a third tab.

**Revisions adopted 2026-08-10 — batch 2 (same-day, shipped; implementation record in §E.5):**

5. **Terminal reflow.** The chart is the full-width hero of the Terminal (560px); the Quant Trade Plan sits directly beneath it; the former right-column panels (Paper Trading, Technical Readout, ML Forecasts, Key Statistics, News Intel) reflow into a responsive grid below. Layout only.
6. **Chart indicators v1 (F3/B6 direction, shipped early).** Five client-side indicators on the Terminal chart, all parameter-customizable and persisted: single EMA, EMA ribbon (20/50/100/200 defaults, all four editable), Bollinger Bands (period + σ), MACD (own pane), RSI (own pane with 30/70 lines). Math in `src/lib/indicators.ts`; warm-up bars are `undefined` and skipped, never price-padded — the F3-documented head-padding bug is dead. Frontend and backend now share one Bollinger convention (population σ) and one RSI edge rule (no-loss ⇒ 100).
7. **Markets becomes a multi-market hub.** `/markets` rebuilt on the discovery engine across six markets — US Equities, India, Crypto, **Govt Bonds & Rates** (US-listed ETFs; Indian G-Sec still keyless-blocked, A11), **Commodities** (futures), **Global Indices** (per-symbol currency overrides: ^NSEI renders ₹, ^N225 ¥) — each with a heat grid, top movers, and horizon-tag cards. `GET /api/discover?...&all=1` returns every parsed symbol (tags may be empty) for the heat/movers surfaces. Intraday tags carry an absolute vol floor so a within-universe percentile can never label a sleepy bond ETF "Intraday."
8. **AI teardown adopts the 11-section deep-dive template** — business model, latest quarterly results, balance sheet, competitive position, management quality, technical setup, catalysts, bull case, bear case, valuation, and a **final BUY / HOLD / AVOID call** that must agree with the deterministic verdict or argue against it citing specific numbers (the call is whitelist-validated server-side so injected text can never set it). Doctrine amendment: qualitative context (business model, competitors, catalysts) may draw on the model's general knowledge, clearly framed; **every figure still comes from the computed DATA block**, whose strings are declared untrusted text, never instructions. A best-effort keyless company-profile fetch (sector, business summary, insider %) enriches the payload when Yahoo allows.
9. **Landing background: 3D scene out, Galaxy in.** The R3F candlestick field / torus knot / particle scene is **removed**; the background is the vendored **ReactBits Galaxy** (`reactbits.dev/backgrounds/galaxy`, OGL) with the demo's mouse-repulsion interaction, tinted to the committed palette — DPR ≤ 2 (re-read on resize), paused offscreen/hidden, a single static frame under reduced motion **and** on low-memory / `prefers-reduced-data` devices (F14's degradation doctrine, implemented), composed CSS fallback on context loss. `ogl` becomes a **pinned runtime dependency** (recorded exception). This supersedes F16(b)'s lattice hero; F16(a)'s single-canvas manager now scopes to R3F scenes (the geotrade globe), and the brand register's context budget reads "≤ 1 per active route" with the landing's OGL Galaxy as the recorded exception outside the R3F manager.
10. **Rainbow splash cursor.** The vendored **ReactBits SplashCursor** (`reactbits.dev/animations/splash-cursor`, WebGL fluid sim) runs on the landing in `RAINBOW_MODE` — pointer-events-none, below the nav (z-30), full teardown on unmount, paused on hidden tabs, and **not rendered at all** under reduced motion or on low-power devices. Brand register only; it can never enter a desk bundle (F13).

---

## A. Framing

### A.1 What this adds

Three things the 2.0 PRD does not have:

1. **A discovery layer.** 2.0 answers "what do I think about the symbol I typed?" It has no answer to *"what should I be looking at today?"* — the question every retail broker leads with. Epic H builds that: horizon-tagged idea cards (H3), a prebuilt-screen runner with live result tables (H4), a curated screen library (H5), a level engine (H1), and a named-setup radar (H2).
2. **Broker-grade market context.** The features that make INDmoney, Zerodha, and Dhan feel complete are not signals — they are *context*: surveillance and circuit states, open-interest structure, breadth, sector rotation, event calendars, holdings x-ray, GTT/basket intents, and behavioral nudges at the ticket. Added across A11–A13, C13–C14, E9, H7–H12.
3. **A brand register.** The desk must stay calm (principle 4), but the logged-out product currently has no visual thesis. F13–F18 formalize two registers under explicit motion, accessibility, and performance budgets — with the landing field itself deliberately cut (revision 3).

### A.2 Competitive teardown — what we take and what we refuse

| Source | Worth taking | Our version | Deliberately refused |
|---|---|---|---|
| **INDmoney** | Suitability at a glance — stocks presented as cards a user can act on; portfolio x-ray; one net-worth surface | **H3 Discovery Cards** — deterministic **Long Term / Swing / Short Term / Intraday** tags, every tag carrying its reason numbers, every card opening the Terminal; **C13 Holdings X-ray** | Analyst-consensus "upside %" as a headline number (no keyless source, no accountability); "buy ideas" framing; any ranked ordering before base rates exist |
| **Zerodha Kite** | Contextual nudges before the order goes in; GTT resting intents; basket orders; holdings day/net split | **E9 Nudges**, **C14 GTT/Basket Intents (paper)** | Anything that implies execution certainty on delayed data |
| **Zerodha Console** | Tradewise analysis, P&L reports, drag attribution | Already largely covered by C3/C4/C9 — extended by **C13** attribution | Tax-filing artifacts (§5 boundary stands) |
| **Zerodha Streak** | No-code strategy → backtest → deploy loop | **B4/B5 + H6** — the loop exists, but "deploy" terminates at paper (§5) | One-click live deployment of an unvalidated scan |
| **Sensibull** | Options strategy chooser, payoff, IV context | **A9 + D10 + H9** | Strategy *recommendations* by market view |
| **Dhan** | 100+ prebuilt scanners; OI/PCR/max-pain analytics; scanner backtests; trader's diary | **H4 Screen Runner + H5 Screen Library**, **H9 Derivatives Intelligence**, **H6 Screen Backtest** — diary is C9 | 20-level depth (no keyless source; would be fabricated) |
| **Chartink** | The screener page itself: a **named public scan anyone runs in one click**, returning a fresh result table with the triggering values (`/screener/short-term-breakouts`); scan-level alerts and backtests | **H4 Screen Runner** (prebuilt, runnable, results-with-numbers) + **H5 library**, **H6**, E5 `screen` trigger | Clause-language parity and the paste-in importer (demoted to vNext, H4b); importing the public corpus wholesale (ToS/attribution; §E Q3 — resolved: author in-house) |
| **Tickertape / Screener.in / Trendlyne** | Fundamental scores, checklists, peer compare | **H10 Fundamental Quality Lens** (P2) | Composite "scores" with undisclosed weights |
| **TradingView** | Technical-rating summary strip; screener ergonomics | **H2** setup cards — same glanceability, but ratings never ship without a base rate | A single "Strong Buy" verdict aggregating unvalidated indicators |
| **Finviz** | Relative volume, breakout tables, heatmap | **H7/H8** and A6 | — |

### A.3 Tension with the committed principles, resolved

Two honest conflicts, resolved as doctrine rather than left to drift:

**Conflict 1 — "surface candidates" vs "evidence before sizing" (principle 7).** A radar that ranks stocks is a recommendation engine wearing a lab coat. Resolution: **no surface may rank, sort by attractiveness, or imply a verdict before Epic D's evidence engine exists for that setup.** Descriptive surfaces (levels, screens, cards) may ship earlier; they list, they never rank. H3 cards list alphabetically; H4 results list in scan order. A setup card without an out-of-sample base rate renders an amber **"UNVALIDATED SETUP — NO BASE RATE"** state and is excluded from every ordering. This is the same doctrine as D3's IN-SAMPLE badge, applied to discovery.

**Conflict 2 — 3D/marquee spectacle vs "motion serves state, not spectacle" (principle 4).** Resolution: **two registers, hard-separated by route.** The brand register (logged-out landing, marketing, onboarding, about) may be expressive; the desk register (everything behind auth that displays a number) may animate only in service of state change. F13 makes this a build-enforced boundary, not a style guide — R3F, GSAP timelines, and marquee code are route-split and cannot enter a desk bundle. F6's reduced-motion supremacy applies to both registers without exception. `/discover` is a **desk surface** — F18's number-motion grammar applies to it in full.

### A.4 New product principles

11. **Surface candidates, never verdicts.** Discovery lists what is *true right now at a level* — a setup fired, a screen matched, a stock currently suits a swing timeframe. Whether that is worth trading is answered by a base rate the user can inspect, or it is not answered at all. The product's vocabulary is "setup," "match," "candidate," "suits" — never "recommendation," "buy idea," or "target."
12. **Two registers, one identity.** Brand surfaces persuade; desk surfaces inform. They share tokens, type, and palette, and share nothing else — no motion system, no bundle, no component.
13. **Context before conviction.** Before a size, before a signal: is it in surveillance, is it circuit-locked, is it illiquid, is earnings in two days, is the whole sector down? The nudge that stops a bad trade is worth more than the factor that finds a good one.

---

## B. Epic H — Discovery, Levels & Screening

Priorities and effort tags per §6 (**S** ≤ 3 days · **M** ≈ 1 week · **L** ≈ 2–3 weeks · **XL** ≈ 4–6 weeks, single developer).

**H1 · Level Engine (P0, L).** "Technically at a good level" needs a defensible definition of *level*. `backend/app/levels/` computes, per instrument and interval, a typed set of price levels from cached bars only (no new outbound calls):
- **Swing pivots** — fractal highs/lows (n=5 default), clustered into zones by ATR-scaled bandwidth (default 0.5×ATR); each zone carries `touch_count`, `last_touch_at`, `age_bars`, and a `strength` = f(touches, age decay, volume at touch).
- **Volume profile** — POC/VAH/VAL over a rolling window (250d default), computed from daily bars with intra-bar volume distributed uniformly and **labeled as an approximation** (true profile needs intraday; upgrades free once A4's 5m bars land).
- **Reference levels** — prior day/week/month high/low/close, 52-week high/low, all-time high, round numbers at instrument-appropriate increments (₹10/₹50/₹100, $1/$5/$10 by price scale from A1).
- **Anchored VWAP** — anchored to 52w high, 52w low, last earnings date (H11), and any user-placed anchor from F3's drawing tools.
Output: `GET /api/levels?symbol=&interval=` → `[{type, price, zone_low, zone_high, strength, touches, age_bars, source}]`, ranked by strength and distance. Rendered as F3 chart zones (opacity ∝ strength) and consumed by H2, C14, and B2's stop logic (a new `stop_logic.type: "level"` option — stop beyond the nearest opposing zone rather than a fixed ATR multiple).
*User story:* As a swing trader, I want the app to show me the same support zone I would have drawn by hand, with how many times it has actually been touched, so my entries and stops reference structure instead of a round ATR multiple.
*Acceptance:* On a synthetic double-bottom fixture, exactly one support zone is produced with `touches: 2` at the constructed price ±0.1×ATR; zone bandwidth scales with volatility (a 3× ATR fixture produces ~3× wider zones); levels are deterministic for identical bars; all computation is pure over cached history (asserted by a no-network test); GBp and ₹ instruments produce correctly scaled round numbers (A1 `price_scale`).
*Build:* `levels/{pivots,profile,reference,anchored_vwap}.py`; golden fixtures added to G6; `LevelZone` rendering in `Chart.tsx` via lightweight-charts price ranges.

**H2 · Setup Radar (P0, XL).** The core of the deeper ask: *which instruments are at a technically meaningful level right now, in which direction, and does that historically mean anything?*

Twelve named setups ship in v1, each authored as a **declarative spec in B4/B5's existing vocabulary** — not bespoke Python — so every setup is user-inspectable, clonable, and editable:

| # | `setup_id` | Direction | Defining condition (default params; all profile-overridable) |
|---|---|---|---|
| 1 | `oversold_pullback_in_uptrend` | Long | close > SMA(200) · RSI(14) < 35 · close within 1.0×ATR of SMA(50) · 20d volume declining |
| 2 | `support_retest` | Long | close within 0.5×ATR of an H1 zone with `touches ≥ 2` · zone `strength` ≥ 0.6 |
| 3 | `bollinger_reversion` | Long | %B < 0.05 · SMA(20) slope ≥ 0 · not within 3 bars of an earnings date |
| 4 | `breakout_with_room` | Long | close > 20d high · distance to next opposing H1 zone ≥ 2×ATR · RVOL > 1.5 |
| 5 | `momentum_continuation` | Long | 12-1 momentum in universe top decile · RSI(14) 55–70 (explicitly *not* > 80) · held EMA(21) on the last touch |
| 6 | `volume_thrust` | Long | RVOL > 2.0 · close in top 25% of bar range · volume_imbalance > 0.6 |
| 7 | `high_tight_pause` | Long | new 52w high within 10 bars · ≥3 consecutive inside/NR7 bars · range contraction > 40% |
| 8 | `gap_fill_candidate` | Both | unfilled gap ≥ 1×ATR within 20 bars · price returning toward it |
| 9 | `overbought_extension` | Short | RSI(14) > 75 · close > 3×ATR above EMA(21) · negative volume_imbalance |
| 10 | `resistance_rejection` | Short | close within 0.5×ATR of an H1 resistance zone (`touches ≥ 2`) · upper wick > 50% of range |
| 11 | `breakdown_with_room` | Short | close < 20d low · distance to next support zone ≥ 2×ATR |
| 12 | `momentum_exhaustion` | Short | 20-bar RSI/price negative divergence · composite crossing down through the profile's `act` threshold |

Every match emits a `SetupCard`:

```json
{
  "symbol": "RELIANCE.NS", "setup_id": "support_retest", "direction": "long",
  "quality": 0.78,
  "trigger_level": 1412.5, "invalidation_level": 1387.0, "targets": [1462.0, 1511.5],
  "distance_to_trigger_atr": 0.31, "risk_reward": 2.0,
  "level_ref": { "type": "swing_zone", "touches": 3, "strength": 0.71 },
  "regime": { "trend": "up", "vol": "calm", "source": "D7" },
  "base_rate": { "win_rate": 0.54, "expectancy_r": 0.28, "n": 71, "is_oos": true,
                 "scope": "universe:nifty_500+regime:up_calm", "run_id": "bt_8f2a" },
  "context_flags": ["earnings_in_9d"],
  "data_quality": "ok", "strategy_version_id": "sv_112", "computed_on": "1d"
}
```

Hard rules: **ranking is by `expectancy_r × quality`, never by `quality` alone**; a card whose `base_rate` is absent or `is_oos: false` renders the amber unvalidated state and drops out of every sort (§A.3); the surface word is "setup," never "recommendation"; the paper-only banner is persistent; every card deep-links to a ⌘K ticket pre-loaded with `trigger_level` as entry and `invalidation_level` as stop, so *the level shown is the level traded* (B2/F10).
*User story:* As a swing trader opening the app at 9am, I want a short list of names that just arrived at a level that has historically meant something — with the level, the invalidation, and the base rate on the card — so I spend my attention on decisions instead of chart-flipping.
*Acceptance:* Each of the 12 setups has a synthetic fixture on which it fires on exactly the constructed bar and on no other bar in the series; base rates resolve from D1 walk-forward runs keyed by `strategy_version_id` and refuse to render from in-sample runs; switching Style Profile changes which setups appear and their thresholds within one refetch; symbols with G9-quarantined bars produce zero cards; a card whose linked backtest is deleted degrades to the unvalidated state rather than showing a stale number; the radar over a 500-symbol universe completes inside the A12 bulk budget with no per-symbol outbound calls.
*Build:* `backend/app/setups/{registry,specs,evaluator}.py`, specs as versioned JSON compiled to the B4 DSL; `SetupCard.tsx`; the radar joins `/discover` as a third tab (revision 4) and registers as an F4 dashboard widget.

**H3 · Discovery Cards & Horizon Tags (P0, M — v1 shipped, §E.5).** *Rewritten by revision 2.* The INDmoney-shaped surface, made honest and made ours. Every instrument in the active universe is evaluated by a deterministic, parameter-visible rule set that assigns zero or more **horizon tags**:

| Tag | Default rule (thresholds live in one visible spec; profile-overridable later via B1) | Reads as |
|---|---|---|
| **Long Term** | close > SMA(200) · SMA(50) > SMA(200) · 1y return ≥ +12% | durable uptrend, structure intact |
| **Swing** | above SMA(200) · RSI(14) 35–55 · within 3% of SMA(20) or SMA(50) | pullback to a moving-average level inside an uptrend |
| **Short Term** | 5d return ≥ +4%, or new 20d closing high with RSI 55–80 | active momentum burst |
| **Intraday** | annualized vol in the universe's top 30%, or \|1d move\| ≥ 2.5% | high-range mover suited to day timeframes |

Tagged instruments render as **cards** — symbol, name, price, signed day move, 30-bar sparkline, tag chips, and a reason line per tag showing the actual numbers ("RSI 44 · 1.2% from 50-DMA · +22% 1y"). A stock can carry several tags; a stock with none is not shown. **Clicking a card opens that symbol in the Terminal** (`/screener?q=SYM`) — same numbers, full chart, quant plan, paper ticket. Cards are **listed (alphabetically), never ranked** (§A.3): a tag is a suitability *description*, not a verdict; until H2/H6 base rates exist, no ordering implies one. Tag filter chips (All / Long Term / Swing / Short Term / Intraday) and a universe switcher sit above the grid. The persistent "descriptive, not advice · paper only" line applies.
*User story:* As someone deciding what kind of trade I'm even looking for today, I want stocks presented as cards tagged with the horizon they currently suit — with the reason on the card — so I can filter to my style and jump straight into the Terminal on anything interesting.
*Acceptance:* Every tag renders its reason numbers; a symbol satisfying no rule appears on no card; classification is reproducible for identical bars (fixture-tested); tag thresholds are defined once, not scattered; a card click lands on the Terminal with that symbol loaded; the not-advice line is persistent. The original dip/extension boards ("fell, structurally intact" / "fell, structure broken" / "rose, room remaining" / "rose, extended") ship as four screens in H5 rather than a separate surface — the intact/broken distinction is preserved there.

**H4 · Screen Runner — prebuilt, runnable screens with live results (P0, L — v1 shipped, §E.5).** *Rewritten by revision 1.* The Chartink page we actually want (`chartink.com/screener/short-term-breakouts`): pick a **named screen**, it runs over the selected universe on demand, and returns a results table — symbol, name, last price, day %, and **the triggering values for that screen's conditions** (RSI at 63, RVOL at 1.9 — the number is the hero). Every screen displays its plain-language description *and* its exact condition set in mono type, so nothing is a black box; every result row opens the symbol in the Terminal. Screens are grouped by category (breakout, momentum, mean reversion, trend, volume & volatility, short-side) with match counts and an as-of stamp; an empty result renders a designed empty state naming the universe and conditions.
Execution discipline (until A12): bulk close-series requests per universe (spark-batched at Yahoo's 20-symbols-per-request cap, cached 30 min, stale-if-error); volume-confirmed screens re-check at most the top-12 stage-one candidates against cached OHLCV; scan results cache 5 minutes — a 50-symbol universe costs three batched calls, never a per-symbol burst. Once A12's bulk store lands, the runner reads it directly and the spark path retires.
*User story:* As a Chartink user, I want to open "Short-Term Breakouts," see today's matching stocks with the numbers that triggered them, and click straight into the chart — without building anything first.
*Acceptance:* Every shipped screen executes over every shipped universe without error; each result row shows the triggering values for the screen's conditions; the conditions shown in the UI are generated from the same spec the evaluator runs (one source of truth); zero matches renders the designed empty state, never a spinner or a blank; results carry `as_of` and are reproducible within a cache window; no scan issues more than one bulk call per 20 symbols (Yahoo spark's per-request cap) plus the capped confirmations.

**H4b · Clause Language & Chartink Importer (vNext, L — demoted from H4 by revision 1).** The text-mode clause grammar deliberately shaped after Chartink's (`latest` / `weekly` / `monthly` / `[-n]` offsets, level functions, `count(n, condition)`, cross-timeframe comparison), the paste-in importer parsing to our AST and rendering as editable B4 chips, unsupported constructs failing with named errors. Deferred until the Screen Runner proves which constructs are actually needed — import demand, not speculation, decides the grammar's scope. Prior acceptance criteria (lossless 12-clause round trip, field-level 422s, importer/hand-built parity, fuzz corpus zero 500s) carry over unchanged when scheduled.

**H5 · Curated Screen Library (P1, M — 12 shipped in v1, §E.5).** ~60 in-house screens as seeded, versioned, forkable rows across eight categories — momentum, mean reversion, breakout, breakdown, trend, volume & volatility, relative strength, and event-adjacent — all runnable through H4's runner. The shipped v1 categories (breakout, trend, mean reversion, momentum, volume & volatility, short-side) map into this taxonomy directly; short-side screens file under breakdown as the library grows. Each carries a plain-language description, its exact conditions, its intended holding horizon, its Style Profile affinity, and — once H6 runs — its base rate. The four dip/extension boards from the draft H3 live here as four screens, presented adjacently so "dip vs downtrend" stays the lesson. Forking a shipped screen creates a user copy with lineage recorded (`forked_from`, version), so "I changed one number and it got worse" is answerable.
*Acceptance:* All screens execute without error over the shipped universes inside the A12 budget (v1: the spark budget); every screen names the profile(s) it suits; forks record lineage and survive B7 export/import; a screen returning zero matches over 60 days is flagged as dormant in the library rather than silently empty.

**H6 · Screen Backtest & Forward Tracking (P1, L).** The feature Chartink and Streak users actually come for — with 2.0's evidence discipline attached. Two modes:
- **Historical:** run any screen over history with a fixed exit rule (n-bar hold / target-stop ladder / opposite-signal) through **D1's engine** — the same fills, costs, and slippage as strategy backtests, no separate math. Output is a D2 report scoped to "every match this screen ever produced," plus a per-regime breakdown (D7) and hit distribution by month.
- **Forward:** every screen run persists its match set to `screen_runs` with the price at match time (this starts accumulating from the day the screen is saved, exactly like G4's signal snapshots), so forward performance is measured on genuinely unseen data. The library shows both numbers side by side; **divergence between them is displayed as a first-class metric**, not hidden.
Guardrails: walk-forward-only for parameterized screens (D3), deflated Sharpe against the count of screens the user has tested (a **scan-shopping counter** — trying 40 screens and keeping the best one is the retail overfitting failure mode, and the product says so), and a hard "insufficient sample" state under 30 matches.
*User story:* As someone who has copied screens off the internet for years, I want to know whether a screen ever worked before I trade off it, and I want the app to tell me when I have shopped through so many screens that the winner is probably luck.
*Acceptance:* A screen backtest and an equivalent B5 strategy backtest over the same period produce identical trade lists (shared engine, asserted by fixture); the scan-shopping counter increments per distinct screen tested and visibly deflates the reported Sharpe; forward and historical panels never merge into one number; deleting a screen preserves its historical runs as orphaned records rather than deleting evidence.

**H7 · Relative Strength & Sector Rotation (P1, M).** RS line (symbol ÷ benchmark, benchmark configurable per universe: `^GSPC`, `^NSEI`, sector index), Mansfield RS with its zero line, RS new-highs flag, and a percentile RS rank within universe and within sector. Sector view: a rotation quadrant (RS ratio × RS momentum, RRG-style) over 1w/1m/3m tails, plus a sector heat table with breadth per sector (H8). Feeds H2 as a `quality` input and H3/H4 as a row column.
*Acceptance:* A synthetic symbol constructed to track the benchmark exactly produces a flat RS line and zero Mansfield; quadrant membership is reproducible across reloads for identical bars; sector mapping gaps render "unclassified" rather than dumping symbols into a default bucket.

**H8 · Market Breadth & Internals (P1, M).** Per universe: advance/decline line and ratio, % above SMA(50)/SMA(200), new 52w highs vs lows, up-volume ÷ down-volume, and a McClellan oscillator — all computed from the A12 bulk store, so breadth costs zero additional outbound calls. Surfaces as a `/markets` strip and a dashboard widget; a breadth-regime tag joins D7's regime service so setup thresholds can tighten in deteriorating breadth.
*Acceptance:* Breadth on a universe of one symbol degrades to a typed "universe too small" state; A/D line reconstructs to the same value from a full recompute (idempotence test); values are stamped with the bulk-store as-of date and never rendered without it.

**H9 · Derivatives Intelligence: OI, PCR & Positioning (P1, L).** What Dhan and Sensibull surface, on top of A9's chains: open-interest by strike with OI change, put-call ratio (OI and volume, with its historical percentile — a bare PCR is noise), max pain, an OI-change strike ladder, and **futures long/short buildup classification** (price↑/OI↑ = long buildup; price↓/OI↑ = short buildup; price↑/OI↓ = short covering; price↓/OI↓ = long unwinding) rendered as an explicit four-state badge with both underlying numbers visible. India F&O via A11's sources; US options via Yahoo chains. IV-rank context comes from A9's accumulating `iv_history` — nothing here waits on new plumbing.
*Acceptance:* Max pain recomputed by hand on a fixture chain matches to the strike; buildup classification is unit-tested across all four quadrants including flat-OI edge cases; underlyings without derivatives return a typed "no F&O" state; every panel carries its delay class (A8).

**H10 · Fundamental Quality Lens (P2, M).** A compact fundamentals panel from Yahoo `quoteSummary` (keyless): revenue/earnings growth trend, margins, ROE/ROCE, debt/equity, interest coverage, promoter/insider holding and pledge where available (India), plus a **rule-based checklist** ("positive operating cash flow 3/3 years," "D/E < 1") — pass/fail rows with the actual number beside each, never a composite score with hidden weights (§A.2). Used as an optional screen filter and as a context strip on setup cards, never as a signal input.
*Acceptance:* Every checklist row shows its underlying figure and as-of date; missing fundamentals render "not reported" rather than 0 or a failed check; no fundamental value ever enters a quant factor (import-graph assertion).

**H11 · Event & Catalyst Calendar (P1, M).** Earnings/results dates, ex-dividend and record dates (already fetched under C5), splits, index rebalance dates, F&O expiry, board meetings (India), plus a small macro strip (Fed/RBI decisions, CPI, jobs). Presented as a `/calendar` surface, a portfolio-scoped "next 14 days" strip, and — the load-bearing use — a `context_flags` source for H2 and E9 (`earnings_in_9d`), plus an optional screen filter (`exclude_within_n_days_of_earnings`).
*Acceptance:* A holding with earnings in 3 days shows the flag on every surface that prices it (portfolio row, setup card, ticket); dates carry a source and are refreshed by a G4 job; unknown/unscheduled events render as "not announced," never as a guessed date.

**H12 · Contextual Education Cards (P1, S).** Varsity-shaped, but embedded rather than a destination: a `?` on any setup, horizon tag, screen, level type, or derivatives metric opens a 150-word card explaining what it is, what it assumes, and how it fails, with a link to the glossary (§14). Authored as static MDX — no LLM generation, no per-view cost.
*Acceptance:* Every `setup_id`, horizon tag, screen `id`, level `type`, and H9 metric has a card (completeness test asserted against the registries); cards render offline (G8).

---

## C. Additions to existing epics

### Epic A — Data platform

**A11 · India Market Pack (NSE/BSE) (P1, L).** Chartink, INDmoney, Zerodha, and Dhan are Indian-market products; taking their features seriously means taking NSE/BSE seriously as a first-class market rather than a Yahoo suffix. Adds, on top of A1's registry: `.NS`/`.BO` symbology with ISIN aliasing (feeds A1's `aliases[]` and C5's `SYMBOL_CHANGE`), NSE/BSE calendars including the Muhurat session, `en-IN` formatting with lakh/crore grouping (`₹1,23,456` — `formatMoney` gains a grouping strategy per locale, A5), F&O lot sizes and expiry conventions in the C10 contract table, **circuit-limit state** (upper/lower band, band %, price-frozen), **surveillance flags** (ASM/GSM stages, T2T/trade-to-trade), and shipped universes (NIFTY 50 / NEXT 50 / 100 / 500, BANK NIFTY, MIDCAP 150, SMALLCAP 250, and the sectoral indices).
*User story:* As an Indian trader, I want ₹ formatted the way I read it, lot sizes that are correct for the contract, and a visible ASM flag before I place an order — so the app is not a US terminal with a rupee sign taped on.
*Acceptance:* `RELIANCE.NS` and `500325.BO` resolve to the same instrument via ISIN alias; ₹12,34,567.89 renders correctly in `en-IN` grouping while `$1,234,567.89` is unaffected (regression fixture); a circuit-locked symbol renders a typed frozen state and its setup cards are suppressed with a reason; NIFTY 50 loads within the A12 bulk budget; Muhurat trading is a correct open session on the right date.

**A12 · Bulk EOD Universe Store (P0 for Epic H, M).** The substrate that makes full-universe screening possible without violating the throttle. A G4 job ingests whole universes per day into the `bars` table from bulk sources — **NSE/BSE bhavcopy archives** (the free full-market EOD source that resolves §13 Q3 for India outright), Yahoo spark batching for US/international, Binance klines for crypto — with per-source adapters behind A2's protocol, resumable ingest, and a coverage report. Scans, breadth, RS, and radar all read the store; **no discovery surface may fetch per symbol** (enforced by test). The v1 slice's spark-batch path (§E.5) is the interim implementation of this rule.
*User story:* As a screener user, I want a scan across 500 names to take two seconds against local data, not twelve minutes against a courtesy throttle.
*Acceptance:* A full NIFTY 500 daily ingest completes in one scheduled window and is idempotent on re-run; a 500-symbol screen runs with zero outbound calls (no-network test); missing symbols are reported in the coverage report rather than silently dropped; bulk-ingested bars pass G9 data-quality validation before they are queryable.
*Build:* `backend/app/marketdata/bulk/{bhavcopy,yahoo_batch,binance}.py`; new `universe_coverage` table; scan endpoints gain an `as_of` stamp from the store (v1 already emits `as_of`).

**A13 · Intraday Screening Window (P2, M).** Once A4's intraday bars and A12's store coexist, screens gain a 5m/15m evaluation mode over a capped universe (≤200 symbols), with an unmissable "delayed data — 15 min" label for equities and real-time only for crypto (§4 caveats). Intraday screening on delayed classes is excluded from H6 evidence metrics, exactly as intraday paper records are.
*Acceptance:* Intraday mode is unavailable (with a stated reason) for classes lacking a real-time provider; evidence exclusion is asserted in the metrics test.

### Epic C — Portfolio

**C13 · Holdings X-ray & Attribution (P1, M).** The Console/Tickertape surface, on ledger truth: exposure breakdowns by sector, market-cap band, asset class, currency, and D7 factor beta; **overlap analysis** across ETFs/funds and direct holdings (the "you own NVDA four times" problem); concentration (HHI, top-5 weight); and a Brinson-lite attribution answering *what actually drove the period* — allocation effect vs selection effect vs FX (A5's decomposition) vs fees/costs, reconciling to the C4 TWR figure exactly.
*Acceptance:* Attribution components sum to the period return within rounding (invariant test, a violation is a P0 bug like C3's); overlap detection is fixture-tested on a known ETF holdings list; a single-position portfolio produces zero allocation effect and full selection effect.

**C14 · GTT, Basket & Bracket Intents (paper) (P1, M).** Zerodha's GTT and basket ergonomics, filled by D4's engine and nothing else. **GTT:** a resting trigger-intent (single or OCO) that survives restarts, carries an expiry (365d default), and — the honest part — is checked on D4's 60s cadence with that cadence stated on the card. **Basket:** compose n orders as one reviewed unit with an aggregate risk readout (total capital, total risk-if-all-stopped, resulting concentration, E3 rules evaluated on the *combined* post-basket portfolio), submitted as one atomically-revertible batch. **Slice/iceberg:** display-only intent modeling that splits a large order across the fill checker's cycles with modeled cost — labeled as a simulation, never as market impact truth. Setup cards (H2) place a GTT at `trigger_level` with `invalidation_level` as the OCO stop in one action.
*Acceptance:* A GTT survives backend restart without re-firing historical triggers; a basket that would breach a rule shows the breach on the aggregate, not per-leg, and reverting the batch restores exact pre-basket state; every GTT card states "checked every 60s on delayed quotes"; no GTT can reach any live execution path (the §5 grep gate covers it).

### Epic E — Copilot & automation

**E9 · Contextual Nudges (P1, M).** Kite's best idea, generalized: a deterministic nudge engine (`src/lib/nudges.ts`, no LLM in the hot path, <100ms) evaluated at the ticket, on setup cards, and on portfolio rows. Nudge sources: A11 surveillance/circuit state, D7c days-to-liquidate, H11 event proximity, spread width vs ATR, C6 margin health, G9 data-quality degradation, position-count and daily-trade-count against the active profile, and **behavioral patterns from C9/C3** — averaging down on a loser, re-entering a name stopped out today, trade frequency above the profile's own norm, size above the user's own median after a loss. Nudges are informational and never block (the E3 doctrine); dismissals and outcomes are recorded so E4's weekly insights can answer "did ignoring nudges cost you anything?"
*User story:* As a trader about to place my fourth trade in an hour after two losses, I want the app to say so, factually, before I confirm — because that is the moment my process fails.
*Acceptance:* Each nudge type has a fixture that fires it and one that does not; nudge evaluation adds <100ms to ticket render (perf test); dismissal is recorded with the order and surfaces in the journal; a nudge never renders without the number that triggered it.

**E5 extension · New trigger types.** Two additions to the existing alert schema, no new ID: `setup` (symbol enters/exits a named H2 setup at quality ≥ x, direction-filtered) and `screen` (symbol enters/exits a saved H4/H5 screen — Chartink's scan-alert, arriving on the G4 cadence with that cadence labeled). Both are alert-as-code documents like every other trigger and are covered by E5's existing acceptance criteria.

---

## D. Epic F additions — the brand register

**F13 · Two-Register Motion System (P0 for this workstream, M).** The doctrine of §A.3 made structural, before any of the visual work below is written. A `MotionRegister` provider (`brand` | `desk`) set at the route-group level; a token layer where each register declares its permitted durations, easings, and animation classes; and **build-enforced separation** — R3F, GSAP timeline, and marquee modules live in `src/components/visual/` and are importable only from `(brand)` route groups, asserted by an import-graph test in CI (the same mechanism §9 uses for the writer matrix). F6's reduced-motion supremacy overrides both registers; the settings toggle (B8) applies globally.
Budgets, enforced in CI (Lighthouse CI + bundle analyzer):
| Metric | Brand register | Desk register |
|---|---|---|
| JS shipped to the route | ≤ 350 KB gz (excl. shared) | ≤ 120 KB gz added by visuals (target: 0) |
| WebGL contexts alive | ≤ 1 per active route (landing's OGL Galaxy + SplashCursor pair is the recorded exception, revisions 9–10) | 0 (globe is a `(brand)`-adjacent exception, F16) |
| Sustained FPS, mid-tier laptop | ≥ 50 | n/a |
| INP | < 200 ms | < 200 ms |
| Animation on data surfaces | n/a | state-change only, ≤ 300 ms |
*Acceptance:* An import of any `visual/` module from a desk route fails CI; with OS reduced-motion enabled, every brand surface renders a static composed frame with zero autonomous animation (per-section verification, extending F6's); budgets are gates, not warnings.

**F14 · Landing Reforge — revised (P1, S; was P1, M).** *(Kept P1 rather than demoted: §6's rule keeps P2 items out of every phase, and this residue is scheduled in Phase 6.)* *Rewritten by revision 3; hero superseded by revisions 9–10 (2026-08-10): the landing background is now the OGL Galaxy with the rainbow SplashCursor overlay, and the degradation gates (reduced motion, `webglcontextlost`, `deviceMemory < 4`, `prefers-reduced-data` → static frame / not rendered) are implemented in those components.* The acid-squares base field is **cut** — no animated grid, no ReactBits `Squares`. Remaining F14 scope is compositional polish only, under F13's budgets: the Aceternity `Spotlight` accent and a low-alpha noise/grain layer — each optional and individually removable (the legibility vignette shipped with revision 9).
*Acceptance:* No grid-field component exists in any bundle (import-graph assertion); contrast on all overlaid text passes WCAG AA; token-derived colors only (lint rule).

**F15 · Velocity Marquee — running horizontal type (P1, S).** The ochi.design signature: oversized display type running horizontally across full bleed, its speed **coupled to scroll velocity** and its direction flipping with scroll direction, easing back to a slow baseline drift when the page is still. Implementation: transform-only animation on a duplicated seam-free track (`translate3d`, no layout thrash), velocity sampled from a rAF-throttled scroll listener with a damped spring, `will-change` applied only while in motion. Used for the section dividers and the manifesto band; **decorative duplicates are `aria-hidden` and the accessible copy exists once as static text**. Paused entirely under reduced motion (text remains, static). A second variant — ReactBits `CurvedLoop` — is available for the one curved band in the manifesto section.
*Acceptance:* No layout shift attributable to the marquee (CLS contribution 0); the seam is invisible at every viewport width from 360–2560px; screen readers announce the phrase exactly once; scroll velocity coupling has an upper clamp so a flick cannot produce unreadable blur.

**F16 · 3D System: single-canvas manager & tilt (P1, L).** *Amended by revisions 9–10 (2026-08-10): the landing hero is the vendored OGL Galaxy (+ SplashCursor overlay), which a React-Three-Fiber manager cannot absorb (different renderer) — F16(b)'s lattice hero is superseded, and (a)'s consolidation scope narrows to R3F scenes.* (a) A **single R3F canvas manager** — at most one live R3F context, scenes registered/unregistered by route, shared renderer, `frameloop="demand"` where possible; the geotrade globe migrates onto it (killing its independent context and its runtime `raw.githubusercontent`/`unpkg` texture dependency, which G8 already wants self-hosted). (b) *Superseded — see revision 9.* (c) **Aceternity 3D card tilt** on the feature cards (CSS 3D transforms — no WebGL, negligible cost) and `CardSwap`/`SpotlightCard` for the feature gallery. Every 3D surface ships a **poster/static fallback**: used under reduced motion, on context loss, on low-power/low-memory devices, and as the SSR/first-paint state so nothing pops in.
*Acceptance:* At most one WebGL context per active route, with the landing's vendored OGL Galaxy + SplashCursor pair as the recorded brand-register exception outside the R3F manager (asserted in E2E across route transitions including geotrade); a forced `webglcontextlost` swaps to the static fallback within 200ms with no console error; brand surfaces hold ≥ 50 FPS on a mid-tier laptop and ≥ 30 on a 3-year-old phone, or auto-degrade; the globe renders identically post-migration (visual regression fixture).

**F17 · Scroll Choreography & Section Reveals (P1, M).** GSAP ScrollTrigger sequences for the brand register: pinned hero-to-manifesto transition, staggered reveals on section entry, an Aceternity `TracingBeam` down the narrative spine, and a `ContainerScroll`-style device frame for the product screenshots. Rules: **no scroll-jacking** (native scroll is never hijacked or speed-modified), every pinned section is escapable by keyboard, all reveals collapse to instant under reduced motion (F6 already commits this), and total ScrollTrigger instances are capped and killed on route exit (leak test).
*Acceptance:* Keyboard-only traversal reaches every section and CTA; no ScrollTrigger instance survives a route change (leak test); disabling JS still yields a readable, fully-populated page (progressive enhancement).

**F18 · Number-Motion Grammar for the Desk (P1, S).** The counterweight — the *only* motion permitted behind auth, specified so spectacle cannot creep in: tick pulse ≤ 300ms on price change (F5's, formalized), count-up **only** on user-initiated recompute and never on poll, a 400ms flash on threshold crossings (signal band change, alert fire, margin state), skeleton-to-content crossfades ≤ 150ms, and nothing else. Everything is off under reduced motion with final values immediate. A shared `<AnimatedNumber>` and `<StateFlash>` prevent per-component reinvention. `/discover` is bound by this grammar from day one.
*Acceptance:* An audit test enumerates animated properties on desk routes and fails on any not in this list; count-up never fires on a background poll (fixture-tested); reduced motion produces zero transitions on desk surfaces.

**Component inventory (vendored, pinned — both ReactBits and Aceternity are copy-in source, MIT; nothing becomes a runtime dependency).** *`Squares`, `BackgroundBeams`, and `MagicBento` removed by revision 3 — no F-item owns them after the F14 rewrite.*

| Source | Component | Used in | Register | Reduced-motion fallback |
|---|---|---|---|---|
| ReactBits | `ScrollVelocity` / `CurvedLoop` | Section dividers, manifesto | brand | Static text |
| ReactBits | `SplitText`, `CountUp` | Hero headline, stat band | brand | Final state immediate |
| ReactBits | `SpotlightCard`, `CardSwap` | Feature gallery | brand | Static grid |
| ReactBits | `LogoLoop` | Data-source strip | brand | Static row |
| Aceternity | `Spotlight` | Hero composite | brand | Static gradient |
| Aceternity | `3D Card Effect`, `WobbleCard` | Feature cards | brand | Flat card (CSS 3D off) |
| Aceternity | `TracingBeam`, `ContainerScroll` | Narrative spine, screenshots | brand | Static rail, static frame |
| ReactBits | `Galaxy` (OGL — pinned runtime dep, recorded exception) | Landing background | brand | Single static frame |
| R3F (existing) | Geotrade globe | `/geotrade` | desk-adjacent | Poster image |
| In-house | `AnimatedNumber`, `StateFlash`, `SignedValue` | All desk surfaces | desk | No transition |

---

## E. Roadmap, risks, questions

### E.1 Roadmap deltas

Sequencing rules that fall out of §A.3: **A12 precedes every full-universe Epic H item** (the shipped v1 slice, §E.5, runs on the interim spark-batch path over curated ≤50-symbol universes); **H1 precedes H2** (no setups without levels); **D1–D3 precede any ranked surface** (no verdicts without evidence); **F13 precedes F15–F18** (no visual work before the register boundary exists).

| Phase | Additions | Added duration | New exit criteria |
|---|---|---|---|
| **Now (pre-phase, shipped)** | H3 v1, H4 v1, H5 v1 (12 screens) — see §E.5 | — | Discover surface live: cards carry reasoned horizon tags; prebuilt screens run with triggering values; nothing ranks; cards/rows open the Terminal |
| **3 — All Markets** | A11, A12 | +3 weeks | NIFTY 500 ingests daily and idempotently; ₹ renders in `en-IN` grouping; a circuit-locked symbol shows a typed frozen state; discovery migrates from the spark path to the bulk store |
| **4 — Infinite Customization** | H1, H5 (full library) · C14 · E9 · F13 | +3 weeks | A 500-symbol screen runs with zero outbound calls; the four boards render with levels attached; no discovery surface ranks anything yet; a desk-route import of `visual/` fails CI |
| **5 — Intelligence** | H2, H6, H7, H8, H9, H11 · C13 | +5 weeks | Every setup card carries an OOS base rate or the amber unvalidated state; screen backtests share D1's engine (fixture-identical trade lists); the scan-shopping counter demonstrably deflates reported Sharpe; attribution reconciles to TWR |
| **6 — Brand Register** | F15, F16, F17, F18 · F14 (revised, S) · H12 | ~6 weeks | One WebGL context app-wide across all routes; reduced-motion landing has zero autonomous animation; budgets green as CI gates; no grid-field component in any bundle |
| **P2 / vNext** | A13, H10, H4b | — | Unscheduled by rule (§6) |

**Calendar honesty:** roughly **+17 weeks (~4 months)** on top of the existing ~1-year critical path, at ~30% buffer, single developer (down from +19: F14 shrank to S, H4's clause grammar left the critical path). Phase 6 remains deliberately last: the brand register sells a product that must first be true. If the schedule must compress, F15–F17 are the correct cut — the desk works without them; H2 without D1 is not a cut, it is a lie.

### E.2 New risks

| Risk | Impact | Mitigation |
|---|---|---|
| **Discovery becomes a slot machine** — a library of screens and a radar invite scan-hopping until something looks good | The product's worst failure mode (§12), reintroduced through a new door | Base rate required before any ranking (§A.3); scan-shopping counter with deflated Sharpe (H6); forward-vs-historical divergence shown, not hidden; screens carry lineage on fork; E4 insights report screen-hopping as a behavior |
| **"Setup"/"suits" reads as advice** — in India, surfacing buy/sell calls is investment advice (SEBI RIA territory); the vocabulary matters even for a single-user tool | Regulatory exposure the moment anything is shared, published, or shown to a second person | Principle 11 vocabulary enforced (a lint rule bans "recommendation"/"buy idea"/"target price" in discovery copy); horizon tags are worded as suitability descriptions with visible reasons, never calls; no ranked list is shareable or exportable as content; persistent paper-only + not-advice banner on `/discover`; the §5 anti-goal on real-money execution stands unchanged |
| **NSE/BSE bulk sources are brittle and terms-bound** (bhavcopy paths and formats change; scraping etiquette) | India universe coverage silently degrades | Adapter behind A2 with format-version detection and a loud coverage report; Yahoo `.NS` per-symbol as the degraded fallback (with `degraded: true`); documented UA and rate discipline; ingest failures are visible in `/api/health`, never silent |
| **Level engine subjectivity** — support/resistance is famously in the eye of the beholder | Setups inherit arbitrary parameters and look rigorous while being arbitrary | Levels are parameterized and profile-overridable, with parameters displayed on every zone tooltip; H6 sensitivity analysis over pivot n and cluster bandwidth (a fragile isolated peak is reported as fragile, per D3); levels are descriptive output, never a hidden constant |
| **Horizon-tag thresholds are arbitrary-looking** — "why is Swing RSI 35–55?" | Tags lose credibility; users treat them as noise or, worse, as authority | Thresholds live in one visible spec rendered in the UI (H12 card per tag); reasons with actual numbers on every tag; thresholds become profile-overridable via B1; H6 forward tracking eventually measures whether tags mean anything |
| **Visual bundle and WebGL regressions leak onto the desk** | The calm, fast desk — the actual product — gets slower to sell itself | F13's import-graph gate and CI budgets; single-canvas manager (F16); route-level code splitting; a desk-route animated-property audit test (F18) |
| **Motion doctrine drift** — the brand register's success invites "just a little" spectacle behind auth | Principle 4 erodes by increments, exactly how it eroded the first time | Register is a build boundary, not a guideline; F18's allowlist is enumerated and tested; any addition to it requires a PRD change, not a PR |
| **Derivatives data gaps** (OI/PCR keyless coverage is uneven, especially India F&O) | H9 renders confident numbers on partial data | Per-field provenance and as-of stamps (A8); typed "not available for this underlying" states; no derived metric (max pain, PCR percentile) computes on a partial chain — it refuses |

### E.3 Open questions

1. **Is India a primary market or a universe?** A11 is written as a first-class market pack (₹ formatting, circuits, surveillance, lot sizes). If the single user trades primarily NSE, A11 should move to Phase 2 and the default benchmark should become `^NSEI` — a small change made expensive later. The v1 slice ships NIFTY 50 as a first-class universe with ₹ display; the deeper question stands. **Recommendation: decide before Phase 3 begins.**
2. **Chartink clause parity — subset or full?** **Resolved 2026-08-10:** neither, for now. The Screen Runner (H4) is the Chartink take; the clause grammar and importer are vNext (H4b), scoped later by observed demand.
3. **Seed the library from public Chartink screens, or author in-house?** **Resolved 2026-08-10:** author in-house with documented logic (provenance matters for a base-rate feature); users paste in whatever they want once H4b exists.
4. **Base-rate scope:** per-symbol (specific but tiny n) vs pooled by universe + regime (large n, less specific)? **Recommendation: pool by universe + D7 regime by default, show per-symbol only at n ≥ 30, and always display the scope string on the card.**
5. **Does `/discover` get the default landing slot?** A discovery-first home changes the product's character from "analyze what I chose" to "here is what to look at." **Recommendation: available as a `default_landing` option (F1) but not the default — the user opts into being shown things.**
6. **Should descriptive discovery ship before base rates exist?** **Resolved 2026-08-10: yes** — cards and screens are live, unranked, with the not-advice banner persistent; revisit the ranking question at Phase 5 exit when H6 base rates exist.
7. **Brand register scope creep:** does the marketing surface justify ~6 weeks for a single-user tool? **Recommendation: build F13 + F15 + F18 (~2 weeks) and treat F16/F17 as optional polish, unless the product's audience is being reconsidered — which is itself a §13-scale question.**

### E.4 Glossary additions

- **Anchored VWAP:** VWAP computed from a chosen anchor bar (52w high/low, earnings date, user-placed) rather than session open; used as a dynamic level.
- **ASM / GSM:** NSE/BSE surveillance frameworks (Additional/Graded Surveillance Measure) applying extra margins or trade restrictions to flagged securities; a hard context flag, not a signal.
- **Base rate:** the historical frequency with which a named setup produced a given outcome, measured out-of-sample; the number that separates a setup from a hunch.
- **Bhavcopy:** NSE/BSE's free daily full-market EOD file; the bulk substrate that makes full-universe screening possible without per-symbol requests.
- **Brinson attribution:** decomposition of portfolio return into allocation, selection, and interaction effects against a benchmark.
- **Circuit limit:** exchange-imposed daily price band; a locked symbol cannot trade beyond it and is excluded from setup surfacing.
- **GTT (Good-Till-Triggered):** a resting trigger intent, long-dated, that places an order when a price condition is met — here, checked on the paper engine's 60s cadence.
- **Horizon tag:** a deterministic suitability description (Long Term / Swing / Short Term / Intraday) computed from visible rules over price history, always rendered with its reason numbers; a description of current character, never a call.
- **Long/short buildup:** the four-quadrant classification of price change against open-interest change (long buildup, short buildup, short covering, long unwinding).
- **Mansfield RS:** relative-strength measure normalized around a zero line, so outperformance and underperformance are readable at a glance.
- **Max pain:** the strike at which the aggregate value of expiring options is smallest; a positioning statistic, not a forecast.
- **NR7 / inside bar:** narrowest range of the last seven bars / a bar contained within the prior bar's range; volatility-contraction markers.
- **OI (Open Interest):** total outstanding derivative contracts; direction of change carries the positioning information, not the level.
- **PCR (Put-Call Ratio):** puts ÷ calls by OI or volume; meaningful only against its own historical percentile.
- **POC / VAH / VAL:** volume profile's point of control and value-area high/low — the prices where most volume traded.
- **Register (brand / desk):** the two motion and visual domains of the product, separated at the route and bundle level.
- **RRG (Relative Rotation Graph):** a quadrant plot of relative-strength ratio against relative-strength momentum, used for sector rotation.
- **RVOL (Relative Volume):** current volume ÷ its average for the same elapsed session time (v1: last bar volume ÷ 20d average volume).
- **Scan-shopping:** testing many screens and keeping the best-performing one — the retail form of overfitting; counted and penalized in H6.
- **Screen Runner:** the surface that executes a named, prebuilt screen over a universe on demand and returns the matching instruments with the values that triggered each condition.
- **Setup:** a named, deterministic, testable market condition at a defined level — the product's unit of discovery, and deliberately not a recommendation.
- **T2T (Trade-to-Trade):** a settlement category requiring delivery, disallowing intraday squaring-off; a nudge condition.

### E.5 Shipped v1 slice (2026-08-10)

A thin vertical slice of Epic H shipped ahead of the phase plan, on current infrastructure (Flask + spark batching + the existing disk cache), so the discovery surface is real while A12/H1/H6 are built properly. Everything below is implementation record, not aspiration.

**Backend — `backend/screener_engine.py`:**
- Three curated universes with embedded display names: **US Large Cap** (~48 megacaps, USD), **NIFTY 50** (curated `.NS` list, INR), **Crypto Majors** (12 `-USD` pairs). Close series arrive via **spark-batched requests at Yahoo's 20-symbols-per-request cap** (1y daily), cached 30 min with stale-if-error — no per-symbol sweep, honoring the A12 rule on interim plumbing.
- **Twelve prebuilt screens** across six categories — breakout (incl. **Short-Term Breakouts**), momentum, mean reversion, trend, volume & volatility, short-side — each a declarative spec `{id, name, category, description, conditions, horizon}` evaluated by one engine; the conditions string shown in the UI is generated from the same spec the evaluator runs, and every advertised condition publishes its triggering value as a result column. Volume-dependent screens confirm at most the **top-12** stage-one candidates against cached OHLCV (RVOL, range position); a confirm bar from a different session than the scanned bar is refused (fail-closed to unconfirmed); unconfirmable rows degrade visibly, never silently.
- The **H3 horizon classifier** (Long Term / Swing / Short Term / Intraday) with per-tag reason strings carrying the actual numbers. Calendar honesty for 7-day-week assets: crypto annualizes vol at √365 and "1y" returns are measured by calendar date, not bar count.
- **Fixture tests** — `backend/test_screener_engine.py`: offline synthetic series (uptrend-pullback, momentum burst, high-vol mover, short history) asserting exact tag output, reproducibility on identical bars, fail-closed behavior on missing metrics, and screen-spec integrity (12 screens, six categories, conditions string = evaluator labels, every column key resolvable). Runs with plain `python`, no network.
- Routes (standard rate-limit scope, 5-min engine-level result cache, browser `Cache-Control` per the existing policy table): `GET /api/discover?universe=`, `GET /api/screens`, `GET /api/screens/run?id=&universe=`.

**Frontend — `/discover` ("Discover" in the nav, beside Terminal):**
- **Ideas tab:** responsive card grid — symbol, name, price, signed day move, 30-bar sparkline, tag chips (Long Term `accentBlue` / Swing `accentPurple` / Short Term `accentCyan` / Intraday `accentAmber`), reason lines; tag filter chips with counts; universe switcher; alphabetical order (no ranking). **Card click → `/screener?q=SYM`.**
- **Screens tab:** category-grouped screen selector; per-screen description + conditions in mono; results table with symbol, name, price, day %, and the triggering values; row click → Terminal; scanned/matched counts and `as_of` stamp; designed empty, loading, error, and 429 states.
- Honesty and a11y: a persistent not-advice line in the header — "Candidates, not calls — descriptive setups and screens on delayed data. Paper trading only." — rendered in every state; `prefers-reduced-motion` respected; signed values carry +/− redundancy per F6; result rows link via a real anchor on the symbol (no ARIA-role overrides on table rows).

**Explicitly not in the slice (owned by their IDs):** base rates and screen backtests (H6/D1), the level engine (H1), the setup radar (H2), the bulk EOD store (A12 — spark path is the interim), screen alerts (E5), surveillance/circuit flags (A11), fork/lineage on screens (H5 full), clause language and import (H4b).

**Batch 2 (2026-08-10, same day — revisions 5–10):**
- **Terminal:** full-width chart (560px) + Quant Trade Plan beneath; side panels reflowed into a `md:2 / xl:3` grid below; `src/lib/indicators.ts` (EMA/SMA/Bollinger/MACD/RSI, undefined warm-ups) + a rebuilt `Chart.tsx` with five toggleable, parameter-editable indicators (settings popovers, clamped inputs, config persisted to `localStorage`), RSI and MACD in their own lightweight-charts v5 panes.
- **Markets hub:** three new engine universes — `bonds` (12 US Treasury/credit ETFs), `commodities` (12 futures), `indices` (13 global indices with a `_symbol_currency` per-symbol override consulted by cards and screen matches alike); `GET /api/discover?...&all=1` emits every parsed symbol (empty `tags` allowed); `/markets` rebuilt as the six-market hub (heat grid → movers → horizon setups), per-universe client cache, outage/empty/error states designed.
- **AI teardown:** `deep_analysis._NARRATIVE_PROMPT` rewritten to the 11-section template with the grounding doctrine above; `_company_profile()` best-effort quoteSummary enrichment (24h cache, any failure → `None`, never crashes the teardown); `DeepAnalysisSection` renders the final-verdict banner (AI call vs computed call, visible side by side), bull/bear tinted panels, and skips any missing section defensively. Live-verified: all 12 keys returned for AAPL with a HOLD call.
- **Landing:** R3F scene deleted from `src/app/page.tsx`; `src/components/reactbits/Galaxy.tsx` vendored from the ReactBits source and hardened (animated=false single frame, visibilitychange + IntersectionObserver pause, DPR cap 2 re-read on resize, low-memory/`prefers-reduced-data` static frame, `webglcontextlost` → composed CSS fallback, full unmount cleanup) with the demo's mouse-repulsion interaction; `src/components/reactbits/SplashCursor.tsx` vendored (rainbow fluid cursor, z-below-nav, pointer-events-none, full teardown, absent under reduced motion / low power); vignette overlay keeps hero type WCAG-legible; locomotive/GSAP wiring untouched.
- Fixture tests grew to 11+ (universe shapes, currency overrides, `include_untagged` contract, intraday vol floor, momentum positive gate — all offline).
- An 18-finding adversarial review pass was applied the same day: quant price-lines surviving indicator rebuilds, `autoSize` charts, dead-pane gating, one Bollinger convention (population σ) and one RSI no-loss rule (⇒ 100) across frontend/backend, markets-hub outage-cache recovery + 5-min TTL + movers overlap guard, deep-analysis 429 handling, honest `sma200: None` under 200 bars, prompt-injection guard + verdict whitelist, intraday absolute vol floor, live parallax listeners, mid-session reduced-motion re-wiring.
