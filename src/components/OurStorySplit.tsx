/**
 * OurStorySplit — split-screen "Our Story" section.
 *
 * Replaces the prior 5-phase pinned TimelineScroll. The pinned timeline
 * created a lot of vertical whitespace and made the user scroll through
 * 5 viewports just to read the partnership story. This version keeps
 * the same content but compresses it to a single-viewport split layout:
 *
 *   LEFT  (~5/12) — fixed PSAC formation copy ("built by bringing the
 *                   best together"). Static; doesn't change while
 *                   right-side cycles.
 *   RIGHT (~7/12) — three real partner logos in a horizontal row at
 *                   the top. The active logo is enlarged and tinted by
 *                   its accent; the inactive ones shrink and dim. Below
 *                   the row sits a single text panel showing the active
 *                   partner's name, region, and description.
 *
 * Cycle behavior:
 *   - Auto-advances every 5s when no logo is hovered.
 *   - Hovering or focusing any logo pauses the auto-advance and locks
 *     that partner as active.
 *   - Mouse leave / blur on the right column resumes the cycle.
 *
 * Partner content roll-up (was 5 cards in TimelineScroll → now 3):
 *   - Phase I (Formation of PSAC) → left-column intro copy.
 *   - Phase II (JPS) → "Jeff's Pool & Spa" card.
 *   - Phase III (Perfect Pools) + Phase V (Savannah hub) → merged into
 *     a single "Perfect Pools" card. The Savannah hub now reads as an
 *     expansion of Perfect Pools' operations rather than a standalone
 *     phase.
 *   - Phase IV (Pool Solutions Plus) → "Pool Solutions Plus" card,
 *     reframed as a partnership that adds renovation/construction
 *     capabilities (it is NOT a portfolio company).
 *
 * Logo files at /public/images/partners/ (all PNG with transparent bg):
 *   - jps.png
 *   - perfect-pools.png
 *   - pool-solutions-plus.png
 * Each should ideally be exported with a TRANSPARENT background so it
 * sits cleanly on the panel. If the source has a background color,
 * the per-partner `logoBlend` setting tries to mute it via
 * mix-blend-mode (multiply for white bgs, lighten for black bgs) — but
 * a real transparent PNG is always the better answer.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import { assetPath } from '../utils/base-url';

interface Partner {
  /** Short identifier shown in the roster pills + as the logo's alt text. */
  short: string;
  /** Full company name shown in the active panel heading. */
  name: string;
  /** One-line role / why-they-matter line. */
  tagline: string;
  /** Markets / regions served. */
  location: string;
  /** Body paragraphs for the active state — rendered as separate <p>s. */
  paragraphs: string[];
  /** Hex accent color used for active highlight. */
  accent: string;
  /** Logo image src, served from /public. */
  logo: string;
  /**
   * mix-blend-mode value applied to the logo to handle source bg color.
   * Use 'multiply' for white-bg logos (white pixels become transparent
   * over the panel), 'lighten' for black-bg logos (black pixels become
   * transparent), or 'normal' for already-transparent PNGs.
   */
  logoBlend: 'multiply' | 'lighten' | 'normal';
  /**
   * Per-logo visual scale multiplier. Squarer logos render visually
   * smaller in the equal-width grid cells because they hit the cell's
   * width limit before their aspect ratio can spread out. Set this >1
   * to visually upscale (via CSS scale()) so the logo matches the
   * apparent size of wider marks. Defaults to 1.
   */
  logoScale?: number;
}

/**
 * Partner content is condensed from the original TimelineScroll phases
 * II–V to exactly two paragraphs per partner. Phrasing is taken from
 * the original copy verbatim, just tightened (sentences merged,
 * redundancies dropped). Phase V (Savannah hub) is folded into Perfect
 * Pools' second paragraph since the hub is an expansion of Perfect
 * Pools' operations, not a standalone partner.
 */
const PARTNERS: Partner[] = [
  {
    short: "Jeff's Pool & Spa",
    name: "Jeff's Pool & Spa Service",
    tagline: 'The Foundation',
    location: 'Golden Isles, GA · Fernandina Beach, FL',
    paragraphs: [
      "PSAC's first major step was partnering with Jeff's Pool & Spa Service (JPS) in the Golden Isles of Georgia and Fernandina Beach Florida. JPS brought 20 years of operational expertise, a highly experienced team, and a culture of deep technical expertise and client service.",
      "JPS was known for something rare in the maintenance world — deep equipment expertise across pumps, filtration, heaters, automation, lighting, and complex hydraulics in both residential and large-scale commercial properties. As one of the few approved warranty service providers in the region, JPS became the foundation of PSAC's complete-care model.",
    ],
    accent: '#0EA5E9',
    logo: '/images/partners/jps.png',
    logoBlend: 'normal',
  },
  {
    short: 'Perfect Pools',
    name: 'Perfect Pools',
    tagline: 'Expanding up the coast',
    location: 'Richmond Hill · Savannah · Tybee · Skidaway · Pooler · Bluffton',
    paragraphs: [
      // Phase III condensed: PSAC + PP origin + culture + combined standard.
      "PSAC's next partnership came with Perfect Pools, expanding the footprint up the Georgia coast. Founded by Erin ~20 years ago, Perfect Pools built a reputation for meticulous attention to detail and a strong commitment to service quality across high-end residential, commercial, HOA, and property-manager accounts. Combined with JPS's technical depth, both brands now serve the entire Georgia Coast under a single standard: complete care, no gaps, no excuses.",
      // Phase V (Savannah hub) folded into Perfect Pools' expansion.
      "Most recently, Perfect Pools opened a Savannah branch — a centralized operations hub strategically positioned for efficient service across Savannah, Tybee Island, Skidaway Island, Pooler, and Bluffton within a 30-minute radius. The facility is built for operational excellence on fleet and inventory management, employee training, and prompt dispatch.",
    ],
    accent: '#22C55E',
    logo: '/images/partners/perfect-pools.png',
    logoBlend: 'normal',
    // Perfect Pools logo is squarer (1536×1024 ≈ 1.5:1) than the wider
    // JPS (~2.5:1) and PSP (~2.75:1) marks, so it hits the cell-width
    // limit looking ~40% narrower than the others. Bump it up to match.
    logoScale: 1.65,
  },
  {
    short: 'Pool Solutions Plus',
    name: 'Pool Solutions Plus',
    tagline: 'Partnership · pool construction & renovation',
    location: 'Coastal Georgia',
    paragraphs: [
      'While prioritizing getting better before getting bigger, PSAC continues to seek out partners who share our values. After working with Tom, founder of Pool Solutions Plus (PSP), on several large-scale commercial pool renovations, it became clear that we shared the same commitment to quality and craftsmanship.',
      'A partnership was formed that expands our capabilities into pool construction and renovation. Pool Solutions Plus focuses on building exceptional pools, while Perfect Pools focuses on maintaining and servicing them. This alignment ensures customers receive expert care throughout the full lifecycle of their pools.',
    ],
    accent: '#F59E0B',
    logo: '/images/partners/pool-solutions-plus.png',
    logoBlend: 'normal',
  },
];

const CYCLE_MS = 5500;

export default function OurStorySplit() {
  const [activeIndex, setActiveIndex] = useState(0);
  /** When non-null, auto-advance is paused (user is hovering / focused). */
  const lockedIndexRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const startCycle = () => {
    if (intervalRef.current !== null) return;
    intervalRef.current = window.setInterval(() => {
      if (lockedIndexRef.current !== null) return;
      setActiveIndex((prev) => (prev + 1) % PARTNERS.length);
    }, CYCLE_MS);
  };

  const stopCycle = () => {
    if (intervalRef.current === null) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  useEffect(() => {
    startCycle();
    return () => stopCycle();
  }, []);

  const handleEnter = (i: number) => {
    lockedIndexRef.current = i;
    setActiveIndex(i);
  };
  const handleLeave = () => {
    lockedIndexRef.current = null;
  };

  const active = PARTNERS[activeIndex];

  return (
    <div class="oss">
      <div class="oss__grid">
        {/* === LEFT — story copy + partner inquiry form ============
            Two body paragraphs were removed in favor of a short
            partner-inquiry form for pool operators who'd like to talk
            about joining PSAC. The form posts to /api/partner-inquiry
            (placeholder — wire to whatever inbox / form-service the
            ops team uses). */}
        <div class="oss__left">
          <span class="oss__kicker">Our story</span>
          <h2 class="oss__heading">
            Built by bringing the <em>best together.</em>
          </h2>
          <p class="oss__lead">
            Pool Services Acquisition Co. <span class="oss__abbr">(PSAC)</span> was founded to bring
            a higher standard of professionalism, communication, and service quality to the pool
            services industry.
          </p>

          <form
            class="oss__form"
            action="/api/partner-inquiry"
            method="post"
            aria-label="Partner inquiry"
          >
            <div class="oss__form-head">
              <strong class="oss__form-title">Are you a pool service operator?</strong>
              <span class="oss__form-sub">
                We're always looking for partners who share our values. Drop us a line.
              </span>
            </div>
            <div class="oss__form-row">
              <label class="oss__field">
                <span class="oss__field-label">Company</span>
                <input
                  type="text"
                  name="company"
                  required
                  class="oss__input"
                  placeholder="Your company name"
                  autocomplete="organization"
                />
              </label>
              <label class="oss__field">
                <span class="oss__field-label">Email</span>
                <input
                  type="email"
                  name="email"
                  required
                  class="oss__input"
                  placeholder="you@example.com"
                  autocomplete="email"
                />
              </label>
            </div>
            <button type="submit" class="oss__submit">
              Start a conversation
              <span aria-hidden="true" class="oss__submit-arrow">→</span>
            </button>
          </form>
        </div>

        {/* === RIGHT — logo strip + active partner panel ============== */}
        <div class="oss__right" onMouseLeave={handleLeave}>
          {/* Horizontal logo row: 3 partners. Active enlarges, inactive
              shrink and dim. Click locks. */}
          <ul class="oss__logos" role="tablist" aria-label="Partner companies">
            {PARTNERS.map((p, i) => {
              const isActive = i === activeIndex;
              return (
                <li
                  key={p.short}
                  class={`oss__logo-cell ${isActive ? 'is-active' : ''}`}
                  style={{ '--accent': p.accent } as any}
                >
                  <button
                    class="oss__logo-btn"
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Show ${p.name}`}
                    onClick={() => handleEnter(i)}
                    onMouseEnter={() => handleEnter(i)}
                    onFocus={() => handleEnter(i)}
                  >
                    <img
                      class="oss__logo-img"
                      src={assetPath(p.logo)}
                      alt={`${p.name} logo`}
                      loading="lazy"
                      style={{
                        mixBlendMode: p.logoBlend,
                        // Per-logo visual size multiplier. CSS scale()
                        // (not max-height) because the limiting factor
                        // on squarer logos is usually the cell WIDTH,
                        // not the max-height. scale() lets the logo
                        // grow past its cell bounds visually without
                        // changing the surrounding layout.
                        transform: p.logoScale && p.logoScale !== 1
                          ? `scale(${p.logoScale})`
                          : undefined,
                      }}
                      onError={(e) => {
                        // Fallback: hide broken img and show wordmark span next to it
                        const el = e.currentTarget as HTMLImageElement;
                        el.style.display = 'none';
                        const fallback = el.nextElementSibling as HTMLElement | null;
                        if (fallback) fallback.style.display = 'inline-flex';
                      }}
                    />
                    <span class="oss__logo-fallback" aria-hidden="true">
                      {p.short}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* Active panel — all 3 panels are always in the DOM,
              stacked in a single grid cell so the stage auto-sizes to
              the TALLEST panel. Opacity toggles the active one — this
              produces a real crossfade (incoming + outgoing visible
              simultaneously) instead of remount-and-fade-in. */}
          <div class="oss__panel-stage">
            {PARTNERS.map((p, i) => {
              const isActive = i === activeIndex;
              return (
                <div
                  key={p.short}
                  class={`oss__panel ${isActive ? 'is-active' : ''}`}
                  style={{ '--accent': p.accent } as any}
                  aria-hidden={!isActive}
                >
                  <div class="oss__panel-meta">
                    <span class="oss__panel-num">0{i + 1} / 0{PARTNERS.length}</span>
                    <span class="oss__panel-tag">{p.tagline}</span>
                  </div>
                  <h3 class="oss__panel-name">{p.name}</h3>
                  <p class="oss__panel-loc">{p.location}</p>
                  <div class="oss__panel-body">
                    {p.paragraphs.map((para, pi) => (
                      <p key={pi} class="oss__panel-para">{para}</p>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
