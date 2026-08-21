'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import usePrefersReducedMotion from '../../lib/useReducedMotion';

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

interface WordsRevealProps {
  text: string;
  className?: string;
}

/**
 * Manifesto effect: each word fades 0.15 -> 1 progressively, scrubbed by scroll
 * position as the block transits the viewport. The motion is motivated —
 * reading pace IS the content here, so the scrub paces the sentence.
 *
 * Renders a fully opaque static paragraph under reduced motion.
 */
export default function WordsReveal({ text, className }: WordsRevealProps) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  useIsomorphicLayoutEffect(() => {
    if (reducedMotion || !ref.current) return;
    const targets = ref.current.querySelectorAll<HTMLElement>('[data-reveal-word]');
    if (!targets.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        targets,
        { opacity: 0.15 },
        {
          opacity: 1,
          ease: 'none',
          stagger: 0.5,
          scrollTrigger: {
            trigger: ref.current,
            start: 'top 80%',
            end: 'bottom 45%',
            scrub: true,
          },
        },
      );
    }, ref);

    return () => ctx.revert();
  }, [reducedMotion, text]);

  const words = text.split(/\s+/).filter(Boolean);

  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`}>
          {/* The dimmed "from" state is inline ONLY when motion will run, so a
              reduced-motion reader never gets a permanently faint paragraph. */}
          <span data-reveal-word style={reducedMotion ? undefined : { opacity: 0.15 }}>
            {word}
          </span>
          {i < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </p>
  );
}
