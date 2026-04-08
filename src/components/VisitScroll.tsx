import { useState, useEffect, useRef } from 'preact/hooks';
import { buildCardStackTimeline } from '../utils/card-stack-timeline';

// SVG icons as JSX for dependency-free rendering
const icons: Record<string, any> = {
  science: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6.5L4 20h16L14 9.5V3" />
      <path d="M8.5 14h7" />
    </svg>
  ),
  plumbing: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 12h4M14 12h4" />
      <path d="M10 8v8a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V8a4 4 0 0 0-4-4h0a4 4 0 0 0-4 4z" />
    </svg>
  ),
  checkCircle: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
};

const STEPS = [
  {
    id: 'testing',
    time: 'Minutes 0–10',
    title: 'Water Testing & Visual Inspection',
    icon: 'science',
    description:
      'We test 6 chemical vectors using digital photometers — not cheap test strips. We assess clarity, surface debris, tile line buildup, and overall structural integrity before any intervention. This baseline drives every decision for the rest of the visit.',
    color: '#2563eb',
  },
  {
    id: 'mechanical',
    time: 'Minutes 10–25',
    title: 'Mechanical & Hydraulic Audit',
    icon: 'plumbing',
    description:
      'Inspecting O-rings, pump baskets, and filter pressure to catch minor wear before it becomes a major repair. We verify optimal flow dynamics, check skimmer weirs, clean pump strainer baskets, and ensure your equipment is running at peak efficiency.',
    color: '#0891b2',
  },
  {
    id: 'treatment',
    time: 'Minutes 25–45',
    title: 'Treatment & Transparent Reporting',
    icon: 'checkCircle',
    description:
      'Balancing your Langelier Saturation Index, skimming, brushing walls and tile, and vacuuming as needed. Every visit ends with time-stamped photos and precise chemical readings logged directly to your account — full accountability, zero guesswork.',
    color: '#059669',
  },
];

export default function VisitScroll() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    const buildTimeline = (gsap: any) =>
      buildCardStackTimeline(gsap, cards, {
        enterStyle: 'scale-fade',
        exitStyle: 'fade-out',
        enterEase: 'power2.out',
        exitEase: 'power1.in',
        onCardEnter: (_card, i) => setActiveIndex(i),
      });

    window.__ourApproach?.register('visit', container, buildTimeline);
  }, []);

  return (
    <div className="vs" ref={containerRef}>
      {/* Mobile header */}
      <div className="section-header vs__header vs__header--mobile">
        <span className="vs__eyebrow">The Process</span>
        <h2>45 Minutes of Precision</h2>
        <p>
          A systemic breakdown of our exact methodology during every residential visit.
        </p>
      </div>

      <div className="vs__sticky-col">
        {/* Desktop header */}
        <div className="section-header vs__header vs__header--desktop">
          <span className="vs__eyebrow">The Process</span>
          <h2>45 Minutes of Precision</h2>
          <p>
            A systemic breakdown of our exact methodology during every residential visit.
          </p>
        </div>

        <div className="vs__content-row">
          {/* Left: Timeline indicator */}
          <div className="vs__timeline">
            <div className="vs__timeline-track" />
            {STEPS.map((step, i) => (
              <div
                key={step.id}
                className={`vs__timeline-step ${i === activeIndex ? 'vs__timeline-step--active' : ''}`}
                style={{
                  '--step-color': step.color,
                  top: `${(i / (STEPS.length - 1)) * 100}%`,
                } as any}
              >
                <div className="vs__timeline-dot">
                  {icons[step.icon]}
                </div>
                <span className="vs__timeline-label">{step.time}</span>
              </div>
            ))}
          </div>

          {/* Right: Card stack */}
          <div className="vs__card-stack">
            {STEPS.map((step, i) => (
              <div
                className="vs__card"
                style={{
                  borderColor: step.color,
                  opacity: i === 0 ? 1 : 0,
                  position: i === 0 ? 'relative' : 'absolute',
                  top: i === 0 ? 'auto' : 0,
                  left: i === 0 ? 'auto' : 0,
                  right: i === 0 ? 'auto' : 0,
                }}
                key={step.id}
                ref={(el) => { cardsRef.current[i] = el; }}
              >
                <div className="vs__card-header">
                  <div className="vs__card-badge" style={{ background: `${step.color}15`, color: step.color, borderColor: `${step.color}30` }}>
                    {step.time}
                  </div>
                  <h3 className="vs__card-title">{step.title}</h3>
                </div>
                <div className="vs__card-body">
                  <p>{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
