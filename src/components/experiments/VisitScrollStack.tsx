/**
 * VisitScrollStack — sandbox experiment for /our-approach Section 5.
 *
 * Pinned scroll-driven card reveal paired with a synced photo column.
 * Modeled after Rivian's "Universal Hands-Free" treatment: text on
 * the left, big rounded photo on the right, both centered vertically
 * in the viewport.
 *
 * Behavior across the pinned scroll range:
 *
 *   PHASE 1 (0.00 → 0.33) — only Card 1 visible, expanded, photo 1.
 *   PHASE 2 (0.33 → 0.66) — Card 2 slides in below Card 1; Card 1
 *                            collapses to header-only. Photo crossfades
 *                            to photo 2.
 *   PHASE 3 (0.66 → 1.00) — Card 3 slides in below; Card 2 collapses;
 *                            photo crossfades to photo 3.
 *
 * After the pin completes, hovering any card overrides the active
 * one (and its paired photo) so the user can revisit any step. The
 * scroll-driven active is the lower bound — newly arrived cards
 * always become active when scrolled INTO; hovering up the stack
 * temporarily expands an earlier card.
 *
 * Class prefix .vss- so styles don't collide with sibling experiments.
 */

import { useState, useEffect, useRef } from 'preact/hooks';
import { assetPath } from '../../utils/base-url';
import { getHeaderOffset } from '../../utils/scroll-config';

interface Step {
  id: string;
  num: string;
  short: string;
  tagline: string;
  title: string;
  description: string;
  accent: string;
  image: string;
  imageAlt: string;
  /** Minute the step starts at within the visit. */
  minStart: number;
  /** Minute the step ends at. minEnd - minStart = step duration. */
  minEnd: number;
}

const STEPS: Step[] = [
  {
    id: 'testing',
    num: '01',
    short: 'Testing',
    tagline: 'Minutes 0–10',
    title: 'Water Testing & Treatment',
    description:
      'Six chemical vectors measured with digital photometers — never test strips. We dose precisely from the baseline, no guessing, no overshoot.',
    accent: '#2563eb',
    image: '/images/visit-step-water-testing.jpg',
    imageAlt: 'A Perfect Pools technician testing pool water at the edge of a pool.',
    minStart: 0,
    minEnd: 10,
  },
  {
    id: 'mechanical',
    num: '02',
    short: 'Audit',
    tagline: 'Minutes 10–25',
    title: 'Mechanical & Hydraulic Audit',
    description:
      'O-rings, pump baskets, and filter pressure inspected to catch wear before it becomes a repair. Skimmer weirs cleared, baskets emptied, flow dynamics verified at peak efficiency.',
    accent: '#0891b2',
    image: '/images/checking-over-equipment.jpg',
    imageAlt: 'A technician inspecting pool equipment in the pump area.',
    minStart: 10,
    minEnd: 25,
  },
  {
    id: 'cleaning',
    num: '03',
    short: 'Cleaning',
    tagline: 'Minutes 25–45',
    title: 'Debris Removal & Brushing',
    description:
      'Walls brushed, tile scrubbed, baskets emptied, surface skimmed and floor vacuumed as needed. Every visit closes with time-stamped photos logged to your account.',
    accent: '#059669',
    image: '/images/pool-cleaning.jpg',
    imageAlt: 'A pool technician brushing the walls and removing debris.',
    minStart: 25,
    minEnd: 45,
  },
];

const TOTAL_MINS = STEPS[STEPS.length - 1].minEnd;

/** Total scroll length: 4 viewports — one for the initial empty
    "Card 1 entering" segment, then one per card after that. */
const SCROLL_VH = 4;

function clamp(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

export default function VisitScrollStack() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const fillRef = useRef<HTMLDivElement>(null);

  // Which card the timeline is CURRENTLY on (by minute proportion,
  // not by equal scroll quartiles). Updates as the timeline fill
  // crosses each segment marker (10 min / 25 min). DISCRETE — drives
  // the active card's expanded body and the matching photo. Card
  // slide-in motion is continuous, driven by GSAP scrub on cardRefs.
  const [scrollIndex, setScrollIndex] = useState(0);
  const lastScrollIndexRef = useRef(0);

  // The card index the USER is currently hovering (desktop) or has
  // tapped (mobile). Overrides scrollIndex when set. Null = use
  // scrollIndex.
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // True on devices that have a real hover-capable pointer (mouse,
  // trackpad). False on touch-only devices. We use this to gate the
  // hover handlers — on touch screens, hover events fire weirdly
  // (e.g. on first tap), so we want explicit click/tap toggling
  // instead. Detected once on mount via the (hover: hover) media
  // query.
  const [hasHover, setHasHover] = useState(true);

  /** Which card is expanded right now. Falls back to 0 when nothing
      has scrolled in yet so the first card opens expanded the moment
      it lands rather than appearing collapsed. */
  const activeIndex = hoverIndex ?? Math.max(0, scrollIndex);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(hover: hover)');
    setHasHover(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setHasHover(e.matches);
    // addEventListener is the modern API; addListener is the legacy
    // fallback for old Safari. We use the modern one — Astro targets
    // are recent browsers.
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionRef.current) return;

    let cleanup = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        const cards = cardRefs.current.filter(Boolean) as HTMLElement[];
        const fill = fillRef.current;
        const N = STEPS.length;

        // Build a paused timeline with a slide-in tween per card and
        // a continuous fill tween. ScrollTrigger's `scrub` ties the
        // timeline's playhead to scroll position, so every value
        // interpolates smoothly with the user's scroll wheel.
        //
        // Timeline length = TOTAL_MINS (45 units, one per minute).
        // Each card slides in over ITS segment's duration:
        //   Card 0 (Testing):   minStart 0  → minEnd 10  (10 min)
        //   Card 1 (Audit):     minStart 10 → minEnd 25  (15 min)
        //   Card 2 (Treatment): minStart 25 → minEnd 45  (20 min)
        // This means card slide-ins, the timeline fill crossing each
        // marker, AND the photo crossfade ALL share the same minute
        // anchors — they happen together as the fill crosses 22% / 56%.
        const tl = gsap.timeline({ paused: true });

        cards.forEach((card, i) => {
          const step = STEPS[i];
          const dur = step.minEnd - step.minStart;
          tl.fromTo(
            card,
            { y: 320, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              ease: 'power2.out',
              duration: dur,
            },
            step.minStart,
          );
        });

        // Timeline fill grows linearly over the full TOTAL_MINS.
        // Combined with the timeline being TOTAL_MINS long total,
        // scaleY 0→1 = scroll 0→1, so the fill height % = scroll % .
        if (fill) {
          tl.fromTo(
            fill,
            { scaleY: 0 },
            {
              scaleY: 1,
              ease: 'none',
              duration: TOTAL_MINS,
            },
            0,
          );
        }

        const st = ScrollTrigger.create({
          // Trigger off the PIN element (not the section) so the
          // mobile section header — which sits ABOVE the pin inside
          // the section but outside .vss-pin — scrolls past
          // naturally before pinning engages. Matches the
          // CompareScroll pattern: the pin engages "after the header
          // and subtitle" rather than when section.top hits viewport
          // top.
          trigger: pinRef.current!,
          // Pin engages with `header-height + topbar-height` of buffer
          // ABOVE the pin top, so the pinned content sits BELOW the
          // global sticky site header (.site-header is position:
          // sticky; top: 0; z-index: 100) instead of behind it. Every
          // other pinned section in this codebase uses this exact
          // pattern — without it, the top of the pinned photo gets
          // hidden under the site header. Function form so the offset
          // re-evaluates on ScrollTrigger.refresh().
          start: () => `top top+=${getHeaderOffset()}`,
          endTrigger: sectionRef.current!,
          end: 'bottom bottom',
          pin: pinRef.current!,
          pinSpacing: false,
          scrub: 0.4,
          animation: tl,
          onUpdate: (self: any) => {
            // Active card index = which MINUTE the timeline is in,
            // not which equal-quartile of scroll. So as the fill
            // crosses 22% (= 10 min mark), the active card and photo
            // flip from Testing → Audit. Same at 56% for Treatment.
            const p = self.progress;
            const targetMin = p * TOTAL_MINS;
            let idx = N - 1;
            for (let i = 0; i < N; i++) {
              if (targetMin < STEPS[i].minEnd) {
                idx = i;
                break;
              }
            }
            if (idx !== lastScrollIndexRef.current) {
              lastScrollIndexRef.current = idx;
              setScrollIndex(idx);
            }
          },
        });

        cleanup = () => st.kill();
      },
    );

    return () => cleanup();
  }, []);

  return (
    <div
      ref={sectionRef}
      class="vss-section"
      style={{ height: `${SCROLL_VH * 100}vh` }}
    >
      {/* Mobile-only section header — sits OUTSIDE the pin so it
          scrolls naturally past before the cards pin engages,
          matching the "What sets us apart" (CompareScroll) pattern. */}
      <header class="vss-header vss-header--mobile">
        <span class="vss-header__eyebrow">The Process</span>
        <h2 class="vss-header__title">45 Minutes of Precision</h2>
        <p class="vss-header__subtitle">
          A systematic breakdown of our exact methodology during every residential visit.
        </p>
      </header>

      <div ref={pinRef} class="vss-pin">
        {/* Desktop section header — pinned alongside the cards / photo
            so it stays visible throughout the scroll. Hidden on
            mobile (the duplicate above takes over there). */}
        <header class="vss-header vss-header--desktop">
          <span class="vss-header__eyebrow">The Process</span>
          <h2 class="vss-header__title">45 Minutes of Precision</h2>
          <p class="vss-header__subtitle">
            A systematic breakdown of our exact methodology during every residential visit.
          </p>
        </header>

        <div class="vss-inner">
          <div class="vss-cards">
            {STEPS.map((step, i) => {
              const isExpanded = activeIndex === i;
              return (
                <article
                  key={step.id}
                  // GSAP scrub writes y/opacity directly to the
                  // element via this ref. The .is-expanded class
                  // still toggles the body open/closed for the
                  // current active card.
                  ref={(el) => { cardRefs.current[i] = el as HTMLElement | null; }}
                  class={`vss-card${isExpanded ? ' is-expanded' : ''}`}
                  style={{ '--accent': step.accent } as any}
                  // On hover-capable pointers, hovering an earlier
                  // card temporarily re-expands it. On touch-only
                  // devices, hover events misfire on tap, so we
                  // skip them and rely on onClick below.
                  onMouseEnter={hasHover ? () => setHoverIndex(i) : undefined}
                  onMouseLeave={hasHover ? () => setHoverIndex(null) : undefined}
                  onFocus={() => setHoverIndex(i)}
                  onBlur={() => setHoverIndex(null)}
                  // Click/tap toggles: tapping the active card
                  // collapses it back to scroll-driven default;
                  // tapping any other card pins it as the active
                  // one. Works on both desktop and mobile, but is
                  // the ONLY way to expand on touch devices.
                  onClick={() => setHoverIndex((prev) => (prev === i ? null : i))}
                  tabIndex={0}
                >
                  <div class="vss-card__head">
                    <span class="vss-card__num">{step.num}</span>
                    <div class="vss-card__head-meta">
                      <h4 class="vss-card__title">{step.title}</h4>
                      <span class="vss-card__tagline">{step.tagline}</span>
                    </div>
                  </div>
                  <div class="vss-card__body" aria-hidden={!isExpanded}>
                    <p class="vss-card__desc">{step.description}</p>
                  </div>
                </article>
              );
            })}
          </div>

          <div class="vss-media" aria-hidden="true">
            {STEPS.map((step, i) => (
              <img
                key={step.id}
                src={assetPath(step.image)}
                alt={step.imageAlt}
                class={`vss-media-img${activeIndex === i ? ' is-active' : ''}`}
                loading="lazy"
              />
            ))}
          </div>

          {/* Vertical timeline — one continuous fill driven by GSAP
              scrub so the bar grows smoothly with scroll position
              (no discrete per-segment flipping). Marker lines at
              segment boundaries (10 / 25 min) show the proportional
              time split. Fill color is the active step's accent. */}
          <div class="vss-timeline" aria-hidden="true">
            <span class="vss-timeline__label">0 min</span>
            <div class="vss-timeline__track">
              <div
                ref={fillRef}
                class="vss-timeline__fill"
                style={{ background: STEPS[activeIndex]?.accent ?? '#fff' }}
              />
              {STEPS.slice(0, -1).map((step, i) => {
                // Marker line at the END of step i (= boundary
                // before step i+1). Top % = cumulative minutes / total.
                const cumMins = STEPS
                  .slice(0, i + 1)
                  .reduce((sum, s) => sum + (s.minEnd - s.minStart), 0);
                return (
                  <span
                    key={step.id}
                    class="vss-timeline__marker"
                    style={{ top: `${(cumMins / TOTAL_MINS) * 100}%` }}
                  />
                );
              })}
            </div>
            <span class="vss-timeline__label">{TOTAL_MINS} min</span>
          </div>
        </div>
      </div>
    </div>
  );
}
