import { useState } from 'preact/hooks';

/*
  IMPORTANT: Icon/label positions were carefully tuned in the static SVG.
  DO NOT change cx, cy, rotate, iconY, iconSize, textY, circleY, or circleR
  without visually verifying alignment. These values produce centered
  icon+label combos with equal padding from inner/outer blade edges.
*/

const PILLARS = [
  {
    id: 'sanitation',
    label: 'Sanitation',
    icon: '/images/pillar-chlorine.svg',
    color: 'var(--color-dark-blue, #0c4a6e)',
    colorHover: '#083d5a',
    bladePath: 'M152.4 53.1L35.2 237L93.8 328.9L211 145L152.4 53.1Z',
    // Exact position from static SVG — DO NOT CHANGE
    cx: 123, cy: 191, rotate: -57.5,
    circleR: 26, circleY: -12,
    iconX: -18, iconY: -30, iconSize: 36,
    textY: 30,
    heading: 'Sanitation & Disinfection',
    description: 'Placeholder content for sanitation pillar. We will fill this in with real content about chlorine management, sanitizer levels, and how we keep your pool safe from bacteria and algae.',
  },
  {
    id: 'balance',
    label: 'Balance',
    icon: '/images/pillar-ph.svg',
    color: 'var(--color-cyan, #06b6d4)',
    colorHover: '#059db5',
    bladePath: 'M152.4 237L93.8 328.9H328.2L386.8 237H152.4Z',
    cx: 240, cy: 283, rotate: 0,
    circleR: 26, circleY: -12,
    iconX: -18, iconY: -30, iconSize: 36,
    textY: 30,
    heading: 'Water Balance & Chemistry',
    description: 'Placeholder content for balance pillar. We will fill this in with real content about pH, alkalinity, calcium hardness, and the Langelier Saturation Index.',
  },
  {
    id: 'filtration',
    label: 'Filtration',
    icon: '/images/pillar-water.svg',
    color: 'var(--color-primary, #0284c7)',
    colorHover: '#0272ad',
    bladePath: 'M269.6 237H386.8L269.6 53.1H152.4L269.6 237Z',
    cx: 270, cy: 145, rotate: 57.5,
    circleR: 26, circleY: -12,
    iconX: -18, iconY: -30, iconSize: 36,
    textY: 30,
    heading: 'Filtration & Circulation',
    description: 'Placeholder content for filtration pillar. We will fill this in with real content about filter maintenance, pump runtime, flow rates, and circulation patterns.',
  },
  {
    id: 'flow',
    label: 'Flow',
    icon: '/images/pillar-flow.svg',
    color: '#9ca3af',
    colorHover: '#6b7280',
    bladePath: 'M211 145L152.4 237H269.6L211 145Z',
    cx: 211, cy: 200, rotate: 0,
    circleR: 18, circleY: -6,
    iconX: -10, iconY: -16, iconSize: 20,
    textY: 22,
    heading: 'The Flow \u2014 How It All Connects',
    description: 'Placeholder content for the flow pillar. We will fill this in with real content about how sanitation, balance, and filtration work as an interconnected system.',
  },
];

export default function PillarsTriangle() {
  const [active, setActive] = useState('sanitation');
  const activePillar = PILLARS.find(p => p.id === active)!;
  const isSmallLabel = (id: string) => id === 'flow';

  return (
    <div className="pillars-interactive">
      {/* Left: Triangle Diagram */}
      <div className="pillars-interactive__diagram">
        <svg
          viewBox="-10 -10 442 402"
          xmlns="http://www.w3.org/2000/svg"
          className="pillars-interactive__svg"
        >
          {PILLARS.map((p) => {
            const isActive = active === p.id;
            const small = isSmallLabel(p.id);

            return (
              <g
                key={p.id}
                onClick={() => setActive(p.id)}
                onMouseEnter={() => setActive(p.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Blade shape */}
                <path
                  d={p.bladePath}
                  style={{
                    fill: isActive ? p.colorHover : p.color,
                    filter: isActive ? 'drop-shadow(0 4px 16px rgba(0,0,0,0.3))' : 'none',
                    transition: 'fill 0.3s ease, filter 0.3s ease',
                  }}
                />

                {/* Icon + label group — EXACT positions from static SVG */}
                <g
                  transform={`translate(${p.cx}, ${p.cy})${p.rotate ? ` rotate(${p.rotate})` : ''}`}
                  style={{ opacity: isActive ? 1 : 0.7, transition: 'opacity 0.3s ease' }}
                  pointer-events="none"
                >
                  <circle
                    cx="0"
                    cy={p.circleY}
                    r={p.circleR}
                    fill={isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.12)'}
                    stroke={isActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.2)'}
                    stroke-width="1"
                    style={{ transition: 'fill 0.3s ease, stroke 0.3s ease' }}
                  />
                  <image
                    href={p.icon}
                    x={p.iconX}
                    y={p.iconY}
                    width={p.iconSize}
                    height={p.iconSize}
                    opacity="0.92"
                  />
                  <text
                    x="0"
                    y={p.textY}
                    text-anchor="middle"
                    fill="white"
                    fill-opacity="0.95"
                    font-size={small ? '12' : '15'}
                    font-weight="600"
                    font-family="Poppins, system-ui, sans-serif"
                    letter-spacing="0.12em"
                    style={{
                      textTransform: 'uppercase',
                      paintOrder: 'stroke',
                      stroke: 'rgba(0,0,0,0.15)',
                      strokeWidth: '0.5px',
                    } as any}
                  >
                    {p.label}
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right: Detail Panel — border color matches active pillar */}
      <div
        className="pillars-interactive__panel"
        key={active}
        style={{ borderColor: activePillar.color }}
      >
        <div className="pi-panel__header">
          <div className="pi-panel__icon" style={{ background: activePillar.color }}>
            <img src={activePillar.icon} alt="" />
          </div>
          <h3 className="pi-panel__title" style={{ color: activePillar.color }}>
            {activePillar.heading}
          </h3>
        </div>
        <div className="pi-panel__body">
          <p>{activePillar.description}</p>
        </div>
      </div>
    </div>
  );
}
