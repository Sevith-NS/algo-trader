'use client';

import React, { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { prefersReducedMotion } from '../../lib/useReducedMotion';

// useLayoutEffect fires before the browser paints the hydrated frame, so the
// initial hide never flashes; fall back to useEffect during SSR to avoid the
// server warning.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface MaskedTextProps {
  /** One entry per visual line — the caller controls the line breaks. */
  lines: string[];
  /** Class applied to every line's inner span (typography, gradients). */
  className?: string;
  /** Optional per-line class override; falls back to `className`. */
  lineClassNames?: string[];
  stagger?: number;
  duration?: number;
  /** Degrees of settle-in rotation, ochi-style. */
  rotate?: number;
}

/**
 * ochi.design-style text transition: each line sits behind an overflow mask
 * and slides up into place with a slight rotation, staggered line by line.
 *
 * Deliberately driven by IntersectionObserver + a plain GSAP tween (no
 * ScrollTrigger): IO measures against the real viewport, so this keeps
 * working inside locomotive-scroll's transformed container without any
 * scrollerProxy wiring. Honors prefers-reduced-motion by rendering the
 * final state instantly.
 */
export default function MaskedText({
  lines,
  className = '',
  lineClassNames,
  stagger = 0.09,
  duration = 1.1,
  rotate = 4,
}: MaskedTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useIsomorphicLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const inners = el.querySelectorAll<HTMLElement>('[data-masked-line]');
    if (inners.length === 0) return;

    if (prefersReducedMotion()) {
      gsap.set(inners, { yPercent: 0, rotate: 0 });
      return;
    }

    gsap.set(inners, { yPercent: 110, rotate, transformOrigin: 'left top' });

    let tween: gsap.core.Tween | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        observer.disconnect();
        tween = gsap.to(inners, {
          yPercent: 0,
          rotate: 0,
          duration,
          ease: 'power4.out',
          stagger,
        });
      },
      { threshold: 0.2 },
    );
    observer.observe(el);

    return () => {
      observer.disconnect();
      tween?.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.join('\n')]);

  return (
    <span ref={ref} className="inline-block">
      {/* Accessible name lives in real (visually hidden) text — aria-label on
          a generic span is authoring-prohibited and unreliable across SRs. */}
      <span className="sr-only">{lines.join(' ')}</span>
      {lines.map((line, i) => (
        <span key={i} aria-hidden="true" className="block overflow-hidden">
          <span
            data-masked-line
            className={`block will-change-transform ${lineClassNames?.[i] ?? className}`}
          >
            {line}
          </span>
        </span>
      ))}
    </span>
  );
}
