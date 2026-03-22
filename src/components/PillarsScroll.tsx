import { useState, useEffect, useRef } from 'preact/hooks';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import PillarsTriangle, { PILLARS } from './PillarsTriangle';
import { assetPath } from '../utils/base-url';

gsap.registerPlugin(ScrollTrigger);

export default function PillarsScroll() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  const activePillar = PILLARS[activeIndex];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    // Build a master timeline — GSAP scrubs through it tied to scroll
    const tl = gsap.timeline();

    cards.forEach((card, i) => {
      if (i === 0) {
        // First card starts visible, holds, then fades out
        tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.01 }, 0); // ensure visible at start
        tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 1 }); // hold
        if (i < cards.length - 1) {
          tl.to(card, { opacity: 0, y: -20, scale: 0.97, duration: 0.5 }); // fade out
        }
      } else {
        // Subsequent cards: fade in, hold, fade out
        tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.5 }); // fade in
        tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 1 }); // hold
        if (i < cards.length - 1) {
          tl.to(card, { opacity: 0, y: -20, scale: 0.97, duration: 0.5 }); // fade out
        }
      }
    });

    // Create the ScrollTrigger that scrubs through the timeline
    const trigger = ScrollTrigger.create({
      trigger: container,
      start: 'top 80px',
      end: 'bottom bottom',
      pin: container.querySelector('.ps__sticky-col') as HTMLElement,
      pinSpacing: false,
      scrub: 0.5, // smooth scrubbing — 0.5s lag behind scroll
      animation: tl,
      onUpdate: (self) => {
        // Determine which card is active based on progress
        // Each card gets equal share of total progress
        const totalCards = PILLARS.length;
        const index = Math.min(
          totalCards - 1,
          Math.floor(self.progress * totalCards)
        );
        setActiveIndex(index);
      },
    });

    return () => {
      trigger.kill();
      tl.kill();
    };
  }, []);

  return (
    <div className="ps" ref={containerRef}>
      {/* Mobile: header scrolls naturally (not sticky) */}
      <div className="section-header ps__header ps__header--mobile">
        <h2>Three pillars of Perfect Pool care</h2>
        <p>
          Every visit is built on chemistry, equipment health, and
          transparency — working together as one system.
        </p>
      </div>

      <div className="ps__sticky-col">
        {/* Desktop: header inside sticky col */}
        <div className="section-header ps__header ps__header--desktop">
          <h2>Three pillars of Perfect Pool care</h2>
          <p>
            Every visit is built on chemistry, equipment health, and
            transparency — working together as one system.
          </p>
        </div>

        <div className="ps__content-row">
          <div className="ps__diagram">
            <PillarsTriangle
              active={activePillar.id}
              onHover={(id) => {
                const idx = PILLARS.findIndex((p) => p.id === id);
                if (idx >= 0) setActiveIndex(idx);
              }}
            />
          </div>

          <div className="ps__card-stack">
            {PILLARS.map((p, i) => (
              <div
                className="ps__card"
                style={{
                  borderColor: p.color,
                  opacity: i === 0 ? 1 : 0,
                  position: i === 0 ? 'relative' : 'absolute',
                  top: i === 0 ? 'auto' : 0,
                  left: i === 0 ? 'auto' : 0,
                  right: i === 0 ? 'auto' : 0,
                }}
                key={p.id}
                ref={(el) => { cardsRef.current[i] = el; }}
              >
                <div className="ps__card-header">
                  <div className="ps__card-icon" style={{ background: p.color }}>
                    <img src={assetPath(p.icon)} alt="" />
                  </div>
                  <h3 className="ps__card-title" style={{ color: p.color }}>
                    {p.heading}
                  </h3>
                </div>
                <div className="ps__card-body">
                  <p>{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="ps__spacer" />

      <div className="ps__mobile-diagram">
        <PillarsTriangle
          active={activePillar.id}
          onHover={(id) => {
            const idx = PILLARS.findIndex((p) => p.id === id);
            if (idx >= 0) setActiveIndex(idx);
          }}
        />
      </div>
    </div>
  );
}
