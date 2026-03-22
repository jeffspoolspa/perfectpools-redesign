import { useState, useEffect, useRef } from 'preact/hooks';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const SIDES = [
  {
    id: 'industry',
    label: 'The Industry Standard',
    title: 'Chaos & Reaction',
    labelClass: '',
    titleClass: '',
    points: [
      { icon: 'bad', title: 'Reactive Treatment', desc: 'Chemicals dumped only after algae blooms or equipment fails. Constant catch-up.', bar: 'chaotic' },
      { icon: 'bad', title: 'Inconsistent Visits', desc: 'No proof of service duration or specific tasks completed. The "splash and dash".', bar: 'gaps' },
      { icon: 'bad', title: 'Hidden Chemical Costs', desc: 'Opaque billing with sudden spikes for shock treatments and algaecides.', bar: null },
    ],
  },
  {
    id: 'ours',
    label: 'Our Systematic Approach',
    title: 'Structure & Perfection',
    labelClass: 'compare-label--accent',
    titleClass: 'compare-title--dark',
    points: [
      { icon: 'good', title: 'Proactive Asset Management', desc: 'Micro-adjustments made weekly based on precise baseline testing. Zero algae, ever.', bar: 'solid' },
      { icon: 'good', title: 'Timestamped Verification', desc: 'Digital logs of exact arrival times, chemical dosing, and photographic evidence.', bar: 'consistent' },
      { icon: 'good', title: 'Transparent Chemical Dosing', desc: 'Flat-rate predictability. We absorb the fluctuations of chemical markets, not you.', bar: null },
    ],
  },
];

function BarVisual({ type }: { type: string | null }) {
  if (!type) return null;
  if (type === 'chaotic') return <div className="compare-bar compare-bar--chaotic"><span style="left: 0; width: 33%;" /><span style="left: 50%; width: 25%;" /></div>;
  if (type === 'gaps') return <div className="compare-bar compare-bar--gaps"><span /><span className="empty" /><span /><span /><span className="empty" /></div>;
  if (type === 'solid') return <div className="compare-bar compare-bar--solid" />;
  if (type === 'consistent') return <div className="compare-bar compare-bar--consistent"><span /><span /><span /><span /><span /></div>;
  return null;
}

function IconBadge({ type }: { type: string }) {
  if (type === 'bad') return <div className="compare-icon compare-icon--bad"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg></div>;
  return <div className="compare-icon compare-icon--good"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></div>;
}

export default function CompareScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const cards = cardsRef.current.filter(Boolean) as HTMLDivElement[];
    if (cards.length === 0) return;

    const tl = gsap.timeline();

    cards.forEach((card, i) => {
      if (i === 0) {
        tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.01 }, 0);
        tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 1 });
        if (i < cards.length - 1) {
          tl.to(card, { opacity: 0, y: -20, scale: 0.97, duration: 0.5 });
        }
      } else {
        tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 0.5 });
        tl.to(card, { opacity: 1, y: 0, scale: 1, duration: 1 });
        if (i < cards.length - 1) {
          tl.to(card, { opacity: 0, y: -20, scale: 0.97, duration: 0.5 });
        }
      }
    });

    const trigger = ScrollTrigger.create({
      trigger: container,
      start: 'top 80px',
      end: 'bottom bottom',
      pin: container.querySelector('.cs__sticky') as HTMLElement,
      pinSpacing: false,
      scrub: 0.5,
      animation: tl,
    });

    return () => {
      trigger.kill();
      tl.kill();
    };
  }, []);

  return (
    <div className="cs" ref={containerRef}>
      <div className="cs__sticky">
        <div className="section-header cs__header">
          <h2>What sets us apart</h2>
          <p>The difference between the industry standard and our systematic approach.</p>
        </div>

        <div className="cs__card-stack">
          {SIDES.map((side, i) => (
            <div
              className="compare-card cs__card"
              key={side.id}
              style={{
                opacity: i === 0 ? 1 : 0,
                position: i === 0 ? 'relative' : 'absolute',
                top: i === 0 ? 'auto' : 0,
                left: i === 0 ? 'auto' : 0,
                right: i === 0 ? 'auto' : 0,
              }}
              ref={(el) => { cardsRef.current[i] = el; }}
            >
              <div className="compare-side__header">
                <span className={`compare-label ${side.labelClass}`}>{side.label}</span>
                <h3 className={`compare-title ${side.titleClass}`}>{side.title}</h3>
              </div>
              <div className="compare-points">
                {side.points.map((pt) => (
                  <div className="compare-point" key={pt.title}>
                    <IconBadge type={pt.icon} />
                    <div>
                      <h4 className="compare-point__title">{pt.title}</h4>
                      <p className="compare-point__desc">{pt.desc}</p>
                      <BarVisual type={pt.bar} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="cs__spacer" />
    </div>
  );
}
