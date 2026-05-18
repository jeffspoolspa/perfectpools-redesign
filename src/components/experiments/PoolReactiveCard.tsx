/**
 * PoolReactiveCard — sandbox experiment
 * =====================================
 *
 * Unified Sanitation + Water Balance visualization, modelled on the
 * Aave-style "simulation" card the user referenced:
 *
 *   ┌──────────────┬────────────────────────────────────────────┐
 *   │ [Sanitation] │              POOL (3/4 view)               │
 *   │ [ Balance  ] │                                            │
 *   ├──────────────┤            (water + ladder)               │
 *   │  FC slider   │                                            │
 *   │  pH slider   │  ┌──────────────────────────────────────┐  │
 *   │  CYA slider  │  │  Active HOCl bar  •or•  LSI scale    │  │
 *   └──────────────┘  └──────────────────────────────────────┘  │
 *                                                                │
 *
 * Two tabs in the left rail:
 *   - Sanitation     → sliders for FC, pH, CYA. The bar below the
 *                      pool is Active HOCl with a 0.05 ppm minimum
 *                      marker.
 *   - Water Balance  → FC drops off the top. pH and CYA shift up, and
 *                      Alkalinity (TA) + Calcium Hardness (CH) get
 *                      added below. The bar becomes the LSI scale
 *                      from corrosive → balanced → scaling.
 *
 * The pool art reacts to chemistry in real time:
 *
 *   Sanitation tab — drives WATER COLOR:
 *     • Plenty of active HOCl  → vibrant blue (healthy water).
 *     • Approaching the 0.05 floor → trends toward green as
 *       sanitizer can't keep algae away.
 *
 *   Water Balance tab — drives WATER + LADDER:
 *     • LSI in range  (-0.3 … +0.3) → clear blue water, clean ladder.
 *     • LSI < -0.3 (corrosive)      → ladder rails go rusty brown.
 *     • LSI > +0.3 (scaling)        → water turns milky white as
 *                                     calcium precipitates out.
 *
 * SCAFFOLD ONLY. Math is shared with the existing HOClWaterfall +
 * LSICalculator components (re-implemented inline here so the shell
 * is self-contained while we iterate; once approved we can extract
 * shared utils).
 */

import { useMemo, useState } from 'preact/hooks';
import Slider from '../tools/Slider';

// =========================================================================
// Sanitation math (mirrors HOClWaterfall.tsx)
// =========================================================================

const PKA_HOCL = 7.54;
const CYA_BINDING = 0.83;
const ALGAE_FLOOR = 0.05; // ppm active HOCl below this → algae territory

function fHOClpH(ph: number): number {
  return 1 / (1 + Math.pow(10, ph - PKA_HOCL));
}

function activeHOCl(fc: number, ph: number, cya: number): number {
  const fHOCl = fHOClpH(ph);
  const hoclForm = fc * fHOCl;
  return hoclForm / (1 + CYA_BINDING * cya);
}

// =========================================================================
// LSI math (mirrors LSICalculator.tsx)
// =========================================================================

function tempFactor(tempF: number): number {
  const table: [number, number][] = [
    [32, 0.0], [37, 0.1], [46, 0.2], [53, 0.3], [60, 0.4],
    [66, 0.5], [76, 0.6], [84, 0.7], [94, 0.8], [104, 0.9],
  ];
  if (tempF <= table[0][0]) return table[0][1];
  if (tempF >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [t1, f1] = table[i];
    const [t2, f2] = table[i + 1];
    if (tempF >= t1 && tempF <= t2) {
      return f1 + ((tempF - t1) / (t2 - t1)) * (f2 - f1);
    }
  }
  return 0.6;
}

function calciumFactor(ppm: number): number {
  const table: [number, number][] = [
    [25, 1.0], [50, 1.3], [75, 1.5], [100, 1.6], [125, 1.7],
    [150, 1.8], [200, 1.9], [250, 2.0], [300, 2.1], [400, 2.2],
    [500, 2.3], [600, 2.4], [800, 2.5], [1000, 2.6],
  ];
  if (ppm <= table[0][0]) return table[0][1];
  if (ppm >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [c1, f1] = table[i];
    const [c2, f2] = table[i + 1];
    if (ppm >= c1 && ppm <= c2) {
      return f1 + ((ppm - c1) / (c2 - c1)) * (f2 - f1);
    }
  }
  return 2.0;
}

function alkalinityFactor(ppm: number): number {
  const table: [number, number][] = [
    [25, 1.4], [50, 1.7], [75, 1.9], [100, 2.0], [125, 2.1],
    [150, 2.2], [200, 2.3], [250, 2.4], [300, 2.5], [400, 2.6],
    [500, 2.7], [750, 2.9], [1000, 3.0],
  ];
  if (ppm <= table[0][0]) return table[0][1];
  if (ppm >= table[table.length - 1][0]) return table[table.length - 1][1];
  for (let i = 0; i < table.length - 1; i++) {
    const [a1, f1] = table[i];
    const [a2, f2] = table[i + 1];
    if (ppm >= a1 && ppm <= a2) {
      return f1 + ((ppm - a1) / (a2 - a1)) * (f2 - f1);
    }
  }
  return 2.0;
}

function computeLSI(ph: number, ch: number, ta: number, cya: number, tempF = 78): number {
  const cyaCorrection = cya * 0.33;
  const carbAlk = Math.max(0, ta - cyaCorrection);
  return ph + tempFactor(tempF) + calciumFactor(ch) + alkalinityFactor(carbAlk) - 12.1;
}

// =========================================================================
// Reactive pool art — color helpers
// =========================================================================

/** Clamp a number to [a, b]. */
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** Linear interpolation 0..1 → between two hex colors. */
function lerpColor(hexA: string, hexB: string, t: number): string {
  const a = parseInt(hexA.slice(1), 16);
  const b = parseInt(hexB.slice(1), 16);
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

const COLOR_WATER_HEALTHY = '#0ea5e9';   // vibrant pool blue
const COLOR_WATER_GREEN   = '#22c55e';   // algae green (sanitation failing)
const COLOR_WATER_MILKY   = '#e5e7eb';   // milky white (scaling)
const COLOR_LADDER_CLEAN  = '#94a3b8';   // brushed steel
const COLOR_LADDER_RUST   = '#92400e';   // corroded brown

/**
 * Compute the reactive water + ladder palette from chemistry + mode.
 *   sanitation mode → water trends blue→green as active HOCl falls
 *                     toward the 0.05 floor.
 *   balance mode    → LSI > 0.3 turns water milky; LSI < -0.3 turns
 *                     the ladder brown.
 */
function reactivePalette(mode: 'sanitation' | 'balance', state: {
  active: number;
  lsi: number;
}) {
  if (mode === 'sanitation') {
    // Greenness ramps in only as you APPROACH the 0.05 floor.
    //   active ≥ 0.10  → comfortably above floor, full blue.
    //   active = 0.05  → at the floor, half-tinted greenish.
    //   active = 0     → below floor, full algae green.
    // 0.10 ppm above floor is a "safe buffer" — picked to match the
    // codebase's existing default chem (FC 3 / pH 7.5 / CYA 30 ≈ 0.06
    // active) reading as still close-to-floor rather than fully safe.
    const SAFE_BUFFER = 0.10; // ppm above the floor to read as "fully safe"
    const safety = clamp((state.active - ALGAE_FLOOR) / SAFE_BUFFER + 0.5, 0, 1);
    const greenness = 1 - safety;
    return {
      water: lerpColor(COLOR_WATER_HEALTHY, COLOR_WATER_GREEN, greenness),
      ladder: COLOR_LADDER_CLEAN,
      tint: 1,
    };
  }
  // balance mode
  const lsi = state.lsi;
  if (lsi > 0.3) {
    // Scaling: blend blue → milky as LSI runs hot.
    const t = clamp((lsi - 0.3) / 0.7, 0, 1);
    return {
      water: lerpColor(COLOR_WATER_HEALTHY, COLOR_WATER_MILKY, t),
      ladder: COLOR_LADDER_CLEAN,
      tint: 1 - t * 0.4, // milkier = less saturated overall
    };
  }
  if (lsi < -0.3) {
    // Corrosive: ladder rusts. Water stays mostly clear but loses
    // a touch of saturation to read as "aggressive".
    const t = clamp((-0.3 - lsi) / 0.7, 0, 1);
    return {
      water: lerpColor(COLOR_WATER_HEALTHY, '#0c4a6e', t * 0.3),
      ladder: lerpColor(COLOR_LADDER_CLEAN, COLOR_LADDER_RUST, t),
      tint: 1,
    };
  }
  return {
    water: COLOR_WATER_HEALTHY,
    ladder: COLOR_LADDER_CLEAN,
    tint: 1,
  };
}

// =========================================================================
// Component
// =========================================================================

type ChemState = {
  fc: number;
  ph: number;
  cya: number;
  ta: number;
  ch: number;
};

const DEFAULT_CHEM: ChemState = {
  fc: 3,
  ph: 7.5,
  cya: 30,
  ta: 100,
  ch: 300,
};

type Mode = 'sanitation' | 'balance';

export default function PoolReactiveCard() {
  const [mode, setMode] = useState<Mode>('sanitation');
  const [chem, setChem] = useState<ChemState>({ ...DEFAULT_CHEM });

  const update = (patch: Partial<ChemState>) =>
    setChem((prev) => ({ ...prev, ...patch }));

  const active = useMemo(
    () => activeHOCl(chem.fc, chem.ph, chem.cya),
    [chem.fc, chem.ph, chem.cya],
  );
  const lsi = useMemo(
    () => computeLSI(chem.ph, chem.ch, chem.ta, chem.cya),
    [chem.ph, chem.ch, chem.ta, chem.cya],
  );

  const palette = reactivePalette(mode, { active, lsi });

  return (
    <div class="prc">
      {/* ===== LEFT PANEL: tabs + sliders ===== */}
      <div class="prc__panel">
        <div class="prc__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sanitation'}
            class={`prc__tab ${mode === 'sanitation' ? 'is-active' : ''}`}
            onClick={() => setMode('sanitation')}
          >
            Sanitation
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'balance'}
            class={`prc__tab ${mode === 'balance' ? 'is-active' : ''}`}
            onClick={() => setMode('balance')}
          >
            Water Balance
          </button>
        </div>

        <div class="prc__readings" role="tabpanel">
          {/* FC — sanitation only; drops off the top when switching to balance */}
          {mode === 'sanitation' && (
            <Reading label="Free Chlorine" value={chem.fc} unit="ppm">
              <Slider
                min={0}
                max={10}
                step={0.1}
                value={chem.fc}
                onChange={(v) => update({ fc: v })}
              />
            </Reading>
          )}

          {/* pH — both tabs */}
          <Reading label="pH" value={chem.ph} unit="">
            <Slider
              min={6.8}
              max={8.2}
              step={0.1}
              value={chem.ph}
              onChange={(v) => update({ ph: v })}
            />
          </Reading>

          {/* CYA — both tabs */}
          <Reading label="CYA" value={chem.cya} unit="ppm">
            <Slider
              min={0}
              max={100}
              step={5}
              value={chem.cya}
              onChange={(v) => update({ cya: v })}
            />
          </Reading>

          {/* TA + CH — balance only; added below when switching to balance */}
          {mode === 'balance' && (
            <>
              <Reading label="Alkalinity" value={chem.ta} unit="ppm">
                <Slider
                  min={40}
                  max={240}
                  step={10}
                  value={chem.ta}
                  onChange={(v) => update({ ta: v })}
                />
              </Reading>
              <Reading label="Calcium" value={chem.ch} unit="ppm">
                <Slider
                  min={100}
                  max={600}
                  step={25}
                  value={chem.ch}
                  onChange={(v) => update({ ch: v })}
                />
              </Reading>
            </>
          )}
        </div>
      </div>

      {/* ===== RIGHT PANEL: pool + reactive bar ===== */}
      <div class="prc__viz">
        <PoolArt palette={palette} mode={mode} />
        <div class="prc__bar-wrap">
          {mode === 'sanitation' ? (
            <ActiveHOClBar active={active} chem={chem} />
          ) : (
            <LSIBar lsi={lsi} />
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// Sub-components
// =========================================================================

function Reading({
  label,
  value,
  unit,
  children,
}: {
  label: string;
  value: number;
  unit: string;
  children: any;
}) {
  return (
    <div class="prc-reading">
      <div class="prc-reading__head">
        <span class="prc-reading__label">{label}</span>
        <span class="prc-reading__value">
          {Number.isInteger(value) ? value : value.toFixed(value < 10 ? 1 : 0)}
          {unit && <span class="prc-reading__unit"> {unit}</span>}
        </span>
      </div>
      {children}
    </div>
  );
}

/**
 * Stylized 3/4 view of a pool — basin, water, and a ladder. Water fill
 * + ladder rails are colored by the `palette` prop, which is computed
 * upstream from chemistry. SVG is deliberately simple so the user can
 * iterate on the art.
 */
function PoolArt({ palette, mode }: { palette: { water: string; ladder: string; tint: number }; mode: Mode }) {
  return (
    <svg
      viewBox="0 0 360 240"
      class="prc-pool"
      aria-hidden="true"
      role="img"
    >
      {/* Deck */}
      <rect x="0" y="40" width="360" height="200" rx="14" fill="#cbd5e1" opacity="0.45" />

      {/* Pool basin (rim) */}
      <rect x="30" y="60" width="300" height="150" rx="18" fill="#475569" />

      {/* Water surface */}
      <rect
        x="36"
        y="66"
        width="288"
        height="138"
        rx="14"
        fill={palette.water}
        opacity={0.65 + 0.25 * palette.tint}
      />

      {/* Water ripple highlights */}
      <g opacity={0.4 * palette.tint}>
        <path d="M50 110 Q90 100 130 110 T210 110 T290 110" stroke="#fff" stroke-width="2" fill="none" opacity="0.55" />
        <path d="M60 150 Q100 140 140 150 T220 150 T300 150" stroke="#fff" stroke-width="2" fill="none" opacity="0.35" />
      </g>

      {/* Ladder — two rails + 3 rungs, rooted on the right edge */}
      <g>
        {/* rails */}
        <rect x="296" y="50" width="6" height="170" rx="3" fill={palette.ladder} />
        <rect x="316" y="50" width="6" height="170" rx="3" fill={palette.ladder} />
        {/* rungs */}
        <rect x="294" y="90" width="30" height="6" rx="2" fill={palette.ladder} />
        <rect x="294" y="130" width="30" height="6" rx="2" fill={palette.ladder} />
        <rect x="294" y="170" width="30" height="6" rx="2" fill={palette.ladder} />
        {/* curl-over at top */}
        <path
          d={'M296 50 Q299 38 305 38 L313 38 Q319 38 322 50'}
          stroke={palette.ladder}
          stroke-width="6"
          fill="none"
          stroke-linecap="round"
        />
      </g>

      {/* Mode label in the corner so it's obvious which view we're in */}
      <text
        x="48"
        y="84"
        fill="rgba(255,255,255,.7)"
        font-size="11"
        font-weight="700"
        letter-spacing="2"
        font-family="Poppins, system-ui, sans-serif"
      >
        {mode === 'sanitation' ? 'ACTIVE HOCl' : 'LSI BALANCE'}
      </text>
    </svg>
  );
}

/**
 * Active HOCl bar: 0 → 0.5 ppm scale, with a vertical line at the
 * 0.05 algae floor and a marker at the current active level.
 */
function ActiveHOClBar({ active, chem }: { active: number; chem: ChemState }) {
  const MAX = 0.5;
  const pct = clamp(active / MAX, 0, 1) * 100;
  const floorPct = (0.05 / MAX) * 100;
  const protectedNow = active >= 0.05;
  return (
    <div class="prc-bar">
      <div class="prc-bar__head">
        <span class="prc-bar__label">Active HOCl</span>
        <span
          class={`prc-bar__pill ${protectedNow ? 'is-good' : 'is-bad'}`}
        >
          {protectedNow ? 'Protected' : 'Below floor'}
        </span>
      </div>
      <div class="prc-bar__track">
        <div
          class="prc-bar__fill"
          style={{
            width: `${pct}%`,
            background: protectedNow ? '#10b981' : '#ef4444',
          }}
        />
        <div
          class="prc-bar__floor"
          style={{ left: `${floorPct}%` }}
          aria-label="Minimum active HOCl"
        />
      </div>
      <div class="prc-bar__legend">
        <span>0</span>
        <span class="prc-bar__floor-label" style={{ left: `${floorPct}%` }}>
          floor 0.05
        </span>
        <span>{MAX.toFixed(1)} ppm</span>
      </div>
      <p class="prc-bar__readout">
        At FC <strong>{chem.fc.toFixed(1)}</strong>, pH <strong>{chem.ph.toFixed(1)}</strong>,
        CYA <strong>{chem.cya}</strong> →{' '}
        <strong>{active.toFixed(3)} ppm</strong> active HOCl.
      </p>
    </div>
  );
}

/**
 * LSI scale bar: -1.0 (corrosive) → 0 (balanced) → +1.0 (scaling),
 * with a needle at the current LSI and color zones for the three
 * regions.
 */
function LSIBar({ lsi }: { lsi: number }) {
  const MIN = -1, MAX = 1;
  const range = MAX - MIN;
  const needlePct = clamp((lsi - MIN) / range, 0, 1) * 100;
  const status =
    lsi < -0.3 ? 'Corrosive' : lsi > 0.3 ? 'Scaling' : 'Balanced';
  const statusTone =
    lsi < -0.3 ? 'is-bad' : lsi > 0.3 ? 'is-warn' : 'is-good';
  return (
    <div class="prc-bar">
      <div class="prc-bar__head">
        <span class="prc-bar__label">Langelier Saturation Index</span>
        <span class={`prc-bar__pill ${statusTone}`}>{status}</span>
      </div>
      <div class="prc-bar__track prc-bar__track--lsi">
        <div class="prc-bar__zone prc-bar__zone--corrosive" style={{ width: `${((-0.3 - MIN) / range) * 100}%` }} />
        <div class="prc-bar__zone prc-bar__zone--balanced" style={{ width: `${(0.6 / range) * 100}%` }} />
        <div class="prc-bar__zone prc-bar__zone--scaling" style={{ width: `${((MAX - 0.3) / range) * 100}%` }} />
        <div class="prc-bar__needle" style={{ left: `${needlePct}%` }} />
      </div>
      <div class="prc-bar__legend">
        <span>−1.0</span>
        <span>−0.3</span>
        <span>0</span>
        <span>+0.3</span>
        <span>+1.0</span>
      </div>
      <p class="prc-bar__readout">
        LSI = <strong>{lsi.toFixed(2)}</strong> — water is{' '}
        <strong>{status.toLowerCase()}</strong>.
      </p>
    </div>
  );
}
