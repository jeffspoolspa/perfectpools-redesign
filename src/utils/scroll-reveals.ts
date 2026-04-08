/**
 * Reusable scroll-reveal system — GSAP ScrollTrigger + Lenis compatible.
 *
 * Authors opt in by tagging DOM elements with `data-reveal="<preset>"`.
 * `initScrollReveals()` scans the page on load, wires up one ScrollTrigger
 * per element, and lets Lenis drive everything smoothly.
 *
 * All reveals respect `prefers-reduced-motion` and are idempotent — calling
 * init twice will not re-animate already-wired elements.
 *
 * ── Presets ───────────────────────────────────────────────────────────
 *   fade-up         Fade + slide up 40px   (default, use for headlines)
 *   fade-down       Fade + slide down 30px (use for follow-on content)
 *   fade-left       Fade + slide in from right 60px
 *   fade-right      Fade + slide in from left 60px
 *   scale-in        Fade + scale from 0.92 (use for cards, CTAs)
 *   blur-in         Fade + unblur 8px → 0  (use for hero statements)
 *   rise            Long fade + y: 80      (cinematic, slow)
 *   parallax        Continuous y translate as element scrolls
 *   parallax-slow   yPercent: -8
 *   parallax-fast   yPercent: -20
 *
 * ── Modifiers (additional data-* attributes on the same element) ──────
 *   data-reveal-stagger    Stagger direct children instead of element itself
 *                          Value = delay between children (default "0.1")
 *   data-reveal-scrub      "true" | "tight" | "loose" — scrub-linked reveal
 *                          instead of one-shot. Default is one-shot (plays once)
 *   data-reveal-start      Override GSAP start string (default "top 80%")
 *   data-reveal-end        Override GSAP end string   (default "top 40%")
 *   data-reveal-delay      Start delay in seconds (default 0, non-scrub only)
 *
 * ── Example ───────────────────────────────────────────────────────────
 *   <h2 data-reveal="blur-in">Big statement</h2>
 *   <div data-reveal="fade-up" data-reveal-stagger="0.12">
 *     <p>Child 1</p>
 *     <p>Child 2</p>
 *   </div>
 *   <img class="hero-bg" data-reveal="parallax-slow" />
 */

type Preset =
  | 'fade'           // opacity-only — SAFE on wrappers containing ScrollTrigger pins
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'scale-in'
  | 'blur-in'
  | 'rise'
  | 'parallax'
  | 'parallax-slow'
  | 'parallax-fast';

interface PresetDef {
  /** Initial "from" state applied before animation */
  from: Record<string, any>;
  /** Target "to" state */
  to: Record<string, any>;
  /** Is this a continuous parallax (always scrubbed) vs a one-shot reveal */
  isParallax?: boolean;
  /** Default duration for non-scrubbed reveals */
  duration?: number;
  /** Default ease */
  ease?: string;
}

const PRESETS: Record<Preset, PresetDef> = {
  // Opacity-only. Use for any wrapper that contains a pinned ScrollTrigger —
  // transforms on the wrapper offset child `getBoundingClientRect()` values
  // and break pin measurements. Opacity is the only safe "from" state.
  'fade':        { from: { opacity: 0 },                     to: { opacity: 1 },          duration: 0.8, ease: 'power2.out' },
  'fade-up':     { from: { opacity: 0, y: 40 },              to: { opacity: 1, y: 0 },    duration: 0.8, ease: 'power2.out' },
  'fade-down':   { from: { opacity: 0, y: -30 },             to: { opacity: 1, y: 0 },    duration: 0.7, ease: 'power2.out' },
  'fade-left':   { from: { opacity: 0, x: 60 },              to: { opacity: 1, x: 0 },    duration: 0.8, ease: 'power2.out' },
  'fade-right':  { from: { opacity: 0, x: -60 },             to: { opacity: 1, x: 0 },    duration: 0.8, ease: 'power2.out' },
  'scale-in':    { from: { opacity: 0, scale: 0.92, y: 20 }, to: { opacity: 1, scale: 1, y: 0 }, duration: 0.8, ease: 'power2.out' },
  'blur-in':     { from: { opacity: 0, y: 20, filter: 'blur(8px)' }, to: { opacity: 1, y: 0, filter: 'blur(0px)' }, duration: 1, ease: 'power2.out' },
  'rise':        { from: { opacity: 0, y: 80 },              to: { opacity: 1, y: 0 },    duration: 1.2, ease: 'power3.out' },
  'parallax':      { from: {}, to: { yPercent: -12 }, isParallax: true, ease: 'none' },
  'parallax-slow': { from: {}, to: { yPercent: -8  }, isParallax: true, ease: 'none' },
  'parallax-fast': { from: {}, to: { yPercent: -20 }, isParallax: true, ease: 'none' },
};

const INITIALIZED_ATTR = 'data-reveal-initialized';

/**
 * Scan the DOM and wire up ScrollTriggers for every [data-reveal] element.
 * Safe to call multiple times — skips already-initialized elements.
 */
export async function initScrollReveals(): Promise<void> {
  if (typeof window === 'undefined') return;

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-reveal]:not([${INITIALIZED_ATTR}])`)
  );
  if (elements.length === 0) return;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [{ gsap }, { ScrollTrigger }] = await Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
  ]);
  gsap.registerPlugin(ScrollTrigger);

  for (const el of elements) {
    el.setAttribute(INITIALIZED_ATTR, 'true');

    const presetName = (el.dataset.reveal || 'fade-up') as Preset;
    const preset = PRESETS[presetName];
    if (!preset) {
      console.warn(`[scroll-reveals] Unknown preset: ${presetName}`);
      continue;
    }

    // Reduced-motion: set elements to their final state and skip animation
    if (prefersReduced) {
      if (!preset.isParallax) {
        gsap.set(el, preset.to);
      }
      continue;
    }

    const start = el.dataset.revealStart || 'top 80%';
    const end = el.dataset.revealEnd || 'top 40%';
    const delay = parseFloat(el.dataset.revealDelay || '0');
    const scrubAttr = el.dataset.revealScrub;
    const staggerAttr = el.dataset.revealStagger;

    // Parallax is always scrub-linked across the full scroll pass
    if (preset.isParallax) {
      gsap.to(el, {
        ...preset.to,
        ease: preset.ease || 'none',
        scrollTrigger: {
          trigger: el,
          start: 'top bottom',
          end: 'bottom top',
          scrub: true,
        },
      });
      continue;
    }

    // Stagger children instead of animating the wrapper
    if (staggerAttr !== undefined) {
      const stagger = parseFloat(staggerAttr || '0.1');
      const children = Array.from(el.children) as HTMLElement[];
      if (children.length === 0) continue;
      gsap.set(children, preset.from);
      gsap.to(children, {
        ...preset.to,
        duration: preset.duration,
        ease: preset.ease,
        stagger,
        delay,
        scrollTrigger: {
          trigger: el,
          start,
          end,
          toggleActions: 'play none none reverse',
          ...(scrubAttr ? { scrub: scrubValue(scrubAttr) } : {}),
        },
      });
      continue;
    }

    // Single element reveal
    gsap.set(el, preset.from);
    gsap.to(el, {
      ...preset.to,
      duration: preset.duration,
      ease: preset.ease,
      delay,
      scrollTrigger: {
        trigger: el,
        start,
        end,
        toggleActions: 'play none none reverse',
        ...(scrubAttr ? { scrub: scrubValue(scrubAttr) } : {}),
      },
    });
  }

  // After wiring everything up, force a refresh so positions are correct
  // regardless of which order elements became visible / layout settled.
  ScrollTrigger.refresh();
}

function scrubValue(attr: string): number | boolean {
  if (attr === 'true') return 1;
  if (attr === 'tight') return 0.5;
  if (attr === 'loose') return 2;
  const n = parseFloat(attr);
  return isNaN(n) ? 1 : n;
}
