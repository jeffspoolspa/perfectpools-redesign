import { useState, useEffect, useRef } from 'preact/hooks';
import PillarsTriangle, { PILLARS } from './PillarsTriangle';
import { assetPath } from '../utils/base-url';
import { buildCardStackTimeline } from '../utils/card-stack-timeline';
import { getHeaderOffset } from '../utils/scroll-config';

export default function PillarsScroll() {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);
  const lastIndexRef = useRef(0);

  const activePillar = PILLARS[activeIndex];

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    let trigger: any;
    let tl: any;

    import('gsap').then(({ gsap }) => {
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);

        tl = buildCardStackTimeline(gsap, cards, {
          enterStyle: 'fade-up',
          exitStyle: 'fade-out-up',
          enterEase: 'power2.out',
          exitEase: 'power1.in',
        });

        trigger = ScrollTrigger.create({
          trigger: container,
          start: () => `top top+=${getHeaderOffset()}`,
          end: 'bottom bottom',
          pin: container.querySelector('.ps__sticky-col') as HTMLElement,
          pinSpacing: false,
          scrub: 1,
          animation: tl,
          onUpdate: (self: any) => {
            const totalCards = PILLARS.length;
            const index = Math.min(
              totalCards - 1,
              Math.floor(self.progress * totalCards)
            );
            if (index !== lastIndexRef.current) {
              lastIndexRef.current = index;
              setActiveIndex(index);
            }
          },
        });
      });
    });

    return () => {
      trigger?.kill();
      tl?.kill();
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
