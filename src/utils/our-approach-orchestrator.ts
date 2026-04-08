/**
 * Our Approach page scroll orchestrator — Apple/Rivian-style section handoff.
 *
 * ── Architecture ─────────────────────────────────────────────────────
 * The 5 pinned sections on /our-approach (Problem, Our Story, Pillars,
 * Compare, Visit) are absolutely stacked inside a single `.oa-pin-stage`
 * wrapper. A master GSAP timeline drives all of them in sequence, with
 * handoff tweens between each adjacent pair. One master ScrollTrigger
 * pins the whole stage and scrubs the master timeline.
 *
 * Each section's Preact component contributes a "buildTimeline" factory
 * (a zero-arg function returning a bare GSAP timeline). The factories
 * are registered via `window.__ourApproach.register(id, el, factory)`
 * from inside each component's useEffect. This orchestrator waits for
 * all expected registrations, then stitches the factories into the
 * master timeline.
 *
 * ── Handoff mechanics ────────────────────────────────────────────────
 * Between section i and section i+1, a parallel tween animates:
 *   - section i   yPercent:   0 → -100  (slides up and out)
 *   - section i+1 yPercent: 100 →    0  (slides up from below)
 * Both on screen simultaneously during the crossover = Apple feel.
 *
 * ── Mobile & reduced motion ──────────────────────────────────────────
 * Uses ScrollTrigger.matchMedia. On desktop (≥ 900px) the full master
 * timeline + handoffs run. On mobile (< 900px) we fall back to classic
 * per-section pinning — same as every other GSAP storytelling site
 * does on small screens (including Apple and Rivian themselves).
 *
 * If prefers-reduced-motion is set, the whole orchestrator is skipped
 * and `.oa-pin-stage--static` is added to revert the absolute stacking
 * to normal block flow. Users see every card of every section stacked
 * vertically with zero animation.
 */

import { getHeaderOffset } from './scroll-config';

/**
 * How many pixels of scroll distance per timeline-time unit.
 * Total pin range = master.duration() * SCROLL_PER_UNIT.
 * Tune empirically — 600 ≈ "comfortable" on a 1000px-tall viewport.
 */
const SCROLL_PER_UNIT = 600;

/** How long (in timeline units) each section → next handoff takes. */
const HANDOFF_DURATION = 1.2;

export interface SectionBuilder {
  id: string;
  el: HTMLElement;
  buildTimeline: (gsap: any) => any;
}

export interface OrchestratorParams {
  /** The `<div class="oa-pin-stage">` wrapper containing all 5 sections. */
  pinStage: HTMLElement;
  /** The 5 pinned sections in narrative order. */
  pinnedSections: SectionBuilder[];
  /** The Reviews section (not pinned, gets a simple slide-up entrance). */
  reviewsEl: HTMLElement | null;
  /** The CTA section (not pinned, gets a simple slide-up entrance). */
  ctaEl: HTMLElement | null;
}

type Teardown = () => void;

export async function initOurApproachOrchestrator(
  params: OrchestratorParams
): Promise<Teardown> {
  const { pinStage, pinnedSections, reviewsEl, ctaEl } = params;

  if (typeof window === 'undefined') return () => {};

  // Reduced motion: revert to normal flow, skip everything.
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    pinStage.classList.add('oa-pin-stage--static');
    // Expose card content so it's all visible in static mode.
    pinnedSections.forEach((s) => {
      s.el.style.transform = 'none';
      s.el.style.opacity = '1';
    });
    return () => {
      pinStage.classList.remove('oa-pin-stage--static');
    };
  }

  const { gsap } = await import('gsap');
  const { ScrollTrigger } = await import('gsap/ScrollTrigger');
  gsap.registerPlugin(ScrollTrigger);

  const teardowns: Teardown[] = [];

  // ── Reviews + CTA slide-up entrances (run on all breakpoints) ────
  if (reviewsEl) {
    const t = gsap.fromTo(
      reviewsEl,
      { yPercent: 12, opacity: 0 },
      {
        yPercent: 0,
        opacity: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: reviewsEl,
          start: 'top 90%',
          end: 'top 55%',
          scrub: 1,
        },
      }
    );
    teardowns.push(() => t.scrollTrigger?.kill());
  }

  if (ctaEl) {
    const ctaCard = ctaEl.querySelector('.partnership-cta__card');
    if (ctaCard) {
      const t = gsap.fromTo(
        ctaCard,
        { yPercent: 10, opacity: 0, scale: 0.96 },
        {
          yPercent: 0,
          opacity: 1,
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: ctaEl,
            start: 'top 90%',
            end: 'top 50%',
            scrub: 1,
          },
        }
      );
      teardowns.push(() => t.scrollTrigger?.kill());
    }
  }

  // ── Master orchestration via matchMedia ─────────────────────────
  // Desktop: full pinned-stage + handoffs.
  // Mobile:  classic per-section pinning, no crossover.
  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px)', () => {
    // --- DESKTOP: single pin stage with master timeline ---

    // Initial layout: sections 1..n below the viewport, section 0 visible.
    pinnedSections.forEach((s, i) => {
      s.el.style.zIndex = String(10 + i);
      gsap.set(s.el, { yPercent: i === 0 ? 0 : 100 });
    });

    const master = gsap.timeline();

    pinnedSections.forEach((section, i) => {
      // Add this section's card-stack sub-timeline
      const sub = section.buildTimeline(gsap);
      master.add(sub, `section-${i}-start`);

      // Handoff to the next section (skip for the last one)
      const next = pinnedSections[i + 1];
      if (next) {
        const handoff = gsap
          .timeline()
          .to(section.el, { yPercent: -100, ease: 'none' }, 0)
          .fromTo(
            next.el,
            { yPercent: 100 },
            { yPercent: 0, ease: 'none' },
            0
          );
        // Force the handoff to take HANDOFF_DURATION time units
        handoff.duration(HANDOFF_DURATION);
        master.add(handoff, `handoff-${i}`);
      }
    });

    const masterTrigger = ScrollTrigger.create({
      trigger: pinStage,
      pin: pinStage,
      start: () => `top top+=${getHeaderOffset()}`,
      end: () => `+=${master.duration() * SCROLL_PER_UNIT}`,
      scrub: 1,
      animation: master,
      pinSpacing: true,
      invalidateOnRefresh: true,
    });

    return () => {
      masterTrigger.kill();
      master.kill();
      // Reset inline styles
      pinnedSections.forEach((s) => {
        s.el.style.zIndex = '';
        gsap.set(s.el, { clearProps: 'transform,opacity' });
      });
    };
  });

  mm.add('(max-width: 899px)', () => {
    // --- MOBILE: classic per-section pinning, no handoffs ---
    // Each section's pin target is the section itself. No yPercent
    // transforms, no stacking — the sections live in normal flow via
    // the `.oa-pin-stage--static` CSS rule.
    pinStage.classList.add('oa-pin-stage--static');

    const triggers: any[] = [];

    pinnedSections.forEach((section) => {
      const sub = section.buildTimeline(gsap);
      const t = ScrollTrigger.create({
        trigger: section.el,
        pin: section.el,
        start: () => `top top+=${getHeaderOffset()}`,
        end: () => `+=${window.innerHeight * 2}`,
        pinSpacing: true,
        scrub: 1,
        animation: sub,
        invalidateOnRefresh: true,
      });
      triggers.push(t);
    });

    return () => {
      pinStage.classList.remove('oa-pin-stage--static');
      triggers.forEach((t) => t.kill());
    };
  });

  teardowns.push(() => mm.revert());

  // Final refresh so master trigger's end position is computed after
  // all sub-timelines are fully built.
  ScrollTrigger.refresh();

  return () => teardowns.forEach((fn) => fn());
}

/**
 * Shared registry type that components write to and the orchestrator reads.
 * Exposed on window so Astro's imperative mount sequence can coordinate
 * without passing callback props through render() calls.
 */
declare global {
  interface Window {
    __ourApproach?: {
      register: (
        id: string,
        el: HTMLElement,
        buildTimeline: (gsap: any) => any
      ) => void;
      registry: Map<string, SectionBuilder>;
    };
  }
}

/**
 * Call this BEFORE mounting any *Scroll Preact component. Sets up the
 * global registry that components write to.
 */
export function createOurApproachRegistry(): Map<string, SectionBuilder> {
  const registry = new Map<string, SectionBuilder>();
  window.__ourApproach = {
    register(id, el, buildTimeline) {
      registry.set(id, { id, el, buildTimeline });
    },
    registry,
  };
  return registry;
}
