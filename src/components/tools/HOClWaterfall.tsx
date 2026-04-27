import { useState, useMemo, useEffect, useRef } from 'preact/hooks';
import Slider from './Slider';

/**
 * Sanitation pillar · Tab 1: "How chlorine becomes sanitizer"
 *
 * A 3-bar stacked waterfall that shows, for your CURRENT Free Chlorine
 * reading, how pH and CYA whittle it down to the tiny active HOCl fraction
 * that actually kills algae.
 *
 *   ┌──────┐        ┌──────┐
 *   │ OCl⁻ │        │Bound │
 *   │(lost │        │ (CYA │
 *   │ to   │        │locks │
 *   │ pH)  │        │ up)  │
 *   ├──────┤═══════►├──────┤
 *   │      │        │      │═══►┌────┐
 *   │ HOCl │        │Active│    │Act │
 *   │ form │        │HOCl  │    │HOCl│
 *   └──────┘        └──────┘    └────┘
 *    Free            HOCl        Active
 *    Chlorine        form        HOCl
 *
 * Each segment has a hover tooltip explaining the chemistry:
 *   OCl⁻    — why the deprotonated form doesn't kill algae
 *   HOCl    — why the neutral form DOES
 *   Bound   — the CYA-bound "reserve" (with a button that animates FC
 *             depletion at normal demand rate)
 *   Active  — the only part actually killing algae, must stay ≥ 0.05 ppm
 *
 * The "1 jug dose" framing lives on the next slide (Daily Protection).
 * This slide is about the FC you already have — not how you got it.
 */

// ===== Constants =====

const PKA_HOCL = 7.54;
const CYA_BINDING = 0.83;
const ALGAE_FLOOR = 0.05;         // minimum active HOCl to prevent algae (ppm)

// Animation assumptions — "normal" mixed demand for a residential pool
// on a sunny day with a couple of swimmers and some debris
const DEMAND_PPM_PER_HR = 0.15;   // typical mixed demand (UV + swimmers + debris)
const ANIM_TICK_MS = 90;          // real-time ms per animation step
const ANIM_MIN_PER_TICK = 15;     // simulated pool minutes per step
const ANIM_PPM_PER_TICK = DEMAND_PPM_PER_HR * (ANIM_MIN_PER_TICK / 60);

// Visualization palette
const COLOR_HOCL = '#06b6d4';      // cyan — the active form of FC
const COLOR_OCL = '#cbd5e1';       // light gray — OCl⁻, lost to pH
const COLOR_BOUND = '#94a3b8';     // gray — locked up by CYA
const COLOR_SAFE = '#10b981';      // green — clears the 0.05 floor
const COLOR_UNSAFE = '#ef4444';    // red — below the 0.05 floor

// ===== Math =====

function fHOClpH(ph: number): number {
  return 1 / (1 + Math.pow(10, ph - PKA_HOCL));
}

type Stages = {
  fc: number;
  hoclForm: number;     // fc × f_HOCl(pH)  — the pH-surviving fraction
  oclForm: number;      // fc − hoclForm    — OCl⁻, lost to pH
  activeHOCl: number;   // hoclForm / (1 + 0.83 × CYA)
  boundByCya: number;   // hoclForm − activeHOCl
  fHOCl: number;
};

function computeStages(fc: number, ph: number, cya: number): Stages {
  const fHOCl = fHOClpH(ph);
  const hoclForm = fc * fHOCl;
  const oclForm = fc - hoclForm;
  const activeHOCl = hoclForm / (1 + CYA_BINDING * cya);
  const boundByCya = hoclForm - activeHOCl;
  return { fc, hoclForm, oclForm, activeHOCl, boundByCya, fHOCl };
}

/**
 * Minimum FC needed at this pH + CYA to clear the 0.05 ppm active HOCl
 * floor. Inverts the Wojtowicz formula:
 *   activeHOCl = FC × f_HOCl / (1 + 0.83 × CYA)
 *   FC_min = 0.05 × (1 + 0.83 × CYA) / f_HOCl
 */
function minFcForFloor(ph: number, cya: number): number {
  const f = fHOClpH(ph);
  return (ALGAE_FLOOR * (1 + CYA_BINDING * cya)) / f;
}

function formatHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ===== Types =====

type TipKey = 'ocl' | 'hocl' | 'bound' | 'active';

type Props = {
  // Shared pool chemistry — owned by SanitationTabs, consumed here
  fc: number;
  ph: number;
  cya: number;
  onChemChange: (patch: { fc?: number; ph?: number; cya?: number }) => void;
  // Click the "See daily protection →" CTA below the Protected callout
  onGoToProtection: () => void;
};

// ===== Component =====

export default function HOClWaterfall({ fc, ph, cya, onChemChange, onGoToProtection }: Props) {
  // Animation-local FC. When null, we render the shared `fc` prop. When
  // set, we're in animating/stopped/depleted state — playback doesn't
  // mutate the parent chem.
  const [animFc, setAnimFc] = useState<number | null>(null);
  const effectiveFc = animFc !== null ? animFc : fc;

  const stages = useMemo(
    () => computeStages(effectiveFc, ph, cya),
    [effectiveFc, ph, cya]
  );

  // Hover + animation state
  const [hover, setHover] = useState<TipKey | null>(null);
  const [animating, setAnimating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [floorCrossedAt, setFloorCrossedAt] = useState<number | null>(null);

  // Refs mirror the animation state synchronously — state drives re-rendering.
  const fcRef = useRef(fc);
  const elapsedRef = useRef(0);
  const floorCrossedAtRef = useRef<number | null>(null);

  // Derived UI states. `animFc` is the marker for "we've been in/through
  // an animation" — while null we're idle.
  const isDepleted = !animating && animFc !== null && animFc <= 0;
  const isStopped = !animating && animFc !== null && animFc > 0;
  const inAnimState = animating || animFc !== null;

  // ===== Animation loop =====
  // pH and CYA are snapshotted at start (sliders are implicitly stable
  // during playback — the user can't hover tooltips or drag sliders while
  // the animation is running).
  useEffect(() => {
    if (!animating) return;
    const phSnap = ph;
    const cyaSnap = cya;
    const id = setInterval(() => {
      elapsedRef.current += ANIM_MIN_PER_TICK;
      fcRef.current = Math.max(0, fcRef.current - ANIM_PPM_PER_TICK);

      if (floorCrossedAtRef.current === null) {
        const snapshot = computeStages(fcRef.current, phSnap, cyaSnap);
        if (snapshot.activeHOCl < ALGAE_FLOOR) {
          floorCrossedAtRef.current = elapsedRef.current;
          setFloorCrossedAt(elapsedRef.current);
        }
      }

      setAnimFc(fcRef.current);
      setElapsed(elapsedRef.current);
    }, ANIM_TICK_MS);
    return () => clearInterval(id);
  }, [animating]);

  // Stop loop when depleted
  useEffect(() => {
    if (animating && animFc !== null && animFc <= 0) {
      setAnimating(false);
    }
  }, [animating, animFc]);

  const startAnim = () => {
    if (animating) return;
    fcRef.current = fc;
    elapsedRef.current = 0;
    floorCrossedAtRef.current = null;
    setAnimFc(fc);
    setFloorCrossedAt(null);
    setElapsed(0);
    setHover(null);
    setAnimating(true);
  };

  const stopAnim = () => setAnimating(false);

  const resumeAnim = () => {
    // Refs are already at the paused values — re-subscribing the effect
    // restarts the interval seamlessly from there.
    if (animating || animFc === null || animFc <= 0) return;
    setHover(null);
    setAnimating(true);
  };

  const resetAnim = () => {
    setAnimFc(null);
    setAnimating(false);
    setElapsed(0);
    setFloorCrossedAt(null);
    floorCrossedAtRef.current = null;
    elapsedRef.current = 0;
  };

  // FC slider writes back through the parent. If we're in a post-animation
  // state, dragging FC returns us to idle.
  const updateFc = (v: number) => {
    onChemChange({ fc: v });
    fcRef.current = v;
    if (animFc !== null) {
      setAnimFc(null);
      setAnimating(false);
      setElapsed(0);
      setFloorCrossedAt(null);
      floorCrossedAtRef.current = null;
      elapsedRef.current = 0;
    }
  };

  const isSafe = stages.activeHOCl >= ALGAE_FLOOR;
  const margin = stages.activeHOCl - ALGAE_FLOOR;
  const safeFill = isSafe ? COLOR_SAFE : COLOR_UNSAFE;

  // Minimum FC at current pH/CYA to clear the 0.05 floor
  const fcMin = minFcForFloor(ph, cya);
  const fcMinUnreachable = fcMin > 8;

  // Time until active HOCl crosses the 0.05 floor (the usable window,
  // NOT time until FC hits zero — algae is already growing by then).
  const hoursUntilFloor = Math.max(0, (effectiveFc - fcMin) / DEMAND_PPM_PER_HR);
  const alreadyBelowFloor = effectiveFc < fcMin;

  // ===== Hover tooltip content =====
  // Tooltips sit in the TOP-RIGHT corner of the chart, constrained to
  // ~35% of container width so they never reach col1/col2 horizontally.
  // Copy is trimmed to 2-3 short lines so the whole tooltip stays in the
  // empty corner above col3's tiny Active bar.
  const tips: Record<TipKey, { title: string; body: any; action?: boolean }> = {
    ocl: {
      title: 'OCl⁻ (hypochlorite)',
      body: (
        <>
          <strong>Negative charge</strong> — repelled by algae cell walls.{' '}
          <strong>80–100× weaker</strong> than HOCl.
        </>
      ),
    },
    hocl: {
      title: 'HOCl (hypochlorous acid)',
      body: (
        <>
          <strong>Small, neutral</strong> — slips through cell walls. This is the form of FC that
          actually kills.
        </>
      ),
    },
    bound: {
      title: 'CYA reserve',
      body: (
        <>
          Slow-release HOCl bound to cyanuric acid. At <strong>{DEMAND_PPM_PER_HR} ppm/hr</strong>{' '}
          demand,{' '}
          {alreadyBelowFloor ? (
            <>you're <strong>already below the 0.05 floor</strong>.</>
          ) : (
            <>active HOCl stays above the 0.05 floor for{' '}
            <strong>{formatHoursMinutes(hoursUntilFloor * 60)}</strong>.</>
          )}
        </>
      ),
      action: animFc === null,  // hide action button in any animation state
    },
    active: {
      title: 'Active HOCl',
      body: (
        <>
          What's killing algae <em>right now</em>. Must stay <strong>≥ 0.05 ppm</strong> to kill
          spores on contact.
        </>
      ),
    },
  };

  const showTip = hover !== null && !animating;

  return (
    <div class="hwf">
      <p class="hwf__intro">
        Your free chlorine reading isn't what keeps algae away — it's how much of that
        chlorine is in its <strong>active form</strong>. That depends on your pH and stabilizer
        levels, and the right free chlorine target is different for every pool.{' '}
        <em>Most companies guess. We calculate it.</em>
      </p>

      {/* ========== Inputs — FC + pH + CYA (disabled during animation) ========== */}
      <div
        class={`hwf__inputs ${animating ? 'is-locked' : ''}`}
        aria-disabled={animating}
      >
        <div class="hocl-slider">
          <div class="hocl-slider__head">
            <span class="hocl-slider__label">Free Cl</span>
            <span class="hocl-slider__value">
              {effectiveFc.toFixed(1)}
              <span class="hocl-slider__unit"> ppm</span>
            </span>
          </div>
          <Slider
            min={0.5}
            max={8}
            step={0.1}
            value={effectiveFc}
            onChange={updateFc}
          />
        </div>
        <div class="hocl-slider">
          <div class="hocl-slider__head">
            <span class="hocl-slider__label">pH</span>
            <span class="hocl-slider__value">{ph.toFixed(1)}</span>
          </div>
          <Slider
            min={7.0}
            max={8.0}
            step={0.1}
            value={ph}
            onChange={(v) => onChemChange({ ph: v })}
          />
        </div>
        <div class="hocl-slider">
          <div class="hocl-slider__head">
            <span class="hocl-slider__label">CYA</span>
            <span class="hocl-slider__value">
              {cya}
              <span class="hocl-slider__unit"> ppm</span>
            </span>
          </div>
          <Slider
            min={0}
            max={100}
            step={5}
            value={cya}
            onChange={(v) => onChemChange({ cya: v })}
          />
        </div>
      </div>

      {/* ========== Chart wrapper — holds SVG + corner-anchored tooltip ==========
          Tooltip is absolutely positioned in the TOP-RIGHT corner of the
          wrapper, capped at ~35% width so it never overlaps col1/col2
          horizontally (col3 is mostly empty except for the tiny Active
          bar at the bottom). onMouseLeave on the wrapper keeps hover
          persistent as the cursor moves from a bar up into the tooltip. */}
      <div
        class="hwf__chart-wrap"
        onMouseLeave={() => {
          if (!animating) setHover(null);
        }}
      >
        {showTip && hover && (
          <div class={`hwf__tip hwf__tip--${hover}`} role="tooltip">
            <h4 class="hwf__tip-title">{tips[hover].title}</h4>
            <p class="hwf__tip-body">{tips[hover].body}</p>
            {tips[hover].action && (
              <button type="button" class="hwf__tip-btn" onClick={startAnim}>
                See reserve deplete →
              </button>
            )}
          </div>
        )}

        {(() => {
          const W = 640;
          const H = 210;
          const pad = { top: 26, right: 16, bottom: 38, left: 34 };
          const plotW = W - pad.left - pad.right;
          const plotH = H - pad.top - pad.bottom;

          const yMax = Math.max(stages.fc * 1.12, 1.5);
          const yToPx = (v: number) => pad.top + plotH - (v / yMax) * plotH;

          const cols = 3;
          const bridgeRatio = 0.55;
          const totalUnits = cols + (cols - 1) * bridgeRatio;
          const colW = plotW / totalUnits;
          const bridgeW = colW * bridgeRatio;
          const colX = (i: number) => pad.left + i * (colW + bridgeW);

          const col1X = colX(0);
          const col2X = colX(1);
          const col3X = colX(2);

          const yFc = yToPx(stages.fc);
          const yHocl = yToPx(stages.hoclForm);
          const yActive = yToPx(stages.activeHOCl);
          const yZero = yToPx(0);

          const ticks = (() => {
            const step = yMax > 6 ? 2 : yMax > 3 ? 1 : 0.5;
            const out: number[] = [];
            for (let t = 0; t <= yMax; t += step) out.push(t);
            return out;
          })();

          // Hover handlers — disabled only during active playback. In
          // idle/stopped/depleted states, hover still works so the user
          // can learn about segments while reviewing the result.
          const hoverSet = (k: TipKey) => () => {
            if (!animating) setHover(k);
          };

          return (
            <svg viewBox={`0 0 ${W} ${H}`} class="hwf__chart" aria-label="Free Chlorine split by pH and CYA into Active HOCl">
              {/* Gridlines */}
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={pad.left}
                    y1={yToPx(tick)}
                    x2={pad.left + plotW}
                    y2={yToPx(tick)}
                    stroke="rgba(10, 30, 55, 0.06)"
                    stroke-width="1"
                  />
                  <text
                    x={pad.left - 6}
                    y={yToPx(tick) + 3}
                    text-anchor="end"
                    font-size="9"
                    fill="#94a3b8"
                    font-weight="600"
                  >
                    {Number.isInteger(tick) ? tick : tick.toFixed(1)}
                  </text>
                </g>
              ))}

              {/* Sankey bridges (behind the bars) */}
              <rect
                x={col1X + colW}
                y={yHocl}
                width={bridgeW}
                height={yZero - yHocl}
                fill={COLOR_HOCL}
                fill-opacity="0.28"
                pointer-events="none"
              />
              <rect
                x={col2X + colW}
                y={yActive}
                width={bridgeW}
                height={yZero - yActive}
                fill={safeFill}
                fill-opacity="0.35"
                pointer-events="none"
              />

              {/* ========= Column 1: Free Chlorine, split by pH ========= */}
              {/* Minimum-FC marker — dashed amber line at the FC level
                  needed to hit the 0.05 active HOCl floor at current pH/CYA.
                  Drawn behind the bars so a filled col1 obscures the line
                  segment that falls inside the surviving FC range. */}
              {!fcMinUnreachable && fcMin > 0 && fcMin <= yMax && (
                <g pointer-events="none">
                  <line
                    x1={col1X - 6}
                    y1={yToPx(fcMin)}
                    x2={col1X + colW + 6}
                    y2={yToPx(fcMin)}
                    stroke="#f59e0b"
                    stroke-width="1.5"
                    stroke-dasharray="4 2"
                  />
                  <text
                    x={col1X + colW + 10}
                    y={yToPx(fcMin) + 3}
                    font-size="8"
                    fill="#b45309"
                    font-weight="800"
                    letter-spacing="0.02em"
                  >
                    min {fcMin.toFixed(1)}
                  </text>
                </g>
              )}
              {/* OCl⁻ (top) — hoverable */}
              <rect
                x={col1X}
                y={yFc}
                width={colW}
                height={yHocl - yFc}
                fill={COLOR_OCL}
                class={`hwf__seg ${hover === 'ocl' ? 'is-hover' : ''}`}
                onMouseEnter={hoverSet('ocl')}
              />
              {/* HOCl (bottom) — hoverable */}
              <rect
                x={col1X}
                y={yHocl}
                width={colW}
                height={yZero - yHocl}
                fill={COLOR_HOCL}
                class={`hwf__seg ${hover === 'hocl' ? 'is-hover' : ''}`}
                onMouseEnter={hoverSet('hocl')}
              />
              {/* Mid-bar % labels */}
              {yHocl - yFc > 14 && (
                <text
                  x={col1X + colW / 2}
                  y={(yFc + yHocl) / 2 + 3}
                  text-anchor="middle"
                  font-size="9"
                  fill="#475569"
                  font-weight="700"
                  pointer-events="none"
                >
                  OCl⁻ {Math.round((1 - stages.fHOCl) * 100)}%
                </text>
              )}
              {yZero - yHocl > 14 && (
                <text
                  x={col1X + colW / 2}
                  y={(yHocl + yZero) / 2 + 3}
                  text-anchor="middle"
                  font-size="9"
                  fill="#ffffff"
                  font-weight="700"
                  pointer-events="none"
                >
                  HOCl {Math.round(stages.fHOCl * 100)}%
                </text>
              )}

              {/* ========= Column 2: HOCl form, split by CYA ========= */}
              {/* Bound (top) — hoverable */}
              <rect
                x={col2X}
                y={yHocl}
                width={colW}
                height={yActive - yHocl}
                fill={COLOR_BOUND}
                class={`hwf__seg ${hover === 'bound' ? 'is-hover' : ''}`}
                onMouseEnter={hoverSet('bound')}
              />
              {/* Active (bottom) — hoverable, links to 'active' tooltip */}
              <rect
                x={col2X}
                y={yActive}
                width={colW}
                height={yZero - yActive}
                fill={safeFill}
                class={`hwf__seg ${hover === 'active' ? 'is-hover' : ''}`}
                onMouseEnter={hoverSet('active')}
              />
              {yActive - yHocl > 16 && (
                <text
                  x={col2X + colW / 2}
                  y={(yHocl + yActive) / 2 + 3}
                  text-anchor="middle"
                  font-size="9"
                  fill="#ffffff"
                  font-weight="700"
                  pointer-events="none"
                >
                  Bound {Math.round((stages.boundByCya / stages.hoclForm) * 100) || 0}%
                </text>
              )}

              {/* ========= Column 3: Active HOCl only — hoverable ========= */}
              <rect
                x={col3X}
                y={yActive}
                width={colW}
                height={Math.max(1.5, yZero - yActive)}
                fill={safeFill}
                class={`hwf__seg ${hover === 'active' ? 'is-hover' : ''}`}
                onMouseEnter={hoverSet('active')}
              />

              {/* ========= Top value labels ========= */}
              <text x={col1X + colW / 2} y={yFc - 6} text-anchor="middle" font-size="11" fill="#0a1e37" font-weight="800" pointer-events="none">
                {stages.fc.toFixed(1)}
                <tspan font-size="8" font-weight="600" fill="#64748b"> ppm</tspan>
              </text>
              <text x={col2X + colW / 2} y={yHocl - 6} text-anchor="middle" font-size="11" fill="#0a1e37" font-weight="800" pointer-events="none">
                {stages.hoclForm.toFixed(2)}
                <tspan font-size="8" font-weight="600" fill="#64748b"> ppm</tspan>
              </text>
              <text x={col3X + colW / 2} y={Math.max(pad.top + 10, yActive - 6)} text-anchor="middle" font-size="11" fill={isSafe ? '#047857' : '#b91c1c'} font-weight="800" pointer-events="none">
                {stages.activeHOCl.toFixed(3)}
                <tspan font-size="8" font-weight="600" fill="#64748b"> ppm</tspan>
              </text>

              {/* ========= Bottom axis labels ========= */}
              {[
                { x: col1X + colW / 2, label: 'Free Chlorine', sub: `pH ${ph.toFixed(1)}` },
                { x: col2X + colW / 2, label: 'HOCl form', sub: `CYA ${cya}` },
                { x: col3X + colW / 2, label: 'Active HOCl', sub: isSafe ? '✓ above floor' : '⚠ below floor' },
              ].map((a) => (
                <g key={a.label} pointer-events="none">
                  <text x={a.x} y={pad.top + plotH + 14} text-anchor="middle" font-size="9" fill="#475569" font-weight="700">
                    {a.label}
                  </text>
                  <text x={a.x} y={pad.top + plotH + 25} text-anchor="middle" font-size="8" fill="#94a3b8" font-weight="600">
                    {a.sub}
                  </text>
                </g>
              ))}
            </svg>
          );
        })()}
      </div>

      {/* ========== Zoomed floor meter — Active HOCl vs 0.05 ppm ========== */}
      {(() => {
        const meterMax = Math.max(0.3, stages.activeHOCl * 1.3);
        const meterW = 640;
        const meterH = 54;
        const mPad = { top: 6, right: 12, bottom: 16, left: 12 };
        const trackY = mPad.top + 10;
        const trackH = 14;
        const trackW = meterW - mPad.left - mPad.right;

        const barPx = (stages.activeHOCl / meterMax) * trackW;
        const floorX = mPad.left + (ALGAE_FLOOR / meterMax) * trackW;

        return (
          <svg viewBox={`0 0 ${meterW} ${meterH}`} class="hwf__meter" aria-label="Active HOCl vs 0.05 ppm algae floor">
            <rect x={mPad.left} y={trackY} width={trackW} height={trackH} fill="rgba(10, 30, 55, 0.06)" rx={4} />
            <rect
              x={mPad.left}
              y={trackY}
              width={barPx}
              height={trackH}
              fill={safeFill}
              rx={4}
            />
            <line
              x1={floorX}
              y1={trackY - 4}
              x2={floorX}
              y2={trackY + trackH + 4}
              stroke="#dc2626"
              stroke-width="2"
            />
            <text
              x={floorX}
              y={trackY - 6}
              text-anchor="middle"
              font-size="8"
              fill="#dc2626"
              font-weight="800"
              letter-spacing="0.03em"
            >
              0.05 FLOOR
            </text>
            <text x={mPad.left} y={trackY + trackH + 13} font-size="8" fill="#94a3b8" font-weight="600">0</text>
            <text x={mPad.left + trackW} y={trackY + trackH + 13} text-anchor="end" font-size="8" fill="#94a3b8" font-weight="600">
              {meterMax.toFixed(2)} ppm
            </text>
          </svg>
        );
      })()}

      {/* ========== Status callout — 4 states: animating / stopped / depleted / idle ========== */}
      {animating ? (
        <div class="hwf__status is-animating">
          <span class="hwf__status-badge">⏱ Depleting</span>
          <span class="hwf__status-text">
            <strong>{formatHoursMinutes(elapsed)}</strong> · FC <strong>{effectiveFc.toFixed(2)}</strong> ppm
            {floorCrossedAt !== null && (
              <>
                {' '}· <span class="hwf__status-mark">⚠ crossed floor at {formatHoursMinutes(floorCrossedAt)}</span>
              </>
            )}
          </span>
          <button type="button" class="hwf__stop-btn" onClick={stopAnim}>
            ■ Stop
          </button>
        </div>
      ) : isDepleted ? (
        <div class="hwf__status is-depleted">
          <span class="hwf__status-badge">⚠ Exhausted</span>
          <span class="hwf__status-text">
            FC depleted after <strong>{formatHoursMinutes(elapsed)}</strong>
            {floorCrossedAt !== null && (
              <>
                {' '}· <strong>crossed 0.05 floor at {formatHoursMinutes(floorCrossedAt)}</strong>
              </>
            )}
            <button type="button" class="hwf__reset-btn" onClick={resetAnim}>
              ↺ Reset
            </button>
          </span>
        </div>
      ) : isStopped ? (
        <div class="hwf__status is-stopped">
          <span class="hwf__status-badge">⏸ Stopped</span>
          <span class="hwf__status-text">
            Paused at <strong>{formatHoursMinutes(elapsed)}</strong> · FC <strong>{effectiveFc.toFixed(2)}</strong> ppm
            {floorCrossedAt !== null && (
              <>
                {' '}· <strong>crossed floor at {formatHoursMinutes(floorCrossedAt)}</strong>
              </>
            )}
          </span>
          <button type="button" class="hwf__resume-btn" onClick={resumeAnim}>
            ▶ Resume
          </button>
          <button type="button" class="hwf__reset-btn" onClick={resetAnim}>
            ↺ Reset
          </button>
        </div>
      ) : (
        <>
          <div class={`hwf__status ${isSafe ? 'is-safe' : 'is-unsafe'}`}>
            <span class="hwf__status-badge">
              {isSafe ? '✓ Protected' : '⚠ Deficient'}
            </span>
            <span class="hwf__status-text">
              {isSafe ? (
                <>
                  Active HOCl <strong>{stages.activeHOCl.toFixed(3)}</strong> — above floor by{' '}
                  <strong>{margin.toFixed(3)}</strong>.{' '}
                  {fcMinUnreachable ? (
                    <span class="hwf__status-hint">Min FC for floor: &gt; 8 ppm (lower pH/CYA first)</span>
                  ) : (
                    <span class="hwf__status-hint">Min FC for floor: <strong>{fcMin.toFixed(1)}</strong> ppm</span>
                  )}
                </>
              ) : (
                <>
                  Active HOCl <strong>{stages.activeHOCl.toFixed(3)}</strong> — short by{' '}
                  <strong>{Math.abs(margin).toFixed(3)}</strong>.{' '}
                  {fcMinUnreachable ? (
                    <span class="hwf__status-hint">Need FC &gt; 8 ppm — lower pH or CYA first</span>
                  ) : (
                    <span class="hwf__status-hint">Need FC ≥ <strong>{fcMin.toFixed(1)}</strong> ppm to clear floor</span>
                  )}
                </>
              )}
            </span>
          </div>

          {/* Next-step CTA — shown only in the protected idle state.
              Carries the user to Tab 2 where they can see whether their
              equipment can maintain this FC level under their daily demand. */}
          {isSafe && (
            <div class="hwf__next-step">
              <p class="hwf__next-step-text">
                Once you know the right level, the next question is whether your equipment can
                maintain it.
              </p>
              <button type="button" class="hwf__next-btn" onClick={onGoToProtection}>
                See daily protection →
              </button>
            </div>
          )}
        </>
      )}

    </div>
  );
}
