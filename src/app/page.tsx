'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { animate, stagger } from 'animejs';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import {
  Crosshair, ShieldAlert, Newspaper, Bot, ArrowRight, LineChart, Globe2, Braces,
  TrendingUp, TrendingDown,
} from 'lucide-react';
import Navigation from '../components/Navigation';
import usePrefersReducedMotion from '../lib/useReducedMotion';

// Magic UI
import { Marquee } from '../components/magicui/Marquee';
<<<<<<< HEAD
import { Meteors } from '../components/magicui/Meteors';
=======
import { BorderBeam } from '../components/magicui/BorderBeam';
import { ShimmerButton } from '../components/magicui/ShimmerButton';
import { Meteors } from '../components/magicui/Meteors';
import { AnimatedGradientText } from '../components/magicui/AnimatedGradientText';

// React Bits
import SplitText from '../components/reactbits/SplitText';
import ShinyText from '../components/reactbits/ShinyText';
import GradientText from '../components/reactbits/GradientText';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import CountUp from '../components/reactbits/CountUp';

// Shared scroll state: ScrollTrigger writes, useFrame reads (no re-renders)
const scrollState = { progress: 0 };
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414

// React Bits
import MaskedText from '../components/reactbits/MaskedText';
import ShinyText from '../components/reactbits/ShinyText';
import GradientText from '../components/reactbits/GradientText';
import SpotlightCard from '../components/reactbits/SpotlightCard';
import CountUp from '../components/reactbits/CountUp';
import Galaxy from '../components/reactbits/Galaxy';
import SplashCursor from '../components/reactbits/SplashCursor';

/* ============================== UI PIECES ================================ */

// framer-motion 3D tilt card
function TiltCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
<<<<<<< HEAD
  // Manual motion values bypass MotionConfig's reducedMotion="user",
  // so the tilt must be gated explicitly.
  const reduced = useReducedMotion();
=======
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 220, damping: 22 });
  const sy = useSpring(my, { stiffness: 220, damping: 22 });
  const rotateY = useTransform(sx, [0, 1], [-7, 7]);
  const rotateX = useTransform(sy, [0, 1], [7, -7]);

  if (reduced) {
    return <div className={`glass-panel relative h-full p-6 ${className}`}>{children}</div>;
  }

  return (
    <motion.div
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', perspective: 900 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onMouseLeave={() => { mx.set(0.5); my.set(0.5); }}
      whileHover={{ scale: 1.02 }}
      className={`glass-panel relative h-full p-6 ${className}`}
    >
      <div style={{ transform: 'translateZ(28px)', transformStyle: 'preserve-3d' }}>
        {children}
      </div>
    </motion.div>
  );
}

// Magic UI Marquee cell — one ticker chip
function TickerChip({ symbol, price, change }: { symbol: string; price: string; change: number }) {
  const up = change >= 0;
  return (
    <div className="mx-2 flex items-center gap-3 rounded-full border border-borderSubtle bg-white/[0.03] px-5 py-2.5 font-mono text-[13px] backdrop-blur-sm">
      <span className="font-bold text-textPrimary">{symbol}</span>
      <span className="tabular text-textSecondary">{price}</span>
      <span className={`flex items-center gap-1 tabular font-semibold ${up ? 'text-accentGreen' : 'text-accentRed'}`}>
        {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
        {up ? '+' : ''}{change.toFixed(2)}%
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

const FEATURES = [
  {
    icon: <Crosshair size={22} className="text-accentGreen" />,
    title: 'Quant Trade Plans',
    desc: 'Five-factor systematic engine — OU mean reversion, momentum, VWAP, order-flow, RSI — voting into executable entry, ATR stop and R-multiple targets with half-Kelly sizing.',
    href: '/screener',
    spotlight: 'rgba(52, 211, 153, 0.16)',
<<<<<<< HEAD
=======
    beamFrom: '#34D399',
    beamTo: '#22D3EE',
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
  },
  {
    icon: <ShieldAlert size={22} className="text-accentRed" />,
    title: 'Institutional Risk',
    desc: '95% VaR & expected shortfall in dollars, Sharpe, Sortino, max drawdown, beta and diversification scoring — recomputed live on your portfolio.',
    href: '/portfolio',
    spotlight: 'rgba(248, 113, 113, 0.14)',
<<<<<<< HEAD
=======
    beamFrom: '#F87171',
    beamTo: '#FBBF24',
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
  },
  {
    icon: <Newspaper size={22} className="text-accentBlue" />,
    title: 'Global News Sentiment',
    desc: 'Headlines across 8 market categories scored with NLP in real time, aggregated into fear/greed mood indices per region and asset class.',
    href: '/news',
    spotlight: 'rgba(96, 165, 250, 0.15)',
<<<<<<< HEAD
=======
    beamFrom: '#60A5FA',
    beamTo: '#22D3EE',
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
  },
  {
    icon: <Bot size={22} className="text-accentPurple" />,
    title: 'AI Copilot',
    desc: 'A portfolio-aware assistant grounded in your live positions, quant signals and news flow. Ask it anything — it cites real numbers, not vibes.',
    href: '/screener',
    spotlight: 'rgba(167, 139, 250, 0.15)',
<<<<<<< HEAD
=======
    beamFrom: '#A78BFA',
    beamTo: '#60A5FA',
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
  },
];

/** Primary CTA — a single focusable Link styled as a button (the previous
 *  <Link><ShimmerButton/></Link> nested a button inside an anchor: invalid
 *  HTML, double tab stops, and a perpetual shimmer besides). */
function PrimaryCta({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 rounded-full bg-accentGreen px-8 py-3.5 text-sm font-bold text-black shadow-glowGreen transition-all hover:brightness-110 active:translate-y-px"
    >
      {children}
    </Link>
  );
}

const STATS = [
  { value: 5, suffix: '', label: 'Alpha factor families' },
  { value: 12, suffix: '+', label: 'Risk & return metrics' },
  { value: 8, suffix: '', label: 'News categories scored' },
  { value: 100, suffix: 'k', label: 'Paper capital to master', prefix: '$' },
];

const WORKFLOW_STEPS = [
  { icon: <LineChart size={16} className="text-accentGreen" />, t: 'Screen', d: 'Multi-factor composite scores every ticker with entry, stop and targets drawn on the chart.' },
  { icon: <Braces size={16} className="text-accentCyan" />, t: 'Size', d: 'Half-Kelly, conviction-scaled position sizing caps your exposure before you click buy.' },
  { icon: <Globe2 size={16} className="text-accentBlue" />, t: 'Context', d: 'Global news mood, ML forecasts and macro geotrade views frame every decision.' },
  { icon: <ShieldAlert size={16} className="text-accentRed" />, t: 'Manage', d: 'Portfolio VaR, drawdown and correlation update as positions move — with an AI to explain it all.' },
];

/* ================================ PAGE =================================== */

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
<<<<<<< HEAD
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const workflowRef = useRef<HTMLDivElement>(null);
  // Hard a11y requirement: under prefers-reduced-motion the SAME galaxy
  // renders as a single frozen frame (no gradient stand-in), smooth scroll
  // stays native, and no scroll tweens are created.
  const reducedMotion = usePrefersReducedMotion();

  // Locomotive smooth scroll (ochi.design-style inertia) + GSAP ScrollTrigger.
  // Locomotive transforms the scroll container, so ScrollTrigger reads scroll
  // position through a scrollerProxy; every trigger is created AFTER the proxy
  // is wired, inside this effect. Depends on reducedMotion so an OS-level
  // toggle mid-session tears the whole rig down (or builds it up) cleanly.
=======
  const workflowRef = useRef<HTMLDivElement>(null);

  // GSAP: scroll rig, hero, feature cascade, CTA
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (reducedMotion) return;

    const scroller = scrollWrapRef.current;
    if (!scroller) return;

    let disposed = false;
    let loco: import('locomotive-scroll').default | null = null;
    let ctx: gsap.Context | null = null;
    let onRefresh: (() => void) | null = null;

    // Hide hero elements SYNCHRONOUSLY, before the async locomotive import —
    // otherwise they paint visible, vanish when the chunk lands, then fade in.
    gsap.set('[data-hero-fade]', { opacity: 0, y: 24 });

    // All tweens in one place so the locomotive path and the native-scroll
    // fallback (import failure) build the identical experience.
    const buildTweens = () => gsap.context(() => {
      // Hero secondary elements (headline is handled by MaskedText)
      gsap.to('[data-hero-fade]', {
        y: 0, opacity: 1, duration: 0.9, stagger: 0.12, delay: 0.4, ease: 'power3.out',
      });

<<<<<<< HEAD
      // Dim the galaxy as content takes over
=======
      // Hero secondary elements (headlines are handled by SplitText)
      gsap.from('[data-hero-fade]', {
        y: 24, opacity: 0, duration: 0.9, stagger: 0.12, delay: 0.7, ease: 'power3.out',
      });

      // Dim the 3D scene as content takes over
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
      gsap.to(canvasWrapRef.current, {
        opacity: 0.28,
        scrollTrigger: { trigger: '[data-features]', start: 'top 85%', end: 'top 30%', scrub: true },
      });

      // Feature cards cascade in
      gsap.from('[data-feature-card]', {
        y: 70, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out',
        scrollTrigger: { trigger: '[data-features]', start: 'top 78%' },
      });

      // CTA reveal
      gsap.from('[data-cta]', {
        scale: 0.92, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: '[data-cta]', start: 'top 85%' },
      });
    }, scroller);

    (async () => {
      try {
        const LocomotiveScroll = (await import('locomotive-scroll')).default;
        if (disposed) return;

        // Locomotive's constructor resets native scroll to 0 — remember where
        // the user already scrolled to during load and restore it after init.
        const preInitY = window.scrollY;

        loco = new LocomotiveScroll({
          el: scroller,
          smooth: true,
          lerp: 0.09,
          // wheel must work over the fixed nav too, which lives OUTSIDE the
          // scroll container — listen on document, not the container
          scrollFromAnywhere: true,
          // native scroll on touch devices — smooth-faking there feels broken
          smartphone: { smooth: false },
          tablet: { smooth: false },
        });

        loco.on('scroll', (args: any) => {
          ScrollTrigger.update();
          // Bridge for the fixed nav: window.scrollY stays 0 under locomotive,
          // so Navigation listens for this to toggle its scrolled backdrop.
          window.dispatchEvent(new CustomEvent('app:scroll', {
            detail: { y: args?.scroll?.y ?? 0 },
          }));
        });
        ScrollTrigger.scrollerProxy(scroller, {
          scrollTop(value?: number) {
            if (arguments.length && loco) {
              loco.scrollTo(value as number, { duration: 0, disableLerp: true });
              return;
            }
            return loco ? loco.scroll.instance.scroll.y : 0;
          },
          getBoundingClientRect() {
            return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
          },
          pinType: 'transform',
        });
        ScrollTrigger.defaults({ scroller });

        ctx = buildTweens();

        // keep locomotive's internal limits in sync with layout changes
        onRefresh = () => loco?.update();
        ScrollTrigger.addEventListener('refresh', onRefresh);
        ScrollTrigger.refresh();

        if (preInitY > 0) loco.scrollTo(preInitY, { duration: 0, disableLerp: true });
      } catch {
        // Chunk failed to load (offline, flaky network): degrade to native
        // scroll with the same tweens instead of leaving hero content hidden.
        if (!disposed) ctx = buildTweens();
      }
    })();

    return () => {
      disposed = true;
      ctx?.revert();
      if (onRefresh) ScrollTrigger.removeEventListener('refresh', onRefresh);
      loco?.destroy();
      ScrollTrigger.defaults({ scroller: window });
      // the initial gsap.set lives outside ctx — never leave the hero hidden
      gsap.set('[data-hero-fade]', { clearProps: 'opacity,transform' });
    };
  }, [reducedMotion]);

  // anime.js: workflow steps cascade + icon pop when the section scrolls into view
  useEffect(() => {
    const el = workflowRef.current;
    if (!el) return;

    // Reduced motion: bail BEFORE hiding the steps — gating only the animate()
    // calls would leave the section permanently invisible. Reactive value (not
    // the imperative check) so an OS-level flip mid-session re-runs the effect
    // and stops anime, which drives inline styles the CSS kill-switch can't
    // touch.
    if (reducedMotion) return;

    const steps = el.querySelectorAll<HTMLElement>('[data-workflow-step]');
    steps.forEach((s) => { s.style.opacity = '0'; });

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();

        animate(steps, {
          opacity: [0, 1],
          translateX: [-42, 0],
          filter: ['blur(6px)', 'blur(0px)'],
          delay: stagger(150),
          duration: 850,
          ease: 'outExpo',
        });
        animate(el.querySelectorAll('[data-workflow-icon]'), {
          scale: [0, 1],
          rotate: ['-90deg', '0deg'],
          delay: stagger(150, { start: 120 }),
          duration: 700,
          ease: 'outBack(2.2)',
        });
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      // A reduced-motion flip mid-session tears this effect down — clear the
      // inline opacity so steps hidden pre-animation aren't left invisible.
      steps.forEach((s) => { s.style.opacity = ''; });
    };
  }, [reducedMotion]);

  // anime.js: workflow steps cascade + icon pop when the section scrolls into view
  useEffect(() => {
    const el = workflowRef.current;
    if (!el) return;

    const steps = el.querySelectorAll<HTMLElement>('[data-workflow-step]');
    steps.forEach((s) => { s.style.opacity = '0'; });

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();

        animate(steps, {
          opacity: [0, 1],
          translateX: [-42, 0],
          filter: ['blur(6px)', 'blur(0px)'],
          delay: stagger(150),
          duration: 850,
          ease: 'outExpo',
        });
        animate(el.querySelectorAll('[data-workflow-icon]'), {
          scale: [0, 1],
          rotate: ['-90deg', '0deg'],
          delay: stagger(150, { start: 120 }),
          duration: 700,
          ease: 'outBack(2.2)',
        });
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="relative">
      {/* Fixed elements live OUTSIDE the locomotive container — position:fixed
          breaks inside a transformed ancestor. */}
      <Navigation />

      {/* Fixed galaxy backdrop — one static frame under prefers-reduced-motion.
          The wrapper paints bgPrimary + a faint green radial glow itself so a
          lost WebGL context (or no WebGL) still looks composed, not black. */}
      <div
        ref={canvasWrapRef}
        className="fixed inset-0 z-0 bg-bgPrimary"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 55% at 50% 38%, rgba(52, 211, 153, 0.05), transparent 70%)',
        }}
      >
        {/* <Galaxy
          animated={!reducedMotion}
          mouseInteraction={!reducedMotion}
          mouseRepulsion={!reducedMotion}
          repulsionStrength={2}
          glowIntensity={0.3}
          twinkleIntensity={0.3}
          rotationSpeed={0.1}
          density={1.2}
          saturation={0.15}
          hueShift={150}
          transparent={false}
        /> */}
        {/* Vignette toward bgPrimary at the edges keeps hero type legible
            over the brightest stars. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 42%, rgba(7, 9, 15, 0.82) 100%)',
          }}
        />
      </div>

      {/* ReactBits SplashCursor — rainbow fluid trail above the landing content
          (z-30) but below the fixed nav (z-50). DYE_RESOLUTION lowered to 1024
          since this page already runs the Galaxy WebGL context. */}
      {!reducedMotion && <SplashCursor RAINBOW_MODE DYE_RESOLUTION={1024} />}

      {/* Locomotive smooth-scroll container */}
      <div ref={scrollWrapRef} data-scroll-container className="relative">

      {/* ======================= HERO ======================= */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div data-hero-fade className="mb-6">
<<<<<<< HEAD
          {/* Static badge — the animated gradient ring ("running border") is gone */}
          <div className="mx-auto flex max-w-fit items-center gap-2 rounded-full border border-borderSubtle bg-white/[0.04] px-4 py-1.5 backdrop-blur-sm">
            <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accentGreen" />
            <GradientText className="text-xs font-semibold uppercase tracking-[0.3em]" animationSpeed={6}>
              Vanguard OS · Quant Terminal
            </GradientText>
          </div>
        </div>

        <h1 className="text-5xl font-black leading-[1.08] tracking-tight sm:text-7xl">
          {/* ochi.design-style masked line reveal */}
          <MaskedText
            lines={['Trade with', 'machine precision.']}
            lineClassNames={[
              'text-gradient pb-1',
              'bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent pb-2',
            ]}
=======
          <AnimatedGradientText>
            <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accentGreen" />
            <GradientText className="text-xs font-semibold uppercase tracking-[0.3em]" animationSpeed={6}>
              Vanguard OS · Quant Terminal
            </GradientText>
            <ChevronRight size={14} className="ml-1 text-textMuted transition-transform duration-300 group-hover:translate-x-0.5" />
          </AnimatedGradientText>
        </div>

        <h1 className="text-5xl font-black leading-[1.08] tracking-tight sm:text-7xl">
          <SplitText text="Trade with" className="text-gradient" delay={35} />
          <br />
          <SplitText
            text="machine precision."
            className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-blue-400 bg-clip-text text-transparent"
            delay={35}
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
          />
        </h1>

        <p data-hero-fade className="mt-6 max-w-2xl text-base leading-relaxed text-textSecondary sm:text-lg">
          Systematic entries and stops, institutional risk analytics, global news
          sentiment and an AI copilot — fused into one screener and portfolio manager.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <div data-hero-fade>
<<<<<<< HEAD
            <PrimaryCta href="/screener">
              Launch Terminal
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </PrimaryCta>
=======
            <Link href="/screener">
              <ShimmerButton
                shimmerColor="#34D399"
                background="linear-gradient(110deg, #064E3B 0%, #07090F 45%, #083344 100%)"
                className="px-8 py-3.5 shadow-glowGreen"
              >
                <span className="flex items-center gap-2 text-sm font-bold text-white">
                  Launch Terminal
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </span>
              </ShimmerButton>
            </Link>
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
          </div>
          <Link
            data-hero-fade
            href="/portfolio"
            className="rounded-full border border-borderSubtle bg-white/[0.04] px-7 py-3.5 text-sm font-semibold text-textPrimary backdrop-blur-md transition-colors hover:border-accentGreen/40"
          >
            View Portfolio
          </Link>
        </div>

        <div data-hero-fade className="absolute bottom-8 flex flex-col items-center gap-2 text-textMuted">
          <ShinyText text="SCROLL" speed={3} className="text-[10px] uppercase tracking-[0.3em]" />
          <div className="h-9 w-[1px] animate-pulse-soft bg-gradient-to-b from-accentGreen to-transparent" />
        </div>
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

      {/* ===================== FEATURES ===================== */}
      <section data-features className="relative z-10 mx-auto max-w-7xl px-6 py-28">
        <div className="mb-14 text-center">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accentBlue">The stack</p>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
<<<<<<< HEAD
            <MaskedText lines={['A hedge-fund desk, distilled.']} className="text-gradient pb-1" />
=======
            <SplitText text="A hedge-fund desk, distilled." className="text-gradient" delay={22} />
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div data-feature-card key={f.title}>
              <Link href={f.href} className="block h-full">
                <SpotlightCard className="h-full p-6 hover-lift" spotlightColor={f.spotlight}>
<<<<<<< HEAD
=======
                  <BorderBeam size={140} duration={10} delay={i * 2.5} colorFrom={f.beamFrom} colorTo={f.beamTo} />
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-borderSubtle bg-white/[0.04]">
                    {f.icon}
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-textPrimary">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-textSecondary">{f.desc}</p>
                  <div className="mt-5 flex items-center gap-1.5 text-xs font-semibold text-accentGreen">
                    Explore <ArrowRight size={12} />
                  </div>
                </SpotlightCard>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ======================= STATS ====================== */}
      <section className="relative z-10 border-y border-borderSubtle bg-bgSecondary/60 backdrop-blur-xl">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-6 py-16 text-center md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <div className="text-4xl font-black text-textPrimary sm:text-5xl">
                <CountUp to={s.value} duration={1.6} prefix={s.prefix ?? ''} suffix={s.suffix} />
              </div>
              <div className="mt-2 text-xs uppercase tracking-wider text-textMuted">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== WORKFLOW ===================== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-28">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-2">
          <div ref={workflowRef}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accentPurple">Workflow</p>
            <h2 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">
              <GradientText animationSpeed={10} colors={['#F1F5F9', '#A78BFA', '#60A5FA', '#F1F5F9']}>
                Signal → Size → Execute → Manage risk.
              </GradientText>
            </h2>
            <div className="space-y-5">
              {WORKFLOW_STEPS.map((s) => (
                <div key={s.t} data-workflow-step className="flex gap-4 will-change-transform">
                  <div data-workflow-icon className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-borderSubtle bg-white/[0.04]">
                    {s.icon}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-textPrimary">{s.t}</div>
                    <div className="mt-0.5 text-sm leading-relaxed text-textSecondary">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <TiltCard className="overflow-hidden">
<<<<<<< HEAD
=======
            <BorderBeam size={180} duration={12} colorFrom="#F87171" colorTo="#A78BFA" />
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
            <div className="space-y-3 font-mono text-[13px]">
              <div className="flex items-center justify-between border-b border-borderSubtle pb-3">
                <span className="font-bold text-textPrimary">AAPL · Quant Plan</span>
                <span className="rounded bg-red-400/10 px-2 py-0.5 text-[11px] font-bold text-accentRed">SELL −0.34</span>
              </div>
              {[
                ['Entry (limit)', '$308.63', 'text-accentBlue'],
                ['Stop loss', '$324.35', 'text-accentRed'],
                ['Target 1 · 1.5R', '$285.04', 'text-accentGreen'],
                ['Target 2 · 3R', '$261.46', 'text-accentGreen'],
                ['Kelly allocation', '3.8% of equity', 'text-accentCyan'],
                ['Win rate (1y)', '52.8%', 'text-textPrimary'],
              ].map(([k, v, c]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <span className="text-textMuted">{k}</span>
                  <span className={`tabular font-semibold ${c}`}>{v}</span>
                </div>
              ))}
              <p className="pt-2 text-[10px] text-textMuted">Live output from the signal engine · educational, not advice</p>
            </div>
          </TiltCard>
        </div>
      </section>

      {/* ======================== CTA ======================= */}
      <section className="relative z-10 px-6 pb-32 pt-10">
        <div
          data-cta
          className="glass-panel relative mx-auto flex max-w-4xl flex-col items-center gap-6 overflow-hidden rounded-3xl p-14 text-center"
        >
          <Meteors number={24} />
<<<<<<< HEAD
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            <MaskedText lines={['Your desk is ready.']} className="text-gradient pb-1" />
=======
          <BorderBeam size={220} duration={14} colorFrom="#34D399" colorTo="#60A5FA" />
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            <SplitText text="Your desk is ready." className="text-gradient" delay={30} />
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
          </h2>
          <p className="max-w-xl text-textSecondary">
            <ShinyText
              text="$100k in paper capital, a full quant stack, and an AI that knows your book. No risk. All signal."
              speed={6}
            />
          </p>
<<<<<<< HEAD
          <div className="mt-2">
            <PrimaryCta href="/screener">
              Open Vanguard OS
              <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            </PrimaryCta>
          </div>
=======
          <Link href="/screener" className="mt-2">
            <ShimmerButton
              shimmerColor="#22D3EE"
              background="linear-gradient(110deg, #064E3B 0%, #07090F 45%, #083344 100%)"
              className="px-9 py-4 shadow-glowGreen"
            >
              <span className="flex items-center gap-2 text-sm font-bold text-white">
                Open Vanguard OS
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </span>
            </ShimmerButton>
          </Link>
>>>>>>> 214d63153a65dc7bb46388fe816048e7fe4cc414
        </div>
      </section>

      </div>{/* /data-scroll-container */}
    </div>
  );
}
