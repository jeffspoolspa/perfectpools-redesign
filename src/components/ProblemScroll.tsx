import { useEffect, useRef } from 'preact/hooks';
import { buildCardStackTimeline } from '../utils/card-stack-timeline';
import { getHeaderOffset } from '../utils/scroll-config';

const CARDS = [
  {
    id: 'construction',
    type: 'cinematic',
    headline: 'Construction drives the pool industry.',
    subline: 'Maintenance is an afterthought.',
    body: 'The pool construction market is more than double the size of maintenance nationwide. Most companies are organized around building first — maintenance, if they offer it, is secondary.',
  },
  {
    id: 'operators',
    type: 'cinematic',
    headline: 'Independent operators fill the gap.',
    subline: "But they're stretched thin.",
    body: 'Over 74,000 independent operators across the country do good, honest work. But one or two-person operations mean limited hours, limited equipment expertise, and limited consistency.',
  },
  {
    id: 'cycle',
    type: 'cinematic',
    headline: 'Pool owners get stuck in a cycle.',
    subline: 'Service starts strong. Then it slips.',
    body: "Your tech can clean the pool but can't help when the heater goes out. Visits get missed. And you're back searching for someone new.",
  },
  {
    id: 'resolve',
    type: 'resolution',
    headline: 'Perfect Pools exists to break that cycle.',
    body: 'We partnered with the best local pool professionals in coastal Georgia and gave them the operational support, technology, and capital to do even more — without losing what made them great.',
    bullets: [
      'Technical depth to handle equipment, not just chemistry',
      'Local presence — your tech knows your pool',
      'Operational foundation for consistent, accountable care',
    ],
  },
];

export default function ProblemScroll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    const sticky = stickyRef.current;
    if (!container || !sticky) return;

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
          holdDuration: 0.8,
          crossfadeDuration: 1,
        });

        trigger = ScrollTrigger.create({
          trigger: container,
          start: () => `top top+=${getHeaderOffset()}`,
          end: 'bottom bottom',
          pin: sticky,
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
    <div className="prb" ref={containerRef}>
      {/* Mobile: header scrolls naturally */}
      <div className="section-header prb__header prb__header--mobile">
        <span className="section-kicker">WHY WE EXIST</span>
        <h2>The pool industry has a service problem.</h2>
      </div>

      <div className="prb__sticky" ref={stickyRef}>
        {/* Desktop: header inside sticky */}
        <div className="section-header prb__header prb__header--desktop">
          <span className="section-kicker">WHY WE EXIST</span>
          <h2>The pool industry has a service problem.</h2>
        </div>

        <div className="prb__card-stack">
          {CARDS.map((card, i) => (
            <div
              className={`prb__card ${card.type === 'resolution' ? 'prb__card--resolve' : 'prb__card--dark'}`}
              key={card.id}
              style={{
                opacity: i === 0 ? 1 : 0,
                position: i === 0 ? 'relative' : 'absolute',
                top: i === 0 ? 'auto' : 0,
                left: i === 0 ? 'auto' : 0,
                right: i === 0 ? 'auto' : 0,
              }}
              ref={(el) => { cardsRef.current[i] = el; }}
            >
              {card.type === 'cinematic' ? (
                <div className="prb__cinematic">
                  <h3 className="prb__cinematic-headline">{card.headline}</h3>
                  <p className="prb__cinematic-subline">{card.subline}</p>
                  <p className="prb__cinematic-body">{card.body}</p>
                </div>
              ) : (
                <div className="prb__resolve">
                  <h3 className="prb__resolve-headline">{card.headline}</h3>
                  <p className="prb__resolve-body">{card.body}</p>
                  <ul className="prb__resolve-bullets">
                    {card.bullets?.map((b) => (
                      <li key={b}>
                        <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8.5l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="prb__spacer" />
    </div>
  );
}
