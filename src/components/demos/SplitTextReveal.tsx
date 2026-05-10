/**
 * SplitTextReveal — line-by-line reveal of a heading on scroll-into-view
 *
 * Adapted from `darkroomengineering/satus` →
 *   `components/effects/split-text/index.tsx`
 *
 * Satus uses GSAP's premium SplitText plugin (now free in GSAP 3.13+).
 * We use the same plugin. The behavior:
 *
 *   - Wraps the children in a heading element.
 *   - GSAP SplitText splits the text into lines (each line gets a `mask`
 *     wrapper so the line can clip-reveal upward from below).
 *   - On scroll-into-view, lines animate upward + fade in with stagger.
 *   - Each line uses a power3.out ease over 1s.
 *
 * The "mask" trick: each line is wrapped in a div with `overflow: hidden`,
 * the line itself starts translated 100% downward (off-screen below the
 * mask), then animates to 0%. This produces the clean "type rises out of
 * the floor" effect Apple/Linear/Rivian use on hero headlines.
 */

import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface SplitTextRevealProps {
  children: ComponentChildren;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | 'div';
  /** Animation duration per line, seconds */
  duration?: number;
  /** Stagger between lines, seconds */
  stagger?: number;
  /** Delay before first line, seconds */
  delay?: number;
  /** ScrollTrigger start: when to fire (default 'top 80%') */
  start?: string;
  className?: string;
}

export default function SplitTextReveal({
  children,
  as: Tag = 'h2',
  duration = 0.9,
  stagger = 0.08,
  delay = 0,
  start = 'top 80%',
  className,
}: SplitTextRevealProps) {
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !rootRef.current) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      if (rootRef.current) rootRef.current.style.opacity = '1';
      return;
    }

    let st: any;
    let split: any;
    let cleanup = () => {};

    Promise.all([
      import('gsap'),
      import('gsap/ScrollTrigger'),
      import('gsap/SplitText'),
    ])
      .then(([{ gsap }, { ScrollTrigger }, { SplitText }]) => {
        gsap.registerPlugin(ScrollTrigger, SplitText);

        // Split into lines, with `mask: 'lines'` so each line gets an
        // overflow-hidden wrapper for the type-rises-from-floor effect.
        // Mirrors Satus's `mask: type` setting.
        split = new SplitText(rootRef.current!, {
          type: 'lines',
          mask: 'lines',
          linesClass: 'stReveal__line',
        });

        // Initial state — each line starts pushed down 110% inside its mask
        gsap.set(split.lines, { yPercent: 110, opacity: 1 });
        if (rootRef.current) rootRef.current.style.opacity = '1';

        // Reveal animation
        const tween = gsap.to(split.lines, {
          yPercent: 0,
          duration,
          stagger,
          delay,
          ease: 'power3.out',
        });
        tween.pause();

        st = ScrollTrigger.create({
          trigger: rootRef.current,
          start,
          once: true,
          onEnter: () => tween.play(),
        });

        cleanup = () => {
          st?.kill();
          split?.revert();
        };
      })
      .catch(() => {
        // SplitText is a premium plugin — ensure GSAP version >= 3.13 covers it.
        // If it fails, fail open: just show the text.
        if (rootRef.current) rootRef.current.style.opacity = '1';
      });

    return () => cleanup();
  }, [duration, stagger, delay, start]);

  return (
    // @ts-expect-error — dynamic Tag + ref
    <Tag ref={rootRef} class={className} style={{ opacity: 0 }}>
      {children}
    </Tag>
  );
}
