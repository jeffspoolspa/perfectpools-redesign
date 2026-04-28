/**
 * FiltrationDiagram — Filtration pillar visualization.
 *
 * Side-by-side schematic split by a vertical filter bar:
 *   Left  ("Total chlorine demand")  — large earthy particles (leaves,
 *                                       debris, sunscreen, oils, dead
 *                                       algae) plus small green dots
 *                                       (dissolved load).
 *   Filter — vertical gradient bar in the center.
 *   Right ("Remaining demand") — only the small green dots that pass
 *                                 through the filter.
 *
 * Static / presentational. Sits in the right column of the pillars
 * section the same way LSICalculator and SanitationTabs do — no chrome,
 * just stacked content (intro · svg · caption · legend · meta).
 */

export default function FiltrationDiagram() {
  return (
    <div class="filt">
      <p class="filt__intro">
        Most chlorine demand in a pool is <strong>particulate, not dissolved</strong>.
        Leaves, sunscreen, oils, even already-dead algae oxidize chlorine on contact.
        A clean filter pulls them out before they ever reach the sanitizer.
      </p>

      <div class="filt__svg-wrap">
        <svg
          class="filt__svg"
          viewBox="0 0 1000 560"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Diagram showing how filtration removes particulate matter from pool water, leaving only dissolved chlorine demand"
        >
          <defs>
            {/* Particle gradients in the brand's blue/green palette. Each
                gradient pairs a lighter highlight stop with the brand mid
                tone and a deep shadow for dimensional warmth. */}
            <radialGradient id="filt-g-leaf" cx="35%" cy="32%" r="70%">
              <stop offset="0%" stop-color="#6BBA66" />
              <stop offset="55%" stop-color="#2f7a38" />
              <stop offset="100%" stop-color="#143015" />
            </radialGradient>
            <radialGradient id="filt-g-debris" cx="35%" cy="32%" r="70%">
              <stop offset="0%" stop-color="#4a7aa8" />
              <stop offset="55%" stop-color="#1E3A5F" />
              <stop offset="100%" stop-color="#0B1320" />
            </radialGradient>
            <radialGradient id="filt-g-oil" cx="35%" cy="32%" r="70%">
              <stop offset="0%" stop-color="#4DD4E8" />
              <stop offset="55%" stop-color="#06b6d4" />
              <stop offset="100%" stop-color="#074E5D" />
            </radialGradient>
            <radialGradient id="filt-g-algae" cx="35%" cy="32%" r="70%">
              <stop offset="0%" stop-color="#3a9b7a" />
              <stop offset="55%" stop-color="#1e6047" />
              <stop offset="100%" stop-color="#0c3329" />
            </radialGradient>
            <linearGradient id="filt-g-bar" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stop-color="#B7BFC6" />
              <stop offset="50%" stop-color="#D8DDE2" />
              <stop offset="100%" stop-color="#B7BFC6" />
            </linearGradient>
            <marker
              id="filt-flow-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M0,0 L8,4 L0,8 z" fill="var(--arrow-stroke)" />
            </marker>
          </defs>

          {/* LEFT half — translated right by 31 to follow the filter bar's
              shift to the viewBox center, keeping the content visually
              centered within the new wider left half. */}
          <g transform="translate(31, 0)">
            <text x="240" y="38" text-anchor="middle" class="filt__col-title">
              Total chlorine demand
            </text>

            {/* Cluster 1 — Leaves, debris */}
            <line class="filt__callout-line" x1="100" y1="200" x2="100" y2="500" />
            <g class="filt__particle">
              <circle cx="68" cy="170" r="34" fill="url(#filt-g-debris)" />
            </g>
            <g class="filt__particle">
              <circle cx="48" cy="240" r="26" fill="url(#filt-g-debris)" />
            </g>
            <g class="filt__particle">
              <circle cx="100" cy="200" r="20" fill="url(#filt-g-leaf)" stroke="#9aa9b0" stroke-width="1.2" />
              <circle cx="100" cy="200" r="3" fill="none" stroke="#9aa9b0" stroke-width="1" />
            </g>
            <g class="filt__particle">
              <circle cx="65" cy="320" r="22" fill="url(#filt-g-leaf)" />
            </g>
            <g class="filt__particle">
              <circle cx="115" cy="370" r="30" fill="url(#filt-g-debris)" />
            </g>
            <g class="filt__particle">
              <circle cx="80" cy="430" r="24" fill="url(#filt-g-leaf)" />
            </g>

            {/* Cluster 2 — Sunscreen, oils */}
            <line class="filt__callout-line" x1="220" y1="220" x2="220" y2="500" />
            <g class="filt__particle">
              <circle cx="180" cy="140" r="28" fill="url(#filt-g-debris)" />
            </g>
            <g class="filt__particle">
              <circle cx="155" cy="220" r="32" fill="url(#filt-g-oil)" />
              <circle cx="155" cy="220" r="3" fill="none" stroke="#9aa9b0" stroke-width="1" />
            </g>
            <g class="filt__particle">
              <circle cx="220" cy="290" r="40" fill="url(#filt-g-oil)" />
            </g>
            <g class="filt__particle">
              <circle cx="170" cy="380" r="26" fill="url(#filt-g-oil)" />
            </g>
            <g class="filt__particle">
              <circle cx="200" cy="450" r="18" fill="url(#filt-g-debris)" />
            </g>

            {/* Cluster 3 — Dead algae */}
            <line class="filt__callout-line" x1="320" y1="155" x2="320" y2="500" />
            <g class="filt__particle">
              <circle cx="320" cy="130" r="22" fill="url(#filt-g-leaf)" stroke="#9aa9b0" stroke-width="1.2" />
              <circle cx="320" cy="130" r="3" fill="none" stroke="#9aa9b0" stroke-width="1" />
            </g>
            <g class="filt__particle">
              <circle cx="295" cy="240" r="28" fill="url(#filt-g-debris)" />
            </g>
            <g class="filt__particle">
              <circle cx="290" cy="340" r="20" fill="url(#filt-g-algae)" />
            </g>
            <g class="filt__particle">
              <circle cx="335" cy="420" r="24" fill="url(#filt-g-algae)" />
            </g>
            <g class="filt__particle">
              <circle cx="270" cy="430" r="14" fill="url(#filt-g-algae)" />
            </g>

            {/* Dissolved dots — left side */}
            {[
              [160, 100, 4.5], [240, 180, 4], [280, 180, 4.5], [135, 290, 4],
              [240, 370, 4.5], [280, 280, 4], [305, 360, 4], [180, 320, 4],
              [350, 260, 4.5], [370, 380, 4], [220, 100, 4.5], [370, 200, 4],
              [360, 90, 4.5],
            ].map(([cx, cy, r], i) => (
              <circle key={`l${i}`} cx={cx} cy={cy} r={r} fill="var(--p-dissolved)" />
            ))}

            {/* Left particle labels */}
            <text x="100" y="525" text-anchor="middle" class="filt__particle-label">
              Leaves, debris
            </text>
            <text x="220" y="525" text-anchor="middle" class="filt__particle-label">
              Sunscreen, oils
            </text>
            <text x="320" y="525" text-anchor="middle" class="filt__particle-label">
              Dead algae
            </text>
          </g>

          <text x="780" y="38" text-anchor="middle" class="filt__col-title">
            Remaining demand
          </text>

          {/* Filter bar — centered in the viewBox so it lines up with the
              caption divider below it. */}
          <rect
            x="493"
            y="40"
            width="14"
            height="490"
            rx="3"
            fill="url(#filt-g-bar)"
            stroke="#9aa9b0"
            stroke-width="0.5"
          />
          <text x="500" y="552" text-anchor="middle" class="filt__filter-label">
            Filter
          </text>

          {/* Wavy flow indicators — gentle waves rightward, suggesting the
              filtered water continuing past the filter. */}
          {[185, 285, 385].map((y, i) => (
            <path
              key={`flow-${i}`}
              class="filt__flow"
              d={`M 520 ${y} q 14 -8 28 0 t 28 0 t 28 0`}
              marker-end="url(#filt-flow-arrow)"
            />
          ))}

          {/* Right callout dot — centered (x=740) under the right content
              cluster (dots span x=560 to x=920). Label below shares this x
              so it reads as centered beneath the right field. */}
          <g class="filt__particle filt__particle--callout">
            <circle cx="740" cy="290" r="6" fill="var(--p-dissolved)" />
          </g>
          <line class="filt__callout-line" x1="740" y1="296" x2="740" y2="500" />

          {/* Dissolved dots — right side. (Originally included a dot at
              [740, 425]; removed because the new callout line at x=740
              would pass through it.) */}
          {[
            [580, 120, 4.5], [700, 100, 4], [850, 135, 4.5], [780, 155, 4],
            [620, 195, 4.5], [900, 190, 4], [730, 220, 4.5], [820, 250, 4],
            [690, 335, 4.5], [800, 350, 4], [600, 385, 4.5], [880, 370, 4],
            [640, 450, 4], [830, 445, 4.5], [920, 310, 4],
            [560, 330, 4.5], [780, 475, 4],
          ].map(([cx, cy, r], i) => (
            <circle key={`r${i}`} cx={cx} cy={cy} r={r} fill="var(--p-dissolved)" />
          ))}

          <text x="740" y="525" text-anchor="middle" class="filt__particle-label">
            Dissolved organics, bacteria, algae spores
          </text>
        </svg>
      </div>

      <div class="filt__caption">
        <div class="filt__caption-side">
          <strong>Left:</strong> the full chlorine load entering circulation. Most of it is
          suspended particulate — and most of it is filterable.
        </div>
        <div class="filt__caption-divider" />
        <div class="filt__caption-side">
          <strong>Right:</strong> what's left for chlorine to handle — dissolved organics,
          free bacteria, and algae spores too small to filter.
        </div>
      </div>

    </div>
  );
}
