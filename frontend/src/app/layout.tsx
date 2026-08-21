import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import "./globals.css";
import { PortfolioProvider } from "../context/PortfolioContext";
import AuthProvider from "../components/AuthProvider";
import AIAssistant from "../components/AIAssistant";
import SmoothScroll from "../components/SmoothScroll";

/**
 * Two faces, one rule: General Sans carries PROSE, JetBrains Mono carries DATA.
 *
 * Both are self-hosted from ./fonts rather than pulled from a CDN, and both
 * are free to use commercially:
 *
 *   General Sans   - Indian Type Foundry, via Fontshare (ITF Free Font License)
 *   JetBrains Mono - JetBrains s.r.o. (SIL Open Font License 1.1)
 *
 * next/font/local (rather than a hand-rolled @font-face) buys three things
 * that matter here: the files are hashed and served same-origin, they are
 * preloaded, and Next generates a size-adjusted local fallback so the page
 * does not reflow when the real face lands.
 */
const generalSans = localFont({
  variable: "--font-sans",
  display: "swap",
  // Fontshare ships one file per weight. 700 is declared as 700-900 so the
  // `font-black` display headings resolve to Bold instead of a synthesised
  // weight, which smears badly at 3xl/4xl.
  src: [
    { path: "./fonts/general-sans-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/general-sans-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/general-sans-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/general-sans-700.woff2", weight: "700 900", style: "normal" },
  ],
  // Metric-matched fallback while the webfont loads.
  fallback: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
});

/**
 * JetBrains Mono, variable build (wght 100-800), latin subset.
 *
 * Replaces Martian Mono, which was a width-variable face defaulting to
 * SemiExpanded: a 0.75em digit advance against JetBrains Mono's 0.60em, so
 * every price, P&L and percentage in the app ran ~25% wide and pushed the
 * dense tables (Movers, Screens, Levels) toward horizontal scroll. JetBrains
 * Mono has no width axis, so the figure width is correct by default and
 * globals.css no longer has to pin font-stretch.
 *
 * It is also a screen-first face designed for long reading sessions at small
 * sizes, which is what a terminal readout actually is: taller x-height,
 * unambiguous 0/O and 1/l/I, and a 1.2x line box that suits stacked stat rows.
 */
const jetbrainsMono = localFont({
  variable: "--font-mono",
  display: "swap",
  src: [{ path: "./fonts/jetbrains-mono-variable.woff2", weight: "100 800", style: "normal" }],
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
});

export const metadata: Metadata = {
  title: "Flint: Screener & Portfolio Intelligence",
  description: "Quant-grade stock screener, portfolio management, global news sentiment and AI copilot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // The font variables go on <html>, not <body>, so --font-sans/--font-mono
    // are in scope for everything globals.css sets at :root.
    <html lang="en" className={`${generalSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        <AuthProvider>
          <PortfolioProvider>
            <SmoothScroll>{children}</SmoothScroll>
            <Suspense fallback={null}>
              <AIAssistant />
            </Suspense>
          </PortfolioProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
