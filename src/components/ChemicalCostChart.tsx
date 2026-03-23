import { useState } from 'preact/hooks';

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
  compact?: boolean;
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

/* ── Compact Tabbed View (for pricing cards) ── */

function CompactChemView({ combined, competitorFlat }: { combined: CombinedRow[]; competitorFlat: number }) {
  const [activeTab, setActiveTab] = useState<'demand' | 'total'>('demand');

  return (
    <div class="chem-compact">
      <div class="chem-compact__tabs">
        <button
          class={`chem-compact__tab ${activeTab === 'demand' ? 'chem-compact__tab--active' : ''}`}
          onClick={() => setActiveTab('demand')}
        >
          Chemical Demand
        </button>
        <button
          class={`chem-compact__tab ${activeTab === 'total' ? 'chem-compact__tab--active' : ''}`}
          onClick={() => setActiveTab('total')}
        >
          Total Monthly Cost
        </button>
      </div>

      <div class="chem-compact__panel">
        {activeTab === 'demand' ? (
          <div>
            <p class="chem-chart-preheader">Your costs scale with the season, not against you — higher in summer when you're using the pool, and savings in the offseason.</p>
            <p class="chem-data-note" style="margin-top: 0.75rem; margin-bottom: 0.25rem;">Based on real billing data from 2,000+ weekly residential cleaning visits.</p>
            {renderChemNumberLine(combined)}
          </div>
        ) : (
          <div>
            <p class="chem-chart-preheader">Large pools and high-debris properties get the chemicals they actually need, while smaller or screened-in pools pay less because they use less.</p>
            <p class="chem-data-note" style="margin-top: 0.75rem; margin-bottom: 0.25rem;">Based on real billing data from 2,000+ weekly residential cleaning visits.</p>
            {renderSeasonalChart(combined, competitorFlat)}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChemicalCostChart({ data, serviceMonthly, competitorFlat = 300, compact = false }: ChemicalCostChartProps) {
  if (!data || data.length < 6) return null;

  const sorted = [...data].sort((a, b) => num(a.calendar_month) - num(b.calendar_month));

  /* Per-month MAD ranges computed from raw billing data (272 weekly PM customers).
     These are true median ± MAD, not approximations. */
  const monthlyMAD: Record<number, { median: number; low: number; high: number }> = {
    1:  { median: 63,  low: 33,  high: 93 },
    2:  { median: 65,  low: 31,  high: 99 },
    3:  { median: 77,  low: 41,  high: 114 },
    4:  { median: 87,  low: 47,  high: 127 },
    5:  { median: 117, low: 59,  high: 176 },
    6:  { median: 114, low: 60,  high: 167 },
    7:  { median: 109, low: 57,  high: 161 },
    8:  { median: 101, low: 55,  high: 146 },
    9:  { median: 98,  low: 61,  high: 136 },
    10: { median: 85,  low: 52,  high: 118 },
    11: { median: 66,  low: 31,  high: 101 },
    12: { median: 73,  low: 45,  high: 101 },
  };

  const combined = sorted.map(d => {
    const mo = num(d.calendar_month);
    const mad = monthlyMAD[mo] || { median: num(d.chem_median), low: num(d.chem_p25), high: num(d.chem_p75) };
    return {
      month: mo,
      season: d.season,
      low: serviceMonthly + mad.low,
      mid: serviceMonthly + mad.median,
      high: serviceMonthly + mad.high,
      chemLow: mad.low,
      chemMid: mad.median,
      chemHigh: mad.high,
      samples: num(d.sample_size),
    };
  });

  if (compact) {
    return <CompactChemView combined={combined} competitorFlat={competitorFlat} />;
  }

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
      {renderChemNumberLine(combined)}
      {renderSeasonalChart(combined, competitorFlat)}

      <div class="chem-chart-insight">
        Total monthly cost includes labor calculated at 4.33 visits/month to account for 5-visit months.
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

/* ── Chemical Cost Number Line ── */

function renderChemNumberLine(combined: CombinedRow[]) {
  // 3-season grouping: Winter (Nov-Feb), Spring/Fall (Mar-May + Sep-Oct), Summer (Jun-Aug)
  const winter = combined.filter(d => [11, 12, 1, 2].includes(d.month));
  const shoulder = combined.filter(d => [3, 4, 5, 9, 10].includes(d.month));
  const summer = combined.filter(d => [6, 7, 8].includes(d.month));

  // Pre-computed MAD ranges from raw billing data (272 weekly PM customers)
  // Median ± MAD calculated directly from individual invoice chemical totals
  const madRanges: Record<string, { low: number; mid: number; high: number }> = {
    winter:   { low: 36, mid: 68, high: 99 },
    shoulder: { low: 53, mid: 94, high: 134 },
    summer:   { low: 57, mid: 108, high: 159 },
  };

  const w = winter.length ? madRanges.winter : { low: 0, mid: 0, high: 0 };
  const sh = shoulder.length ? madRanges.shoulder : { low: 0, mid: 0, high: 0 };
  const s = summer.length ? madRanges.summer : { low: 0, mid: 0, high: 0 };

  const allLows = [w.low, sh.low, s.low].filter(v => v > 0);
  const allHighs = [w.high, sh.high, s.high].filter(v => v > 0);
  const absMin = Math.min(...allLows);
  const absMax = Math.max(...allHighs);
  const range = absMax - absMin;

  const pct = (v: number) => ((v - absMin) / range) * 100;

  const seasons = [
    { label: '❄ Winter', period: 'Nov – Feb', ...w, cls: 'winter', color: '#2563eb', callout: 'Lower demand — pool sits cooler, less evaporation' },
    { label: '🌿 Spring/Fall', period: 'Mar–May, Sep–Oct', ...sh, cls: 'shoulder', color: '#059669', callout: 'Pollen season + transitional temps shift demand' },
    { label: '☀ Summer', period: 'Jun – Aug', ...s, cls: 'summer', color: '#d97706', callout: 'Peak usage — heat, sun, and swimmers drive demand' },
  ].filter(s => s.high > 0);

  return (
    <div class="chem-numberline">
      <div class="chem-numberline__header-row">
        <span class="chem-numberline__label">Monthly Chemical Demand</span>
        <span class="chem-numberline__range-header">Typical Range</span>
      </div>
      <div class="chem-numberline__rows">
        {seasons.map(s => (
          <div key={s.cls}>
            <div class="chem-numberline__row">
              <span class="chem-numberline__season" style={{ color: s.color }}>{s.label}<span class="chem-numberline__period">{s.period}</span></span>
              <div class="chem-numberline__track">
                <div
                  class={`chem-numberline__band chem-numberline__band--${s.cls}`}
                  style={{ left: `${pct(s.low)}%`, width: `${pct(s.high) - pct(s.low)}%` }}
                >
                  <span class="chem-numberline__mid" style={{ left: `${((s.mid - s.low) / (s.high - s.low)) * 100}%` }}>
                    <span class="chem-numberline__mid-label">${s.mid}</span>
                  </span>
                </div>
              </div>
              <span class="chem-numberline__range" style={{ color: s.color }}>${s.low}–${s.high}</span>
            </div>
            <div class="chem-numberline__callout" style={{ color: s.color }}>{s.callout}</div>
          </div>
        ))}
      </div>
      <div class="chem-numberline__axis">
        <span>${absMin}</span>
        <span>${Math.round(absMin + range * 0.25)}</span>
        <span>${Math.round(absMin + range * 0.5)}</span>
        <span>${Math.round(absMin + range * 0.75)}</span>
        <span>${absMax}</span>
      </div>
    </div>
  );
}

/* ── Total Cost Bars (matching number line style) ── */

function renderTotalCostBars(combined: CombinedRow[], competitorFlat: number) {
  // 3-season grouping matching the chemical demand line
  const winter = combined.filter(d => [11, 12, 1, 2].includes(d.month));
  const shoulder = combined.filter(d => [3, 4, 5, 9, 10].includes(d.month));
  const summer = combined.filter(d => [6, 7, 8].includes(d.month));

  const calcRange = (rows: CombinedRow[]) => {
    if (!rows.length) return { low: 0, mid: 0, high: 0 };
    // Use the actual MAD-based low/mid/high from the combined data
    return {
      low: Math.round(Math.min(...rows.map(r => r.low))),
      mid: Math.round(rows.reduce((s, r) => s + r.mid, 0) / rows.length),
      high: Math.round(Math.max(...rows.map(r => r.high))),
    };
  };

  const w = calcRange(winter);
  const sh = calcRange(shoulder);
  const s = calcRange(summer);

  const seasons = [
    { label: '❄ Winter', period: 'Nov – Feb', ...w, cls: 'winter', color: '#2563eb' },
    { label: '🌿 Spring/Fall', period: 'Mar–May, Sep–Oct', ...sh, cls: 'shoulder', color: '#059669' },
    { label: '☀ Summer', period: 'Jun – Aug', ...s, cls: 'summer', color: '#d97706' },
  ].filter(ss => ss.high > 0);

  const allLows = seasons.map(ss => ss.low);
  const allHighs = seasons.map(ss => ss.high);
  allHighs.push(competitorFlat + 20); // Include flat rate in scale
  const absMin = Math.min(...allLows) - 20;
  const absMax = Math.max(...allHighs);
  const range = absMax - absMin;

  const pct = (v: number) => ((v - absMin) / range) * 100;
  const flatPct = pct(competitorFlat);

  return (
    <div class="chem-totalcost">
      <div class="chem-numberline__header-row">
        <span class="chem-numberline__label">Total Monthly Cost (Labor + Chemicals)</span>
        <span class="chem-numberline__range-header">Typical Range</span>
      </div>
      <div class="chem-numberline__rows">
        {seasons.map(ss => (
          <div class="chem-numberline__row" key={ss.cls}>
            <span class="chem-numberline__season" style={{ color: ss.color }}>{ss.label}<span class="chem-numberline__period">{ss.period}</span></span>
            <div class="chem-numberline__track">
              {/* Flat rate marker line */}
              <div class="chem-totalcost__flatline" style={{ left: `${flatPct}%` }} />
              <div
                class={`chem-numberline__band chem-numberline__band--${ss.cls}`}
                style={{ left: `${pct(ss.low)}%`, width: `${pct(ss.high) - pct(ss.low)}%` }}
              >
                <span class="chem-numberline__mid" style={{ left: `${((ss.mid - ss.low) / (ss.high - ss.low)) * 100}%` }}>
                  <span class="chem-numberline__mid-label">${ss.mid}</span>
                </span>
              </div>
              {/* Color the portion above flat rate red */}
              {ss.high > competitorFlat && (
                <div
                  class="chem-totalcost__over"
                  style={{
                    left: `${flatPct}%`,
                    width: `${pct(ss.high) - flatPct}%`,
                  }}
                />
              )}
            </div>
            <span class="chem-numberline__range" style={{ color: ss.color }}>${ss.low}–${ss.high}</span>
          </div>
        ))}
      </div>

      {/* Flat rate legend */}
      <div class="chem-totalcost__legend">
        <div class="chem-totalcost__legend-item">
          <span class="chem-totalcost__legend-line" />
          <span>Flat-rate competitor: ${competitorFlat}/mo</span>
        </div>
        <div class="chem-totalcost__legend-item chem-totalcost__legend-item--red">
          <span class="chem-totalcost__legend-swatch" />
          <span>Would go green under flat rate</span>
        </div>
      </div>

      {/* Axis */}
      <div class="chem-numberline__axis">
        <span>${Math.round(absMin)}</span>
        <span>${Math.round(absMin + range * 0.25)}</span>
        <span>${Math.round(absMin + range * 0.5)}</span>
        <span>${Math.round(absMin + range * 0.75)}</span>
        <span>${Math.round(absMax)}</span>
      </div>

      {/* Annotations */}
      <div class="chem-chart-annotations">
        <div class="chem-annotation chem-annotation--green">
          <span class="chem-annotation__icon">◀</span>
          <span>Left of the line — you're saving money versus flat rate every month.</span>
        </div>
        <div class="chem-annotation chem-annotation--red">
          <span class="chem-annotation__icon">▶</span>
          <span>Right of the line — these pools need more chemicals. Under flat rate, the company cuts corners and your pool goes green.</span>
        </div>
      </div>
    </div>
  );
}

/* ── Seasonal SVG Chart ── */

function renderSeasonalChart(combined: CombinedRow[], competitorFlat: number) {
  const CHART_W = 480;
  const CHART_H = 220;
  const PAD = { top: 16, right: 50, bottom: 30, left: 46 };
  const plotW = CHART_W - PAD.left - PAD.right;
  const plotH = CHART_H - PAD.top - PAD.bottom;

  /* Y-axis scale — tight to data with $25 gridlines */
  const allVals = combined.flatMap(d => [d.low, d.high]);
  allVals.push(competitorFlat);
  const yMax = Math.ceil(Math.max(...allVals) / 25) * 25 + 15;
  const yMin = Math.floor(Math.min(...allVals) / 25) * 25 - 10;
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
  const gridStep = yRange <= 150 ? 25 : yRange <= 300 ? 50 : 100;
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

  /* Build clip paths for above/below flat rate shading */
  const refVal = competitorFlat;

  // Points where band goes ABOVE flat rate (red zone — these pools need more chemicals)
  const aboveTopPoints = combined.map(d => ({
    x: xScale(d.month),
    y: Math.min(yScale(d.high), refY) // clamp to ref line
  }));
  const aboveRefPoints = combined.map(d => ({
    x: xScale(d.month),
    y: refY
  }));
  // Only draw if any point actually exceeds flat rate
  const hasAbove = combined.some(d => d.high > refVal);

  // Points where band is BELOW flat rate (green zone — saving money)
  const belowRefPoints = combined.map(d => ({
    x: xScale(d.month),
    y: refY
  }));
  const belowBotPoints = combined.map(d => ({
    x: xScale(d.month),
    y: Math.max(yScale(d.low), refY) // clamp to ref line
  }));

  // Find the peak month for annotation positioning
  const peakMonth = combined.reduce((a, b) => b.high > a.high ? b : a);
  const peakX = xScale(peakMonth.month);
  const peakY = yScale(peakMonth.high);

  // Find the lowest month
  const lowMonth = combined.reduce((a, b) => b.low < a.low ? b : a);
  const lowX = xScale(lowMonth.month);
  const lowY = yScale(lowMonth.low);

  return (
    <div class="chem-chart-container">
      <div class="chem-chart-title">Total Monthly Cost (Labor + Chemicals)<span class="chem-chart-subscript">Includes labor at 4.33 visits/month to account for 5-visit months</span></div>
      <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} class="chem-chart-svg" role="img" aria-label="Monthly total cost chart">
        <defs>
          <linearGradient id="bandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#2563eb" stop-opacity="0.3" />
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.08" />
          </linearGradient>
          <clipPath id="aboveClip">
            <rect x={PAD.left} y={PAD.top} width={plotW} height={refY - PAD.top} />
          </clipPath>
        </defs>

        {/* Y-axis — minimal, just key values */}
        {gridLines.filter((_, i) => i % 2 === 0 || gridLines.length <= 5).map(v => (
          <g key={v}>
            <text x={PAD.left - 6} y={yScale(v) + 4} text-anchor="end" font-size="11" fill="#1E3A5F" font-weight="700">${v}</text>
          </g>
        ))}

        {/* Band fill */}
        <path d={bandD} fill="url(#bandGrad)" stroke="none" />

        {/* Red zone above flat rate */}
        {hasAbove && <path d={bandD} fill="rgba(239, 68, 68, 0.18)" stroke="none" clip-path="url(#aboveClip)" />}

        {/* Band edges */}
        <path d={smoothPath(topPoints)} fill="none" stroke="#3b82f6" stroke-width="1.5" opacity="0.35" />
        <path d={smoothPath(botPoints)} fill="none" stroke="#3b82f6" stroke-width="1.5" opacity="0.35" />

        {/* Median line — bold, vibrant */}
        <path d={medianD} fill="none" stroke="#2563eb" stroke-width="3.5" stroke-linecap="round" />

        {/* Flat rate line */}
        <line x1={PAD.left} y1={refY} x2={PAD.left + plotW} y2={refY} stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4" opacity="0.8" />
        <text x={PAD.left + plotW + 6} y={refY + 1} font-size="13" fill="#ef4444" font-weight="700">${competitorFlat}</text>
        <text x={PAD.left + plotW + 6} y={refY + 14} font-size="9" fill="#ef4444" opacity="0.7">flat rate</text>

        {/* Current month dot */}
        {curRow && <circle cx={xScale(curMonth)} cy={yScale(curRow.mid)} r="6" fill="#2563eb" stroke="#fff" stroke-width="2.5" />}

        {/* Month labels */}
        {MONTH_LABELS.map((label, i) => {
          const mo = i + 1;
          const seasonColor = [11,12,1,2].includes(mo) ? '#2563eb'
            : [3,4,5,9,10].includes(mo) ? '#059669'
            : '#d97706';
          return (
            <text key={i} x={xScale(mo)} y={CHART_H - 10} text-anchor="middle" font-size="11"
              fill={mo === curMonth ? seasonColor : seasonColor} font-weight={mo === curMonth ? '800' : '600'}
              opacity={mo === curMonth ? 1 : 0.7}>{label}</text>
          );
        })}
      </svg>

      <div class="chem-chart-annotations">
        <div class="chem-annotation chem-annotation--red">
          <span class="chem-annotation__icon">▲</span>
          <span>Above the line — these pools have higher chemical demand during peak months. Under flat rate, they'd struggle to stay blue.</span>
        </div>
        <div class="chem-annotation chem-annotation--green">
          <span class="chem-annotation__icon">▼</span>
          <span>Below the line — you're overpaying under flat rate, subsidizing high-demand pools on the same route.</span>
        </div>
      </div>
    </div>
  );
}
