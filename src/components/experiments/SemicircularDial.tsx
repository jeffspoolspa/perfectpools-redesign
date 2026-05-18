/**
 * SemicircularDial — compact half-circle gauge with drag support.
 *
 * Why semicircle? On mobile the horizontal slider eats too much
 * width (~200px each), and stacking three or four of them plus the
 * bullet explanations devours the viewport. A semicircular dial is
 * roughly half as wide as a slider and gives us a clean place to
 * tuck an info-icon tooltip — so we can also drop the bullet block
 * in favor of contextual hints.
 *
 * Visual:
 *
 *        ___________
 *      /  arc fill  \
 *     /  ╱        ╲  \         (arc spans 180° across the top half;
 *    │  ╱   3.0   ╲  │          value + label sit underneath the
 *    │  ╲   ppm   ╱  │          midpoint; ⓘ to the right for the
 *     \  ╲       ╱  /           tooltip toggle)
 *      \___________/
 *           pH  ⓘ
 *
 * Drag math: pointer position is translated to an angle on the arc,
 * angle is normalized to 0..1, then mapped to value via min/max/step.
 * Snaps to step. Works for both touch and mouse via PointerEvents.
 */

import { useRef, useState, useEffect, useCallback } from 'preact/hooks';

type Health = 'ideal' | 'ok' | 'bad';

type Props = {
  /** Display label below the dial (e.g. "pH", "Free Chlorine"). */
  label: string;
  /** Unit suffix shown next to the value (e.g. "ppm"). */
  unit?: string;
  /** Decimals when formatting the live value. */
  decimals?: number;

  /** Slider range. */
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;

  /** Optional ideal / acceptable bands — used to paint colored
   *  segments under the foreground arc so the user can see at a
   *  glance whether their reading sits in the green / amber / red
   *  zone. Omit either to skip drawing it. */
  idealMin?: number;
  idealMax?: number;
  okMin?: number;
  okMax?: number;

  /** Health derived from current value (drives the colored ring) */
  health?: Health;

  /** Tooltip body. Tap the ⓘ to expand below the dial. */
  hint?: string;

  /** Disable interaction (e.g. while a parent simulation is running). */
  disabled?: boolean;
  /** Optional small label suffix shown after the main label
   *  (e.g. "· simulating" during the deplete animation). */
  labelSuffix?: string;
};

// SVG viewBox is 100x60 — the arc only uses the top half of a 100px
// circle so the dial reads as a wide-and-short shape.
const VB_W = 100;
const VB_H = 60;
const CX = 50;
const CY = 50;
const R = 42;
const TRACK_STROKE = 8;
const FILL_STROKE = 8;

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** Polar → cartesian helper. angle 0° = right (east), 180° = left (west).
 *  We render across the TOP half so allowed range is 0..180. */
function polarToXY(angle: number) {
  const rad = (angle * Math.PI) / 180;
  return {
    x: CX + R * Math.cos(rad),
    y: CY - R * Math.sin(rad),
  };
}

/** Build an SVG arc path between two angles on the top half. */
function arcPath(startAngle: number, endAngle: number): string {
  // Always sweep from start (larger angle, leftward) to end (smaller, rightward).
  // SVG arc with sweep-flag=1 goes clockwise; since we're inverting Y the
  // top-arc draws naturally with sweep-flag=1 when going from large→small.
  const s = polarToXY(startAngle);
  const e = polarToXY(endAngle);
  // Always large-arc-flag=0 for half-circle segments (the segment is < 180°).
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 0 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

/** Map normalized 0..1 progress to an angle on the top-arc (180°→0°). */
function normToAngle(norm: number) {
  return 180 - clamp(norm, 0, 1) * 180;
}

/** Inverse: angle 180°→0 maps to norm 0..1. */
function angleToNorm(angle: number) {
  return clamp((180 - angle) / 180, 0, 1);
}

const HEALTH_RING_COLOR: Record<Health, string> = {
  ideal: '#10b981',
  ok: '#f59e0b',
  bad: '#ef4444',
};

export default function SemicircularDial({
  label,
  unit,
  decimals = 1,
  min,
  max,
  step,
  value,
  onChange,
  idealMin,
  idealMax,
  okMin,
  okMax,
  health,
  hint,
  disabled = false,
  labelSuffix,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

  // Compute the current handle position from value.
  const norm = clamp((value - min) / (max - min), 0, 1);
  const handleAngle = normToAngle(norm);
  const handle = polarToXY(handleAngle);

  // Map a min/max range pair to its arc endpoints (in angle space).
  const rangeArc = (lo?: number, hi?: number): string | null => {
    if (lo == null || hi == null) return null;
    const loNorm = clamp((lo - min) / (max - min), 0, 1);
    const hiNorm = clamp((hi - min) / (max - min), 0, 1);
    // angle decreases as norm increases, so the start of the arc is the
    // angle for hiNorm (larger angle, left side) and end is loNorm.
    return arcPath(normToAngle(loNorm), normToAngle(hiNorm));
  };
  const okArcD = rangeArc(okMin, okMax);
  const idealArcD = rangeArc(idealMin, idealMax);

  // Compute filled foreground arc from leftmost (180°) to current.
  const fillArcD = arcPath(180, handleAngle);

  // === Drag math ===
  const valueFromClient = useCallback(
    (clientX: number, clientY: number): number | null => {
      const wrap = wrapRef.current;
      if (!wrap) return null;
      const rect = wrap.getBoundingClientRect();
      // The SVG fills the wrap; map client coords into SVG viewBox space.
      const svgX = ((clientX - rect.left) / rect.width) * VB_W;
      const svgY = ((clientY - rect.top) / rect.height) * VB_H;
      // Angle from arc center (CX, CY). Y is screen-down, so we invert.
      const dx = svgX - CX;
      const dy = CY - svgY;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      // Clamp to the top arc (0..180°). If the touch dips below the
      // baseline, snap to nearest endpoint instead of letting it
      // wrap around the bottom.
      if (angle < 0) angle = dx > 0 ? 0 : 180;
      const newNorm = angleToNorm(angle);
      const raw = min + newNorm * (max - min);
      const snapped = Math.round(raw / step) * step;
      return clamp(snapped, min, max);
    },
    [min, max, step],
  );

  const handlePointer = (e: PointerEvent) => {
    if (disabled) return;
    const v = valueFromClient(e.clientX, e.clientY);
    if (v !== null) onChange(v);
  };

  const onPointerDown = (e: PointerEvent) => {
    if (disabled) return;
    setIsDragging(true);
    handlePointer(e);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!isDragging) return;
    handlePointer(e);
  };
  const onPointerUp = (e: PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    } catch {}
  };

  // Close tooltip on outside click.
  useEffect(() => {
    if (!tipOpen) return;
    const onDocClick = (ev: MouseEvent) => {
      const wrap = wrapRef.current;
      if (wrap && !wrap.contains(ev.target as Node)) setTipOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [tipOpen]);

  // Edge-clamp the tooltip — when a dial sits near the viewport edge
  // the centered tooltip can clip on one side. Measure after open and
  // push the tooltip body inward via a CSS custom property; the arrow
  // is reverse-shifted so it stays pointed at the dial center.
  useEffect(() => {
    if (!tipOpen) return;
    const wrap = wrapRef.current;
    const tip = wrap?.querySelector('.sdial__tip') as HTMLElement | null;
    if (!wrap || !tip) return;
    const r = tip.getBoundingClientRect();
    const margin = 8;
    let shift = 0;
    if (r.left < margin) shift = margin - r.left;
    else if (r.right > window.innerWidth - margin) {
      shift = window.innerWidth - margin - r.right;
    }
    tip.style.setProperty('--tip-shift', `${shift}px`);
  }, [tipOpen]);

  const ringColor = health ? HEALTH_RING_COLOR[health] : '#06b6d4';

  const valueText = Number.isFinite(value)
    ? Number(value).toFixed(decimals)
    : '—';

  return (
    <div
      class={`sdial ${isDragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''}`}
      ref={wrapRef}
    >
      <svg
        class="sdial__svg"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={onPointerDown as any}
        onPointerMove={onPointerMove as any}
        onPointerUp={onPointerUp as any}
        onPointerCancel={onPointerUp as any}
      >
        {/* Background track — full 180° arc */}
        <path
          d={arcPath(180, 0)}
          fill="none"
          stroke="rgba(15, 23, 42, .12)"
          stroke-width={TRACK_STROKE}
          stroke-linecap="round"
        />
        {/* Acceptable band (amber) */}
        {okArcD && (
          <path
            d={okArcD}
            fill="none"
            stroke="rgba(245, 158, 11, .35)"
            stroke-width={TRACK_STROKE}
            stroke-linecap="round"
          />
        )}
        {/* Ideal band (green) — painted on top of ok so it wins where they overlap */}
        {idealArcD && (
          <path
            d={idealArcD}
            fill="none"
            stroke="rgba(16, 185, 129, .55)"
            stroke-width={TRACK_STROKE}
            stroke-linecap="round"
          />
        )}
        {/* Foreground fill from leftmost to current value — uses health color */}
        <path
          d={fillArcD}
          fill="none"
          stroke={ringColor}
          stroke-width={FILL_STROKE}
          stroke-linecap="round"
          opacity="0.85"
        />
        {/* Handle — white pill matching the slider thumb's look */}
        <circle
          cx={handle.x}
          cy={handle.y}
          r="5"
          fill="#fff"
          stroke={ringColor}
          stroke-width="2.5"
        />
      </svg>

      <div class="sdial__readout">
        <span class="sdial__value">{valueText}</span>
        {unit && <span class="sdial__unit">{unit}</span>}
      </div>

      <div class="sdial__label-row">
        <span class="sdial__label">
          {label}
          {labelSuffix && (
            <span class="sdial__label-suffix">{labelSuffix}</span>
          )}
        </span>
        {hint && (
          <button
            type="button"
            class={`sdial__info ${tipOpen ? 'is-open' : ''}`}
            aria-label={`Info: ${label}`}
            aria-expanded={tipOpen}
            onClick={(e) => {
              e.stopPropagation();
              setTipOpen((v) => !v);
            }}
          >
            ⓘ
          </button>
        )}
      </div>

      {hint && tipOpen && (
        <div class="sdial__tip" role="tooltip">
          {hint}
        </div>
      )}
    </div>
  );
}
