import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import PoolIcon from './PoolIcon';
import SemicircularDial from './SemicircularDial';
import Slider from '../tools/Slider';
import HOClWaterfall from '../tools/HOClWaterfall';
import PillarsTriangle, { PILLARS } from '../PillarsTriangle';
import {
  DIALS,
  dialHealth,
  type DialSpec,
  type DialHealth,
} from '../tools/LSICalculator';

// Quick lookups for the balance-mode sliders — we drive the ideal-range
// band and the per-slider hint text off these shared specs so this card
// stays in sync with the standalone LSICalculator's copy / ranges.
const DIAL_PH = DIALS.find((d) => d.key === 'ph')!;
const DIAL_CYA = DIALS.find((d) => d.key === 'cya')!;
const DIAL_TA = DIALS.find((d) => d.key === 'ta')!;
const DIAL_CH = DIALS.find((d) => d.key === 'ch')!;

/**
 * Given the current value + its spec, pick the right one-liner:
 *   ideal → spec.ideal       (neutral / why it matters here)
 *   below → spec.warnLow     (what goes wrong on the low side)
 *   above → spec.warnHigh    (what goes wrong on the high side)
 */
function dialHint(value: number, spec: DialSpec): string {
  const h = dialHealth(value, spec);
  if (h === 'ideal') return spec.ideal;
  return value < spec.idealMin ? spec.warnLow : spec.warnHigh;
}

/**
 * Map ideal/ok range edges into percentages of the slider's full
 * range so the visual band can position itself with `left/right`.
 */
function rangeBandPct(value: { min: number; max: number }, idealMin: number, idealMax: number) {
  const span = value.max - value.min;
  const lo = ((idealMin - value.min) / span) * 100;
  const hi = ((idealMax - value.min) / span) * 100;
  return { lo: Math.max(0, lo), hi: Math.min(100, hi) };
}

/**
 * PillarsTriangleHeaders — sandbox layout shell
 * =============================================
 *
 * Layout shell — single rounded dark card with a top split panel
 * (controls left, visualization right) and a lighter bottom band
 * with a 4-column comparison row.
 *
 * The right panel now hosts:
 *   • Active HOCl bar      — driven by current chem state.
 *   • Min FC needed value  — driven by pH + CYA.
 *   • Scaled-down pool     — water and ladder colored from chem state
 *                            via CSS vars on the wrap.
 *
 * The left panel has FC / pH / CYA sliders that update shared state;
 * everything on the right re-renders from useMemo.
 */

// =========================================================================
// Chemistry math — mirrors HOClWaterfall.tsx so the bar and the Min FC
// value stay consistent with the live sanitation tool.
// =========================================================================

const PKA_HOCL = 7.54;
const CYA_BINDING = 0.83;
const ALGAE_FLOOR = 0.05; // ppm active HOCl below this → algae territory

// Reserve-deplete animation: "typical residential day" demand of
// ~0.15 ppm/hr (mixed UV + swimmers + debris). Same constants as the
// existing HOClWaterfall so the simulation feel stays consistent.
const DEMAND_PPM_PER_HR = 0.15;
const ANIM_TICK_MS = 90;
const ANIM_MIN_PER_TICK = 15;
const ANIM_PPM_PER_TICK = DEMAND_PPM_PER_HR * (ANIM_MIN_PER_TICK / 60);

// === LSI math (mirrors LSICalculator.tsx) ============================
// Langelier Saturation Index: pH + TF + CF + AF − 12.1
// (TF=temp factor, CF=calcium factor, AF=alkalinity factor).
// We use a fixed 78°F water temp for the shell; can lift later.
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
    if (tempF >= t1 && tempF <= t2) return f1 + ((tempF - t1) / (t2 - t1)) * (f2 - f1);
  }
  return 0.6;
}
function calciumFactor(ppm: number): number {
  const t: [number, number][] = [
    [25, 1.0], [50, 1.3], [75, 1.5], [100, 1.6], [125, 1.7],
    [150, 1.8], [200, 1.9], [250, 2.0], [300, 2.1], [400, 2.2],
    [500, 2.3], [600, 2.4], [800, 2.5], [1000, 2.6],
  ];
  if (ppm <= t[0][0]) return t[0][1];
  if (ppm >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 0; i < t.length - 1; i++) {
    const [a, fa] = t[i]; const [b, fb] = t[i + 1];
    if (ppm >= a && ppm <= b) return fa + ((ppm - a) / (b - a)) * (fb - fa);
  }
  return 2.0;
}
function alkalinityFactor(ppm: number): number {
  const t: [number, number][] = [
    [25, 1.4], [50, 1.7], [75, 1.9], [100, 2.0], [125, 2.1],
    [150, 2.2], [200, 2.3], [250, 2.4], [300, 2.5], [400, 2.6],
    [500, 2.7], [750, 2.9], [1000, 3.0],
  ];
  if (ppm <= t[0][0]) return t[0][1];
  if (ppm >= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 0; i < t.length - 1; i++) {
    const [a, fa] = t[i]; const [b, fb] = t[i + 1];
    if (ppm >= a && ppm <= b) return fa + ((ppm - a) / (b - a)) * (fb - fa);
  }
  return 2.0;
}
function computeLSI(ph: number, ch: number, ta: number, cya: number, tempF = 78) {
  // Carbonate alkalinity = TA − (CYA × 0.33) (industry shortcut).
  const carbAlk = Math.max(0, ta - cya * 0.33);
  return ph + tempFactor(tempF) + calciumFactor(ch) + alkalinityFactor(carbAlk) - 12.1;
}
function lsiTone(lsi: number): 'corrosive' | 'balanced' | 'scaling' {
  if (lsi < -0.3) return 'corrosive';
  if (lsi > 0.3) return 'scaling';
  return 'balanced';
}

function formatHoursMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function fHOClpH(ph: number): number {
  return 1 / (1 + Math.pow(10, ph - PKA_HOCL));
}

function activeHOCl(fc: number, ph: number, cya: number): number {
  return (fc * fHOClpH(ph)) / (1 + CYA_BINDING * cya);
}

/**
 * Minimum FC needed at this pH + CYA to clear the 0.05 ppm active
 * HOCl floor. Inverts the active-HOCl equation:
 *   FC_min = 0.05 × (1 + 0.83 × CYA) / f_HOCl(pH)
 */
function minFcForFloor(ph: number, cya: number): number {
  return (ALGAE_FLOOR * (1 + CYA_BINDING * cya)) / fHOClpH(ph);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/** Linear interp 0..1 between two hex colors. */
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

// Reactive water palette — colors are deliberately tied to the FC bar
// graph in the desktop/mobile compare-row. Healthy water uses the
// primary→cyan gradient (#0284c7 → #06b6d4) that the "Your FC" bar
// shows when it's above the minimum. Algae water uses the chartreuse
// → lime ramp that the bar flips to when FC is short of minimum.
// Same colors, same semantics — fill bar matches what the pool would
// actually look like.
const WATER_LIGHT_HEALTHY = '#06b6d4'; // cyan-500 — top of FC bar gradient
const WATER_DARK_HEALTHY  = '#0284c7'; // sky-600 — bottom of FC bar gradient
const WATER_DEEP_HEALTHY  = '#075985'; // sky-800 — deepest shadow
const WATER_LIGHT_ALGAE   = '#a3e635'; // lime-400 — top of warning bar
const WATER_DARK_ALGAE    = '#65a30d'; // lime-700 — bottom of warning bar
const WATER_DEEP_ALGAE    = '#365314'; // lime-900 — deepest algae shadow
// Scaling = milky calcium-fallout cloud over blue. Pushed whiter so
// the scaling state reads as a clearly cloudy pool, not just slightly
// desaturated water.
const WATER_LIGHT_CLOUDY  = '#f8fafc';
const WATER_DARK_CLOUDY   = '#e5e7eb';
const WATER_DEEP_CLOUDY   = '#9ca3af';
// Corrosive water gets slightly desaturated; the rust shows mostly on the ladder.
const WATER_DARK_CORROSIVE = '#0c4a6e';
// Ladder palettes — clean stainless silver ↔ rusty brown. Silver
// (not the previous blue-tinted grey) so the ladder reads as real
// pool-grade stainless steel that then visibly oxidizes when
// corrosive water hits it.
const LADDER_CLEAN_LIGHT  = '#e8eaed'; // bright silver highlight
const LADDER_CLEAN_COLOR  = '#b0b3b8'; // mid silver / brushed steel
const LADDER_CLEAN_SHADOW = '#5c6370'; // dark silver shadow
const LADDER_RUST_LIGHT   = '#c2410c'; // orange-700
const LADDER_RUST_COLOR   = '#7c2d12'; // orange-900
const LADDER_RUST_SHADOW  = '#1c0701'; // very dark brown

type WaterPalette = {
  light: string;
  dark: string;
  deep: string;
  ripple: string;
  ladderLight: string;
  ladderColor: string;
  ladderShadow: string;
  /** px of CSS blur to apply to the .pool-icon__water layer */
  blur: number;
};

/**
 * In SANITATION mode the palette ramps blue → algae green as active
 * HOCl approaches / drops below the floor.
 * In BALANCE mode the palette is driven by LSI:
 *   • LSI < -0.3 (corrosive)  → ladder lerps clean → rust brown.
 *   • LSI > +0.3 (scaling)    → water lerps blue → milky white + blur.
 *   • In between             → clean blue water + clean steel ladder.
 */
function waterPalette(mode: Mode, active: number, lsi: number): WaterPalette {
  if (mode === 'sanitation') {
    // Stay fully blue while active HOCl is at or above the algae
    // floor. Only start ramping toward green once it drops below.
    // At the floor → 0 green. At active = 0 → fully green. Linear
    // ramp in between so the change reads as severity, not a sudden
    // switch.
    const green = clamp((ALGAE_FLOOR - active) / ALGAE_FLOOR, 0, 1);
    return {
      light: lerpColor(WATER_LIGHT_HEALTHY, WATER_LIGHT_ALGAE, green),
      dark: lerpColor(WATER_DARK_HEALTHY, WATER_DARK_ALGAE, green),
      deep: lerpColor(WATER_DEEP_HEALTHY, WATER_DEEP_ALGAE, green),
      ripple: lerpColor(WATER_DARK_HEALTHY, WATER_DARK_ALGAE, green),
      ladderLight: LADDER_CLEAN_LIGHT,
      ladderColor: LADDER_CLEAN_COLOR,
      ladderShadow: LADDER_CLEAN_SHADOW,
      blur: 0,
    };
  }
  // === BALANCE MODE ===
  // Scaling fade: 0.0 at LSI 0.3, 1.0 at LSI 0.7. Narrower ramp so
  // even small excursions past the scaling threshold produce visible
  // clouding instead of having to push LSI all the way to +1.3.
  const scaling = clamp((lsi - 0.3) / 0.4, 0, 1);
  // Corrosive fade: 0.0 at LSI -0.3, 1.0 at LSI -0.7. Same idea —
  // rust shows up promptly when the user pushes into corrosive
  // territory rather than only at extreme LSI values.
  const corrosive = clamp((-0.3 - lsi) / 0.4, 0, 1);
  return {
    light: lerpColor(WATER_LIGHT_HEALTHY, WATER_LIGHT_CLOUDY, scaling),
    dark: lerpColor(
      lerpColor(WATER_DARK_HEALTHY, WATER_DARK_CORROSIVE, corrosive * 0.4),
      WATER_DARK_CLOUDY,
      scaling,
    ),
    deep: lerpColor(WATER_DEEP_HEALTHY, WATER_DEEP_CLOUDY, scaling),
    ripple: lerpColor(WATER_DARK_HEALTHY, WATER_DARK_CLOUDY, scaling),
    ladderLight: lerpColor(LADDER_CLEAN_LIGHT, LADDER_RUST_LIGHT, corrosive),
    ladderColor: lerpColor(LADDER_CLEAN_COLOR, LADDER_RUST_COLOR, corrosive),
    ladderShadow: lerpColor(LADDER_CLEAN_SHADOW, LADDER_RUST_SHADOW, corrosive),
    // Up to 7px of blur on the water layer at full scaling — was 3.5;
    // doubled so the cloudy state reads as "you can't see clearly
    // through the water" rather than "slight fuzz".
    blur: scaling * 7,
  };
}

// =========================================================================
// Component
// =========================================================================

type Chem = {
  fc: number;
  ph: number;
  cya: number;
  ta: number; // total alkalinity (ppm)
  ch: number; // calcium hardness (ppm)
};
const DEFAULT_CHEM: Chem = { fc: 3, ph: 7.5, cya: 30, ta: 100, ch: 300 };

/** Which view of the card is showing. */
type Mode = 'sanitation' | 'balance';

// Pillar metadata — pulled from the shared PILLARS list so icons,
// headings, and accent colors stay in sync with the rest of the site.
const SANITATION = PILLARS.find((p) => p.id === 'sanitation')!;
const BALANCE = PILLARS.find((p) => p.id === 'balance')!;

type CardProps = {
  /** When true, skip the outer scroll section + pin wrapper and the
   *  triangle landing animation. The card's own header triangle is
   *  hidden because the parent owns the moving diagram. The parent
   *  passes `mode` to drive sanitation ↔ balance. */
  embedded?: boolean;
  /** Forces the card into a specific mode. Required when embedded;
   *  ignored when running standalone (mode is scroll-derived). */
  mode?: Mode;
  /** Continuous 0..1 value that drives the crossfade between
   *  sanitation (0) and balance (1) modes. When parent passes this,
   *  the changing elements (HOCl bar ↔ LSI gauge, bullets+CTA ↔
   *  status cards) ramp their opacity + max-height directly off this
   *  number instead of snapping at the mode-flip threshold. */
  balanceAmount?: number;
};

export default function PillarsTriangleHeaders({
  embedded = false,
  mode: modeProp,
  balanceAmount: balanceAmountProp,
}: CardProps = {}) {
  // === Scroll-driven mode + intro animation (standalone only) ===
  // When embedded, the parent owns the scroll pinning, the triangle's
  // landing animation, and decides which mode to render. We skip all
  // of the internal scroll plumbing in that case.
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const [progress, setProgress] = useState(0);
  /** Dynamic fit-scale — drives transform: scale(fitScale) on the
   *  .pth-card so an oversized card visually shrinks to fit the pin's
   *  available height. Updates on mount, viewport resize, and any
   *  ResizeObserver fire (slider movement, mode change, etc.). */
  const [fitScale, setFitScale] = useState(1);

  // Measure card vs the closest pin container and compute fit-scale.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const card = cardRef.current;
    if (!card) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      // On mobile the card has CSS rules that make it stretch to fill
      // the pin (so sanitation + balance modes always share the same
      // box). Forcing fitScale to 1 there avoids fighting that with
      // a content-height-derived transform.
      if (window.matchMedia('(max-width: 900px)').matches) {
        setFitScale((prev) => (prev !== 1 ? 1 : prev));
        return;
      }
      // Walk up to find whichever pin container the card lives in:
      // .pc-pin (cinematic) or .pth-section__pin (standalone sandbox).
      // Fallback: window.innerHeight minus a 160px chrome budget.
      // The 160px reserve (~64px site-header + 96px bottom margin)
      // matches the .pc-card-wrap max-height so naturalH > available
      // → fitScale kicks in instead of letting the card spill above
      // the viewport into the header zone or below into the next
      // section.
      const pin = card.closest('.pc-pin, .pth-section__pin') as HTMLElement | null;
      const available = pin ? pin.clientHeight - 160 : window.innerHeight - 160;
      const naturalH = card.scrollHeight;
      if (naturalH <= 0 || available <= 0) return;
      const next = Math.min(1, available / naturalH);
      setFitScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
    };
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver(schedule);
    ro.observe(card);
    if (card.parentElement) ro.observe(card.parentElement);
    window.addEventListener('resize', schedule);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll listener — rAF-throttled. Subscribes to Lenis's `scroll`
  // event when Lenis is present (the site uses Lenis for smooth scroll,
  // and native window `scroll` events may be debounced or skipped while
  // Lenis is driving the position). Falls back to window scroll +
  // a per-frame poll when Lenis isn't ready yet.
  // Skipped entirely when embedded — parent component drives everything.
  useEffect(() => {
    if (embedded) return;
    if (typeof window === 'undefined') return;
    const section = sectionRef.current;
    if (!section) return;
    let raf = 0;
    let queued = false;
    const compute = () => {
      const rect = section.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = Math.max(1, rect.height - vh);
      const scrolled = -rect.top;
      const p = Math.max(0, Math.min(1, scrolled / total));
      setProgress(p);
      queued = false;
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      raf = requestAnimationFrame(compute);
    };
    compute();

    const lenis = (window as any).__lenis;
    if (lenis?.on) {
      lenis.on('scroll', schedule);
    }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      const lenisNow = (window as any).__lenis;
      if (lenisNow?.off) lenisNow.off('scroll', schedule);
      cancelAnimationFrame(raf);
    };
  }, [embedded]);

  // balanceAmount: continuous 0..1 crossfade signal. In embedded use
  // the parent passes it. In standalone use we derive it from scroll
  // progress: ramps 0→1 over the window 0.50 → 0.60 so the changing
  // elements crossfade gradually as the user scrolls, instead of
  // snap-flipping at a single threshold.
  const balanceAmount =
    balanceAmountProp ?? clamp((progress - 0.5) / 0.1, 0, 1);

  // Mode: prop wins when embedded, otherwise derive from balanceAmount
  // (crosses at midpoint of the transition window). Used for the
  // discrete bits — title text, active triangle slice, slider data-
  // state. The continuous fades live in CSS via --pth-balance-amount.
  const mode: Mode = modeProp ?? (balanceAmount >= 0.5 ? 'balance' : 'sanitation');

  // Phase A drives the triangle landing animation in STANDALONE mode.
  // When embedded, the parent owns the moving triangle and we render
  // the in-card slot as a static placeholder (visibility: hidden via
  // CSS so it still reserves layout space).
  const phaseA = Math.min(1, progress / 0.3);
  const triangleScale = 3.6 - phaseA * 2.6;
  const triangleTx = (1 - phaseA) * 360;
  const triangleTy = (1 - phaseA) * 240;
  const triangleStyle: any = embedded
    ? {}
    : {
        transform: `translate(${triangleTx}px, ${triangleTy}px) scale(${triangleScale})`,
        transformOrigin: 'center',
        transition: 'none',
        zIndex: phaseA < 0.95 ? 10 : 1,
      };

  const [chem, setChem] = useState<Chem>({ ...DEFAULT_CHEM });
  const update = (patch: Partial<Chem>) =>
    setChem((prev) => ({ ...prev, ...patch }));

  // === Active HOCl waterfall modal ===
  // Opened from the ⓘ button next to any "Active HOCl" label.
  // Shows the FC → HOCl form → Active HOCl chain with the pH and
  // CYA loss fractions. Mounted at the top of the cardContent
  // tree so the overlay covers the full viewport.
  const [hoclModalOpen, setHoclModalOpen] = useState(false);
  useEffect(() => {
    if (!hoclModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHoclModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hoclModalOpen]);

  // === Reserve-deplete animation state ===
  // animFc is non-null while we're running (or just finished) the
  // simulation. Until it's set, all chemistry comes off chem.fc.
  // elapsed and floorCrossedAt are in *simulated* minutes.
  const [animFc, setAnimFc] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [floorCrossedAt, setFloorCrossedAt] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  // Refs mirror state synchronously inside the setInterval tick so we
  // don't fight stale-closure issues.
  const fcRef = useRef(chem.fc);
  const elapsedRef = useRef(0);
  const floorCrossedRef = useRef<number | null>(null);

  // The "effective" FC drives all downstream visuals. While the
  // simulation is running, animFc is the source of truth; otherwise
  // we use the slider value.
  const effectiveFc = animFc !== null ? animFc : chem.fc;

  // Derived chemistry values — recompute whenever any input changes.
  const active = useMemo(
    () => activeHOCl(effectiveFc, chem.ph, chem.cya),
    [effectiveFc, chem.ph, chem.cya],
  );
  const minFc = useMemo(
    () => minFcForFloor(chem.ph, chem.cya),
    [chem.ph, chem.cya],
  );
  const lsi = useMemo(
    () => computeLSI(chem.ph, chem.ch, chem.ta, chem.cya),
    [chem.ph, chem.ch, chem.ta, chem.cya],
  );
  const tone = lsiTone(lsi);
  const palette = useMemo(
    () => waterPalette(mode, active, lsi),
    [mode, active, lsi],
  );

  // Active HOCl bar — 0 → 0.5 ppm scale. Floor at 0.05 ppm.
  const BAR_MAX = 0.5;
  const fillPct = clamp(active / BAR_MAX, 0, 1) * 100;
  const floorPct = (ALGAE_FLOOR / BAR_MAX) * 100;
  const protectedNow = active >= ALGAE_FLOOR;
  const isDepleted = !isAnimating && animFc !== null && animFc <= 0;
  const inAnimState = isAnimating || animFc !== null;

  // === Animation loop ===
  // pH and CYA are snapshotted at start — they don't change mid-run,
  // and locking them avoids surprising mid-animation feedback. FC
  // decrements every tick; floor crossing recorded once.
  useEffect(() => {
    if (!isAnimating) return;
    const phSnap = chem.ph;
    const cyaSnap = chem.cya;
    const id = setInterval(() => {
      elapsedRef.current += ANIM_MIN_PER_TICK;
      fcRef.current = Math.max(0, fcRef.current - ANIM_PPM_PER_TICK);

      // Detect floor crossing (active HOCl drops below 0.05).
      if (floorCrossedRef.current === null) {
        const a = activeHOCl(fcRef.current, phSnap, cyaSnap);
        if (a < ALGAE_FLOOR) {
          floorCrossedRef.current = elapsedRef.current;
          setFloorCrossedAt(elapsedRef.current);
        }
      }

      setAnimFc(fcRef.current);
      setElapsed(elapsedRef.current);

      if (fcRef.current <= 0) {
        setIsAnimating(false);
      }
    }, ANIM_TICK_MS);
    return () => clearInterval(id);
  }, [isAnimating, chem.ph, chem.cya]);

  const startDeplete = () => {
    if (isAnimating) return;
    fcRef.current = chem.fc;
    elapsedRef.current = 0;
    floorCrossedRef.current = null;
    setAnimFc(chem.fc);
    setElapsed(0);
    setFloorCrossedAt(null);
    setIsAnimating(true);
  };
  // Pause the running simulation. animFc / elapsed / floorCrossedAt
  // are all left intact so resume picks up exactly where it left off.
  const pauseDeplete = () => {
    setIsAnimating(false);
  };
  // Resume from a paused state. Re-sync refs from React state in case
  // pH/CYA changed while paused (the effect's snapshot of those will
  // update on re-mount). FC ref is locked to the current animFc.
  const resumeDeplete = () => {
    if (isAnimating) return;
    if (animFc === null || animFc <= 0) return;
    fcRef.current = animFc;
    elapsedRef.current = elapsed;
    floorCrossedRef.current = floorCrossedAt;
    setIsAnimating(true);
  };
  const resetDeplete = () => {
    setIsAnimating(false);
    setAnimFc(null);
    setElapsed(0);
    setFloorCrossedAt(null);
    fcRef.current = chem.fc;
    elapsedRef.current = 0;
    floorCrossedRef.current = null;
  };
  // Derived flag: paused == we have animation state but it's not
  // actively ticking AND we haven't hit zero yet.
  const isPaused = !isAnimating && animFc !== null && animFc > 0;

  // CSS vars pushed onto the pool wrapper so PoolIcon's gradient
  // stops, ripple lines, ladder fills, and water blur re-tint without
  // re-rendering the SVG tree.
  const poolVars = {
    '--pool-water-light': palette.light,
    '--pool-water-dark': palette.dark,
    '--pool-water-deep': palette.deep,
    '--pool-water-ripple': palette.ripple,
    '--pool-ladder-light': palette.ladderLight,
    '--pool-ladder-color': palette.ladderColor,
    '--pool-ladder-shadow': palette.ladderShadow,
    '--pool-water-blur': `${palette.blur}px`,
  } as any;

  // Card content factored out so we can wrap it in the standalone
  // scroll section OR render it bare when embedded inside a parent
  // cinematic. --pth-balance-amount drives the gradual crossfade of
  // the changing elements via CSS calc() (see global.css /
  // our-approach-v2.astro for the .pth-viz-pane / .pth-status-cards /
  // .pth-sanitation-extras rules).
  const cardContent = (
        <div
          class="pth"
          style={{ '--pth-balance-amount': balanceAmount } as any}
        >
          {/* HOCl chemistry waterfall modal — portaled to document.body
              so it escapes the cinematic's animated opacity + transform
              chain on .pc-card-wrap. The modal would otherwise inherit
              the wrap's opacity and only render at ~36% during phase B. */}
          {hoclModalOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                class="pth-hocl-modal"
                role="dialog"
                aria-modal="true"
                aria-label="How chlorine becomes active HOCl"
                onClick={() => setHoclModalOpen(false)}
              >
                <div
                  class="pth-hocl-modal__panel"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    class="pth-hocl-modal__close"
                    aria-label="Close"
                    onClick={() => setHoclModalOpen(false)}
                  >
                    ×
                  </button>
                  {/* Title sits inline above the chart so the modal
                      panel can scale up to give the graph more room.
                      No separate header card to eat vertical space. */}
                  <h3 class="pth-hocl-modal__title">
                    How chlorine becomes sanitizer
                  </h3>
                  {/* Re-use the production HOClWaterfall component
                      (lives in /tools/). Same chemistry math as the
                      main card so the modal's numbers always match
                      the dial readouts. */}
                  <HOClWaterfall
                    fc={effectiveFc}
                    ph={chem.ph}
                    cya={chem.cya}
                    onChemChange={(patch) => update(patch)}
                    onGoToProtection={() => setHoclModalOpen(false)}
                  />
                </div>
              </div>,
              document.body,
            )}
          <article
            ref={cardRef as any}
            class="pth-card"
            style={{
              transform: `scale(${fitScale})`,
              /* Scale anchored at the top-center so the visual top
                 edge stays aligned with the wrap's top edge. With
                 center-center origin the visual sits BELOW the
                 wrap, leaving uneven space above vs below the card
                 in the viewport. */
              transformOrigin: 'center top',
            }}
          >
            <div class="pth-card__top">
              {/* ===== LEFT — pillar header (triangle + label) + sliders ===== */}
              <div class="pth-card__left">
                {/* Pillar header. In standalone mode the triangle's transform
                    is scroll-driven during Phase A; in embedded mode the
                    parent renders the moving triangle as an overlay and we
                    hide this in-card slot (visibility: hidden so the heading
                    next to it still has its leading whitespace reserved). */}
                <header class="pth-pillar-head">
                  <div
                    class={`pth-pillar-head__triangle ${
                      embedded ? 'pth-pillar-head__triangle--hidden' : ''
                    }`}
                    style={triangleStyle}
                  >
                    <PillarsTriangle active={mode === 'balance' ? 'balance' : 'sanitation'} />
                  </div>
                  {/* Keyed re-render forces the title block to remount on
                      mode change → CSS animation fires fresh each time, so
                      the heading flips in while the card stays put. The
                      subtitle replaces the separate header card the design
                      had — a single line under the pillar label. */}
                  <div
                    key={mode}
                    class="pth-pillar-head__text pth-pillar-head__title--flip"
                  >
                    <h3
                      class="pth-pillar-head__title"
                      style={{
                        color: mode === 'balance' ? BALANCE.color : SANITATION.color,
                      }}
                    >
                      {mode === 'balance' ? BALANCE.heading : SANITATION.heading}
                    </h3>
                    {mode === 'balance' && (
                      <p class="pth-pillar-head__subtitle">
                        Water non-corrosive, non-scaling — keep the Langelier
                        index inside the sweet spot.
                      </p>
                    )}
                  </div>
                </header>

            {/* DESKTOP — vertical stack of horizontal sliders.
                Mobile hides this and shows the dial grid below. */}
            <div class="pth-readings pth-readings--desktop">
              <div
                class={`pth-reading pth-reading--sanitation-only ${inAnimState ? 'is-locked' : ''}`}
                data-state="visible"
              >
                <div class="pth-reading__head">
                  <span class="pth-reading__label">
                    Free Chlorine
                    {inAnimState && (
                      <span class="pth-reading__sim"> · simulating</span>
                    )}
                  </span>
                  <span class="pth-reading__value">
                    {effectiveFc.toFixed(1)}
                    <span class="pth-reading__unit"> ppm</span>
                  </span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={0.1}
                  value={effectiveFc}
                  onChange={(v) => {
                    if (inAnimState) return;
                    update({ fc: v });
                  }}
                />
              </div>

              <BalanceReading
                panelMode="common"
                label="pH"
                value={chem.ph}
                displayValue={chem.ph.toFixed(1)}
                unit=""
                spec={DIAL_PH}
                sliderMin={6.8}
                sliderMax={8.2}
                step={0.1}
                onChange={(v) => update({ ph: v })}
                showRange={mode === 'balance'}
              />
              <BalanceReading
                panelMode="common"
                label="CYA"
                value={chem.cya}
                unit=" ppm"
                spec={DIAL_CYA}
                sliderMin={0}
                sliderMax={100}
                step={5}
                onChange={(v) => update({ cya: v })}
                showRange={mode === 'balance'}
              />
              <BalanceReading
                panelMode="balance-only"
                label="Alkalinity"
                value={chem.ta}
                unit=" ppm"
                spec={DIAL_TA}
                sliderMin={40}
                sliderMax={240}
                step={10}
                onChange={(v) => update({ ta: v })}
              />
              <BalanceReading
                panelMode="balance-only"
                label="Calcium"
                value={chem.ch}
                unit=" ppm"
                spec={DIAL_CH}
                sliderMin={100}
                sliderMax={600}
                step={25}
                onChange={(v) => update({ ch: v })}
              />
            </div>

            {/* MOBILE — five dial cells. Each panel-mode class drives a
                width-collapse animation as mode flips: FC fades out
                for balance mode, Alk + Ca fade in. pH + CYA are common
                to both modes and stay visible at the endpoints. The
                bullet copy that used to sit below the sliders now
                lives behind each dial's ⓘ button. */}
            <div class="pth-readings pth-readings--mobile">
              <div
                class={`pth-reading pth-reading--sanitation-only ${inAnimState ? 'is-locked' : ''}`}
                data-state="visible"
              >
                <SemicircularDial
                  label="FC"
                  unit="ppm"
                  decimals={1}
                  min={0}
                  max={10}
                  step={0.1}
                  value={effectiveFc}
                  onChange={(v) => {
                    if (inAnimState) return;
                    update({ fc: v });
                  }}
                  health={protectedNow ? 'ideal' : 'bad'}
                  hint="Active HOCl is the fraction that actually kills algae."
                  disabled={inAnimState}
                  labelSuffix={inAnimState ? '· sim' : undefined}
                />
              </div>

              <div class="pth-reading pth-reading--common" data-state="visible">
                <SemicircularDial
                  label="pH"
                  decimals={1}
                  min={6.8}
                  max={8.2}
                  step={0.1}
                  value={chem.ph}
                  onChange={(v) => update({ ph: v })}
                  idealMin={DIAL_PH.idealMin}
                  idealMax={DIAL_PH.idealMax}
                  okMin={DIAL_PH.okMin}
                  okMax={DIAL_PH.okMax}
                  health={dialHealth(chem.ph, DIAL_PH)}
                  hint={
                    mode === 'balance'
                      ? dialHint(chem.ph, DIAL_PH)
                      : 'pH controls how much of your FC stays in the active HOCl form.'
                  }
                />
              </div>

              <div class="pth-reading pth-reading--common" data-state="visible">
                <SemicircularDial
                  label="CYA"
                  unit="ppm"
                  decimals={0}
                  min={0}
                  max={100}
                  step={5}
                  value={chem.cya}
                  onChange={(v) => update({ cya: v })}
                  idealMin={DIAL_CYA.idealMin}
                  idealMax={DIAL_CYA.idealMax}
                  okMin={DIAL_CYA.okMin}
                  okMax={DIAL_CYA.okMax}
                  health={dialHealth(chem.cya, DIAL_CYA)}
                  hint={
                    mode === 'balance'
                      ? dialHint(chem.cya, DIAL_CYA)
                      : 'CYA locks up HOCl — more CYA means more FC needed.'
                  }
                />
              </div>

              <div class="pth-reading pth-reading--balance-only" data-state="visible">
                <SemicircularDial
                  label="Alk"
                  unit="ppm"
                  decimals={0}
                  min={40}
                  max={240}
                  step={10}
                  value={chem.ta}
                  onChange={(v) => update({ ta: v })}
                  idealMin={DIAL_TA.idealMin}
                  idealMax={DIAL_TA.idealMax}
                  okMin={DIAL_TA.okMin}
                  okMax={DIAL_TA.okMax}
                  health={dialHealth(chem.ta, DIAL_TA)}
                  hint={dialHint(chem.ta, DIAL_TA)}
                />
              </div>

              <div class="pth-reading pth-reading--balance-only" data-state="visible">
                <SemicircularDial
                  label="Ca"
                  unit="ppm"
                  decimals={0}
                  min={100}
                  max={600}
                  step={25}
                  value={chem.ch}
                  onChange={(v) => update({ ch: v })}
                  idealMin={DIAL_CH.idealMin}
                  idealMax={DIAL_CH.idealMax}
                  okMin={DIAL_CH.okMin}
                  okMax={DIAL_CH.okMax}
                  health={dialHealth(chem.ch, DIAL_CH)}
                  hint={dialHint(chem.ch, DIAL_CH)}
                />
              </div>
            </div>

            {/* Sanitation-only bullets + deplete CTA. Bullets are
                hidden on mobile (dial tooltips carry the same copy).
                Wrapper fades + collapses in balance mode so the
                mode switch reads as a smooth transition. */}
            <div class="pth-sanitation-extras" data-active={mode === 'sanitation'}>
              <ul class="pth-bullets">
                <li>
                  <span class="pth-bullets__bullet" /> Active HOCl is the
                  fraction that actually sanitizes. Everything else is in
                  reserve or inactive.
                </li>
                <li>
                  <span class="pth-bullets__bullet" /> pH controls how much
                  of your FC stays active. Lower pH = more killing power
                  per ppm.
                </li>
                <li>
                  <span class="pth-bullets__bullet" /> CYA protects chlorine
                  from the sun but locks most of it up. More CYA means more
                  FC needed to keep active HOCl above the algae floor.
                </li>
              </ul>

              {/* When the sim is active (running / paused / depleted)
                  the time tracker sits INLINE with the control
                  button(s) in a flex row, so the whole simulation
                  block stays compact within the mobile viewport.
                  When idle, just the deplete CTA renders. */}
              {inAnimState ? (
                <div class="pth-sim-row">
                  <div
                    class={`pth-sim-status ${isAnimating ? 'is-running' : isPaused ? 'is-paused' : 'is-done'}`}
                    role="status"
                    aria-live="polite"
                  >
                    {/* Two stacked rows so the layout never jumps
                        between one and two lines as the FC value
                        grows or shrinks. Row 1: state label + elapsed
                        time. Row 2: current FC (hidden when depleted
                        since FC is by definition 0). */}
                    <div class="pth-sim-status__row">
                      <span class="pth-sim-status__label">
                        {isAnimating
                          ? 'Elapsed'
                          : isPaused
                            ? 'Paused at'
                            : 'Depleted in'}
                      </span>
                      <strong class="pth-sim-status__value">
                        {formatHoursMinutes(elapsed)}
                      </strong>
                    </div>
                    {!isDepleted && (
                      <div class="pth-sim-status__row">
                        <span class="pth-sim-status__label">FC</span>
                        <strong class="pth-sim-status__value">
                          {effectiveFc.toFixed(2)} ppm
                        </strong>
                      </div>
                    )}
                    {floorCrossedAt !== null && (
                      <div class="pth-sim-status__row pth-sim-status__row--floor">
                        <span class="pth-sim-status__floor-dot" aria-hidden="true" />
                        <span class="pth-sim-status__label">
                          Crossed 0.05 floor at
                        </span>
                        <strong class="pth-sim-status__value">
                          {formatHoursMinutes(floorCrossedAt)}
                        </strong>
                      </div>
                    )}
                  </div>
                  <div class="pth-sim-row__actions">
                    {isAnimating ? (
                      <>
                        <button
                          type="button"
                          class="pth-cta pth-cta--running pth-cta--compact"
                          onClick={pauseDeplete}
                        >
                          ⏸ Pause
                        </button>
                        <button
                          type="button"
                          class="pth-cta-link"
                          onClick={resetDeplete}
                        >
                          ↺ Reset
                        </button>
                      </>
                    ) : isPaused ? (
                      <>
                        <button
                          type="button"
                          class="pth-cta pth-cta--compact"
                          onClick={resumeDeplete}
                        >
                          ▶ Resume
                        </button>
                        <button
                          type="button"
                          class="pth-cta-link"
                          onClick={resetDeplete}
                        >
                          ↺ Reset
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        class="pth-cta pth-cta--reset pth-cta--compact"
                        onClick={resetDeplete}
                      >
                        ↺ Reset
                      </button>
                    )}
                  </div>
                </div>
              ) : protectedNow ? (
                <button
                  type="button"
                  class="pth-cta"
                  onClick={startDeplete}
                >
                  ▶ Deplete reserve at typical demand
                </button>
              ) : (
                <button
                  type="button"
                  class="pth-cta pth-cta--disabled"
                  disabled
                >
                  Below floor — adjust to test deplete
                </button>
              )}
            </div>
          </div>

          {/* ===== RIGHT — pool visualization ===== */}
          <div class="pth-card__right">
            {/* Right-panel viz top. Both panes (sanitation HOCl bar +
                Min FC, balance LSI gauge) are ALWAYS mounted and
                crossfade via opacity + max-height — so the scroll
                transition between modes smoothly fades the old set
                out and the new set in instead of snap-swapping the
                DOM subtree. */}
            <div class="pth-viz-top" data-mode={mode}>
              {/* Sanitation pane — desktop version: tall FC vs Min FC
                  comparison bars on the left, status copy panel with
                  inline horizontal HOCl meter on the right. Format
                  ported from the Aave-style design mockup. Hidden on
                  mobile in favor of the vertical-meter card below. */}
              <div
                class="pth-viz-pane pth-viz-pane--sanitation pth-viz-pane--desktop"
                data-active={mode === 'sanitation'}
              >
                {(() => {
                  const fcGood = chem.fc >= minFc;
                  const fcDelta = chem.fc - minFc;
                  // Shared y-axis scale so both bars compare cleanly.
                  const barScale =
                    Math.max(effectiveFc, minFc, minFc * 2) * 1.15 || 1;
                  const yourPct = clamp((effectiveFc / barScale) * 100, 0, 100);
                  const minPct = clamp((minFc / barScale) * 100, 0, 100);
                  const hoclTrackMax = 0.5;
                  const hoclPct = clamp(
                    (active / hoclTrackMax) * 100,
                    0,
                    100,
                  );
                  const hoclFloorPct = (ALGAE_FLOOR / hoclTrackMax) * 100;
                  return (
                    <div class="pth-calc-top">
                      <div class="pth-fcbars">
                        <div class="pth-fcbars__chart">
                          <div class="pth-fcbars__col">
                            <div class="pth-fcbars__value">
                              <span
                                class={`pth-fcbars__num ${fcGood ? '' : 'is-low'}`}
                              >
                                {effectiveFc.toFixed(1)}
                              </span>
                              <span class="pth-fcbars__unit">ppm</span>
                            </div>
                            <div
                              class={`pth-fcbars__bar pth-fcbars__bar--primary ${fcGood ? '' : 'is-low'}`}
                              style={{ height: `${yourPct}%` }}
                            />
                            <div class="pth-fcbars__label is-primary">
                              Your FC
                            </div>
                          </div>
                          <div class="pth-fcbars__col">
                            <div class="pth-fcbars__value is-muted">
                              <span class="pth-fcbars__num">
                                {minFc.toFixed(1)}
                              </span>
                              <span class="pth-fcbars__unit">ppm</span>
                            </div>
                            <div
                              class="pth-fcbars__bar pth-fcbars__bar--secondary"
                              style={{ height: `${minPct}%` }}
                            />
                            <div class="pth-fcbars__label">Min FC</div>
                          </div>
                        </div>
                        <div
                          class={`pth-fcbars__delta ${fcGood ? 'is-ok' : 'is-low'}`}
                        >
                          {fcGood
                            ? `+${fcDelta.toFixed(1)} ppm reserve`
                            : `${fcDelta.toFixed(1)} ppm below min`}
                        </div>
                      </div>

                      <div class="pth-copy">
                        <div
                          class={`pth-copy__eyebrow ${protectedNow ? '' : 'is-low'}`}
                        >
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                          </svg>
                          <span>
                            {protectedNow
                              ? 'Sanitizer active'
                              : 'Sanitizer below floor'}
                          </span>
                        </div>
                        <h4 class="pth-copy__title">
                          {protectedNow ? "You're protected." : 'Algae conditions.'}
                        </h4>
                        <div class="pth-hoclmeter">
                          <div class="pth-hoclmeter__top">
                            <span class="pth-hoclmeter__label">
                              Active HOCl
                              <button
                                type="button"
                                class="pth-hoclmeter__info"
                                aria-label="How chlorine becomes active HOCl"
                                onClick={() => setHoclModalOpen(true)}
                              >
                                ⓘ
                              </button>
                            </span>
                            <span class="pth-hoclmeter__readout">
                              <span
                                class={`pth-hoclmeter__num ${protectedNow ? '' : 'is-low'}`}
                              >
                                {active.toFixed(3)}
                              </span>
                              <span class="pth-hoclmeter__unit">ppm</span>
                            </span>
                          </div>
                          <div class="pth-hoclmeter__track">
                            <div
                              class={`pth-hoclmeter__fill ${protectedNow ? '' : 'is-low'}`}
                              style={{ width: `${hoclPct}%` }}
                            />
                            <div
                              class="pth-hoclmeter__floor"
                              style={{ left: `${hoclFloorPct}%` }}
                            >
                              <div class="pth-hoclmeter__floor-tick" />
                              <div class="pth-hoclmeter__floor-label">
                                0.05 floor
                              </div>
                            </div>
                          </div>
                        </div>
                        <p class="pth-copy__lead">
                          {protectedNow ? (
                            <>
                              Algae spores that enter the water are
                              overwhelmed before they can replicate.
                            </>
                          ) : (
                            <>
                              Algae survives initial contact long enough
                              to duplicate, leading to blooms.
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Mobile-only sanitation pane — ports the design
                  mockup's mobile layout: FC vs Min FC tall bars +
                  short copy side-by-side, then a full-width
                  horizontal HOCl meter below. Hidden on desktop. */}
              <div
                class="pth-viz-pane pth-viz-pane--sanitation pth-viz-pane--mobile"
                data-active={mode === 'sanitation'}
              >
                {(() => {
                  const fcGood = effectiveFc >= minFc;
                  const fcDelta = effectiveFc - minFc;
                  const barScale =
                    Math.max(effectiveFc, minFc, minFc * 2) * 1.15 || 1;
                  const yourPct = clamp((effectiveFc / barScale) * 100, 0, 100);
                  const minPct = clamp((minFc / barScale) * 100, 0, 100);
                  const hoclTrackMax = 0.5;
                  const hoclPct = clamp(
                    (active / hoclTrackMax) * 100,
                    0,
                    100,
                  );
                  const hoclFloorPct = (ALGAE_FLOOR / hoclTrackMax) * 100;
                  return (
                    <>
                      {/* Mobile pool-first layout: pool icon up top
                          owns the visual real-estate. Below: bars
                          (with the reserve pill underneath) on the
                          left, and the Active HOCl meter + status
                          copy on the right. The meter doesn't need
                          full width — sitting in the narrow right
                          column keeps everything in one viewport. */}
                      <div class="pth-compare-row">
                        <div class="pth-fcbars">
                          <div class="pth-fcbars__chart">
                          <div class="pth-fcbars__col">
                            <div class="pth-fcbars__value">
                              <span
                                class={`pth-fcbars__num ${fcGood ? '' : 'is-low'}`}
                              >
                                {effectiveFc.toFixed(1)}
                              </span>
                              <span class="pth-fcbars__unit">ppm</span>
                            </div>
                            <div
                              class={`pth-fcbars__bar pth-fcbars__bar--primary ${fcGood ? '' : 'is-low'}`}
                              style={{ height: `${yourPct}%` }}
                            />
                            <div class="pth-fcbars__label is-primary">
                              Your FC
                            </div>
                          </div>
                          <div class="pth-fcbars__col">
                            <div class="pth-fcbars__value is-muted">
                              <span class="pth-fcbars__num">
                                {minFc.toFixed(1)}
                              </span>
                              <span class="pth-fcbars__unit">ppm</span>
                            </div>
                            <div
                              class="pth-fcbars__bar pth-fcbars__bar--secondary"
                              style={{ height: `${minPct}%` }}
                            />
                            <div class="pth-fcbars__label">Min FC</div>
                          </div>
                        </div>
                        {/* Reserve / shortfall pill — lives below the
                            bars again, the spot the user knows it
                            from the original mockup. */}
                        <div
                          class={`pth-fcbars__delta ${fcGood ? 'is-ok' : 'is-low'}`}
                        >
                          {fcGood
                            ? `+${fcDelta.toFixed(1)} ppm reserve`
                            : `${fcDelta.toFixed(1)} ppm below min`}
                        </div>
                      </div>
                          <div class="pth-copy pth-copy--mobile">
                            {/* Compact Active HOCl meter sits on top
                                of the right column — narrow track,
                                tight readout, anchored above the
                                "You're protected." header. */}
                            <div class="pth-hoclmeter pth-hoclmeter--mobile pth-hoclmeter--compact">
                              <div class="pth-hoclmeter__top">
                                <span class="pth-hoclmeter__label">
                                  Active HOCl
                                  <button
                                    type="button"
                                    class="pth-hoclmeter__info"
                                    aria-label="How chlorine becomes active HOCl"
                                    onClick={() => setHoclModalOpen(true)}
                                  >
                                    ⓘ
                                  </button>
                                </span>
                                <span class="pth-hoclmeter__readout">
                                  <span
                                    class={`pth-hoclmeter__num ${protectedNow ? '' : 'is-low'}`}
                                  >
                                    {active.toFixed(3)}
                                  </span>
                                  <span class="pth-hoclmeter__unit">ppm</span>
                                </span>
                              </div>
                              <div class="pth-hoclmeter__track">
                                <div
                                  class={`pth-hoclmeter__fill ${protectedNow ? '' : 'is-low'}`}
                                  style={{ width: `${hoclPct}%` }}
                                />
                                <div
                                  class="pth-hoclmeter__floor"
                                  style={{ left: `${hoclFloorPct}%` }}
                                >
                                  <div class="pth-hoclmeter__floor-tick" />
                                  <div class="pth-hoclmeter__floor-label">
                                    0.05 floor
                                  </div>
                                </div>
                              </div>
                            </div>
                            <h4 class="pth-copy__title">
                              {fcGood ? "You're protected." : "You're short."}
                            </h4>
                            <p class="pth-copy__lead">
                              {fcGood ? (
                                <>
                                  Algae spores that enter the water are
                                  overwhelmed before they can replicate.
                                </>
                              ) : (
                                <>
                                  Algae survives initial contact long
                                  enough to duplicate, leading
                                  to blooms.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                    </>
                  );
                })()}
              </div>

              {/* Balance pane — full-width LSI gauge */}
              <div
                class="pth-viz-pane pth-viz-pane--balance"
                data-active={mode === 'balance'}
              >
                <div class={`pth-lsi pth-lsi--${tone}`}>
                  <div class="pth-lsi__top">
                    <div class="pth-lsi__readout">
                      <span class="pth-lsi__label">LSI</span>
                      <span class="pth-lsi__value">
                        {lsi >= 0 ? '+' : ''}
                        {lsi.toFixed(2)}
                      </span>
                    </div>
                    <div class="pth-lsi__status">
                      {tone === 'balanced' && 'Balanced'}
                      {tone === 'corrosive' && 'Corrosive'}
                      {tone === 'scaling' && 'Scaling'}
                    </div>
                  </div>
                  <div class="pth-lsi__track">
                    <div class="pth-lsi__zone pth-lsi__zone--corrosive" />
                    <div class="pth-lsi__zone pth-lsi__zone--balanced" />
                    <div class="pth-lsi__zone pth-lsi__zone--scaling" />
                    <div
                      class="pth-lsi__marker"
                      style={{
                        '--pos': Math.max(
                          0,
                          Math.min(100, ((lsi + 1.5) / 3) * 100),
                        ),
                      } as any}
                    />
                  </div>
                  <div class="pth-lsi__labels">
                    <span>Corrosive</span>
                    <span>Balanced</span>
                    <span>Scaling</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Status callouts — left card mirrors the LSI tone, right
                card summarizes readings health. Always mounted; the
                container fades + collapses to 0 height in sanitation
                mode so the scroll transition between modes reads as
                a smooth swap instead of a content snap. */}
            {(() => {
              const lsiCopy = lsiStatusCopy(tone);
              const rd = readingsStatus(chem, tone);
              return (
                <div class="pth-status-cards" data-active={mode === 'balance'}>
                  <div class={`pth-status-card pth-status-card--${tone}`}>
                    <h4 class="pth-status-card__title">{lsiCopy.title}</h4>
                    <p class="pth-status-card__body">{lsiCopy.body}</p>
                  </div>
                  <div class={`pth-status-card pth-status-card--${rd.tone}`}>
                    <h4 class="pth-status-card__title">{rd.title}</h4>
                    <p class="pth-status-card__body">{rd.body}</p>
                  </div>
                </div>
              );
            })()}

            {/* Short caption above the pool on MOBILE only — the
                "we adapt" promise. Reorders before pool-wrap via
                flex order on mobile; hidden on desktop (the longer
                caption below the pool covers desktop). */}
            {mode === 'sanitation' && (
              <p class="pth-pool-note pth-pool-note--short">
                We understand the chemistry behind recommended chlorine
                ranges and adapt it to your pool, so your sanitizer
                stays ahead of algae in any season.
              </p>
            )}
            <div class="pth-pool-wrap" style={poolVars}>
              <PoolIcon className="pth-pool" />
            </div>
            {/* Full narrative line directly under the pool on
                DESKTOP — covers the "we adapt the chemistry" angle.
                Sanitation-mode only so it doesn't compete with the
                balance caption that follows. Hidden on mobile (the
                short caption above the pool covers mobile). */}
            {mode === 'sanitation' && (
              <p class="pth-pool-note pth-pool-note--full">
                Recommended chlorine ranges make assumptions that don't
                hold up in coastal heat and sun. We understand the
                chemistry behind those ranges and adapt it to your
                pool, so your sanitizer stays ahead of algae in any
                season.
              </p>
            )}
            <p class="pth-chart-caption">
              {mode === 'balance' ? (
                /* Balance mode — describe what the pool art is showing
                   for the current LSI tone, not chlorine numbers. */
                tone === 'corrosive' ? (
                  'Aggressive water pulls calcium from metal — the ladder is rusting and surfaces will pit.'
                ) : tone === 'scaling' ? (
                  'Calcium drops out of solution — the water clouds and scale forms on tile and equipment.'
                ) : (
                  'Balanced water keeps calcium in solution — surfaces, metal, and skin are all protected.'
                )
              ) : isAnimating ? (
                <>
                  Elapsed <strong>{formatHoursMinutes(elapsed)}</strong> ·
                  FC <strong>{effectiveFc.toFixed(2)} ppm</strong>
                  {floorCrossedAt !== null && (
                    <>
                      {' '}· crossed floor at{' '}
                      <strong>{formatHoursMinutes(floorCrossedAt)}</strong>
                    </>
                  )}
                </>
              ) : isPaused ? (
                <>
                  Paused at <strong>{formatHoursMinutes(elapsed)}</strong> ·
                  FC <strong>{effectiveFc.toFixed(2)} ppm</strong>
                  {floorCrossedAt !== null && (
                    <>
                      {' '}· crossed floor at{' '}
                      <strong>{formatHoursMinutes(floorCrossedAt)}</strong>
                    </>
                  )}
                </>
              ) : isDepleted ? (
                <>
                  Depleted in <strong>{formatHoursMinutes(elapsed)}</strong>
                  {floorCrossedAt !== null && (
                    <>
                      {' '}· crossed floor at{' '}
                      <strong>{formatHoursMinutes(floorCrossedAt)}</strong>
                    </>
                  )}
                </>
              ) : protectedNow ? (
                `Active HOCl is ${active.toFixed(3)} ppm — above the 0.05 algae floor.`
              ) : (
                `Active HOCl is ${active.toFixed(3)} ppm — below the 0.05 algae floor.`
              )}
            </p>
          </div>
        </div>

          </article>
        </div>
  );

  // Embedded use: render the bare card (parent owns the pin section
  // and triangle landing animation).
  if (embedded) return cardContent;

  // Standalone use: wrap with the scroll-pinned section.
  return (
    <div class="pth-section" ref={sectionRef}>
      <div class="pth-section__pin">
        {cardContent}
      </div>
    </div>
  );
}

// =========================================================================
// Helpers used only by the balance mode of this card
// =========================================================================

/**
 * Vertical HOCl meter — mobile-only gauge for current active HOCl
 * against the 0..0.5 ppm scale.
 *
 * Design: dark gauge card with a wide rounded bar on the left. The
 * fill rises with a glowing accent — green when above the algae
 * floor, red when below — and a floating pill marker sits at the
 * fill top showing the current value with a hairline that connects
 * back into the bar. Scale labels (0.5 / floor 0.05 / 0) sit to the
 * left of the bar; "Active HOCl" label + value sit to the right,
 * centered to the bar's vertical midline.
 */

function HOClMeter({
  active,
  barMax,
  algaeFloor,
  protectedNow,
}: {
  active: number;
  barMax: number;
  algaeFloor: number;
  protectedNow: boolean;
}) {
  const norm = Math.min(active / barMax, 1);
  const fillPct = norm * 100;
  const floorPct = (algaeFloor / barMax) * 100;
  return (
    <div
      class={`pth-hocl-meter ${protectedNow ? 'is-safe' : 'is-danger'}`}
    >
      <div class="pth-hocl-meter__bar-wrap">
        <div class="pth-hocl-meter__bar">
          <div
            class="pth-hocl-meter__fill"
            style={{ height: `${fillPct}%` }}
          />
        </div>
        <div
          class="pth-hocl-meter__floor"
          style={{ bottom: `${floorPct}%` }}
          aria-hidden="true"
        >
          <span class="pth-hocl-meter__floor-label">0.05</span>
        </div>
        <span class="pth-hocl-meter__status">
          {protectedNow ? 'Above' : 'Below'}
        </span>
      </div>
      <div class="pth-hocl-meter__readout">
        <span class="pth-hocl-meter__value">{active.toFixed(3)}</span>
        <span class="pth-hocl-meter__unit">ppm</span>
      </div>
    </div>
  );
}

/**
 * Desktop slider row — bare slider + label/value head + optional ideal
 * band overlay and one-line hint. Used by the .pth-readings--desktop
 * stack; the mobile dial layout below uses SemicircularDial instead.
 */
function BalanceReading({
  panelMode = 'common',
  label,
  value,
  displayValue,
  unit,
  spec,
  sliderMin,
  sliderMax,
  step,
  onChange,
  showRange = true,
}: {
  panelMode?: 'sanitation-only' | 'balance-only' | 'common';
  label: string;
  value: number;
  displayValue?: string;
  unit: string;
  spec: DialSpec;
  sliderMin: number;
  sliderMax: number;
  step: number;
  onChange: (v: number) => void;
  showRange?: boolean;
}) {
  const health: DialHealth = dialHealth(value, spec);
  const hint = (() => {
    const h = dialHealth(value, spec);
    if (h === 'ideal') return spec.ideal;
    return value < spec.idealMin ? spec.warnLow : spec.warnHigh;
  })();
  const ideal = rangeBandPct(
    { min: sliderMin, max: sliderMax },
    spec.idealMin,
    spec.idealMax,
  );
  const ok = rangeBandPct(
    { min: sliderMin, max: sliderMax },
    spec.okMin,
    spec.okMax,
  );
  const panelClass =
    panelMode === 'sanitation-only'
      ? ' pth-reading--sanitation-only'
      : panelMode === 'balance-only'
        ? ' pth-reading--balance-only'
        : ' pth-reading--common';
  return (
    <div class={`pth-reading${panelClass}`} data-state="visible">
      <div class="pth-reading__head">
        <span class="pth-reading__label">{label}</span>
        <span class="pth-reading__value">
          {displayValue ?? value}
          {unit && <span class="pth-reading__unit">{unit}</span>}
        </span>
      </div>
      <div class="pth-reading__slider-wrap">
        {showRange && (
          <>
            <div
              class="pth-reading__range pth-reading__range--ok"
              style={{ left: `${ok.lo}%`, right: `${100 - ok.hi}%` }}
            />
            <div
              class="pth-reading__range pth-reading__range--ideal"
              style={{ left: `${ideal.lo}%`, right: `${100 - ideal.hi}%` }}
            />
          </>
        )}
        <Slider
          min={sliderMin}
          max={sliderMax}
          step={step}
          value={value}
          onChange={onChange}
        />
      </div>
      {showRange && (
        <p class={`pth-reading__hint pth-reading__hint--${health}`}>{hint}</p>
      )}
    </div>
  );
}

/**
 * LSI callout copy. Text and logic mirror the existing LSICalculator
 * pillar tool exactly so the two views stay in sync. Title comes
 * from the lsi-calc__callout-label block; body from
 * lsi-calc__callout-detail.
 */
function lsiStatusCopy(t: 'corrosive' | 'balanced' | 'scaling'): {
  title: string;
  body: string;
} {
  if (t === 'corrosive') {
    return {
      title: 'Corrosive',
      body:
        'Readings tip into corrosion — water pulls calcium from plaster, grout, and metal fixtures.',
    };
  }
  if (t === 'scaling') {
    return {
      title: 'Scaling',
      body:
        'Readings tip into scaling — calcium drops out as cloudy water and scale on tile and heaters.',
    };
  }
  return {
    title: 'In balance',
    body:
      'Ranges combine to keep saturation balanced — protecting surfaces, equipment, and skin.',
  };
}

/**
 * Readings callout copy. Mirrors LSICalculator's anyBad-driven logic:
 *   anyBad           → "Out of range" (red)
 *   no bad + balanced → "Everything in range" (green) + ideal-scenario body
 *   no bad + lsi off  → "Everything in range" (green) + close-to-sweet-spot body
 */
function readingsStatus(
  chem: { ph: number; cya: number; ta: number; ch: number },
  lsiToneVal: 'corrosive' | 'balanced' | 'scaling',
): {
  title: string;
  body: string;
  tone: 'corrosive' | 'balanced' | 'scaling';
} {
  const pairs: Array<[DialSpec, number]> = [
    [DIAL_PH, chem.ph],
    [DIAL_CYA, chem.cya],
    [DIAL_TA, chem.ta],
    [DIAL_CH, chem.ch],
  ];
  const anyBad = pairs.some(([spec, v]) => dialHealth(v, spec) === 'bad');
  if (anyBad) {
    return {
      title: 'Out of range',
      body:
        "Fix the red dial first — water balance can't be trusted until every reading is inside its target band.",
      tone: 'corrosive',
    };
  }
  if (lsiToneVal === 'balanced') {
    return {
      title: 'Everything in range',
      body:
        'Ideal scenario — all readings dialed and water is balanced. Nothing needs to be added.',
      tone: 'balanced',
    };
  }
  return {
    title: 'Everything in range',
    body:
      'All readings sit in their target bands. Small adjustments will bring the saturation index back to the sweet spot.',
    tone: 'balanced',
  };
}
