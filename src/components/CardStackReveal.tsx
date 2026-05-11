/**
 * CardStackReveal — vertical stack of expandable cards with one active
 * at a time and auto-cycle.
 *
 * Originally built as the first iteration of the "Our Story" section,
 * then archived for reuse on other sections of the site (or later
 * pages). Generic in two ways:
 *
 *   1. Content is passed in via the `items` prop — each item supplies
 *      a numeral, short wordmark, tagline, title, optional location,
 *      description, and an accent color. Not partnership-specific.
 *   2. Cycle interval is configurable (default 5s).
 *
 * Behavior:
 *   - Cards stack vertically with a small gap.
 *   - At any moment one card is "active" — it expands to reveal the
 *     title / location / description, gets a subtle accent-tinted
 *     background, and lifts with a soft accent-colored shadow.
 *   - Inactive cards collapse to just the wordmark + tagline row.
 *   - Auto-advances every `cycleMs` ms when the user is not hovering
 *     or focused on any card.
 *   - Hover or focus locks that card as the active one and pauses the
 *     cycle. Mouse-leave on the container resumes.
 *
 * Class prefix `.csr-` so styles don't collide with the (newer)
 * horizontal-logos `OurStorySplit` component or any other card UI.
 *
 * Usage example:
 *
 *   <CardStackReveal
 *     items={[
 *       {
 *         id: 'discovery',
 *         num: '01',
 *         short: 'Discovery',
 *         tagline: 'Walk the property',
 *         title: 'On-site discovery visit',
 *         location: 'At your pool',
 *         description: 'We start every relationship with a 45-minute walk-through…',
 *         accent: '#0EA5E9',
 *       },
 *       …
 *     ]}
 *     cycleMs={6000}
 *   />
 *
 * Styles live in src/styles/global.css under the "CardStackReveal"
 * comment marker.
 */

import { useEffect, useRef, useState } from 'preact/hooks';

export interface CardStackItem {
  /** Stable key. Used for React/Preact reconciliation. */
  id: string;
  /** Card numeral, e.g. "01". Shown in a small badge in the head row. */
  num: string;
  /** Short wordmark / label shown in the head row, always visible. */
  short: string;
  /** One-line role / hook shown in the head row, always visible. */
  tagline: string;
  /** Full heading shown when the card is active. */
  title: string;
  /** Optional region / context line under the heading. */
  location?: string;
  /** Body paragraph shown when the card is active. */
  description: string;
  /** Hex accent color used for active state border, badge, shadow. */
  accent: string;
}

interface CardStackRevealProps {
  items: CardStackItem[];
  /** Milliseconds between auto-advances. Defaults to 5000. */
  cycleMs?: number;
  /** Initial active index. Defaults to 0. */
  initialIndex?: number;
  /** Optional class name appended to the root for one-off styling. */
  class?: string;
  /** Fires whenever the active index changes (auto-cycle, hover, or
      focus). Lets a parent sync external content — e.g., a photo
      stack on the side that should crossfade in step with the card. */
  onActiveChange?: (index: number) => void;
}

export default function CardStackReveal({
  items,
  cycleMs = 5000,
  initialIndex = 0,
  class: className = '',
  onActiveChange,
}: CardStackRevealProps) {
  const [activeIndex, setActiveIndex] = useState(
    Math.min(initialIndex, items.length - 1),
  );
  /** When non-null, auto-advance is paused (user hovering / focused). */
  const lockedIndexRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const startCycle = () => {
    if (intervalRef.current !== null || items.length <= 1) return;
    intervalRef.current = window.setInterval(() => {
      if (lockedIndexRef.current !== null) return;
      setActiveIndex((prev) => (prev + 1) % items.length);
    }, cycleMs);
  };

  const stopCycle = () => {
    if (intervalRef.current === null) return;
    clearInterval(intervalRef.current);
    intervalRef.current = null;
  };

  useEffect(() => {
    startCycle();
    return () => stopCycle();
  }, [cycleMs, items.length]);

  // Notify parent whenever active index changes (auto-cycle / hover /
  // focus) so external panels (e.g., a paired photo column) can sync.
  useEffect(() => {
    onActiveChange?.(activeIndex);
  }, [activeIndex]);

  const handleEnter = (i: number) => {
    lockedIndexRef.current = i;
    setActiveIndex(i);
  };
  const handleLeave = () => {
    lockedIndexRef.current = null;
  };

  return (
    <div class={`csr ${className}`} onMouseLeave={handleLeave}>
      {items.map((item, i) => {
        const isActive = i === activeIndex;
        return (
          <article
            key={item.id}
            class={`csr__card ${isActive ? 'is-active' : ''}`}
            style={{ '--accent': item.accent } as any}
            onMouseEnter={() => handleEnter(i)}
            onFocus={() => handleEnter(i)}
            tabIndex={0}
          >
            <header class="csr__head">
              <span class="csr__mark">
                <span class="csr__num">{item.num}</span>
                <span class="csr__short">{item.short}</span>
              </span>
              <span class="csr__tag">{item.tagline}</span>
            </header>
            <div class="csr__body" aria-hidden={!isActive}>
              <h3 class="csr__title">{item.title}</h3>
              {item.location && <p class="csr__loc">{item.location}</p>}
              <p class="csr__desc">{item.description}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
