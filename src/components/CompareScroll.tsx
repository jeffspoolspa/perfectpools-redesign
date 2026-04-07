import { useEffect, useRef } from 'preact/hooks';
import { buildCardStackTimeline } from '../utils/card-stack-timeline';
import { getHeaderOffset } from '../utils/scroll-config';

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

    let trigger: any;
    let tl: any;

    import('gsap').then(({ gsap }) => {
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);

        tl = buildCardStackTimeline(gsap, cards, {
          enterStyle: 'slide-left',
          exitStyle: 'fade-out-left',
          enterEase: 'power3.out',
          exitEase: 'power2.in',
          holdDuration: 0.8,
          crossfadeDuration: 1,
        });

        trigger = ScrollTrigger.create({
          trigger: container,
          start: () => `top top+=${getHeaderOffset()}`,
          end: 'bottom bottom',
          pin: container.querySelector('.cs__sticky') as HTMLElement,
          pinSpacing: false,
          scrub: 1,
          animation: tl,
        });
      });
    });

    return () => {
      trigger?.kill();
      tl?.kill();
    };
  }, []);

  return (
    <div className="cs" ref={containerRef}>
      {/* Mobile: header scrolls naturally */}
      <div className="section-header cs__header cs__header--mobile">
        <h2>What sets us apart</h2>
        <p>The difference between the industry standard and our systematic approach.</p>
      </div>

      <div className="cs__sticky">
        {/* Desktop: header inside sticky */}
        <div className="section-header cs__header cs__header--desktop">
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
