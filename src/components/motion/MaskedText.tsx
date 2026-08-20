'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import usePrefersReducedMotion from '../../lib/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface MaskedTextProps {
  children: string;
  as?: 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
  delay?: number;
  stagger?: number;
  className?: string;
  /**
   * Set when a parent supplies the accessible name (e.g. a heading split into
   * several MaskedText lines, whose text nodes would otherwise run together).
   */
  'aria-hidden'?: boolean;
}

/**
 * Headline reveal: words wrapped in overflow-hidden masks, inner spans slide up
 * from translateY(110%) with a stagger.
 *
 * Fail-visible by design: the hidden "from" state is applied only inside the
 * animation effect (pre-paint), never in markup. If JS fails, the trigger never
 * fires, or reduced motion is on, the text simply renders. Elements already in
 * view animate on mount; below-the-fold instances wait for scroll.
 */
export default function MaskedText({
  children,
  as: Tag = 'h2',
  delay = 0,
  stagger = 0.06,
  className,
  'aria-hidden': ariaHidden,
}: MaskedTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion || !ref.current) return;
    const el = ref.current;
    const targets = el.querySelectorAll<HTMLElement>('[data-masked-word]');
    if (!targets.length) return;

    const ctx = gsap.context(() => {
      const vars = {
        yPercent: 0,
        duration: 1,
        ease: 'power4.out' as const,
        delay,
        stagger,
      };
      const inView = el.getBoundingClientRect().top < window.innerHeight * 0.88;
      if (inView) {
        gsap.fromTo(targets, { yPercent: 110 }, vars);
      } else {
        gsap.fromTo(targets, { yPercent: 110 }, {
          ...vars,
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        });
      }
    }, ref);

    return () => ctx.revert();
  }, [reducedMotion, delay, stagger, children]);

  const words = children.split(/\s+/).filter(Boolean);

  return (
    <Tag ref={ref as React.Ref<never>} className={className} aria-hidden={ariaHidden}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`}>
          <span className="inline-block overflow-hidden align-bottom">
            <span data-masked-word className="inline-block will-change-transform">
              {word}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
