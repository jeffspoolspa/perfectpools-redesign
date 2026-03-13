/** ChemicalCostChart — SVG seasonal cost visualization for the quote page.
 *  Shows prospective customers what to expect for chemical costs by season,
 *  using pre-computed percentile data from billing_audit.chemical_cost_estimates.
 *
 *  Two visualizations:
 *  1. Cost Range Card — seasonal summary (Summer / Spring-Fall / Winter)
 *  2. Seasonal SVG Chart — 12-month area chart with p25-p75 band + median line
 */

interface ChemCostRow {
  calendar_month: number;
  season: string;
  service_frequency: string;
  chem_p25: number;
  chem_median: number;
  chem_p75: number;
  total_p25: number;
  total_median: number;
  total_p75: number;
  sample_size: number;
}

interface ChemicalCostChartProps {
  data: ChemCostRow[];
  serviceMonthly: number;
  competitorFlat?: number;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const SEASONS = [
  { key: 'summer', label: 'Summer', period: 'Jun – Aug', color: '#f59e0b' },
  { key: 'shoulder', label: 'Spring / Fall', period: 'Mar–May, Sep–Nov', color: '#0284c7' },
  { key: 'winter', label: 'Winter', period: 'Dec – Feb', color: '#64748b' },
];

/* ── Helpers ── */

function num(v: string | number): number {
  return typeof v === 'string' ? parseFloat(v) : v;
}

/** Build a smooth SVG path using cardinal spline interpolation */
function smoothPath(points: { x: number; y: number }[], tension: number = 0.3): string {
  if (points.length < 2) return '';
  if (points.length === 2) return `M${points[0].x},${points[0].y} L${points[1].x},${points[1].y}`;

  let d = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Build a closed area path from top line + bottom line (reversed) */
function areaPath(
  topPoints: { x: number; y: number }[],
  botPoints: { x: number; y: number }[],
  tension: number = 0.3
): string {
  const topPath = smoothPath(topPoints, tension);
  const botReversed = [...botPoints].reverse();
  const botPath = smoothPath(botReversed, tension).replace(/^M/, 'L');
  return `${topPath} ${botPath} Z`;
}

/* ── Main Component ── */

export default function ChemicalCostChart({ data, serviceMonthly, competitorFlat = 300 }: ChemicalCostChartProps) {
  if (!data || data.length < 6) return null;

  const sorted = [...data].sort((a, b) => num(a.calendar_month) - num(b.calendar_month));

  /* Combine user's service base + chemical data for total cost chart */
  const combined = sorted.map(d => ({
    month: num(d.calendar_month),
    season: d.season,
    low: serviceMonthly + num(d.chem_p25),
    mid: serviceMonthly + num(d.chem_median),
    high: serviceMonthly + num(d.chem_p75),
    chemLow: num(d.chem_p25),
    chemMid: num(d.chem_median),
    chemHigh: num(d.chem_p75),
    samples: num(d.sample_size),
  }));

  return (
    <div class="chem-cost-section">
      <div class="chem-cost-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2" />
          <path d="M8.5 2h7" />
          <path d="M7 16.5h10" />
        </svg>
        <span>Estimated Chemical Costs</span>
      </div>

      {renderCostRangeCards(combined)}
      {renderSeasonalChart(combined, competitorFlat)}

      <div class="chem-chart-insight">
        Some months you'll pay more than a flat rate, some months less — but overall you pay for what you actually use instead of overpaying year-round.
      </div>
    </div>
  );
}

/* ── Cost Range Cards ── */

type CombinedRow = {
  month: number;
  season: string;
  low: number;
  mid: number;
  high: number;
  chemLow: number;
  chemMid: number;
  chemHigh: number;
  samples: number;
};

function renderCostRangeCards(combined: CombinedRow[]) {
  return (
    <div class="chem-cost-seasons">
      {SEASONS.map(s => {
        const rows = combined.filter(d => d.season === s.key);
        if (!rows.length) return null;
        const minChem = Math.round(Math.min(...rows.map(r => r.chemLow)));
        const maxChem = Math.round(Math.max(...rows.map(r => r.chemHigh)));
        return (
          <div key={s.key} class="chem-cost-season-card">
            <span class="chem-season-label" style={{ color: s.color }}>{s.label}</span>
            <span class="chem-season-range">${minChem} – ${maxChem}</span>
            <span class="chem-season-period">{s.period}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Seasonal SVG Chart ── */

function renderSeasonalChart(combined: CombinedRow[], competitorFlat: number) {
  const CHART_W = 360;
  const CHART_H = 180;
  const PAD = { top: 15, right: 20, bottom: 28, left: 44 };
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  /* Y-axis scale */
  const allVals = combined.flatMap(d => [d.low, d.high]);
  allVals.push(competitorFlat);
  const yMax = Math.ceil(Math.max(...allVals) / 50) * 50 + 25;
  const yMin = Math.floor(Math.min(...allVals) / 50) * 50 - 25;
  const yRange = yMax - yMin;

  const xScale = (month: number) => PAD.left + ((month - 1) / 11) * plotW;
  const yScale = (val: number) => PAD.top + plotH - ((val - yMin) / yRange) * plotH;

  /* Build paths */
  const topPoints = combined.map(d => ({ x: xScale(d.month), y: yScale(d.high) }));
  const botPoints = combined.map(d => ({ x: xScale(d.month), y: yScale(d.low) }));
  const midPoints = combined.map(d => ({ x: xScale(d.month), y: yScale(d.mid) }));

  const bandD = areaPath(topPoints, botPoints);
  const medianD = smoothPath(midPoints);

  /* Y gridlines */
  const gridStep = yRange <= 200 ? 50 : 100;
  const gridLines: number[] = [];
  for (let v = Math.ceil(yMin / gridStep) * gridStep; v <= yMax; v += gridStep) {
    gridLines.push(v);
  }

  /* Reference line */
  const refY = yScale(competitorFlat);

  /* Summer highlight zone (Jun=6 to Aug=8) */
  const summerX1 = xScale(6) - plotW / 24;
  const summerX2 = xScale(8) + plotW / 24;

  /* Current month indicator */
  const now = new Date();
  const curMonth = now.getMonth() + 1;
  const curRow = combined.find(d => d.month === curMonth);

  return (
    <div class="chem-chart-container">
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} class="chem-chart-svg" role="img" aria-label="Monthly cost chart showing seasonal chemical cost variation">
        <defs>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#0284c7" stop-opacity="0.15" />
            <stop offset="100%" stop-color="#0284c7" stop-opacity="0.04" />
          </linearGradient>
        </defs>

        {/* Summer highlight zone */}
        <rect
          x={summerX1} y={PAD.top}
          width={summerX2 - summerX1} height={plotH}
          fill="rgba(251, 146, 60, 0.05)" rx="3"
        />

        {/* Y-axis gridlines */}
        {gridLines.map(v => (
          <g key={v}>
            <line
              x1={PAD.left} y1={yScale(v)}
              x2={PAD.left + plotW} y2={yScale(v)}
              stroke="#e5e7eb" stroke-width="0.5"
            />
            <text
              x={PAD.left - 6} y={yScale(v) + 3}
              text-anchor="end" font-size="8" fill="#9ca3af"
            >
              ${v}
            </text>
          </g>
        ))}

        {/* P25-P75 shaded band */}
        <path d={bandD} fill="url(#bandGrad)" stroke="none" />

        {/* Band edge lines (subtle) */}
        <path d={smoothPath(topPoints)} fill="none" stroke="#0284c7" stroke-width="0.5" opacity="0.3" />
        <path d={smoothPath(botPoints)} fill="none" stroke="#0284c7" stroke-width="0.5" opacity="0.3" />

        {/* Median line */}
        <path d={medianD} fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" />

        {/* Competitor flat-rate reference line */}
        <line
          x1={PAD.left} y1={refY}
          x2={PAD.left + plotW} y2={refY}
          stroke="#ef4444" stroke-width="1" stroke-dasharray="5,3" opacity="0.6"
        />
        <text
          x={PAD.left + plotW + 3} y={refY + 3}
          font-size="7" fill="#ef4444" opacity="0.8"
        >
          $300
        </text>
        <text
          x={PAD.left + plotW + 3} y={refY + 11}
          font-size="6" fill="#ef4444" opacity="0.6"
        >
          flat rate
        </text>

        {/* Current month dot */}
        {curRow && (
          <circle
            cx={xScale(curMonth)} cy={yScale(curRow.mid)}
            r="3.5" fill="#0284c7" stroke="#fff" stroke-width="1.5"
          />
        )}

        {/* X-axis month labels */}
        {MONTH_SHORT.map((label, i) => (
          <text
            key={i}
            x={xScale(i + 1)} y={CHART_H - 8}
            text-anchor="middle" font-size="8"
            fill={i + 1 === curMonth ? '#0284c7' : '#9ca3af'}
            font-weight={i + 1 === curMonth ? '700' : '400'}
          >
            {label}
          </text>
        ))}

        {/* Legend */}
        <g transform={`translate(${PAD.left + 4}, ${PAD.top + 4})`}>
          <rect x="0" y="0" width="8" height="8" rx="1.5" fill="rgba(2,132,199,0.15)" stroke="#0284c7" stroke-width="0.5" />
          <text x="11" y="7" font-size="7" fill="#6b7280">Typical range (most customers)</text>
          <line x1="0" y1="16" x2="8" y2="16" stroke="#0284c7" stroke-width="1.5" />
          <text x="11" y="19" font-size="7" fill="#6b7280">Median total cost</text>
        </g>
      </svg>
    </div>
  );
}
