# Design Context

Strategic product context lives in [PRODUCT.md](PRODUCT.md). Read it before design work.

- **Register:** product (the app — screener, portfolio, dashboard) is the default; the landing page at `/` runs in **brand** register. Pick per surface; both carry equal weight.
- **Platform:** web (Next.js 16 App Router).
- **Identity (committed):** dark deep-slate theme (`#07090F`) with neon accents (green/red/blue/purple/amber/cyan), Inter + JetBrains Mono, glass panels. Tokens in `src/app/globals.css` and `tailwind.config.js`. Preserve this identity — don't invent a new palette.
- **Principles:** the number is the hero · discipline over emotion · powerful, not intimidating · motion serves state, not spectacle · honest about risk (all trading is paper).
- **Hard a11y requirement:** honor `prefers-reduced-motion` across the motion-heavy surfaces (3D field, GSAP scroll, meteors, count-ups).
