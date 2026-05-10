/**
 * OurApproachNav — sticky chapter marker (top-left) + side rail with
 * section dots for /our-approach.
 *
 * Two visible elements, one shared scroll-tracking core:
 *
 *   C2 — Sticky chapter marker (top-left): shows "01 / WHY WE EXIST",
 *        updates as the user scrolls through the 7 sections of
 *        /our-approach. Spatial orientation marker, like a chapter
 *        title in a magazine article.
 *
 *   C3 — Side rail with 7 dots (right edge, vertically centered): each
 *        dot represents a section, fills as the user scrolls past it.
 *        Click a dot → lenis.scrollTo() smoothly scrolls to that
 *        section's start. Linear-docs style nav.
 *
 * Section detection: IntersectionObserver on each section element.
 * Whichever section has the largest intersection ratio in the viewport
 * is the "active" one. Tracks 7 sections; the IDs are looked up at mount.
 *
 * Click navigation: uses window.__lenis (the global Lenis instance set in
 * BaseLayout.astro) to smooth-scroll to the target section. Falls back
 * to native scrollIntoView if Lenis isn't available.
 */

import { useEffect, useRef, useState } from 'preact/hooks';

interface Section {
  id: string;
  /** Short uppercase label shown in the chapter marker */
  label: string;
}

const SECTIONS: Section[] = [
  { id: 'problem', label: 'Why we exist' },
  { id: 'our-story', label: 'Our story' },
  { id: 'pillars', label: 'Three pillars' },
  { id: 'compare', label: 'Industry vs us' },
  { id: 'visit', label: 'Anatomy of a visit' },
  { id: 'reviews', label: 'What clients say' },
  // The partnership-cta section doesn't have an id; we synthesize one
  // below at mount time so the side-rail dot still works.
  { id: 'cta', label: 'Get started' },
];

export default function OurApproachNav() {
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState(true); // hidden above the first section
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Synthesize a CTA id on the partnership-cta section if missing,
    // so we can scrollTo it via Lenis without touching v1's markup.
    const ctaSec = document.querySelector<HTMLElement>('.partnership-cta');
    if (ctaSec && !ctaSec.id) ctaSec.id = 'cta';

    const targets = SECTIONS
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null);

    if (targets.length === 0) return;

    // Pick the section with the largest visible intersection ratio.
    // Each entry has a target element + a current intersection ratio;
    // we keep the one with the highest ratio as "active."
    const ratios = new Map<HTMLElement, number>();
    const indexById = new Map<string, number>();
    SECTIONS.forEach((s, i) => indexById.set(s.id, i));

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          ratios.set(e.target as HTMLElement, e.intersectionRatio);
        }
        // Find the section with the highest ratio
        let bestRatio = 0;
        let bestId: string | null = null;
        ratios.forEach((r, el) => {
          if (r > bestRatio) {
            bestRatio = r;
            bestId = el.id;
          }
        });
        if (bestId) {
          const i = indexById.get(bestId);
          if (i !== undefined) setActive(i);
          setHidden(bestRatio < 0.05);
        } else {
          setHidden(true);
        }
      },
      {
        // Sample at multiple thresholds so we can pick the most-visible
        // section even when several are partially in view.
        threshold: [0, 0.05, 0.1, 0.25, 0.5, 0.75, 1],
        rootMargin: '-20% 0px -20% 0px',
      },
    );
    targets.forEach((t) => io.observe(t));
    observerRef.current = io;

    return () => io.disconnect();
  }, []);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const lenis = (window as any).__lenis;
    if (lenis?.scrollTo) {
      lenis.scrollTo(el, { duration: 1.4, lock: false });
    } else {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <>
      {/* C2 — Sticky chapter marker (top-left) */}
      <div
        class={`oa-nav-marker ${hidden ? 'is-hidden' : ''}`}
        aria-hidden="true"
      >
        <span class="oa-nav-marker__num">
          {String(active + 1).padStart(2, '0')}
        </span>
        <span class="oa-nav-marker__sep">/</span>
        <span class="oa-nav-marker__label">{SECTIONS[active]?.label}</span>
      </div>

      {/* C3 — Side rail with section dots */}
      <nav
        class={`oa-nav-rail ${hidden ? 'is-hidden' : ''}`}
        aria-label="Page sections"
      >
        <ol class="oa-nav-rail__list">
          {SECTIONS.map((s, i) => (
            <li class="oa-nav-rail__item" key={s.id}>
              <button
                type="button"
                class={`oa-nav-rail__dot ${i === active ? 'is-active' : ''} ${i < active ? 'is-passed' : ''}`}
                onClick={() => goTo(s.id)}
                aria-label={`Scroll to ${s.label}`}
                aria-current={i === active ? 'true' : undefined}
              >
                <span class="oa-nav-rail__dot-inner" />
              </button>
              <span class="oa-nav-rail__tooltip">{s.label}</span>
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
