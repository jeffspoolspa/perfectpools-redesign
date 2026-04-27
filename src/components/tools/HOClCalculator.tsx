import { useState, useMemo } from 'preact/hooks';
import { scaleLinear } from 'd3-scale';
import { line, area, curveMonotoneX } from 'd3-shape';
import Slider from './Slider';

/**
 * Sanitation pillar: FC / HOCl time-series model.
 *
 * Simulates chlorine levels over 24 hours given pool conditions and lets the
 * user watch how pump runtime, UV exposure, CYA, pH, debris, and swimmers
 * interact to keep (or fail to keep) active HOCl above the algae-kill
 * threshold.
 *
 * NOT a measurement — this is a dynamics model. Real pools vary in sun
 * exposure, debris load, and bather schedule. The chart teaches the SHAPE
 * of the problem: why a pool that tests fine at 10 AM can be unprotected
 * by midnight, and why CYA + pump runtime matter more than FC alone.
 *
 * ─────────────────────────────────────────────────────────────
 * Inputs are grouped into three buckets to match how people think:
 *   - FC Input:   what puts chlorine IN  (start FC, cell %, pump hrs)
 *   - Active HOCl factors: how much of it is actually ACTIVE (pH, CYA)
 *   - Use / Losses: what takes it OUT    (UV, debris, swimmers)
 * Pool volume is fixed at 15,000 gallons to keep the surface small.
 * ─────────────────────────────────────────────────────────────
 *
 * Core math
 * ─────────────────────────────────────────────────────────────
 *
 * Active HOCl (simplified Wojtowicz model, calibrated to pool tables):
 *   fHOCl_pH = 1 / (1 + 10^(pH − 7.54))        (Henderson-Hasselbalch, pKa 7.54)
 *   HOCl ppm = FC × fHOCl_pH / (1 + 0.83 × CYA)
 *
 * Salt cell output:
 *   Reference: Pentair IC40 ~1.4 lb/day @ 100% in a 15,000 gal pool
 *     ≈ 0.76 ppm/hr at 100% output, pump on
 *
 * UV decay (exponential, CYA-protected, scaled by exposure level):
 *   k_uv_baseline = 0.693 / (1 + 0.117 × CYA)   (per hour, full sun)
 *   k_uv_effective = k_uv_baseline × UV_EXPOSURE[shade|partial|full]
 *
 * Organic demand (debris category):
 *   Clean  — 0.10 ppm/day, spread evenly
 *   Some   — 0.30 ppm/day, spread evenly
 *   Heavy  — 0.70 ppm/day, spread evenly
 *
 * Swimmer pulse (concentrated between 2–5 PM):
 *   None   — 0 ppm
 *   Few    — 0.25 ppm total
 *   Many   — 0.75 ppm total
 *
 * Thresholds (Wojtowicz / TFP):
 *   0.011 ppm HOCl — minimum for algae prevention
 *   0.05  ppm HOCl — comfortable margin, can absorb swing events
 */

// ===== Chemistry helpers =====

const PKA_HOCL = 7.54;
const CYA_BINDING = 0.83;

function activeHOCl(fc: number, cya: number, ph: number): number {
  const fHOCl = 1 / (1 + Math.pow(10, ph - PKA_HOCL));
  return (fc * fHOCl) / (1 + CYA_BINDING * cya);
}

// ===== Types =====

type UvLevel = 'shade' | 'partial' | 'full';
type DebrisLevel = 'clean' | 'some' | 'heavy';
type SwimmerLevel = 'none' | 'few' | 'many';

// Equipment + demand inputs — FC/pH/CYA come in via props from the
// parent (SanitationTabs), which shares them with Tab 1 (HOClWaterfall).
type Inputs = {
  cellOutput: number;   // 0..100 (percent)
  pumpHours: number;    // 0..24
  uv: UvLevel;
  debris: DebrisLevel;
  swimmers: SwimmerLevel;
};

// The chemistry snapshot we receive from SanitationTabs as props.
type PoolChem = {
  fc: number;   // starting FC (ppm) from Tab 1
  ph: number;
  cya: number;  // ppm
};

// Fixed pool volume — keeps the calculator focused on the chemistry story
// rather than on sizing. 15,000 gal is the industry reference for the cell
// output curve we use below.
const VOLUME_GAL = 15000;

const DEFAULTS: Inputs = {
  cellOutput: 55,
  pumpHours: 8,
  uv: 'partial',
  debris: 'some',
  swimmers: 'few',
};

// UV exposure multiplier on the base full-sun rate constant.
const UV_EXPOSURE: Record<UvLevel, number> = {
  shade: 0.3,
  partial: 0.65,
  full: 1.0,
};

// Debris → organic demand (ppm per 24h, spread evenly through the day).
const DEBRIS_DAILY_PPM: Record<DebrisLevel, number> = {
  clean: 0.1,
  some: 0.3,
  heavy: 0.7,
};

// Swimmer load → total ppm consumed, applied as a pulse across 2–5 PM.
const SWIMMER_PULSE_PPM: Record<SwimmerLevel, number> = {
  none: 0,
  few: 0.25,
  many: 0.75,
};

// ===== Simulation =====

const SIM_HOURS = 24;
const SIM_STEP = 0.25; // quarter-hour resolution (96 points across 24h)
const SIM_START = 6;   // simulation begins at 6 AM — everything resets overnight
const PUMP_START = 8;  // hour 8 = 8 AM
const DAYLIGHT_START = 6;
const DAYLIGHT_END = 19;
const ALGAE_THRESHOLD = 0.011;
const COMFORT_THRESHOLD = 0.05;

type SimPoint = {
  hour: number;
  fc: number;
  hocl: number;
  pumpOn: boolean;
  dCell: number;    // FC added by salt cell during this step (ppm)
  dUv: number;      // FC consumed by UV during this step (ppm, positive)
  dOrg: number;     // FC consumed by organics during this step (ppm, positive)
  dBath: number;    // FC consumed by bather load during this step (ppm, positive)
};

function simulate(inputs: Inputs, chem: PoolChem): SimPoint[] {
  const { cellOutput, pumpHours, uv, debris, swimmers } = inputs;
  const { fc: startFc, cya, ph } = chem;
  const points: SimPoint[] = [];

  // Fixed pool volume, so the 15k gal reference rate applies directly.
  const cellReferenceRate = 0.76; // ppm/hr at 100% output
  const cellRate = cellReferenceRate * (cellOutput / 100);

  // UV rate constant — full sun baseline (CYA-protected), scaled by exposure.
  const uvKFullSun = (0.693 / (1 + 0.117 * cya)) * UV_EXPOSURE[uv];

  // Organic demand per hour (ppm/hr) — from debris level
  const organicPerHour = DEBRIS_DAILY_PPM[debris] / 24;

  // Bather load pulse window (swimmers) — concentrated 2–5 PM
  const swimPulseTotal = SWIMMER_PULSE_PPM[swimmers];
  const swimStart = 14;
  const swimEnd = 17;
  const swimPerHour = swimPulseTotal / (swimEnd - swimStart);

  let fc = startFc;
  for (let i = 0; i <= SIM_HOURS / SIM_STEP; i++) {
    const hour = SIM_START + i * SIM_STEP; // 6.0 → 30.0
    const dayHour = hour % 24;

    // Pump window
    const pumpOn = dayHour >= PUMP_START && dayHour < PUMP_START + pumpHours;

    // Sun intensity: 0 at dawn/dusk, peak at solar noon (sine curve)
    let sun = 0;
    if (dayHour >= DAYLIGHT_START && dayHour < DAYLIGHT_END) {
      const dayProgress = (dayHour - DAYLIGHT_START) / (DAYLIGHT_END - DAYLIGHT_START);
      sun = Math.sin(dayProgress * Math.PI);
    }

    // Instantaneous rates (ppm/hour)
    const cellInputRate = pumpOn ? cellRate : 0;
    const uvLossRate = fc * uvKFullSun * sun;
    const organicLossRate = organicPerHour;
    const batherLossRate =
      dayHour >= swimStart && dayHour < swimEnd ? swimPerHour : 0;

    const lossRate = uvLossRate + organicLossRate + batherLossRate;
    const dFcDt = cellInputRate - lossRate;
    // Euler step
    fc = Math.max(0, fc + dFcDt * SIM_STEP);

    const hocl = activeHOCl(fc, cya, ph);
    points.push({
      hour,
      fc,
      hocl,
      pumpOn,
      dCell: cellInputRate * SIM_STEP,
      dUv: uvLossRate * SIM_STEP,
      dOrg: organicLossRate * SIM_STEP,
      dBath: batherLossRate * SIM_STEP,
    });
  }

  return points;
}

// ===== Sliders config (numeric inputs only) =====

type SliderConfig = {
  key: 'cellOutput' | 'pumpHours';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
  format?: (v: number) => string;
  /** Optional small caption under the slider label, derived from the value. */
  subtitle?: (v: number) => string;
};

// Tiny hour formatter used by the pump-hours subtitle. Compact ("8A" / "12P")
// because this sits under the slider and has very little horizontal room.
function shortHour(h: number): string {
  const h24 = ((h % 24) + 24) % 24;
  if (h24 === 0) return '12A';
  if (h24 === 12) return '12P';
  if (h24 < 12) return `${h24}A`;
  return `${h24 - 12}P`;
}

// Reference: Pentair IC40 ~0.76 ppm/hr @ 100% output in a 15k-gal pool.
// Exposed as a constant so the slider subtitle and simulate() stay in sync.
const CELL_REFERENCE_RATE = 0.76; // ppm/hr

const EQUIPMENT_SLIDERS: SliderConfig[] = [
  {
    key: 'cellOutput',
    label: 'Chlorinator',
    unit: '%',
    min: 0,
    max: 100,
    step: 5,
    decimals: 0,
    // Show the computed ppm/hr the salt cell is currently producing — makes
    // the abstract "%" number feel concrete as the user drags the slider.
    subtitle: (v) => `${(CELL_REFERENCE_RATE * (v / 100)).toFixed(2)} ppm/hr`,
  },
  {
    key: 'pumpHours',
    label: 'Pump runtime',
    unit: 'hrs',
    min: 4,
    max: 24,
    step: 1,
    decimals: 0,
    // Show the actual window the pump is running, anchored at the 8AM start.
    subtitle: (v) => `${shortHour(PUMP_START)}–${shortHour(PUMP_START + v)}`,
  },
];

// ===== Hover-select options (3-option categorical inputs) =====

type HoverOption<T extends string> = {
  value: T;
  label: string;
  icon: string;
  description: string;
};

const UV_OPTIONS: HoverOption<UvLevel>[] = [
  { value: 'shade', label: 'Shade', icon: '☁', description: 'Covered or mostly shaded — very little direct sun' },
  { value: 'partial', label: 'Partial', icon: '⛅', description: 'Trees, pergola, or partial shade most of the day' },
  { value: 'full', label: 'Full sun', icon: '☀', description: 'Wide open, direct sun from dawn to dusk' },
];

const DEBRIS_OPTIONS: HoverOption<DebrisLevel>[] = [
  { value: 'clean', label: 'Clean', icon: '✨', description: 'Clear deck, no trees, minimal organics' },
  { value: 'some', label: 'Some', icon: '🍃', description: 'Normal residential, some leaves and pollen' },
  { value: 'heavy', label: 'Heavy', icon: '🌳', description: 'Under trees, heavy debris, pollen bloom' },
];

const SWIMMER_OPTIONS: HoverOption<SwimmerLevel>[] = [
  { value: 'none', label: 'None', icon: '0', description: 'Empty pool all day' },
  { value: 'few', label: 'A few', icon: '2', description: '1–3 swimmers for a normal afternoon' },
  { value: 'many', label: 'Many', icon: '6+', description: 'Party day — kids, guests, lots of splash-out' },
];

// ===== Component =====

// Collapse the fine-grained simulation into 8 three-hour windows with a
// breakdown of each chlorine source (salt cell, UV, organics, bathers).
type Bucket = {
  hour: number;               // END of window: 3, 6, 9, 12, 15, 18, 21, 0
  fc: number;                 // FC at the END of the window
  hocl: number;               // active HOCl at the end of the window
  phase: 'night' | 'day' | 'pump';
  cell: number;               // ppm added by salt cell
  uv: number;                 // ppm lost to UV
  org: number;                // ppm lost to organics
  bath: number;               // ppm lost to bathers
  safe: boolean;              // end-of-window HOCl ≥ COMFORT_THRESHOLD
};

function toBuckets(sim: SimPoint[], pumpHours: number): Bucket[] {
  const buckets: Bucket[] = [];
  const WINDOW = 3; // hours
  // Sim runs 6→30.  Windows: [6,9] [9,12] [12,15] [15,18] [18,21] [21,24] [24,27] [27,30]
  // Bucket hours (display): 9, 12, 15, 18, 21, 0, 3, 6
  for (let end = SIM_START + WINDOW; end <= SIM_START + 24; end += WINDOW) {
    const start = end - WINDOW;
    let cellSum = 0;
    let uvSum = 0;
    let orgSum = 0;
    let bathSum = 0;
    let lastPoint: SimPoint | null = null;
    for (const p of sim) {
      if (p.hour >= start && p.hour < end) {
        cellSum += p.dCell;
        uvSum += p.dUv;
        orgSum += p.dOrg;
        bathSum += p.dBath;
        lastPoint = p;
      }
    }
    if (!lastPoint) {
      lastPoint = sim.find((p) => Math.abs(p.hour - (end - SIM_STEP)) < SIM_STEP) ?? sim[sim.length - 1];
    }

    // Phase based on the END of the window (the moment the card represents)
    const hourOfDay = end % 24;
    const pumpOn = hourOfDay >= PUMP_START && hourOfDay < PUMP_START + pumpHours;
    const isDaylight = hourOfDay >= DAYLIGHT_START && hourOfDay < DAYLIGHT_END;
    const phase: Bucket['phase'] = pumpOn ? 'pump' : isDaylight ? 'day' : 'night';

    buckets.push({
      hour: end % 24,
      fc: lastPoint.fc,
      hocl: lastPoint.hocl,
      phase,
      cell: cellSum,
      uv: uvSum,
      org: orgSum,
      bath: bathSum,
      safe: lastPoint.hocl >= COMFORT_THRESHOLD,
    });
  }
  return buckets;
}

function formatHour(h: number): string {
  if (h === 0) return '12AM';
  if (h === 12) return '12PM';
  if (h < 12) return `${h}AM`;
  return `${h - 12}PM`;
}

// ===== DemandRow subcomponent =====
//
// Each demand source as a compact row: icon + label + computed ppm/hr +
// info tooltip (i) + hover-select picker for the category. Replaces the
// old HoverSelect for the demand section and adds the rich tooltip.

function DemandRow<T extends string>({
  icon,
  label,
  ppmHr,
  tooltip,
  value,
  options,
  onChange,
}: {
  icon: string;
  label: string;
  ppmHr: number;
  tooltip: { title: string; body: string };
  value: T;
  options: HoverOption<T>[];
  onChange: (v: T) => void;
}) {
  const selected = options.find((o) => o.value === value) ?? options[0];
  return (
    <div class="hocl-demand-row">
      <div class="hocl-demand-row__left">
        <span class="hocl-demand-row__icon">{icon}</span>
        <span class="hocl-demand-row__label">{label}</span>
        <span class="hocl-demand-row__rate">
          {ppmHr.toFixed(3)}
          <span class="hocl-demand-row__rate-unit"> ppm/hr</span>
        </span>
        <span class="hocl-demand-row__info" tabIndex={0} aria-label={`About ${label} demand`}>
          <span class="hocl-demand-row__info-icon">i</span>
          <div class="hocl-demand-row__tip" role="tooltip">
            <div class="hocl-demand-row__tip-title">{tooltip.title}</div>
            <p class="hocl-demand-row__tip-body">{tooltip.body}</p>
          </div>
        </span>
      </div>
      <div class="hocl-hselect__control" tabIndex={0}>
        <span class="hocl-hselect__current">
          <span class="hocl-hselect__icon" aria-hidden="true">{selected.icon}</span>
          <span class="hocl-hselect__text">{selected.label}</span>
        </span>
        <div class="hocl-hselect__pop" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              class={`hocl-hselect__opt ${o.value === value ? 'is-active' : ''}`}
              title={o.description}
              onClick={() => onChange(o.value)}
            >
              <span class="hocl-hselect__opt-icon" aria-hidden="true">{o.icon}</span>
              <span class="hocl-hselect__opt-label">{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== Slider row subcomponent =====

function SliderRow({
  spec,
  value,
  onChange,
}: {
  spec: SliderConfig;
  value: number;
  onChange: (v: number) => void;
}) {
  const display = spec.format
    ? spec.format(value)
    : spec.decimals > 0
      ? value.toFixed(spec.decimals)
      : Math.round(value).toString();
  const subtitle = spec.subtitle ? spec.subtitle(value) : null;
  return (
    <div class="hocl-slider">
      <div class="hocl-slider__head">
        <span class="hocl-slider__label">
          {spec.label}
          {subtitle && <span class="hocl-slider__sub"> · {subtitle}</span>}
        </span>
        <span class="hocl-slider__value">
          {display}
          {spec.unit && <span class="hocl-slider__unit"> {spec.unit}</span>}
        </span>
      </div>
      <Slider
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

type Props = {
  // Shared pool chemistry from SanitationTabs (comes from Tab 1)
  fc: number;
  ph: number;
  cya: number;
};

export default function HOClCalculator({ fc, ph, cya }: Props) {
  const [inputs, setInputs] = useState<Inputs>({ ...DEFAULTS });
  const [timeView, setTimeView] = useState<'day' | 'night'>('day');
  const chem: PoolChem = { fc, ph, cya };

  const data = useMemo(() => simulate(inputs, chem), [inputs, fc, ph, cya]);
  const buckets = useMemo(() => toBuckets(data, inputs.pumpHours), [data, inputs.pumpHours]);

  // Minimum FC that keeps HOCl ≥ comfort threshold at this pH/CYA
  const fHOCl = 1 / (1 + Math.pow(10, ph - PKA_HOCL));
  const minFc = COMFORT_THRESHOLD * (1 + CYA_BINDING * cya) / fHOCl;

  // ===== Budget computations =====

  const cellPpmPerHour = CELL_REFERENCE_RATE * (inputs.cellOutput / 100);
  const totalFcIn = cellPpmPerHour * inputs.pumpHours;

  // Per-source demand rates from actual sim (accounts for FC-dependent UV)
  const avgUvPpmHr = useMemo(() => {
    return data.reduce((s, p) => s + p.dUv, 0) / 24;
  }, [data]);
  const debrisPpmHr = DEBRIS_DAILY_PPM[inputs.debris] / 24;
  const swimmerPpmHr = useMemo(() => {
    return data.reduce((s, p) => s + p.dBath, 0) / 24;
  }, [data]);
  const totalFcOutPerHr = avgUvPpmHr + debrisPpmHr + swimmerPpmHr;
  const totalFcOut = totalFcOutPerHr * 24;

  // Day/Night bucket selection
  // Buckets (sim 6→30): [9am(0), 12pm(1), 3pm(2), 6pm(3), 9pm(4), 12am(5), 3am(6), 6am(7)]
  // Day view prepends a "6AM start" snapshot so cards are: 6AM★, 9AM, 12PM, 3PM, 6PM
  const startBucket: Bucket = {
    hour: 6,
    fc,
    hocl: activeHOCl(fc, cya, ph),
    phase: 'day',
    cell: 0, uv: 0, org: 0, bath: 0,
    safe: activeHOCl(fc, cya, ph) >= COMFORT_THRESHOLD,
  };
  const dayBuckets = [startBucket, ...buckets.slice(0, 4)]; // 6AM★, 9AM, 12PM, 3PM, 6PM
  const nightBuckets = buckets.slice(3, 8);                  // 6PM, 9PM, 12AM, 3AM, 6AM
  const visibleBuckets = timeView === 'day' ? dayBuckets : nightBuckets;

  // Protection hours after pump off
  const protectionHours = useMemo(() => {
    let firstOff = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i - 1].pumpOn && !data[i].pumpOn) { firstOff = i; break; }
    }
    if (firstOff < 0) return null;
    for (let i = firstOff; i < data.length; i++) {
      if (data[i].hocl < COMFORT_THRESHOLD) {
        return data[i].hour - data[firstOff].hour;
      }
    }
    return null;
  }, [data]);

  const worstHocl = Math.min(...data.map((d) => d.hocl));
  const status: 'protected' | 'thin' | 'vulnerable' =
    worstHocl >= COMFORT_THRESHOLD ? 'protected' :
    worstHocl >= ALGAE_THRESHOLD ? 'thin' : 'vulnerable';

  const updateInput = <K extends keyof Inputs>(key: K, value: Inputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }));
  };

  // Demand tooltip content — dynamic where values depend on current inputs
  const demandTooltips = {
    uv: {
      title: 'UV Chlorine Demand',
      body: `UV from sunlight breaks apart hypochlorous acid molecules — the single largest demand source for outdoor pools. The rate peaks at solar noon and drops to zero after sunset. Your CYA of ${cya} ppm slows UV decay significantly; without it, chlorine would burn off 3-5x faster. This is the 24-hour average — midday demand is much higher.`,
    },
    debris: {
      title: 'Organic Demand',
      body: 'Leaves, pollen, grass clippings, and algae spores all consume chlorine through oxidation. Unlike UV, this demand is roughly constant around the clock. A clean deck with good landscaping makes a measurable difference — heavy debris loads can triple organic chlorine consumption.',
    },
    swimmers: {
      title: 'Bather Load',
      body: 'Sweat, sunscreen, body oils, and urine each consume chlorine. Bather demand is concentrated between 2-5 PM, so the hourly rate during swimming is much higher than this daily average. A pool party can consume more chlorine in 3 hours than UV burns in a full day.',
    },
  };

  // Icon for time-of-day cards
  function bucketIcon(hour: number): string {
    if (hour >= 6 && hour <= 18) return '☀';
    return '🌙';
  }

  return (
    <div class="hocl-calc">
      {/* ========== Intro commentary ========== */}
      <p class="hocl-calc__intro">
        Now that you know your target FC, can your equipment keep up? Below is a 24-hour simulation — chlorine produced by your cell vs. chlorine consumed by UV, debris, and swimmers.
      </p>

      {/* ========== Chem values + Day/Night toggle — one row ========== */}
      <div class="hocl-calc__top-row">
        <div class="hocl-calc__chem" role="note" aria-label="Pool chemistry from previous tab">
          <span class="hocl-calc__chem-item">
            <span class="hocl-calc__chem-label">Min FC</span>
            <span class="hocl-calc__chem-value">{minFc.toFixed(1)}<span class="hocl-calc__chem-unit"> ppm</span></span>
          </span>
          <span class="hocl-calc__chem-item">
            <span class="hocl-calc__chem-label">pH</span>
            <span class="hocl-calc__chem-value">{ph.toFixed(1)}</span>
          </span>
          <span class="hocl-calc__chem-item">
            <span class="hocl-calc__chem-label">CYA</span>
            <span class="hocl-calc__chem-value">{cya}<span class="hocl-calc__chem-unit"> ppm</span></span>
          </span>
        </div>
        <div class="hocl-timeview" role="tablist" aria-label="Time of day">
          <div
            class="hocl-timeview__indicator"
            style={{ transform: `translateX(${timeView === 'night' ? '100%' : '0'})` }}
            aria-hidden="true"
          />
          <button
            type="button"
            role="tab"
            aria-selected={timeView === 'day'}
            class={`hocl-timeview__btn ${timeView === 'day' ? 'is-active' : ''}`}
            onClick={() => setTimeView('day')}
          >
            ☀ Day
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={timeView === 'night'}
            class={`hocl-timeview__btn ${timeView === 'night' ? 'is-active' : ''}`}
            onClick={() => setTimeView('night')}
          >
            🌙 Night
          </button>
        </div>
      </div>

      {/* ========== FC line chart ========== */}
      {(() => {
        const CHART_W = 640;
        const CHART_H = 90;
        const cPad = { top: 18, right: 12, bottom: 8, left: 12 };
        const plotW = CHART_W - cPad.left - cPad.right;
        const plotH = CHART_H - cPad.top - cPad.bottom;

        const VIS_START = timeView === 'day' ? 6 : 18;
        const VIS_END = timeView === 'day' ? 18 : 30;
        const x = scaleLinear().domain([VIS_START, VIS_END]).range([cPad.left, cPad.left + plotW]);

        // Sim hours run 6→30, so both day (6-18) and night (18-30) are monotonic
        const visData = data.filter((d) => d.hour >= VIS_START && d.hour <= VIS_END);

        const fcVals = visData.map((d) => d.fc);
        const dataMin = Math.min(...fcVals);
        const dataMax = Math.max(...fcVals);
        const yPad = Math.max(0.1, (dataMax - dataMin) * 0.3);
        const yMin = Math.max(0, dataMin - yPad);
        const yMax = dataMax + yPad;
        const y = scaleLinear().domain([yMin, yMax]).range([cPad.top + plotH, cPad.top]);
        const lineGen = line<SimPoint>().x((d) => x(d.hour)).y((d) => y(d.fc)).curve(curveMonotoneX);
        const areaGen = area<SimPoint>()
          .x((d) => x(d.hour))
          .y0(cPad.top + plotH)
          .y1((d) => y(d.fc))
          .curve(curveMonotoneX);

        // Min FC threshold line (FC at which HOCl = comfort threshold)
        const showMinLine = minFc >= yMin && minFc <= yMax;
        const minFcY = y(minFc);

        // Pump band
        const pumpEnd = PUMP_START + inputs.pumpHours;
        const bandStart = Math.max(VIS_START, PUMP_START);
        const bandEnd = Math.min(VIS_END, pumpEnd);
        const showPumpBand = bandEnd > bandStart;

        // Bucket markers — convert display hour to sim hour for x placement
        const bucketMarkers = visibleBuckets.map((b) => {
          const simHour = (timeView === 'night' && b.hour < 18) ? b.hour + 24 : b.hour;
          return { ...b, cx: x(simHour), cy: y(b.fc) };
        });

        return (
          <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} class="hocl-minichart" aria-label={`FC curve — ${timeView} view`}>
            {showPumpBand && (
              <rect x={x(bandStart)} y={cPad.top} width={x(bandEnd) - x(bandStart)} height={plotH} fill="#0ea5e9" fill-opacity="0.12" />
            )}
            {showMinLine && (
              <line x1={cPad.left} y1={minFcY} x2={cPad.left + plotW} y2={minFcY} stroke="#dc2626" stroke-width="1" stroke-dasharray="2 3" opacity="0.4" />
            )}
            <path d={areaGen(visData) || ''} fill="#0ea5e9" fill-opacity="0.15" />
            <path d={lineGen(visData) || ''} fill="none" stroke="#0ea5e9" stroke-width="1.75" stroke-linecap="round" />
            {bucketMarkers.map((m) => (
              <g key={`marker-${m.hour}`}>
                <circle cx={m.cx} cy={m.cy} r="3.5" fill="#0ea5e9" stroke="#fff" stroke-width="1.5" />
                <text x={m.cx} y={m.cy - 7} text-anchor="middle" font-size="9" fill="#0c4a6e" font-weight="700">
                  {m.fc.toFixed(2)}
                </text>
              </g>
            ))}
            {showMinLine && (
              <text x={cPad.left + plotW - 2} y={minFcY - 3} text-anchor="end" font-size="7.5" fill="#dc2626" font-weight="600" opacity="0.7">
                min FC {minFc.toFixed(1)}
              </text>
            )}
          </svg>
        );
      })()}

      {/* ========== Hour labels ========== */}
      <div class="hocl-hours" aria-hidden="true">
        {visibleBuckets.map((b, idx) => (
          <>
            <div key={`hour-${b.hour}`} class="hocl-hours__label">
              {formatHour(b.hour)}
            </div>
            {idx < visibleBuckets.length - 1 && (
              <div key={`hour-spacer-${b.hour}`} class="hocl-hours__spacer" />
            )}
          </>
        ))}
      </div>

      {/* ========== Timeline cards with deltas ========== */}
      <div class="hocl-timeline">
        {visibleBuckets.map((b, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === visibleBuckets.length - 1;
          const next = isLast ? null : visibleBuckets[idx + 1];
          const netDelta = next ? next.fc - b.fc : 0;
          const nextSources = next ? { cell: next.cell, uv: next.uv, org: next.org, bath: next.bath } : null;
          const totalMovement = nextSources ? nextSources.cell + nextSources.uv + nextSources.org + nextSources.bath : 0;
          const pct = (v: number) => totalMovement > 0 ? Math.round((v / totalMovement) * 100) : 0;
          const tag = (isFirst && timeView === 'day') ? 'start' : (isLast && timeView === 'night') ? 'end' : null;
          return (
            <>
              <div key={`cell-${b.hour}`} class="hocl-card" title={`${formatHour(b.hour)} · FC ${b.fc.toFixed(1)} · HOCl ${b.hocl.toFixed(3)}`}>
                {tag && <span class={`hocl-card__tag hocl-card__tag--${tag}`}>{tag}</span>}
                <div class="hocl-card__icon" aria-hidden="true">{bucketIcon(b.hour)}</div>
                <div class="hocl-card__fc">
                  <span class="hocl-card__fc-label">FC </span>{b.fc.toFixed(1)}
                </div>
                <div class={`hocl-card__hocl ${b.safe ? 'is-safe' : 'is-unsafe'}`}>
                  ({b.hocl.toFixed(3)})
                </div>
              </div>
              {!isLast && next && nextSources && (
                <div key={`delta-${b.hour}`} class={`hocl-delta ${netDelta >= 0 ? 'is-up' : 'is-down'}`} tabIndex={0}
                  aria-label={`Change from ${formatHour(b.hour)} to ${formatHour(next.hour)}: ${netDelta >= 0 ? '+' : ''}${netDelta.toFixed(2)} ppm`}>
                  <span class="hocl-delta__arrow">{netDelta >= 0 ? '↑' : '↓'}</span>
                  <span class="hocl-delta__value">{Math.abs(netDelta).toFixed(1)}</span>
                  <div class="hocl-delta__pop" role="tooltip">
                    <div class="hocl-delta__pop-head">
                      {formatHour(b.hour)} → {formatHour(next.hour)}
                      <span class="hocl-delta__pop-net">{netDelta >= 0 ? '+' : ''}{netDelta.toFixed(2)} ppm</span>
                    </div>
                    {nextSources.cell > 0.005 && (
                      <div class="hocl-delta__pop-row hocl-delta__pop-row--in">
                        <span class="hocl-delta__pop-icon">⚡</span>
                        <span class="hocl-delta__pop-label">Cell</span>
                        <span class="hocl-delta__pop-pct">+{pct(nextSources.cell)}%</span>
                      </div>
                    )}
                    {nextSources.uv > 0.005 && (
                      <div class="hocl-delta__pop-row hocl-delta__pop-row--out">
                        <span class="hocl-delta__pop-icon">☀</span>
                        <span class="hocl-delta__pop-label">UV</span>
                        <span class="hocl-delta__pop-pct">−{pct(nextSources.uv)}%</span>
                      </div>
                    )}
                    {nextSources.bath > 0.005 && (
                      <div class="hocl-delta__pop-row hocl-delta__pop-row--out">
                        <span class="hocl-delta__pop-icon">👤</span>
                        <span class="hocl-delta__pop-label">Bathers</span>
                        <span class="hocl-delta__pop-pct">−{pct(nextSources.bath)}%</span>
                      </div>
                    )}
                    {nextSources.org > 0.005 && (
                      <div class="hocl-delta__pop-row hocl-delta__pop-row--out">
                        <span class="hocl-delta__pop-icon">🍃</span>
                        <span class="hocl-delta__pop-label">Organics</span>
                        <span class="hocl-delta__pop-pct">−{pct(nextSources.org)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          );
        })}
      </div>

      {/* ========== FC IN + FC OUT — side by side below chart ========== */}
      <div class="hocl-budget-row">
        <div class="hocl-budget hocl-budget--in">
          <div class="hocl-budget__heading">
            <div class="hocl-budget__heading-left">
              <span class="hocl-budget__title">FC In</span>
              <span class="hocl-budget__subtitle">Equipment</span>
            </div>
            <span class="hocl-budget__heading-total hocl-budget__heading-total--in">
              {totalFcIn.toFixed(1)} <span class="hocl-budget__total-unit">ppm/day</span>
            </span>
          </div>
          <div class="hocl-budget__sliders hocl-budget__sliders--stacked">
            {EQUIPMENT_SLIDERS.map((spec) => (
              <SliderRow
                key={spec.key}
                spec={spec}
                value={inputs[spec.key]}
                onChange={(v) => updateInput(spec.key, v)}
              />
            ))}
          </div>
        </div>

        <div class="hocl-budget hocl-budget--out">
          <div class="hocl-budget__heading">
            <div class="hocl-budget__heading-left">
              <span class="hocl-budget__title">FC Out</span>
              <span class="hocl-budget__subtitle">Demand</span>
            </div>
            <span class="hocl-budget__heading-total hocl-budget__heading-total--out">
              {totalFcOut.toFixed(1)} <span class="hocl-budget__total-unit">ppm/day</span>
            </span>
          </div>
          <div class="hocl-demand-sources">
            <DemandRow
              icon="☀"
              label="UV"
              ppmHr={avgUvPpmHr}
              tooltip={demandTooltips.uv}
              value={inputs.uv}
              options={UV_OPTIONS}
              onChange={(v) => updateInput('uv', v)}
            />
            <DemandRow
              icon="🍃"
              label="Debris"
              ppmHr={debrisPpmHr}
              tooltip={demandTooltips.debris}
              value={inputs.debris}
              options={DEBRIS_OPTIONS}
              onChange={(v) => updateInput('debris', v)}
            />
            <DemandRow
              icon="👤"
              label="Swim"
              ppmHr={swimmerPpmHr}
              tooltip={demandTooltips.swimmers}
              value={inputs.swimmers}
              options={SWIMMER_OPTIONS}
              onChange={(v) => updateInput('swimmers', v)}
            />
          </div>
        </div>
      </div>

      {/* ========== Status row — badge + in/out bars inline ========== */}
      {(() => {
        const maxVal = Math.max(totalFcIn, totalFcOut, 0.1);
        const inPct = (totalFcIn / maxVal) * 100;
        const outPct = (totalFcOut / maxVal) * 100;
        return (
          <div class={`hocl-calc__status hocl-calc__status--${status}`}>
            <span class={`hocl-calc__safe-badge hocl-calc__safe-badge--${status === 'protected' ? 'safe' : 'unsafe'}`}>
              {status === 'protected' ? '✓ Protected' : '⚠ Unprotected'}
            </span>
            <div class="hocl-calc__status-bars">
              <div class="hocl-calc__status-bar hocl-calc__status-bar--in">
                <div class="hocl-calc__status-bar-fill" style={{ '--fill': inPct / 100 } as any} />
                <span class="hocl-calc__status-bar-label">{totalFcIn.toFixed(1)} in</span>
              </div>
              <div class="hocl-calc__status-bar hocl-calc__status-bar--out">
                <div class="hocl-calc__status-bar-fill" style={{ '--fill': outPct / 100 } as any} />
                <span class="hocl-calc__status-bar-label">{totalFcOut.toFixed(1)} out</span>
              </div>
            </div>
            <span class="hocl-calc__status-net">
              {totalFcIn >= totalFcOut ? '+' : ''}{(totalFcIn - totalFcOut).toFixed(1)}
            </span>
          </div>
        );
      })()}

    </div>
  );
}
