# Product

## Register

product

## Platform

web

## Users

A single quant-minded self-directed trader — the person who built and runs it. The context is research and paper trading: sitting with a chart open, deciding whether and how large to take a position, and wanting the discipline of explicit rules rather than gut feel. The job to be done is to turn a symbol into a defensible decision — is there an edge, where's the entry, where's the stop, how big should the position be, and what's the portfolio-level risk of adding it.

The product register is the default, but the surface is split: the app itself (screener, portfolio, dashboard, markets, news, geotrade) is a working tool and reads as **product**, while the landing page at `/` is a presentation surface and operates in **brand** register. Pick the register per task from the surface in focus; both carry equal weight.

## Product Purpose

Flint is a personal quant desk: a stock screener and paper-trading platform that unifies the analysis a disciplined trader would otherwise assemble from many tools. It produces a systematic multi-factor trade plan (limit entry, ATR/swing stop, 1.5R/3R targets, factor-vote breakdown, half-Kelly sizing), portfolio risk analytics (VaR/CVaR in dollars, Sharpe, Sortino, max drawdown, beta, diversification, Markowitz optimization), sentiment-scored global news, ML forecasts (XGBoost direction, Prophet), and a portfolio-aware AI assistant grounded in live signals. Success is measured in decision quality: better-sized positions, clearer risk, and trades taken on rules rather than emotion.

## Positioning

A retail-accessible quant desk in a single screen — the institutional machinery of systematic signals, Kelly sizing, dollar-denominated tail risk, and AI grounded in your live portfolio, unified where a professional would normally pay for and stitch together separate terminals.

## Brand Personality

Precise, systematic, and quietly elite. The voice is that of a disciplined instrument, not a hype machine: it states the plan and the risk plainly and lets the numbers carry the weight. It should feel powerful and pro-grade — comfortable with ATR, Kelly, and CVaR — while staying approachable and legible rather than intimidating, closer to the polish of TradingView or Robinhood than to a cluttered legacy broker terminal. Confidence comes from clarity and depth, never from spectacle.

## Anti-references

- **Meme / gambling apps** — no confetti, rockets, "to the moon," or gamified dopamine. Nothing that trivializes risk or celebrates a trade; the tone treats capital seriously.
- **Generic SaaS templates** — no cream/purple gradient landing look, identical feature-card grids, tiny uppercase tracked eyebrows, or hero-metric templates. This is the AI-default that must be actively avoided.
- **Over-animated spectacle** — motion and glow must serve the data, never become the point. Effects that distract from a chart or a number are a failure, even though the current build leans heavy on them (3D field, meteors, animated gradients) and should be reined in toward the target feel.

## Design Principles

- **The number is the hero.** Data, signals, and risk figures are the product. Every layout, color, and motion decision either sharpens their legibility or is cut.
- **Discipline over emotion.** The interface reinforces rules-based trading — explicit entries, stops, R-targets, and sizing shown plainly — and never nudges toward reckless or impulsive action.
- **Powerful, not intimidating.** Serve genuine depth (Kelly, VaR/CVaR, factor votes) while staying legible and approachable; density is earned by the task, not imposed for effect.
- **Motion serves state, not spectacle.** Animation conveys change, feedback, and loading. The current spectacle-forward motion is dialed back toward calm, purposeful movement that never competes with the data.
- **Honest about risk.** All trading is paper; signals and analytics are educational, not advice. The design communicates this plainly rather than implying certainty or guaranteed outcomes.

## Accessibility & Inclusion

Reduced-motion support is the one hard requirement: `prefers-reduced-motion` must be honored across the motion-heavy surfaces (the 3D candlestick field, GSAP scroll effects, meteors, count-ups), with a calm crossfade or instant fallback. Beyond that, accessibility is kept in mind as best-effort rather than a hard gate for this personal tool — but given the dark, red/green-heavy, data-dense UI, two things are worth carrying forward when touching those surfaces: maintaining readable contrast on numeric readouts (avoid faint gray that vanishes on the dark background), and not relying on color alone to signal up/down (pair green/red with sign, icon, or label).
