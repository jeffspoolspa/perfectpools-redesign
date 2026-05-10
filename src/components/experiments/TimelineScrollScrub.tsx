/**
 * TimelineScrollScrub — sandbox experiment
 * =========================================
 *
 * EXPERIMENT — not for production. This is a port of
 * `src/components/TimelineScroll.tsx` with one change:
 *
 *   - Original: `scrub: false` + `snap: { ... }` — the section pins,
 *     scroll snaps to card boundaries, transitions are discrete.
 *
 *   - This version: `scrub: 0.4` + no snap — the section pins, scroll
 *     drives index continuously with 0.4s smoothing, no forced snap.
 *     User can linger between cards; activeIndex still flips discretely
 *     via Math.round so cards never end up "mid-slide" visually.
 *
 * The point of this experiment: feel how the timeline navigates with
 * scrub instead of snap. The author of v1 chose snap because they
 * felt scrub was "broken" at the time. With Lenis lerp:0.1 in BaseLayout
 * (instead of duration:1.2), scrub may feel different now.
 *
 * Identical content, identical CSS classes (`.tl-*` are in global.css
 * so they're portable). Only the ScrollTrigger config differs.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { getHeaderOffset } from '../../utils/scroll-config';

interface Phase {
  numeral: string;
  badge: string;
  badgeClass: '' | 'blue' | 'green' | 'orange' | 'teal';
  title: string;
  content: string[];
}

const PHASES: Phase[] = [
  {
    numeral: 'I',
    badge: 'New Beginning',
    badgeClass: '',
    title: 'Formation of PSAC',
    content: [
      'Pool Services Acquisition Co. (PSAC) was founded to bring a higher standard of professionalism, communication, and service quality to the pool services industry.',
      'While the market presented significant growth opportunities, many service companies struggled to deliver consistently excellent customer communication and operational reliability. PSAC was created to combine strong operational systems with technical expertise in order to elevate quality of service and customer experience in the pool service space.',
    ],
  },
  {
    numeral: 'II',
    badge: 'The Foundation',
    badgeClass: 'blue',
    title: "Jeff's Pool & Spa Service",
    content: [
      "PSAC's first major step was partnering with Jeff's Pool & Spa Service (JPS) in the Golden Isles of Georgia and Fernandina Beach Florida. JPS brought 20 years of operational expertise, a highly experienced team, and a culture of deep technical expertise and client service.",
      'JPS was known for something rare in the maintenance world — deep equipment expertise. Pumps, filtration, heaters, automation, lighting, and complex hydraulic systems across both residential and large-scale commercial properties.',
      "JPS became the foundation: a complete care model where the same company that maintains your pool also understands your system end to end, keeps your equipment running, and stands behind their work as one of the few approved warranty service providers.",
    ],
  },
  {
    numeral: 'III',
    badge: 'Perfect Pools',
    badgeClass: 'green',
    title: 'Expanding up the coast',
    content: [
      "PSAC's next partnership came with Perfect Pools, expanding the company's footprint up the Georgia coast to Richmond Hill and Savannah. Erin founded the company ~20 years ago and under her leadership, Perfect Pools built a reputation for meticulous attention to detail and a strong commitment to service quality.",
      'The company specialized in servicing high-end residential pools, commercial properties, property managers, and HOAs while bringing this professional level of service to residential customers.',
      "The partnership combined JPS's technical depth with PP's service culture. Combined under PSAC, both brands were able to serve the entire Georgia Coast under a single standard: complete care, no gaps, no excuses.",
    ],
  },
  {
    numeral: 'IV',
    badge: 'Focused Partnerships',
    badgeClass: 'orange',
    title: 'Pool Solutions Plus',
    content: [
      'While prioritizing getting better before getting bigger, PSAC continues to seek out partners who share our values. After working with Tom, founder of Pool Solutions Plus (PSP), on several large-scale commercial pool renovations, it became clear that we shared the same commitment to quality and craftsmanship.',
      'A partnership was formed that allows each company to focus on what they do best. Pool Solutions Plus continues to concentrate on building exceptional pools, while Perfect Pools focuses on maintaining and servicing them to the highest standards. This alignment strengthens both organizations and ensures customers receive expert care throughout the full lifecycle of their pools.',
    ],
  },
  {
    numeral: 'V',
    badge: 'Savannah Branch',
    badgeClass: 'teal',
    title: 'Opening of the Savannah hub',
    content: [
      "The next stage of growth is the opening of the Perfect Pools Savannah branch, which serves as a centralized operations hub for the region. This location brings together the best practices and operational strengths developed across the company's other branches.",
      'The location is strategically positioned and designed for efficient service across Savannah, Tybee Island, Skidaway Island, Pooler, and Bluffton within roughly a 30-minute service radius. The facility is designed for operational excellence on fleet and inventory management, employee training, and prompt dispatch.',
      'With this footprint in place, PSAC is best positioned to provide the highest level of service across all of our markets.',
    ],
  },
];

export default function TimelineScrollScrub() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const prevIndexRef = useRef(0);
  const stRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionRef.current) return;

    let cleanup = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        const total = PHASES.length;

        // ▼ EXPERIMENTAL CHANGE — was: scrub: false + snap config
        // Now: scrub: 0.4 (smoothed scroll-bound), no snap.
        // activeIndex still flips discretely (Math.round) so cards never
        // mid-transition; the difference is whether scroll position
        // is forced to snap points or stays where the user leaves it.
        const st = ScrollTrigger.create({
          trigger: sectionRef.current!,
          pin: stickyRef.current!,
          start: () => `top top+=${getHeaderOffset()}`,
          end: 'bottom bottom',
          pinSpacing: false,
          scrub: 0.4,
          onUpdate: (self: any) => {
            const idx = Math.min(total - 1, Math.round(self.progress * (total - 1)));
            if (idx !== prevIndexRef.current) {
              prevIndexRef.current = idx;
              setActiveIndex(idx);
            }
          },
        });
        // ▲ END EXPERIMENTAL CHANGE

        stRef.current = st;
        cleanup = () => {
          stRef.current = null;
          st.kill();
        };
      },
    );

    return () => cleanup();
  }, []);

  const goTo = (i: number) => {
    if (i === activeIndex) return;
    const st = stRef.current;
    if (!st || typeof window === 'undefined') return;

    prevIndexRef.current = i;
    setActiveIndex(i);

    const target = st.start + (i / (PHASES.length - 1)) * (st.end - st.start);
    // Use lenis.scrollTo if available so the navigation matches the
    // surrounding smooth-scroll feel.
    const lenis = (window as any).__lenis;
    if (lenis?.scrollTo) {
      lenis.scrollTo(target, { duration: 1.0, lock: false });
    } else {
      window.scrollTo({ top: target, behavior: 'instant' });
    }
  };

  const fillPct = (activeIndex / (PHASES.length - 1)) * 100;

  return (
    <div ref={sectionRef} class="tl-scroll">
      <div class="section-header tl__header tl__header--mobile">
        <span class="section-kicker">EXPERIMENT · scrub 0.4</span>
        <h2>Built by bringing the best together.</h2>
        <p>Five partnerships that shaped how we take care of your pool.</p>
      </div>

      <div ref={stickyRef} class="tl-sticky">
        <div class="section-header tl__header tl__header--desktop">
          <span class="section-kicker">EXPERIMENT · scrub 0.4 (vs v1's snap)</span>
          <h2>Built by bringing the best together.</h2>
          <p>Five partnerships that shaped how we take care of your pool.</p>
        </div>

        <div class="tl-track">
          <div class="tl-track__rail">
            <div
              class="tl-track__rail-fill"
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <div class="tl-track__nodes">
            {PHASES.map((p, i) => (
              <button
                key={i}
                type="button"
                class={`tl-node ${i === activeIndex ? 'is-active' : ''} ${
                  i < activeIndex ? 'is-passed' : ''
                }`}
                aria-label={`Go to ${p.title}`}
                onClick={() => goTo(i)}
              >
                <span class="tl-node__dot" />
              </button>
            ))}
          </div>
        </div>

        <div class="tl-stage">
          <div class="tl-card-wrap">
            {PHASES.map((p, i) => {
              const isActive = i === activeIndex;
              let stateClass = '';
              if (isActive) {
                stateClass = 'is-active';
              } else if (i < activeIndex) {
                stateClass = 'is-off-left';
              } else {
                stateClass = 'is-off-right';
              }
              return (
                <article
                  key={i}
                  class={`tl-card ${stateClass}`}
                  aria-hidden={!isActive}
                >
                  <div class="tl-card__row">
                    <span class="tl-card__numeral">{p.numeral}</span>
                    <span class={`tl-badge tl-badge--${p.badgeClass || 'default'}`}>
                      {p.badge}
                    </span>
                  </div>
                  <h3>{p.title}</h3>
                  {p.content.map((para, j) => (
                    <p key={j}>{para}</p>
                  ))}
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div class="tl__spacer" />
    </div>
  );
}
