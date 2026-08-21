'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';

import Navigation from '../components/Navigation';
import { Marquee } from '../components/magicui/Marquee';
import MaskedText from '../components/motion/MaskedText';
import WordsReveal from '../components/motion/WordsReveal';
import CharReveal from '../components/motion/CharReveal';
import VelocityMarquee from '../components/motion/VelocityMarquee';
import Magnetic from '../components/motion/Magnetic';
import usePrefersReducedMotion from '../lib/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/* -------------------------------- content -------------------------------- */

const MARQUEE_WORDS = ['FLINT', 'EVIDENCE', 'DISCIPLINE', 'RISK'];

const CAPABILITIES = [
  {
    index: '01',
    title: 'Quant Trade Plans',
    href: '/screener',
    accent: 'text-accentGreen',
    hover: 'hover:border-accentGreen/40',
    desc: 'Five factor families vote on every symbol: mean reversion, momentum, VWAP, order flow, RSI. The output is a plan, not a hunch. Limit entry, ATR stop, 1.5R and 3R targets, half-Kelly size.',
  },
  {
    index: '02',
    title: 'Movers Across Every Cap',
    href: '/movers',
    accent: 'text-accentAmber',
    hover: 'hover:border-accentAmber/40',
    desc: 'The whole NSE Total Market scanned by segment. Largecap through microcap, Nifty 50 to Smallcap 250, filtered to the names that actually moved. A 20% day rarely happens in the Nifty 50.',
  },
  {
    index: '03',
    title: 'Portfolio Risk in Rupees',
    href: '/portfolio',
    accent: 'text-accentRed',
    hover: 'hover:border-accentRed/40',
    desc: 'VaR and expected shortfall stated in currency, not abstractions. Sharpe, Sortino, drawdown, beta and diversification recomputed as your book moves. Tail risk you can read as money.',
  },
  {
    index: '04',
    title: 'India-first, Global-aware',
    href: '/markets',
    accent: 'text-accentBlue',
    hover: 'hover:border-accentBlue/40',
    desc: 'NSE membership and segment data straight from the exchange, beside US equities, crypto and commodities. One desk for both books, no juggling terminals to see the same position twice.',
  },
];

const STATS = [
  { value: 752, decimals: 0, suffix: '', label: 'NSE names scanned daily' },
  { value: 5, decimals: 0, suffix: '', label: 'Factor votes per signal' },
  { value: 95, decimals: 0, suffix: '%', label: 'VaR confidence level' },
  { value: 0.5, decimals: 1, suffix: '×', label: 'Kelly sizing cap' },
];

/* ------------------------------ small pieces ----------------------------- */

/** Count-up stat in mono. Renders the final value statically under reduced motion. */
function CountStat({
  value,
  decimals,
  suffix,
}: {
  value: number;
  decimals: number;
  suffix: string;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion || !ref.current) return;
    const el = ref.current;
    const format = (n: number) => `${n.toFixed(decimals)}${suffix}`;
    const counter = { n: 0 };
    el.textContent = format(0);

    const ctx = gsap.context(() => {
      gsap.to(counter, {
        n: value,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: () => {
          el.textContent = format(counter.n);
        },
      });
    });

    return () => {
      ctx.revert();
      // The tween drives textContent directly, so ctx.revert() cannot restore
      // it — write the final value back explicitly or the stat reads "0".
      el.textContent = format(value);
    };
  }, [reducedMotion, value, decimals, suffix]);

  return (
    <span ref={ref} className="tabular">
      {`${value.toFixed(decimals)}${suffix}`}
    </span>
  );
}

/** One ticker chip in the tape. Prices are static sample data, not a live feed. */
function TickerChip({ symbol, price, change }: { symbol: string; price: string; change: number }) {
  const up = change >= 0;
  return (
    <div className="mx-2 flex items-center gap-3 rounded-full border border-borderSubtle bg-white/[0.03] px-5 py-2.5 font-mono text-[13px] backdrop-blur-sm">
      <span className="font-bold text-textPrimary">{symbol}</span>
      <span className="tabular text-textSecondary">{price}</span>
      <span
        className={`flex items-center gap-1 tabular font-semibold ${up ? 'text-accentGreen' : 'text-accentRed'}`}
      >
        {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {up ? '+' : ''}
        {change.toFixed(2)}%
      </span>
    </div>
  );
}

const TICKERS_A = [
  { symbol: 'AAPL', price: '311.20', change: 1.24 },
  { symbol: 'NVDA', price: '188.45', change: 3.87 },
  { symbol: 'TSLA', price: '412.09', change: -2.13 },
  { symbol: 'MSFT', price: '502.66', change: 0.58 },
  { symbol: 'AMZN', price: '231.14', change: 1.02 },
  { symbol: 'META', price: '744.31', change: -0.76 },
];

const TICKERS_B = [
  { symbol: 'BTC-USD', price: '112,480', change: 2.41 },
  { symbol: 'ETH-USD', price: '4,102', change: -1.18 },
  { symbol: 'SPY', price: '682.55', change: 0.34 },
  { symbol: 'QQQ', price: '612.90', change: 0.71 },
  { symbol: 'GLD', price: '312.77', change: -0.22 },
  { symbol: 'VIX', price: '14.82', change: -4.05 },
];

/** One repeated segment of the marquee strip. */
function MarqueeSegment() {
  return (
    <div className="flex items-baseline">
      {MARQUEE_WORDS.map((word, i) => (
        <React.Fragment key={word}>
          <span
            className="px-6 text-[clamp(3.5rem,7vw,7rem)] font-black leading-none tracking-tight md:px-10"
            style={
              i % 2 === 1
                ? { WebkitTextStroke: '1.5px rgba(241,245,249,0.4)', color: 'transparent' }
                : undefined
            }
          >
            {word}
          </span>
          <span className="text-[clamp(2rem,4vw,4rem)] font-light text-textMuted">
            /
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ---------------------------------- page --------------------------------- */

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion || !rootRef.current) return;

    // Smooth scrolling is provided app-wide by <SmoothScroll> (Lenis) in the
    // root layout, which drives NATIVE scroll — so every trigger here reads the
    // default scroller with no proxy and no scroll container of its own.
    const ctx = gsap.context(() => {
      // Hero support copy and CTAs drift in after the headline mask reveal —
      // sequence follows reading order, so the eye lands on the headline first.
      gsap.from('[data-hero-fade]', {
        y: 20,
        opacity: 0,
        duration: 0.9,
        stagger: 0.1,
        delay: 0.55,
        ease: 'power3.out',
      });

      // Capability cards rise once as the grid enters.
      gsap.from('[data-cap-card]', {
        y: 48,
        opacity: 0,
        duration: 0.9,
        stagger: 0.09,
        ease: 'power3.out',
        scrollTrigger: { trigger: '[data-cap-grid]', start: 'top 80%', once: true },
      });

      // Stats fade up as one unit; the numbers count themselves.
      gsap.from('[data-stat]', {
        y: 28,
        opacity: 0,
        duration: 0.8,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '[data-stats]', start: 'top 85%', once: true },
      });
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  return (
    <div ref={rootRef} className="relative">
      <Navigation />

      {/* ================================ HERO =============================== */}
      <section className="relative flex min-h-[100dvh] flex-col justify-center px-6 pt-24 md:px-12 lg:px-20">
        <p
          data-hero-fade
          className="mb-8 font-mono text-[11px] uppercase tracking-[0.35em] text-textMuted"
        >
          Flint / a personal quant desk
        </p>

        {/* The two masked lines are separate block spans, so their text nodes
            butt together and the accessible name came out as "TRADE ONEVIDENCE."
            Name the heading explicitly and hide the split halves from AT. */}
        <h1
          aria-label="Trade on evidence."
          className="max-w-[13ch] text-[clamp(3.25rem,8.5vw,9rem)] font-black leading-[0.95] tracking-tight text-textPrimary"
        >
          <MaskedText as="span" className="block" stagger={0.08} aria-hidden>
            TRADE ON
          </MaskedText>
          <MaskedText
            as="span"
            className="block text-accentGreen"
            delay={0.18}
            stagger={0.08}
            aria-hidden
          >
            EVIDENCE.
          </MaskedText>
        </h1>

        <p
          data-hero-fade
          className="mt-8 max-w-xl text-base leading-relaxed text-textSecondary md:text-lg"
        >
          Systematic signals, currency-denominated risk and sizing by rule, on paper
          capital. The only thing at stake is your discipline.
        </p>

        <div className="mt-12 flex flex-wrap items-center gap-8">
          <div data-hero-fade>
            <Magnetic strength={0.25}>
              <Link
                href="/screener"
                className="group inline-flex items-center gap-2.5 rounded-full bg-accentGreen px-8 py-4 text-sm font-bold text-black transition-colors hover:bg-accentGreen/90"
              >
                Open the desk
                <ArrowRight
                  size={16}
                  className="transition-transform duration-300 group-hover:translate-x-1"
                />
              </Link>
            </Magnetic>
          </div>
          <Link
            data-hero-fade
            href="/movers"
            className="text-sm font-medium text-textSecondary underline decoration-borderSubtle underline-offset-8 transition-colors hover:text-textPrimary hover:decoration-accentGreen/60"
          >
            See today&apos;s movers
          </Link>
        </div>
      </section>

      {/* ========================== VELOCITY MARQUEE ======================== */}
      <section
        aria-label="Flint: evidence, discipline, risk"
        className="border-y border-borderSubtle py-8 md:py-12"
      >
        <VelocityMarquee baseSpeed={70} className="select-none">
          <MarqueeSegment />
        </VelocityMarquee>
      </section>

      {/* ============================= MANIFESTO ============================ */}
      <section className="px-6 py-32 md:px-12 md:py-40 lg:px-20">
        <WordsReveal
          className="max-w-4xl text-2xl font-medium leading-relaxed tracking-tight text-textPrimary md:text-4xl md:leading-relaxed"
          text="Every number here is earned. Sourced, timestamped and sized by evidence. Signals are computed, not felt, risk is stated in currency, and discipline beats conviction on every single trade."
        />
      </section>

      {/* ================= LIVE TICKER TAPE ================= */}
      <section className="relative z-10 border-y border-borderSubtle bg-bgPrimary/60 py-4 backdrop-blur-md">
        <Marquee pauseOnHover className="[--duration:32s] [--gap:0.5rem]">
          {TICKERS_A.map((t) => <TickerChip key={t.symbol} {...t} />)}
        </Marquee>
        <Marquee reverse pauseOnHover className="[--duration:38s] [--gap:0.5rem]">
          {TICKERS_B.map((t) => <TickerChip key={t.symbol} {...t} />)}
        </Marquee>
        {/* edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-bgPrimary to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-bgPrimary to-transparent" />
      </section>

      {/* ============================ CAPABILITIES ========================== */}
      <section className="border-t border-borderSubtle px-6 py-32 md:px-12 md:py-40 lg:px-20">
        <div className="mb-16 md:mb-20">
          <MaskedText
            as="h2"
            className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-textPrimary md:text-6xl"
            stagger={0.05}
          >
            The desk does the arithmetic. You keep the judgment.
          </MaskedText>
        </div>

        <div data-cap-grid className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {CAPABILITIES.map((cap) => (
            <Link
              key={cap.index}
              data-cap-card
              href={cap.href}
              className={`glass-panel group flex flex-col justify-between p-8 transition-[transform,border-color,box-shadow] duration-300 motion-safe:hover:-translate-y-1 md:p-10 ${cap.hover}`}
            >
              <div>
                <div className="mb-8 flex items-baseline justify-between">
                  <span className={`font-mono text-xs ${cap.accent}`}>{cap.index}</span>
                  <ArrowRight
                    size={16}
                    className="text-textMuted transition-[transform,color] duration-300 motion-safe:group-hover:translate-x-1 group-hover:text-textPrimary"
                  />
                </div>
                <CharReveal
                  as="h3"
                  className="text-2xl font-bold tracking-tight text-textPrimary md:text-3xl"
                  stagger={0.02}
                >
                  {cap.title}
                </CharReveal>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-textSecondary">
                  {cap.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* =========================== NUMBERS STRIP ========================== */}
      <section
        data-stats
        className="border-t border-borderSubtle px-6 py-24 md:px-12 md:py-32 lg:px-20"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-14 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} data-stat className="flex flex-col gap-3">
              <span className="font-mono text-5xl font-bold tracking-tight text-textPrimary md:text-6xl">
                <CountStat value={s.value} decimals={s.decimals} suffix={s.suffix} />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.25em] text-textMuted">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ============================= CTA FOOTER =========================== */}
      <section className="border-t border-borderSubtle px-6 pb-12 pt-32 md:px-12 md:pt-40 lg:px-20">
        <MaskedText
          as="h2"
          className="max-w-5xl text-[clamp(2.75rem,7vw,7rem)] font-black leading-[1.02] tracking-tight text-textPrimary"
          stagger={0.07}
        >
          Start with the evidence.
        </MaskedText>

        <div className="mt-12">
          <Magnetic strength={0.25}>
            <Link
              href="/screener"
              className="group inline-flex items-center gap-2.5 rounded-full bg-accentGreen px-9 py-4 text-sm font-bold text-black transition-colors hover:bg-accentGreen/90"
            >
              Open the desk
              <ArrowRight
                size={16}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </Link>
          </Magnetic>
        </div>

        <footer className="mt-32 flex flex-col gap-3 border-t border-borderSubtle pt-8 font-mono text-[11px] text-textMuted md:flex-row md:items-center md:justify-between">
          <span>Flint</span>
          <span>All trading is paper. Signals are educational, not advice.</span>
          <Link href="/movers" className="transition-colors hover:text-textSecondary">
            /movers
          </Link>
        </footer>
      </section>

    </div>
  );
}
