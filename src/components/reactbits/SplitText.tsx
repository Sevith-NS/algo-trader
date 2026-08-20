'use client';

import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number; // ms between chars
  duration?: number;
  ease?: string;
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  threshold?: number;
  textAlign?: React.CSSProperties['textAlign'];
  onLetterAnimationComplete?: () => void;
}

export default function SplitText({
  text,
  className = '',
  delay = 40,
  duration = 0.9,
  ease = 'power4.out',
  from = { opacity: 0, y: 60, rotateX: -80 },
  to = { opacity: 1, y: 0, rotateX: 0 },
  threshold = 0.15,
  textAlign = 'center',
  onLetterAnimationComplete,
}: SplitTextProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const el = ref.current;
    if (!el) return;

    const chars = el.querySelectorAll<HTMLElement>('[data-split-char]');

    // Reduced motion: jump straight to the final state — headlines must never
    // fly in per-character for users who asked for less motion.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(chars, { ...to, clearProps: 'all' });
      onLetterAnimationComplete?.();
      return;
    }

    const tween = gsap.fromTo(
      chars,
      { ...from },
      {
        ...to,
        duration,
        ease,
        stagger: delay / 1000,
        scrollTrigger: {
          trigger: el,
          start: `top ${(1 - threshold) * 100}%`,
          once: true,
        },
        onComplete: onLetterAnimationComplete,
      },
    );

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const words = text.split(' ');

  return (
    <span
      ref={ref}
      className={`inline-block overflow-hidden ${className}`}
      style={{ textAlign, perspective: '900px' }}
      aria-label={text}
    >
      {words.map((word, w) => (
        <span key={w} className="inline-block whitespace-nowrap" aria-hidden="true">
          {word.split('').map((char, c) => (
            <span key={c} data-split-char className="inline-block will-change-transform">
              {char}
            </span>
          ))}
          {w < words.length - 1 && <span className="inline-block">&nbsp;</span>}
        </span>
      ))}
    </span>
  );
}
