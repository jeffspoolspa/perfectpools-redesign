/**
 * PinnedMediaScroll — sandbox experiment
 * =======================================
 *
 * Rivian-style "picture pinned, text scrolls" pattern.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────┐
 *   │            (sticky container)               │
 *   │  ┌─────────────┐  ┌──────────────────────┐  │
 *   │  │             │  │                      │  │
 *   │  │  Text step  │  │   Pinned media       │  │
 *   │  │  (active)   │  │   (active fades in,  │  │
 *   │  │             │  │    others fade out)  │  │
 *   │  └─────────────┘  └──────────────────────┘  │
 *   └─────────────────────────────────────────────┘
 *
 * Mechanism:
 *   1. ScrollTrigger pins the two-column container to the viewport.
 *   2. The pin lasts for `STEPS.length * 100vh` of scroll distance.
 *   3. As scroll progresses, an `activeStep` is computed via Math.floor.
 *   4. The active step's text gets `opacity: 1`; others fade to 0.
 *   5. The active step's media gets `opacity: 1`; others fade to 0.
 *   6. CSS transitions handle the crossfade (700ms ease-out).
 *
 * Why this isn't TimelineScroll:
 *   - TimelineScroll has cards that slide horizontally in/out of a
 *     SINGLE stage column.
 *   - PinnedMediaScroll has TWO columns: text changes on the left,
 *     media changes on the right. Both crossfade in place rather than
 *     sliding. Different visual grammar — Rivian uses this for product
 *     features (each feature gets its own image + description).
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { getHeaderOffset } from '../../utils/scroll-config';

interface Step {
  /** Two-digit step number, e.g. "01" */
  num: string;
  /** Eyebrow / category label */
  eyebrow: string;
  /** Main heading for this step */
  heading: string;
  /** Body description */
  body: string;
  /** Image src (relative to public/) */
  imageSrc: string;
  /** Image alt text */
  imageAlt: string;
}

const STEPS: Step[] = [
  {
    num: '01',
    eyebrow: 'Step one',
    heading: 'Water testing & visual inspection',
    body:
      'We test six chemical vectors using digital photometers — not cheap test strips. Clarity, surface debris, tile-line buildup, and structural integrity, all assessed before any intervention. The baseline drives every decision for the rest of the visit.',
    imageSrc: '/images/hero-residential-pool.webp',
    imageAlt: 'A pristine residential pool — the baseline before service.',
  },
  {
    num: '02',
    eyebrow: 'Step two',
    heading: 'Mechanical & hydraulic audit',
    body:
      'Inspecting O-rings, pump baskets, and filter pressure to catch minor wear before it becomes a major repair. Verifying optimal flow dynamics, checking skimmer weirs, cleaning pump strainer baskets — everything running at peak efficiency.',
    imageSrc: '/images/pool-cleaning-action.jpg',
    imageAlt: 'A technician auditing pool equipment in motion.',
  },
  {
    num: '03',
    eyebrow: 'Step three',
    heading: 'Treatment & transparent reporting',
    body:
      'Balancing your Langelier Saturation Index, skimming, brushing walls and tile, vacuuming as needed. Every visit ends with time-stamped photos and chemical readings logged directly to your account — full accountability, zero guesswork.',
    imageSrc: '/images/coastal-pool.png',
    imageAlt: 'A coastal Georgia pool, freshly serviced.',
  },
];

export default function PinnedMediaScroll() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionRef.current) return;

    let cleanup = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        const total = STEPS.length;

        // pinSpacing: true (default) — GSAP manages the scroll distance.
        // The end: '+=' value sets pin duration in pixels of scroll.
        // Each step gets 100vh of scroll (so total = N × 100vh).
        const st = ScrollTrigger.create({
          trigger: sectionRef.current!,
          pin: stickyRef.current!,
          start: () => `top top+=${getHeaderOffset()}`,
          end: () => `+=${total * window.innerHeight}`,
          scrub: 0.4,
          invalidateOnRefresh: true,
          onUpdate: (self: any) => {
            // Map progress 0→1 to step index 0..total-1, biased so each
            // step holds for roughly the same scroll distance.
            const idx = Math.min(
              total - 1,
              Math.max(0, Math.floor(self.progress * total - 0.0001)),
            );
            if (idx !== prevRef.current) {
              prevRef.current = idx;
              setActive(idx);
            }
          },
        });

        // Fire ScrollTrigger.refresh() to trigger BaseLayout's global
        // 'refresh' listener, which calls lenis.resize(). Required when
        // a new pin-spacer was added (changes body scroll height that
        // Lenis caches).
        requestAnimationFrame(() => {
          requestAnimationFrame(() => ScrollTrigger.refresh());
        });

        cleanup = () => st.kill();
      },
    );

    return () => cleanup();
  }, []);

  return (
    <div ref={sectionRef} class="pms">
      <div ref={stickyRef} class="pms__sticky">
        <div class="pms__inner">
          {/* LEFT — text column. All steps stacked, only active one
              is opacity:1. CSS transition handles the fade. */}
          <div class="pms__text-col">
            {STEPS.map((s, i) => (
              <article
                key={s.num}
                class={`pms__step ${i === active ? 'is-active' : ''}`}
                aria-hidden={i !== active}
              >
                <span class="pms__step-num">{s.num}</span>
                <span class="pms__step-eyebrow">{s.eyebrow}</span>
                <h3 class="pms__step-heading">{s.heading}</h3>
                <p class="pms__step-body">{s.body}</p>
              </article>
            ))}

            {/* Step indicator dots at the bottom */}
            <ol class="pms__dots" aria-label="Step indicators">
              {STEPS.map((_, i) => (
                <li
                  key={i}
                  class={`pms__dot ${i === active ? 'is-active' : ''} ${i < active ? 'is-passed' : ''}`}
                  aria-current={i === active ? 'true' : undefined}
                />
              ))}
            </ol>
          </div>

          {/* RIGHT — media column. All step images stacked, only active
              one is opacity:1. */}
          <div class="pms__media-col">
            <div class="pms__media-stack">
              {STEPS.map((s, i) => (
                <figure
                  key={s.num}
                  class={`pms__media ${i === active ? 'is-active' : ''}`}
                  aria-hidden={i !== active}
                >
                  <img src={s.imageSrc} alt={s.imageAlt} loading="lazy" />
                </figure>
              ))}
            </div>
            {/* Mini caption at the corner — Rivian-style */}
            <div class="pms__caption">
              <span class="pms__caption-mark" aria-hidden="true">●</span>
              <span class="pms__caption-text">{STEPS[active]?.eyebrow}</span>
            </div>
          </div>
        </div>
      </div>

      {/* No manual spacer — GSAP's pinSpacing:true (default) manages
          the scroll distance via the `end: '+=' + (steps * vh)` config. */}
    </div>
  );
}
