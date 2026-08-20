'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import usePrefersReducedMotion from '../../lib/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface CharRevealProps {
  children: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
  delay?: number;
  stagger?: number;
  className?: string;
}

/**
 * Per-character staggered entrance for short display words.
 *
 * Same fail-visible contract as MaskedText. The split characters are marked
 * aria-hidden and the real string is exposed via aria-label, so a screen reader
 * reads one word instead of spelling it out.
 */
export default function CharReveal({
  children,
  as: Tag = 'span',
  delay = 0,
  stagger = 0.035,
  className,
}: CharRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion || !ref.current) return;
    const el = ref.current;
    const targets = el.querySelectorAll<HTMLElement>('[data-reveal-char]');
    if (!targets.length) return;

    const ctx = gsap.context(() => {
      const vars = {
        yPercent: 0,
        duration: 0.8,
        ease: 'power4.out' as const,
        delay,
        stagger,
      };
      const inView = el.getBoundingClientRect().top < window.innerHeight * 0.9;
      if (inView) {
        gsap.fromTo(targets, { yPercent: 110 }, vars);
      } else {
        gsap.fromTo(targets, { yPercent: 110 }, {
          ...vars,
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        });
      }
    }, ref);

    return () => ctx.revert();
  }, [reducedMotion, delay, stagger, children]);

  const chars = Array.from(children);

  return (
    <Tag ref={ref as React.Ref<never>} className={className} aria-label={children}>
      {chars.map((char, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden align-bottom">
          <span data-reveal-char className="inline-block will-change-transform">
            {char === ' ' ? ' ' : char}
          </span>
        </span>
      ))}
    </Tag>
  );
}
