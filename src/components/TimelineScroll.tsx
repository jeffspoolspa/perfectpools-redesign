import { useEffect, useRef } from 'preact/hooks';
import { buildCardStackTimeline } from '../utils/card-stack-timeline';
import { getHeaderOffset } from '../utils/scroll-config';

const PHASES = [
  {
    numeral: 'I',
    badge: 'New Beginning',
    badgeClass: '',
    title: 'Formation of PSAC',
    content: [
      'Pool Services Acquisition Co. (PSAC) was founded to bring a higher standard of professionalism, communication, and service quality to the pool services industry.',
      'While the market presented significant growth opportunities, many service companies struggled to deliver consistently excellent customer communication and operational reliability. PSAC was created to combine strong operational systems with technical expertise in order to elevate quality of service and customer experience in the pool service space.',
    ],
  },
  {
    numeral: 'II',
    badge: 'The Foundation',
    badgeClass: 'blue',
    title: "Jeff's Pool & Spa Service",
    content: [
      "PSAC's first major step was partnering with Jeff's Pool & Spa Service (JPS) in the Golden Isles of Georgia and Fernandina Beach Florida. JPS brought 20 years of operational expertise, a highly experienced team, and a culture of deep technical expertise and client service.",
      'JPS was known for something rare in the maintenance world — deep equipment expertise. Pumps, filtration, heaters, automation, lighting, and complex hydraulic systems across both residential and large-scale commercial properties.',
      "JPS became the foundation: a complete care model where the same company that maintains your pool also understands your system end to end, keeps your equipment running, and stands behind their work as one of the few approved warranty service providers.",
    ],
  },
  {
    numeral: 'III',
    badge: 'Perfect Pools',
    badgeClass: 'green',
    title: 'Expanding Up the Coast',
    content: [
      "PSAC's next partnership came with Perfect Pools, expanding the company's footprint up the Georgia coast to Richmond Hill and Savannah. Erin founded the company ~20 years ago and under her leadership, Perfect Pools built a reputation for meticulous attention to detail and a strong commitment to service quality.",
      'The company specialized in servicing high-end residential pools, commercial properties, property managers, and HOAs while bringing this professional level of service to residential customers.',
      "The partnership combined JPS's technical depth with PP's service culture. Combined under PSAC, both brands were able to serve the entire Georgia Coast under a single standard: complete care, no gaps, no excuses.",
    ],
  },
  {
    numeral: 'IV',
    badge: 'Focused Partnerships',
    badgeClass: 'orange',
    title: 'Pool Solutions Plus',
    content: [
      'While prioritizing getting better before getting bigger, PSAC continues to seek out partners who share our values. After working with Tom, founder of Pool Solutions Plus (PSP), on several large-scale commercial pool renovations, it became clear that we shared the same commitment to quality and craftsmanship.',
      'A partnership was formed that allows each company to focus on what they do best. Pool Solutions Plus continues to concentrate on building exceptional pools, while Perfect Pools focuses on maintaining and servicing them to the highest standards. This alignment strengthens both organizations and ensures customers receive expert care throughout the full lifecycle of their pools.',
    ],
  },
  {
    numeral: 'V',
    badge: 'Savannah Branch',
    badgeClass: 'teal',
    title: 'Opening of the Savannah Hub',
    content: [
      "The next stage of growth is the opening of the Perfect Pools Savannah branch, which serves as a centralized operations hub for the region. This location brings together the best practices and operational strengths developed across the company's other branches.",
      'The location is strategically positioned and designed for efficient service across Savannah, Tybee Island, Skidaway Island, Pooler, and Bluffton within roughly a 30-minute service radius. The facility is designed for operational excellence on fleet and inventory management, employee training, and prompt dispatch.',
      'With this footprint in place, PSAC is best positioned to provide the highest level of service across all of our markets.',
    ],
  },
];

export default function TimelineScroll() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionRef.current) return;

    import('gsap').then(({ gsap }) => {
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger);

        const cards = Array.from(sectionRef.current!.querySelectorAll('.tl-card')) as HTMLElement[];
        const markers = Array.from(sectionRef.current!.querySelectorAll('.tl-marker')) as HTMLElement[];
        if (!cards.length) return;

        // Track which marker is active so we only update on change
        let activeMarkerIndex = 0;

        const setActiveMarker = (index: number) => {
          if (index === activeMarkerIndex) return;
          // Deactivate previous
          gsap.to(markers[activeMarkerIndex], { scale: 1, background: '#e5e7eb', duration: 0.3 });
          (markers[activeMarkerIndex] as HTMLElement).querySelector('.tl-numeral')!.style.color = '#6b7280';
          // Activate new
          gsap.to(markers[index], { scale: 1.2, background: '#145BB8', duration: 0.3 });
          (markers[index] as HTMLElement).querySelector('.tl-numeral')!.style.color = '#fff';
          activeMarkerIndex = index;
        };

        // Set first marker active immediately
        gsap.set(markers[0], { scale: 1.2, background: '#145BB8' });
        (markers[0] as HTMLElement).querySelector('.tl-numeral')!.style.color = '#fff';

        const tl = buildCardStackTimeline(gsap, cards, {
          enterStyle: 'slide-up',
          exitStyle: 'fade-out-up',
          enterEase: 'power2.out',
          exitEase: 'power1.in',
          holdDuration: 0.6,
          crossfadeDuration: 1,
        });

        ScrollTrigger.create({
          trigger: sectionRef.current,
          pin: stickyRef.current,
          start: () => `top top+=${getHeaderOffset()}`,
          end: 'bottom bottom',
          pinSpacing: false,
          animation: tl,
          scrub: 1,
          onUpdate: (self: any) => {
            const totalCards = cards.length;
            const index = Math.min(
              totalCards - 1,
              Math.floor(self.progress * totalCards)
            );
            setActiveMarker(index);
          },
        });
      });
    });
  }, []);

  return (
    <div ref={sectionRef} class="tl-scroll">
      {/* Mobile: header scrolls naturally */}
      <div class="section-header tl__header tl__header--mobile">
        <span class="section-kicker">OUR STORY</span>
        <h2>Built by Bringing the Best Together</h2>
        <p>Five partnerships that shaped how we take care of your pool.</p>
      </div>

      <div ref={stickyRef} class="tl-sticky">
        {/* Desktop: header inside sticky */}
        <div class="section-header tl__header tl__header--desktop">
          <span class="section-kicker">OUR STORY</span>
          <h2>Built by Bringing the Best Together</h2>
          <p>Five partnerships that shaped how we take care of your pool.</p>
        </div>

        <div class="tl__content-row">
          {/* Left: markers */}
          <div class="tl-markers">
            <div class="tl-line"></div>
            {PHASES.map((p, i) => (
              <div key={i} class="tl-marker">
                <span class="tl-numeral">{p.numeral}</span>
              </div>
            ))}
          </div>

          {/* Right: card stack */}
          <div class="tl-card-area">
            {PHASES.map((p, i) => (
              <div key={i} class={`tl-card`} style={i !== 0 ? 'opacity: 0; position: absolute; top: 0; left: 0; right: 0;' : ''}>
                <span class={`tl-badge tl-badge--${p.badgeClass || 'default'}`}>{p.badge}</span>
                <h3>{p.title}</h3>
                {p.content.map((para, j) => (
                  <p key={j}>{para}</p>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="tl__spacer" />
    </div>
  );
}
