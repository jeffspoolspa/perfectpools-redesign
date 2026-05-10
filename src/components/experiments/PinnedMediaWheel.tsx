/**
 * PinnedMediaWheel — sandbox experiment
 * ======================================
 *
 * The visit-anatomy pattern as a 45-minute timeline with:
 *   • A pinned image on the right (crossfades when active step changes)
 *   • A scroll-linked text "wheel" on the left (text translates upward
 *     continuously as the user scrolls — like a ticker/wheel — with
 *     fade masks at top and bottom so off-screen text dissolves)
 *   • A vertical 45-minute timeline rail on the far left (00:00 / 15:00
 *     / 30:00 / 45:00 ticks, fill grows as user scrolls)
 *
 * Mechanics:
 *
 *   1. The whole two-column container pins to the viewport.
 *   2. Text wheel:
 *      - All 3 step blocks stacked vertically inside an overflow:hidden
 *        wheel viewport (window).
 *      - On every scroll tick, translateY of the inner stack is computed
 *        so that the "active" block's center aligns with the wheel-window
 *        center. progress 0 → block 0 centered; progress 0.5 → block 1
 *        centered; progress 1 → block 2 centered. Continuous interpolation
 *        between those points = the wheel-scroll feel.
 *      - mask-image gradient fades top + bottom edges so text dissolves
 *        rather than hard-clipping.
 *   3. Image flip:
 *      - activeIdx = Math.round(progress * (N - 1))
 *      - When activeIdx changes, the active image gets opacity 1 (CSS
 *        transition handles the crossfade). Image change happens AT the
 *        crossover point, so it lines up with the moment the text "rolls
 *        over" past the center.
 *   4. Timeline rail:
 *      - Vertical 4px-wide rail on the far left edge, with 4 tick marks
 *        at the 4 quarter-points (00:00, 15:00, 30:00, 45:00).
 *      - Fill height = progress × 100%.
 *      - A small minute-counter ("18:32") shows current elapsed time.
 *
 * Key formulas (scroll-bound layout):
 *   blockHeight = 0.6 × viewportHeight (each step gets 60vh of vertical space)
 *   gap         = 0.16 × viewportHeight
 *   baseOffset  = vh/2 - blockHeight/2
 *   totalDist   = (N - 1) × (blockHeight + gap)
 *   translateY  = baseOffset - progress × totalDist
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { getHeaderOffset } from '../../utils/scroll-config';

interface Step {
  /** Two-digit step number, e.g. "01" */
  num: string;
  /** Time range of this step, e.g. "0–15 min" */
  duration: string;
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

const TOTAL_MINUTES = 45;

const STEPS: Step[] = [
  {
    num: '01',
    duration: '0–15 min',
    eyebrow: 'First quarter',
    heading: 'Water testing & visual inspection',
    body:
      'We test six chemical vectors using digital photometers — not cheap test strips. Clarity, surface debris, tile-line buildup, and structural integrity, all assessed before any intervention. The baseline drives every decision for the rest of the visit.',
    imageSrc: '/images/hero-residential-pool.webp',
    imageAlt: 'A pristine residential pool — the baseline before service.',
  },
  {
    num: '02',
    duration: '15–30 min',
    eyebrow: 'Second quarter',
    heading: 'Mechanical & hydraulic audit',
    body:
      'O-rings, pump baskets, filter pressure — minor wear caught before it becomes a major repair. Verifying flow dynamics, checking skimmer weirs, cleaning pump strainer baskets, ensuring everything is running at peak efficiency.',
    imageSrc: '/images/pool-cleaning-action.jpg',
    imageAlt: 'A technician auditing pool equipment in motion.',
  },
  {
    num: '03',
    duration: '30–45 min',
    eyebrow: 'Final quarter',
    heading: 'Treatment & transparent reporting',
    body:
      'Balancing the Langelier Saturation Index, skimming, brushing walls and tile, vacuuming. Every visit ends with time-stamped photos and chemical readings logged directly to your account — full accountability, zero guesswork.',
    imageSrc: '/images/coastal-pool.png',
    imageAlt: 'A coastal Georgia pool, freshly serviced.',
  },
];

export default function PinnedMediaWheel() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const wheelInnerRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<HTMLSpanElement>(null);

  const [active, setActive] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionRef.current) return;

    let cleanup = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        const total = STEPS.length;

        const st = ScrollTrigger.create({
          trigger: sectionRef.current!,
          pin: stickyRef.current!,
          start: () => `top top+=${getHeaderOffset()}`,
          // Each step gets 100vh of scroll. Generous so the wheel
          // motion is gradual and readable.
          end: () => `+=${total * window.innerHeight}`,
          scrub: 0.4,
          invalidateOnRefresh: true,
          onUpdate: (self: any) => {
            const progress = self.progress; // 0 → 1

            // === Text wheel translateY ===
            const vh = window.innerHeight;
            // Block height + gap need to match CSS values below.
            const blockHeight = vh * 0.6;
            const gap = vh * 0.16;
            const baseOffset = vh / 2 - blockHeight / 2;
            const totalDist = (total - 1) * (blockHeight + gap);
            const ty = baseOffset - progress * totalDist;
            if (wheelInnerRef.current) {
              wheelInnerRef.current.style.transform = `translate3d(0, ${ty}px, 0)`;
            }

            // === Timeline fill height ===
            if (fillRef.current) {
              fillRef.current.style.height = `${progress * 100}%`;
            }

            // === Minute counter ===
            const minutes = Math.floor(progress * TOTAL_MINUTES);
            const seconds = Math.floor((progress * TOTAL_MINUTES - minutes) * 60);
            if (timerRef.current) {
              timerRef.current.textContent =
                `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }

            // === Image flip — discrete crossfade ===
            // Round to nearest step. The crossover happens at progress
            // values 1/(2N), 3/(2N), etc. — exactly when the text wheel
            // is centered between two blocks.
            const idx = Math.min(
              total - 1,
              Math.max(0, Math.round(progress * (total - 1))),
            );
            if (idx !== prevRef.current) {
              prevRef.current = idx;
              setActive(idx);
            }
          },
        });

        // After the pin-spacer is inserted, fire ScrollTrigger.refresh()
        // explicitly — this triggers the global 'refresh' event, which
        // BaseLayout listens for and calls lenis.resize(). Without this,
        // Lenis caches a stale scroll limit from before the pin-spacer
        // existed and clamps scroll prematurely.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => ScrollTrigger.refresh());
        });

        cleanup = () => st.kill();
      },
    );

    return () => cleanup();
  }, []);

  return (
    <div ref={sectionRef} class="pmw">
      <div ref={stickyRef} class="pmw__sticky">
        <div class="pmw__layout">

          {/* === FAR LEFT — 45-minute timeline rail === */}
          <aside class="pmw__timeline" aria-hidden="true">
            <div class="pmw__timeline-track">
              <div class="pmw__timeline-rail" />
              <div ref={fillRef} class="pmw__timeline-fill" />
            </div>
            <ul class="pmw__timeline-marks">
              <li class="pmw__timeline-mark" style={{ top: '0%' }}>
                <span class="pmw__timeline-tick" />
                <span class="pmw__timeline-label">00:00</span>
              </li>
              <li class="pmw__timeline-mark" style={{ top: '33.33%' }}>
                <span class="pmw__timeline-tick" />
                <span class="pmw__timeline-label">15:00</span>
              </li>
              <li class="pmw__timeline-mark" style={{ top: '66.66%' }}>
                <span class="pmw__timeline-tick" />
                <span class="pmw__timeline-label">30:00</span>
              </li>
              <li class="pmw__timeline-mark" style={{ top: '100%' }}>
                <span class="pmw__timeline-tick" />
                <span class="pmw__timeline-label">45:00</span>
              </li>
            </ul>
            <div class="pmw__timeline-now">
              <span class="pmw__timeline-now-label">elapsed</span>
              <span ref={timerRef} class="pmw__timeline-now-value">00:00</span>
            </div>
          </aside>

          {/* === LEFT-CENTER — text wheel === */}
          <div class="pmw__wheel" aria-live="polite">
            <div ref={wheelInnerRef} class="pmw__wheel-inner">
              {STEPS.map((s, i) => (
                <article
                  key={s.num}
                  class={`pmw__step ${i === active ? 'is-active' : ''}`}
                >
                  <div class="pmw__step-meta">
                    <span class="pmw__step-num">{s.num}</span>
                    <span class="pmw__step-duration">{s.duration}</span>
                  </div>
                  <span class="pmw__step-eyebrow">{s.eyebrow}</span>
                  <h3 class="pmw__step-heading">{s.heading}</h3>
                  <p class="pmw__step-body">{s.body}</p>
                </article>
              ))}
            </div>
          </div>

          {/* === RIGHT — pinned image (crossfades on step change) === */}
          <div class="pmw__media">
            <div class="pmw__media-stack">
              {STEPS.map((s, i) => (
                <figure
                  key={s.num}
                  class={`pmw__media-frame ${i === active ? 'is-active' : ''}`}
                  aria-hidden={i !== active}
                >
                  <img src={s.imageSrc} alt={s.imageAlt} loading="lazy" />
                </figure>
              ))}
            </div>
            <div class="pmw__media-caption">
              <span class="pmw__media-caption-mark" aria-hidden="true">●</span>
              <span class="pmw__media-caption-text">{STEPS[active]?.duration}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
