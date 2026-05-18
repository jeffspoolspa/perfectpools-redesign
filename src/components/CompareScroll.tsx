import { useEffect, useRef, useState } from 'preact/hooks';
import { buildCardStackTimeline } from '../utils/card-stack-timeline';
import { getHeaderOffset } from '../utils/scroll-config';
import { assetPath } from '../utils/base-url';

const SIDES = [
  {
    id: 'industry',
    label: 'The Industry Standard',
    title: 'Chaos & Reaction',
    labelClass: '',
    titleClass: '',
    image: '/images/compare-pool-neglected.png',
    imageAlt: 'A neglected pool with green, algae-filled water',
    points: [
      { icon: 'bad', title: 'Reactive Treatment', desc: 'Chemicals dumped only after algae blooms or equipment fails. Constant catch-up.', bar: 'chaotic' },
      { icon: 'bad', title: 'Inconsistent Visits', desc: 'No proof of service duration or specific tasks completed. The "splash and dash".', bar: 'gaps' },
      { icon: 'bad', title: 'Hidden Chemical Costs', desc: 'Opaque billing with sudden spikes for shock treatments and algaecides.', bar: null },
    ],
  },
  {
    id: 'ours',
    label: 'Our Systematic Approach',
    title: 'Structure & Perfection',
    labelClass: 'compare-label--accent',
    titleClass: 'compare-title--dark',
    image: '/images/compare-pool-perfect.png',
    imageAlt: 'A perfectly maintained pool with clear blue water',
    points: [
      { icon: 'good', title: 'Proactive Asset Management', desc: 'Micro-adjustments made weekly based on precise baseline testing. Zero algae, ever.', bar: 'solid' },
      { icon: 'good', title: 'Timestamped Verification', desc: 'Digital logs of exact arrival times, chemical dosing, and photographic evidence.', bar: 'consistent' },
      { icon: 'good', title: 'Transparent Chemical Dosing', desc: 'Flat-rate predictability. We absorb the fluctuations of chemical markets, not you.', bar: null },
    ],
  },
];

function BarVisual({ type }: { type: string | null }) {
  if (!type) return null;
  if (type === 'chaotic') return <div className="compare-bar compare-bar--chaotic"><span style="left: 0; width: 33%;" /><span style="left: 50%; width: 25%;" /></div>;
  if (type === 'gaps') return <div className="compare-bar compare-bar--gaps"><span /><span className="empty" /><span /><span /><span className="empty" /></div>;
  if (type === 'solid') return <div className="compare-bar compare-bar--solid" />;
  if (type === 'consistent') return <div className="compare-bar compare-bar--consistent"><span /><span /><span /><span /><span /></div>;
  return null;
}

function IconBadge({ type }: { type: string }) {
  if (type === 'bad') return <div className="compare-icon compare-icon--bad"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></div>;
  return <div className="compare-icon compare-icon--good"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>;
}

export default function CompareScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  // Tracks which side's card is currently in view so the right-column
  // photo can crossfade in lockstep with the card flip.
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIndexRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    let trigger: any;
    let tl: any;

    import('gsap').then(({ gsap }) => {
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);

        tl = buildCardStackTimeline(gsap, cards, {
          enterStyle: 'slide-left',
          exitStyle: 'fade-out-left',
          // Match the easing used by the other 4 card stacks (Problem/Timeline/
          // Pillars/Visit) so the whole "our approach" sequence feels uniform.
          enterEase: 'power2.out',
          exitEase: 'power1.in',
          holdDuration: 0.8,
          crossfadeDuration: 1,
        });

        const stickyEl = container.querySelector('.cs__sticky') as HTMLElement;
        trigger = ScrollTrigger.create({
          // Trigger off the STICKY element (not the container) so pin
          // engages when the sticky's top reaches the centered offset —
          // not when the container's top does. The desktop section
          // header scrolls naturally ABOVE the sticky.
          trigger: stickyEl,
          // Pin start offset: center the sticky vertically in the
          // ABSOLUTE viewport, with just the visible site header
          // (not the phantom topbar that's reserved in CSS but not
          // rendered) as a minimum top floor.
          //
          // `top top+=N` means pin engages when sticky.top reaches
          // viewport.top + N. ScrollTrigger captures that N and
          // keeps sticky.top = N for the pin range.
          //
          // Setting N = (vh - sh) / 2 makes sticky.center = vh/2.
          // The headerH + 16px floor keeps the sticky from going
          // under the actual rendered site header.
          start: () => {
            const vh = window.innerHeight;
            const sh = stickyEl.offsetHeight;
            const headerH =
              document.querySelector<HTMLElement>('.site-header')
                ?.offsetHeight ?? 64;
            const centeredTop = (vh - sh) / 2;
            return `top top+=${Math.max(headerH + 16, centeredTop)}`;
          },
          // Use the container as the END trigger so the pin range
          // still spans the full section (sticky + spacer).
          endTrigger: container,
          end: 'bottom bottom',
          pin: stickyEl,
          pinSpacing: false,
          // anticipatePin: 1 — pre-fixes the sticky just before the
          // pin range so Lenis's smoothed scroll doesn't catch a frame
          // of stall when ScrollTrigger first computes position:fixed.
          anticipatePin: 1,
          scrub: 1,
          // fastScrollEnd: true — on direction change or sudden stop,
          // snap to the current scroll position instead of winding
          // back through the scrub buffer.
          fastScrollEnd: true,
          animation: tl,
          onUpdate: (self: any) => {
            // Split the section's scroll range evenly between the two
            // sides — first half = "industry", second half = "ours".
            // The image crossfade is then driven by CSS opacity tied
            // to .is-active, syncing with the card-stack flip.
            const idx = Math.min(
              SIDES.length - 1,
              Math.floor(self.progress * SIDES.length),
            );
            if (idx !== lastIndexRef.current) {
              lastIndexRef.current = idx;
              setActiveIndex(idx);
            }
          },
        });
      });
    });

    return () => {
      trigger?.kill();
      tl?.kill();
    };
  }, []);

  return (
    <div className="cs" ref={containerRef}>
      {/* Mobile: header scrolls naturally */}
      <div className="section-header cs__header cs__header--mobile">
        <h2>What sets us apart</h2>
        <p>The difference between the industry standard and our systematic approach.</p>
      </div>

      <div className="cs__sticky">
        {/* Desktop header pinned with the rest of the sticky content
            so it stays visible throughout the comparison — sticky's
            total height (header + layout) is what gets centered in
            the viewport via the JS pin offset. */}
        <div className="section-header cs__header cs__header--desktop">
          <h2>What sets us apart</h2>
          <p>The difference between the industry standard and our systematic approach.</p>
        </div>

        {/* Two-column desktop layout: card stack on the left, pool
            photo stack on the right. On mobile the layout stacks
            vertically with the photo above the card. */}
        <div className="cs__layout">
          <div className="cs__card-stack">
            {SIDES.map((side, i) => (
              <div
                className="compare-card cs__card"
                key={side.id}
                // Both cards stack in the same grid cell (cs__card-stack
                // is a 1-column grid). Initial opacity for SSR / pre-JS:
                // first card visible, second hidden. The card-stack
                // timeline animates opacity from there.
                style={{ opacity: i === 0 ? 1 : 0 }}
                ref={(el) => { cardsRef.current[i] = el; }}
              >
                <div className="compare-side__header">
                  <span className={`compare-label ${side.labelClass}`}>{side.label}</span>
                  <h3 className={`compare-title ${side.titleClass}`}>{side.title}</h3>
                </div>
                <div className="compare-points">
                  {side.points.map((pt) => (
                    <div className="compare-point" key={pt.title}>
                      <IconBadge type={pt.icon} />
                      <div>
                        <h4 className="compare-point__title">{pt.title}</h4>
                        <p className="compare-point__desc">{pt.desc}</p>
                        <BarVisual type={pt.bar} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Pool photo stack — both images live in the same grid cell
              and crossfade via CSS opacity when activeIndex changes. */}
          <div className="cs__media">
            {SIDES.map((side, i) => (
              <img
                key={side.id}
                src={assetPath(side.image)}
                alt={side.imageAlt}
                className={`cs__media-img ${activeIndex === i ? 'is-active' : ''}`}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      </div>

      <div className="cs__spacer" />
    </div>
  );
}
