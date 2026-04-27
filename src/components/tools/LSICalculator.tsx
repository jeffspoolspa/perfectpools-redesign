import { useState, useRef, useEffect, useCallback } from 'preact/hooks';

/**
 * Langelier Saturation Index (LSI) calculator with rotary dials.
 *
 * LSI = pH + TF + CF + AF - 12.1
 *  where:
 *    TF = Temperature factor (based on water temp, F)
 *    CF = Calcium Hardness factor
 *    AF = Carbonate Alkalinity factor  (TA adjusted for CYA contribution)
 *
 * Interpretation:
 *    LSI < -0.3   → corrosive (etching plaster, eating metals)
 *    -0.3 to +0.3 → balanced (ideal)
 *    LSI > +0.3   → scaling (calcium buildup, cloudy water)
 *
 * We use a fixed water temperature (78°F) for simplicity — LSI is most
 * sensitive to pH and alkalinity, so temperature variations don't shift
 * the result significantly within a typical pool range.
 */

type DialSpec = {
  key: 'ph' | 'ch' | 'ta' | 'cya';
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** "Ideal" band — tight sweet spot used for green status. */
  idealMin: number;
  idealMax: number;
  /** "Acceptable" band — values outside ideal but still workable (yellow). */
  okMin: number;
  okMax: number;
  decimals: number;
  /** Warning shown when the value is BELOW idealMin — what happens in the balance context. */
  warnLow: string;
  /** Warning shown when the value is ABOVE idealMax — what happens in the balance context. */
  warnHigh: string;
  /** Neutral descriptor shown when the value is inside the ideal band. */
  ideal: string;
};

/** Pool industry acceptable + ideal ranges. Outside okMin/okMax = red.
 *  Hint copy is scoped to the water-balance context only — how each reading
 *  affects calcium saturation and what goes wrong at each extreme. Chlorine
 *  and sanitation implications of pH/CYA are covered in the sanitation pillar. */
const DIALS: DialSpec[] = [
  {
    key: 'ph',
    label: 'pH',
    unit: '',
    min: 6.8,
    max: 8.4,
    step: 0.1,
    idealMin: 7.4,
    idealMax: 7.6,
    okMin: 7.2,
    okMax: 7.8,
    decimals: 1,
    warnLow: 'Corrosive — strips calcium from plaster and pits metal.',
    warnHigh: 'Forces calcium out — scale and cloudy water.',
    ideal: 'Main driver of balance.',
  },
  {
    key: 'ch',
    label: 'Calcium',
    unit: 'ppm',
    min: 100,
    max: 800,
    step: 10,
    idealMin: 200,
    idealMax: 400,
    okMin: 150,
    okMax: 500,
    decimals: 0,
    warnLow: 'Starved — scavenges calcium from plaster and grout.',
    warnHigh: 'Drops out as scale on tile and heaters.',
    ideal: 'The raw material water needs.',
  },
  {
    key: 'ta',
    label: 'Alkalinity',
    unit: 'ppm',
    min: 0,
    max: 240,
    step: 5,
    idealMin: 80,
    idealMax: 120,
    okMin: 60,
    okMax: 180,
    decimals: 0,
    warnLow: "No buffer — pH drifts, balance won't hold.",
    warnHigh: 'Locks pH high — water trends scaling.',
    ideal: 'Buffers pH against swings.',
  },
  {
    key: 'cya',
    label: 'CYA',
    unit: 'ppm',
    min: 0,
    max: 150,
    step: 5,
    idealMin: 30,
    idealMax: 50,
    okMin: 20,
    okMax: 80,
    decimals: 0,
    warnLow: "No impact on balance — this matters for chlorine.",
    warnHigh: 'Inflates alkalinity reading — throws off balance math.',
    ideal: "Small enough not to skew balance math.",
  },
];

type DialHealth = 'ideal' | 'ok' | 'bad';

function dialHealth(value: number, spec: DialSpec): DialHealth {
  if (value >= spec.idealMin && value <= spec.idealMax) return 'ideal';
  if (value >= spec.okMin && value <= spec.okMax) return 'ok';
  return 'bad';
}

const DEFAULTS: Record<string, number> = {
  ph: 7.5,
  ch: 300,
  ta: 100,
  cya: 40,
};

// ===== LSI Factor Lookup Tables =====

/** Temperature factor for LSI. Water temp in °F → factor. */
function tempFactor(tempF: number): number {
  // Lookup table from pool industry LSI tables (extrapolated linearly).
  if (tempF <= 32) return 0.0;
  if (tempF >= 104) return 0.9;
  const table: [number, number][] = [
    [32, 0.0], [37, 0.1], [46, 0.2], [53, 0.3], [60, 0.4],
    [66, 0.5], [76, 0.6], [84, 0.7], [94, 0.8], [104, 0.9],
  ];
  for (let i = 0; i < table.length - 1; i++) {
    const [t1, f1] = table[i];
    const [t2, f2] = table[i + 1];
    if (tempF >= t1 && tempF <= t2) {
      return f1 + ((tempF - t1) / (t2 - t1)) * (f2 - f1);
    }
  }
  return 0.6;
}

/** Calcium Hardness factor. ppm as CaCO3 → factor. */
function calciumFactor(ppm: number): number {
  // Standard LSI calcium factor table.
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

/** Alkalinity factor. ppm as CaCO3 → factor. */
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

/**
 * CYA correction factor for total alkalinity → carbonate alkalinity.
 * Rough industry rule: CarbAlk = TA - (CYA × 0.33).
 * We use this adjusted alkalinity when computing the LSI alkalinity factor.
 */
function carbonateAlkalinity(ta: number, cya: number, ph: number): number {
  // At typical pool pH (7.2–7.8), ~33% of CYA contributes to measured TA.
  // More precise equations exist but this is the standard pool industry shortcut.
  const cyaCorrection = cya * 0.33;
  return Math.max(0, ta - cyaCorrection);
}

function computeLSI(ph: number, ch: number, ta: number, cya: number, tempF = 78): number {
  const carbAlk = carbonateAlkalinity(ta, cya, ph);
  const tf = tempFactor(tempF);
  const cf = calciumFactor(ch);
  const af = alkalinityFactor(carbAlk);
  return ph + tf + cf + af - 12.1;
}

function lsiStatus(lsi: number): { label: string; tone: 'balanced' | 'corrosive' | 'scaling'; detail: string } {
  if (lsi < -0.3) {
    return {
      label: 'Corrosive',
      tone: 'corrosive',
      detail: 'Water is aggressive — it will etch plaster, eat away metal fixtures, and stain surfaces. Raise alkalinity, calcium, or pH to correct.',
    };
  }
  if (lsi > 0.3) {
    return {
      label: 'Scaling',
      tone: 'scaling',
      detail: 'Water is over-saturated — calcium will precipitate out, causing cloudy water, scale buildup on tile, and clogged filters. Lower pH or alkalinity to correct.',
    };
  }
  return {
    label: 'Balanced',
    tone: 'balanced',
    detail: "Water is in the Goldilocks zone — not corrosive, not scaling. This is what we aim for on every service visit.",
  };
}

// ===== CircularDial sub-component =====

type DialProps = {
  spec: DialSpec;
  value: number;
  onChange: (v: number) => void;
};

function CircularDial({ spec, value, onChange }: DialProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Drag state uses INCREMENTAL tracking: each pointer move computes a small
  // angular delta from the PREVIOUS pointer position (not the drag origin),
  // and that delta is added to the running value. This avoids the wrap-around
  // problem you get when computing one cumulative delta across a large drag —
  // atan2 flips sign when you cross the ±180° boundary at the bottom of the
  // dial, which would otherwise cause the value to snap back unexpectedly.
  const dragStateRef = useRef<{ lastAngle: number; currentValue: number } | null>(null);

  const range = spec.max - spec.min;
  const normalized = Math.max(0, Math.min(1, (value - spec.min) / range));

  // Dial sweep: 270° arc (from -135° to +135°), bottom-anchored.
  const SWEEP = 270;
  const START_ANGLE = -135;
  const rotation = START_ANGLE + normalized * SWEEP;

  /** Raw pointer angle from dial center. 0° = 12 o'clock, increasing clockwise. */
  const pointerAngle = useCallback((clientX: number, clientY: number): number | null => {
    if (!dialRef.current) return null;
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    const angle = pointerAngle(clientX, clientY);
    if (angle === null) return;
    dragStateRef.current = { lastAngle: angle, currentValue: value };
    setIsDragging(true);
  };
  const handleMove = (clientX: number, clientY: number) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const angle = pointerAngle(clientX, clientY);
    if (angle === null) return;

    // Small incremental delta from the previous pointer angle. Because moves
    // happen frame-by-frame, this delta is always small, so the ±180° wrap
    // correction is unambiguous.
    let delta = angle - drag.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Accumulate value. 270° of spin = full range.
    const valueDelta = (delta / SWEEP) * range;
    const rawNew = drag.currentValue + valueDelta;
    const clamped = Math.max(spec.min, Math.min(spec.max, rawNew));

    // Persist the running state so the next move picks up from here.
    drag.lastAngle = angle;
    drag.currentValue = clamped;

    // Snap to the nearest step for display.
    const snapped = Math.round(clamped / spec.step) * spec.step;
    onChange(snapped);
  };
  const handleEnd = () => {
    dragStateRef.current = null;
    setIsDragging(false);
  };

  // Global mouse/touch listeners while dragging. Handlers are inline closures
  // that read from dragStartRef + latest prop refs, so we only re-subscribe
  // when the drag state toggles (not on every value update).
  const moveHandlerRef = useRef(handleMove);
  const endHandlerRef = useRef(handleEnd);
  moveHandlerRef.current = handleMove;
  endHandlerRef.current = handleEnd;
  useEffect(() => {
    if (!isDragging) return;
    const onMouseMove = (e: MouseEvent) => moveHandlerRef.current(e.clientX, e.clientY);
    const onMouseUp = () => endHandlerRef.current();
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) moveHandlerRef.current(t.clientX, t.clientY);
    };
    const onTouchEnd = () => endHandlerRef.current();
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [isDragging]);

  const onMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };
  const onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (t) handleStart(t.clientX, t.clientY);
  };

  const health = dialHealth(value, spec);
  const inIdeal = health === 'ideal';

  // Compute ideal band arc endpoints (for SVG arc path).
  const idealMinNorm = (spec.idealMin - spec.min) / range;
  const idealMaxNorm = (spec.idealMax - spec.min) / range;
  const idealStartAngle = START_ANGLE + idealMinNorm * SWEEP;
  const idealEndAngle = START_ANGLE + idealMaxNorm * SWEEP;

  // Indicator dot color based on per-dial health
  const dotInnerColor =
    health === 'ideal' ? '#059669' :
    health === 'ok' ? '#f59e0b' : '#dc2626';

  // SVG arc path helper. Radius 90 (viewBox is 200×200, center 100,100).
  const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
    // Convert "12 o'clock = 0°, clockwise" to SVG "3 o'clock = 0°, clockwise" by subtracting 90°.
    const a = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  };
  const describeArc = (cx: number, cy: number, r: number, startDeg: number, endDeg: number) => {
    const start = polarToCartesian(cx, cy, r, endDeg);
    const end = polarToCartesian(cx, cy, r, startDeg);
    const largeArc = endDeg - startDeg <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  };

  // Current value's angle along the dial sweep.
  const currentAngle = START_ANGLE + normalized * SWEEP;

  const displayValue = spec.decimals > 0 ? value.toFixed(spec.decimals) : Math.round(value).toString();

  return (
    <div class="lsi-dial">
      <div class="lsi-dial__label">{spec.label}</div>
      <div
        class={`lsi-dial__wheel lsi-dial__wheel--${health} ${isDragging ? 'is-dragging' : ''}`}
        ref={dialRef}
        onMouseDown={onMouseDown as any}
        onTouchStart={onTouchStart as any}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg viewBox="0 0 200 200" class="lsi-dial__svg" style={{ pointerEvents: 'none' }}>
          {/* pointer-events="none" on the <g> is an SVG attribute that cascades
              reliably to every child shape — no clicks are absorbed anywhere
              inside the dial visuals, so the wheel div's mousedown handler
              always fires regardless of which pixel was clicked. */}
          <g pointer-events="none">
            {/* Full-range arc (muted) — background track */}
            <path
              d={describeArc(100, 100, 85, START_ANGLE, START_ANGLE + SWEEP)}
              fill="none"
              stroke="rgba(255,255,255,0.18)"
              stroke-width="8"
              stroke-linecap="round"
            />
            {/* Ideal band arc (green) — shows the healthy range */}
            <path
              d={describeArc(100, 100, 85, idealStartAngle, idealEndAngle)}
              fill="none"
              stroke="#34d399"
              stroke-width="8"
              stroke-linecap="round"
              opacity="0.9"
            />
            {/* Progress arc — fills from start to current value, showing position */}
            {normalized > 0.001 && (
              <path
                d={describeArc(100, 100, 85, START_ANGLE, currentAngle)}
                fill="none"
                stroke="#ffffff"
                stroke-width="8"
                stroke-linecap="round"
                opacity="0.85"
              />
            )}
            {/* Tick marks every 10% of range */}
            {Array.from({ length: 11 }, (_, i) => {
              const tickNorm = i / 10;
              const tickAngle = START_ANGLE + tickNorm * SWEEP;
              const isMajor = i % 5 === 0;
              const inner = polarToCartesian(100, 100, isMajor ? 68 : 72, tickAngle);
              const outer = polarToCartesian(100, 100, 76, tickAngle);
              return (
                <line
                  key={i}
                  x1={inner.x}
                  y1={inner.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke="rgba(255,255,255,0.55)"
                  stroke-width={isMajor ? 2 : 1}
                />
              );
            })}
            {/* Large indicator dot at the current value position — clearly shows
                where the dial is "pointing" */}
            {(() => {
              const dot = polarToCartesian(100, 100, 85, currentAngle);
              return (
                <>
                  <circle cx={dot.x} cy={dot.y} r="11" fill="#ffffff" />
                  <circle cx={dot.x} cy={dot.y} r="5" fill={dotInnerColor} />
                </>
              );
            })()}
          </g>
        </svg>

        {/* Center readout */}
        <div class="lsi-dial__center">
          <div class={`lsi-dial__value lsi-dial__value--${health}`}>{displayValue}</div>
          <div class="lsi-dial__unit">{spec.unit}</div>
        </div>
      </div>
      {/* Dynamic caption: changes based on where the dial currently sits —
          shows the specific consequence of being too low, too high, or a
          neutral descriptor when in the ideal band. */}
      <p class={`lsi-dial__why lsi-dial__why--${health}`}>
        {value < spec.idealMin ? spec.warnLow
          : value > spec.idealMax ? spec.warnHigh
          : spec.ideal}
      </p>
    </div>
  );
}

// ===== Main Calculator =====

export default function LSICalculator() {
  const [values, setValues] = useState<Record<string, number>>({ ...DEFAULTS });

  const lsi = computeLSI(values.ph, values.ch, values.ta, values.cya);
  const status = lsiStatus(lsi);
  // Map LSI to a 0–100 position on the gauge. -1.5 → 0, 0 → 50, +1.5 → 100.
  const gaugePos = Math.max(0, Math.min(100, ((lsi + 1.5) / 3) * 100));

  // Check if any individual dial reading is outside its acceptable range.
  // Used to show a secondary warning alongside the LSI callout — the index
  // can look fine while individual parameters are way out of band.
  const anyBad = DIALS.some((spec) => dialHealth(values[spec.key], spec) === 'bad');

  const reset = () => setValues({ ...DEFAULTS });

  return (
    <div class="lsi-calc">
      <p class="lsi-calc__intro">
        Every pool reading we test has its own job and its own target range, but it's how they combine
        that determines whether your water protects surfaces or attacks them. Individual readings tell
        us what to adjust. The saturation index tells us where within those ranges to aim to keep
        water balanced based on the other factors in your pool.
      </p>

      <div class="lsi-calc__dials">
        {DIALS.map((spec) => (
          <CircularDial
            key={spec.key}
            spec={spec}
            value={values[spec.key]}
            onChange={(v) => setValues((prev) => ({ ...prev, [spec.key]: v }))}
          />
        ))}
      </div>

      <div class={`lsi-calc__result lsi-calc__result--${status.tone}`}>
        <div class="lsi-calc__callout-row">
          {/* LEFT: LSI callout — how all four readings combine to keep water balanced. */}
          <div class={`lsi-calc__callout lsi-calc__callout--${status.tone}`}>
            <div class="lsi-calc__callout-label">
              {status.tone === 'scaling' && 'Scaling'}
              {status.tone === 'corrosive' && 'Corrosive'}
              {status.tone === 'balanced' && 'In balance'}
            </div>
            <div class="lsi-calc__callout-detail">
              {status.tone === 'scaling' &&
                'Readings tip into scaling — calcium drops out as cloudy water and scale on tile and heaters.'}
              {status.tone === 'corrosive' &&
                'Readings tip into corrosion — water pulls calcium from plaster, grout, and metal fixtures.'}
              {status.tone === 'balanced' &&
                'Ranges combine to keep saturation balanced — protecting surfaces, equipment, and skin.'}
            </div>
          </div>

          {/* RIGHT: Individual readings status — out-of-range (red), ideal
              (green, when LSI is also balanced), or in-range-but-LSI-off (green). */}
          <div class={`lsi-calc__readings-callout lsi-calc__readings-callout--${anyBad ? 'bad' : 'good'}`}>
            <div class="lsi-calc__readings-callout-label">
              {anyBad ? 'Out of range' : 'Everything in range'}
            </div>
            <div class="lsi-calc__readings-callout-detail">
              {anyBad &&
                "Fix the red dial first — water balance can't be trusted until every reading is inside its target band."}
              {!anyBad && status.tone === 'balanced' &&
                'Ideal scenario — all readings dialed and water is balanced. Nothing needs to be added.'}
              {!anyBad && status.tone !== 'balanced' &&
                'All readings sit in their target bands. Small adjustments will bring the saturation index back to the sweet spot.'}
            </div>
          </div>
        </div>

        <div class="lsi-calc__result-top">
          <div class="lsi-calc__lsi">
            <span class="lsi-calc__lsi-label">LSI</span>
            <span class="lsi-calc__lsi-value">{lsi >= 0 ? '+' : ''}{lsi.toFixed(2)}</span>
          </div>
          <div class="lsi-calc__status">{status.label}</div>
          <button type="button" class="lsi-calc__reset" onClick={reset}>Reset</button>
        </div>
        <div class="lsi-calc__gauge-track">
          <div class="lsi-calc__gauge-zone lsi-calc__gauge-zone--corrosive" />
          <div class="lsi-calc__gauge-zone lsi-calc__gauge-zone--balanced" />
          <div class="lsi-calc__gauge-zone lsi-calc__gauge-zone--scaling" />
          <div class="lsi-calc__gauge-marker" style={{ '--pos': gaugePos } as any} />
        </div>
        <div class="lsi-calc__gauge-labels">
          <span>Corrosive</span>
          <span>Balanced</span>
          <span>Scaling</span>
        </div>
      </div>
    </div>
  );
}
