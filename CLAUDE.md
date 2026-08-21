# Design Context

Strategic product context lives in [PRODUCT.md](PRODUCT.md). Read it before design work.

- **Register:** product (the app — screener, portfolio, dashboard) is the default; the landing page at `/` runs in **brand** register. Pick per surface; both carry equal weight.
- **Platform:** web (Next.js 16 App Router). The repo is split into `frontend/` (Next.js) and `backend/` (Flask API); all UI work lives under `frontend/`.
- **Identity (committed):** dark deep-slate theme (`#07090F`) with neon accents (green/red/blue/purple/amber/cyan), General Sans (prose) + Martian Mono (data), glass panels. Tokens in `frontend/src/app/globals.css` and `frontend/tailwind.config.js`. Both faces are self-hosted from `frontend/src/app/fonts/` via `next/font/local` in `layout.tsx` — General Sans under the ITF Free Font License, Martian Mono under OFL 1.1. Preserve this identity — don't invent a new palette.
- **Principles:** the number is the hero · discipline over emotion · powerful, not intimidating · motion serves state, not spectacle · honest about risk (all trading is paper).
- **Hard a11y requirement:** honor `prefers-reduced-motion` across the motion-heavy surfaces (3D field, GSAP scroll, meteors, count-ups).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
