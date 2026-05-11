/**
 * VisitCardStack — sandbox experiment for /our-approach v3.
 *
 * Pairs the existing CardStackReveal (auto-cycling vertical cards
 * on the left) with a synced photo column on the right. Each step
 * has its own photo; the photo crossfades whenever the card stack's
 * active index changes — auto-cycle, hover, or focus.
 *
 * Layout (desktop):
 *   [ card stack (3 stacked cards) ]  [ photo (one of 3, crossfaded) ]
 *
 * Layout (mobile): single column, photo above card stack.
 *
 * Replaces the scroll-driven VisitScroll for /our-approach Section 5
 * once approved. Same data shape (3 steps), different interaction:
 * timer-driven instead of pin-and-scrub.
 */

import { useState } from 'preact/hooks';
import CardStackReveal, { type CardStackItem } from '../CardStackReveal';
import { assetPath } from '../../utils/base-url';

interface VisitStep extends CardStackItem {
  image: string;
  imageAlt: string;
}

const STEPS: VisitStep[] = [
  {
    id: 'testing',
    num: '01',
    short: 'Testing',
    tagline: 'Minutes 0–10',
    title: 'Water Testing & Visual Inspection',
    description:
      'We test 6 chemical vectors using digital photometers — not cheap test strips. We assess clarity, surface debris, tile line buildup, and overall structural integrity before any intervention. This baseline drives every decision for the rest of the visit.',
    accent: '#2563eb',
    image: '/images/pool-cleaning.jpg',
    imageAlt: 'A pool technician taking a water sample for testing.',
  },
  {
    id: 'mechanical',
    num: '02',
    short: 'Audit',
    tagline: 'Minutes 10–25',
    title: 'Mechanical & Hydraulic Audit',
    description:
      'Inspecting O-rings, pump baskets, and filter pressure to catch minor wear before it becomes a major repair. We verify optimal flow dynamics, check skimmer weirs, clean pump strainer baskets, and ensure your equipment is running at peak efficiency.',
    accent: '#0891b2',
    image: '/images/checking-over-equipment.jpg',
    imageAlt: 'A technician inspecting pool equipment in the pump area.',
  },
  {
    id: 'treatment',
    num: '03',
    short: 'Treatment',
    tagline: 'Minutes 25–45',
    title: 'Treatment & Transparent Reporting',
    description:
      'Balancing your Langelier Saturation Index, skimming, brushing walls and tile, and vacuuming as needed. Every visit ends with time-stamped photos and precise chemical readings logged directly to your account — full accountability, zero guesswork.',
    accent: '#059669',
    image: '/images/hero-residential-pool.webp',
    imageAlt: 'A clean, well-maintained residential pool after service.',
  },
];

export default function VisitCardStack() {
  // Mirror the active index from the inner CardStackReveal so the
  // photo column can crossfade in sync.
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div class="vcs">
      <div class="vcs__cards">
        <CardStackReveal
          items={STEPS}
          cycleMs={6000}
          onActiveChange={setActiveIndex}
        />
      </div>

      <div class="vcs__media" aria-hidden="true">
        {STEPS.map((step, i) => (
          <img
            key={step.id}
            src={assetPath(step.image)}
            alt={step.imageAlt}
            class={`vcs__media-img ${activeIndex === i ? 'is-active' : ''}`}
            loading="lazy"
          />
        ))}
      </div>
    </div>
  );
}
