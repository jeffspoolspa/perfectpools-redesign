/**
 * Marquee — horizontal infinite-scrolling row, scroll-velocity-aware
 *
 * Adapted from `darkroomengineering/satus` →
 *   `components/ui/marquee/index.tsx`
 *   `components/ui/marquee/marquee.module.css`
 *
 * Satus's implementation uses tempus + hamo + lenis + react. We adapt
 * to vanilla Preact + our existing GSAP/Lenis stack. Behavior matches
 * exactly:
 *
 *   - The children are duplicated `repeat` times in a row
 *   - On every animation frame, all duplicates translate left by
 *     `deltaTime * speed * 0.1 * velocityMultiplier` pixels
 *   - When a duplicate has translated past one full child-width, the
 *     transform wraps modulo so the row appears infinite
 *   - When the page is scrolling fast (Lenis velocity > 0), the marquee
 *     speeds up proportionally — `1 + Math.abs(velocity / 5)`
 *   - When the user hovers (and pauseOnHover is true), the row freezes
 *
 * The visual effect: a row of cards/logos/text scrolling sideways forever,
 * subtly accelerating when you scroll fast — a Studio Freight signature.
 */

import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface MarqueeProps {
  children: ComponentChildren;
  /** How many times to duplicate the children. 4 is enough on desktop. */
  repeat?: number;
  /** Base speed multiplier */
  speed?: number;
  /** Scroll-velocity influences marquee speed when true (default true) */
  scrollVelocity?: boolean;
  /** Reverse the direction */
  reversed?: boolean;
  /** Pause when the cursor hovers the marquee */
  pauseOnHover?: boolean;
  className?: string;
}

const modulo = (n: number, m: number) => ((n % m) + m) % m;

export default function Marquee({
  children,
  repeat = 4,
  speed = 1,
  scrollVelocity = true,
  reversed = false,
  pauseOnHover = false,
  className,
}: MarqueeProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const innersRef = useRef<HTMLDivElement[]>([]);
  const transformRef = useRef(0);
  const isHoveredRef = useRef(false);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return; // No motion at all

    let lastTime = performance.now();
    let rafId = 0;

    // Try to read Lenis velocity from the global instance set by BaseLayout
    const getVelocity = (): number => {
      if (typeof window === 'undefined') return 0;
      const lenis = (window as any).__lenis;
      return lenis?.velocity ?? 0;
    };

    // Visibility observer — pause the marquee when off-screen for perf
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) isVisibleRef.current = e.isIntersecting;
      },
      { threshold: 0 },
    );
    if (sectionRef.current) io.observe(sectionRef.current);

    const tick = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      if (
        isVisibleRef.current &&
        !(pauseOnHover && isHoveredRef.current) &&
        innersRef.current[0]
      ) {
        const firstWidth = innersRef.current[0].getBoundingClientRect().width;
        if (firstWidth > 0) {
          let velocity = scrollVelocity ? getVelocity() : 0;
          velocity = 1 + Math.abs(velocity / 5);

          const offset = deltaTime * (speed * 0.1 * velocity);
          transformRef.current += reversed ? -offset : offset;
          transformRef.current = modulo(transformRef.current, firstWidth);

          for (const node of innersRef.current) {
            node.style.transform = `translate3d(${-transformRef.current}px, 0, 0)`;
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      io.disconnect();
    };
  }, [speed, scrollVelocity, reversed, pauseOnHover]);

  const onMouseEnter = () => {
    isHoveredRef.current = true;
  };
  const onMouseLeave = () => {
    isHoveredRef.current = false;
  };

  return (
    <section
      ref={sectionRef}
      class={className}
      aria-live="off"
      aria-label="Scrolling content"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'flex',
        overflowX: 'clip',
      }}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={`marquee-${i}`}
          ref={(node: HTMLDivElement | null) => {
            if (node) innersRef.current[i] = node;
          }}
          aria-hidden={i !== 0}
          style={{
            display: 'flex',
            whiteSpace: 'nowrap',
            transform: 'translate3d(0,0,0)',
            flexShrink: 0,
          }}
        >
          {children}
        </div>
      ))}
    </section>
  );
}
