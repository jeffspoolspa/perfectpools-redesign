/**
 * HorizontalScroll — vertical scroll drives horizontal card movement
 *
 * Inspired by Lenis playground horizontal demo, but the "Apple keynote
 * style" pattern is to keep the page in vertical scroll and convert that
 * scroll into horizontal translation of a row of cards. The Lenis
 * `orientation: 'horizontal'` mode is overkill for one section — we
 * pin a section and translate the inner row with GSAP scrub instead.
 *
 * Pattern: pin the section, the inner row translates left as scroll
 * progresses. Total scroll distance = (row_width - viewport_width).
 *
 * This is the technique used by Apple's iPhone product pages, Rivian's
 * "Built to last" gallery, Stripe's customer logos showcase.
 */

import { useEffect, useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';

interface HorizontalScrollProps {
  /** Children should be a flex row of items. The row will be translated
   *  horizontally as the user scrolls vertically through the section. */
  children: ComponentChildren;
  className?: string;
}

export default function HorizontalScroll({
  children,
  className,
}: HorizontalScrollProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionRef.current) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // Reduced-motion: let the row scroll horizontally natively
      if (rowRef.current) rowRef.current.style.overflowX = 'auto';
      return;
    }

    let st: any;
    let cleanup = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        const row = rowRef.current!;
        const section = sectionRef.current!;
        const sticky = stickyRef.current!;

        // The horizontal travel distance = (row content width) - viewport width
        const getDistance = () => Math.max(0, row.scrollWidth - window.innerWidth);

        st = ScrollTrigger.create({
          trigger: section,
          pin: sticky,
          start: 'top top',
          end: () => `+=${getDistance()}`,
          scrub: 0.6,
          invalidateOnRefresh: true,
          onUpdate: (self: any) => {
            row.style.transform = `translate3d(${-self.progress * getDistance()}px, 0, 0)`;
          },
        });

        cleanup = () => st.kill();
      },
    );

    return () => cleanup();
  }, []);

  return (
    <div ref={sectionRef} class={className}>
      <div
        ref={stickyRef}
        style={{
          height: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          ref={rowRef}
          style={{
            display: 'flex',
            flexShrink: 0,
            willChange: 'transform',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
