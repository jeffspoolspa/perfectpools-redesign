import { useEffect, useRef } from 'preact/hooks';

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

        const cards = sectionRef.current!.querySelectorAll('.tl-card');
        const markers = sectionRef.current!.querySelectorAll('.tl-marker');
        if (!cards.length) return;

        // Set first card and marker as active immediately
        gsap.set(cards[0], { opacity: 1, y: 0 });
        gsap.set(markers[0], { scale: 1.2, background: '#145BB8' });
        (markers[0] as HTMLElement).querySelector('.tl-numeral')!.style.color = '#fff';

        // Build timeline starting from hold on first card
        const tl = gsap.timeline();
        tl.to({}, { duration: 0.8 }); // hold first card

        for (let i = 1; i < cards.length; i++) {
          tl.to(cards[i - 1], { opacity: 0, y: -20, duration: 0.3 }, `card${i}`);
          tl.to(markers[i - 1], { scale: 1, background: '#e5e7eb', duration: 0.3, onUpdate() { (markers[i-1] as HTMLElement).querySelector('.tl-numeral')!.style.color = '#6b7280'; } }, `card${i}`);
          tl.fromTo(cards[i], { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5 }, `card${i}`);
          tl.to(markers[i], { scale: 1.2, background: '#145BB8', duration: 0.3, onUpdate() { (markers[i] as HTMLElement).querySelector('.tl-numeral')!.style.color = '#fff'; } }, `card${i}`);
          tl.to({}, { duration: 0.8 }); // hold
        }

        ScrollTrigger.create({
          trigger: sectionRef.current,
          pin: stickyRef.current,
          start: 'top 100px',
          end: `+=${cards.length * 600}`,
          animation: tl,
          scrub: 0.5,
        });
      });
    });
  }, []);

  return (
    <div ref={sectionRef} class="tl-scroll">
      <div ref={stickyRef} class="tl-sticky">
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
  );
}
