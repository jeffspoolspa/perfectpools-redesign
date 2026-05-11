/**
 * PillarsCinematic — sandbox experiment
 * =====================================
 *
 * Reimagines the Three Pillars section as a single pinned scroll
 * sequence with four phases:
 *
 *   PHASE A (0.00 → 0.30) — "Reveal"
 *     - Pool background image clip-path animates from an inset
 *       rectangle (matching the Rivian-style "small framed image"
 *       reference) to a full-bleed image filling the viewport.
 *     - The title "Three pillars of Perfect Pool care" and the
 *       triangle diagram fade in centered over the image.
 *
 *   PHASE B (0.30 → 0.45) — "Diagram persists, title exits"
 *     - The background image fades to a muted backdrop.
 *     - The title fades out.
 *     - The triangle diagram TWEENS from screen-center to
 *       top-left corner, scaling down — and stays there for the rest
 *       of the section as a constant compass.
 *
 *   PHASE C (0.45 → 1.00) — "Pillar deep-dives"
 *     - Three full-viewport pillar panels (Sanitation → Filtration →
 *       Balance) crossfade through, each one centered and using the
 *       full content area to the RIGHT of the now-pinned diagram.
 *     - The diagram's active pillar updates in sync with whichever
 *       panel is currently centered, so the triangle "lights up" the
 *       matching slice as the user moves through the section.
 *
 * Total scroll length: SCROLL_VH viewports (default 5 = 500vh) — one
 * for the reveal, one for the transition, and roughly one per pillar.
 *
 * Reuses PILLARS data + PillarsTriangle component from the existing
 * PillarsScroll so content stays identical between the v1 and this
 * experiment.
 */

import { useEffect, useRef, useState } from 'preact/hooks';
import PillarsTriangle, { PILLARS } from '../PillarsTriangle';
import LSICalculator from '../tools/LSICalculator';
import SanitationTabs from '../tools/SanitationTabs';
import FiltrationDiagram from '../tools/FiltrationDiagram';
import { assetPath } from '../../utils/base-url';

const SCROLL_VH = 5;
const BG_IMAGE = assetPath('/images/hero-pool.png');

/**
 * Cinematic cycle order: sanitation → filtration → balance → flow.
 * Each gets its own crossfade panel; the "flow" panel is intentionally
 * blank for now (placeholder reserved so we can fill it in later with
 * content about how the three outer pillars connect as one system).
 */
const MAIN_PILLAR_IDS = ['sanitation', 'filtration', 'balance', 'flow'] as const;
const MAIN_PILLARS = MAIN_PILLAR_IDS
  .map((id) => PILLARS.find((p) => p.id === id))
  .filter((p): p is (typeof PILLARS)[number] => Boolean(p));

/**
 * Linear interpolation between two values.
 * Wrapped here so the JS animation reads cleanly without depending
 * on gsap's helpers.
 */
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Clamp a value to [min, max]. */
function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

/**
 * Symmetric ease-in-out (cubic). Maps a linear t in [0, 1] to a curve
 * that starts and ends with zero velocity — so opacity / scale ramps
 * don't "snap" into motion at fade boundaries. Matches the codebase's
 * default crossfade easing.
 */
function easeInOutCubic(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export default function PillarsCinematic() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  /** Drives which pillar slice on the triangle is highlighted. */
  const [activeIndex, setActiveIndex] = useState(0);
  const lastActiveRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !sectionRef.current || !pinRef.current) {
      return;
    }

    let cleanup = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        const bg = bgRef.current!;
        const title = titleRef.current!;
        const diagram = diagramRef.current!;
        const pin = pinRef.current!;
        const panels = panelRefs.current.filter(Boolean) as HTMLDivElement[];

        const st = ScrollTrigger.create({
          trigger: sectionRef.current!,
          start: 'top top',
          end: 'bottom bottom',
          pin: pinRef.current!,
          pinSpacing: false,
          scrub: 0.6,
          onUpdate: (self: any) => {
            const p = self.progress;

            // === Compute the unified diagram + card BLOCK layout ===
            // The diagram and card render as a single visual component:
            //   [ diagram ] [gap] [ card ]
            // centered horizontally with min side padding. Gap stays
            // fixed (32px) at every size so the pair always reads as
            // one unit, not two scattered pieces.
            //
            // IMPORTANT: positions are relative to the PIN element
            // (pin.getBoundingClientRect()), NOT the viewport. Pin is
            // position:fixed but its containing block can be smaller
            // than the viewport (e.g., when this experiment is mounted
            // inside a column-constrained sandbox container). All
            // inline left/transform values below are in pin-local
            // coordinates.
            const pinR = pin.getBoundingClientRect();
            const vw = pinR.width;
            const vh = pinR.height;
            // diagVisualW/H: rendered triangle dimensions after the
            // Phase C end scale is applied. We measure offsetWidth/H
            // so the math tracks the diagram's actual CSS-defined
            // size (clamp(280px, 32vw, 420px)) at every viewport,
            // instead of hardcoding 410 / 0.55 desktop assumptions.
            const DIAG_END_SCALE = 0.7;
            const diagBaseW = diagram.offsetWidth || 410;
            const diagBaseH = diagram.offsetHeight || 372;
            const diagVisualW = diagBaseW * DIAG_END_SCALE;
            const diagVisualH = diagBaseH * DIAG_END_SCALE;
            const blockGap = 18;     // tightened from 32 — reads as
                                     // one component instead of two.
            const sidePadMin = 40;
            const cardMaxW = 820;
            const availableForCard = vw - sidePadMin * 2 - diagVisualW - blockGap;
            const cardW = Math.min(cardMaxW, Math.max(360, availableForCard));
            const blockTotalW = diagVisualW + blockGap + cardW;
            const blockLeft = Math.max(sidePadMin, (vw - blockTotalW) / 2);
            const diagramLeftPx = blockLeft;
            const diagramCenterX = diagramLeftPx + diagVisualW / 2;
            const cardLeftPx = diagramLeftPx + diagVisualW + blockGap;

            // === Vertical centering of the [diagram + card] block ===
            // The diagram's vertical center is anchored to vh/2 so it
            // sits at the same vertical axis as every card's center.
            // Each panel's `top` is computed PER-PANEL (in the loop
            // below) from its own natural height — so a content-light
            // panel like Flow doesn't inherit the tall Filtration
            // panel's top offset and look stuck at the viewport top.
            const minTopMargin = 32;
            const maxAllowedCardH = vh - 2 * minTopMargin;
            const diagramCenterY = vh / 2;

            // --- PHASE A: 0.00 → 0.30 (reveal) ---------------------
            const a = clamp(p / 0.30, 0, 1);
            // Photo frame: starts inset (a=0) and grows to full bleed
            // (a=1). Inset is set via top/left/right/bottom (not
            // clip-path) so the element can carry a real CSS border —
            // the colored frame around the photo while it's small.
            const insetTop = lerp(14, 0, a);
            const insetSide = lerp(8, 0, a);
            const insetBottom = lerp(22, 0, a);
            bg.style.top = `${insetTop}%`;
            bg.style.left = `${insetSide}%`;
            bg.style.right = `${insetSide}%`;
            bg.style.bottom = `${insetBottom}%`;
            bg.style.borderRadius = `${lerp(28, 0, a)}px`;
            // Border tapers to 0 as the photo goes full bleed.
            bg.style.borderWidth = `${lerp(4, 0, a)}px`;
            bg.style.opacity = String(lerp(0.65, 1, a));

            // Title & diagram fade in over Phase A.
            const titleFadeIn = clamp((p - 0.08) / 0.22, 0, 1);
            title.style.opacity = String(titleFadeIn);

            // === Phase A diagram + title vertical layout ===========
            // Goal: when no title is visible, the diagram sits in the
            // lower portion of the photo (bottom-center anchor). As
            // the title fades in, the diagram TRANSLATES UP to sit
            // right under the title — and the [title + gap + diagram]
            // block as a whole stays centered in the image area.
            //
            // We measure the title and diagram heights live so the math
            // adapts to viewport-driven font-size + diagram size changes
            // without manual constants going stale.
            const phaseA_imageCenterY = vh / 2;
            const phaseA_titleH = title.offsetHeight || 160;
            const phaseA_diagFullH = diagram.offsetHeight || 360;
            const phaseA_blockGap = 28;
            const phaseA_blockH =
              phaseA_titleH + phaseA_blockGap + phaseA_diagFullH;
            // Title's TOP edge so the block is centered around the image
            // center when titleFadeIn = 1.
            const phaseA_titleTopY =
              phaseA_imageCenterY - phaseA_blockH / 2;
            // Diagram visual center y when title is fully visible:
            // sitting right below the title with the fixed gap, and
            // the whole [title + gap + diagram] block centered in the
            // image area.
            const phaseA_diagWithTitleCenterY =
              phaseA_titleTopY +
              phaseA_titleH +
              phaseA_blockGap +
              phaseA_diagFullH / 2;
            // Diagram visual center y when title is hidden: anchored
            // so the BALANCE section's TOP edge in the diagram lines
            // up exactly with the photo's bottom edge.
            //
            // PillarsTriangle SVG viewBox is `-10 -10 442 402`.
            // Balance's top edge is at SVG y=237, which is at fraction
            // (237 + 10) / 402 ≈ 0.6144 of the rendered diagram height
            // measured from its top. Diagram center is at fraction 0.5,
            // so the balance line sits BELOW the diagram center by
            // (0.6144 - 0.5) * diagH = 0.1144 * diagH.
            //
            // photoBottomY tracks the live inset so the diagram slides
            // slightly downward as the photo expands during Phase A —
            // the alignment holds throughout the reveal.
            const BALANCE_TOP_FRACTION = (237 + 10) / 402;
            const photoBottomY = vh * (1 - insetBottom / 100);
            const phaseA_diagAloneCenterY =
              photoBottomY -
              (BALANCE_TOP_FRACTION - 0.5) * phaseA_diagFullH;
            // Live diagram center as the title fades in: starts low,
            // translates UP to land right under the title.
            const phaseA_diagCenterY = lerp(
              phaseA_diagAloneCenterY,
              phaseA_diagWithTitleCenterY,
              titleFadeIn,
            );

            // Override the CSS `top: 28%` so the title lands at the
            // computed position. `transform` keeps the (-50%) horizontal
            // centering and adds the slide-up entrance from 20px below.
            title.style.top = `${phaseA_titleTopY}px`;
            title.style.transform = `translate(-50%, ${lerp(20, 0, titleFadeIn)}px)`;

            // --- PHASE B: 0.30 → 0.45 (transition) ----------------
            // Title fades out, image dims, diagram tweens to top-left,
            // and PILLAR 1 fades in — all timed to complete together
            // at p=0.45 so the diagram "lands" at the exact moment
            // the first card is fully visible.
            const b = clamp((p - 0.30) / 0.15, 0, 1);
            title.style.opacity = String(lerp(titleFadeIn, 0, b));
            bg.style.opacity = String(lerp(1, 0.18, b));

            // Stage background: white during Phase A (so the framed
            // image reads as a clean photo on a light page coming out
            // of "Our Story"), then crossfades to dark navy during
            // Phase B as the image dims and the white cards appear,
            // giving them contrast for Phase C.
            const stageR = Math.round(lerp(255, 10, b));
            const stageG = Math.round(lerp(255, 25, b));
            const stageBl = Math.round(lerp(255, 41, b));
            pin.style.background = `rgb(${stageR}, ${stageG}, ${stageBl})`;

            // Diagram positioning across Phases A → B:
            //   Phase A end (b=0): visual center = phaseA_diagCenterY
            //     (computed above — sits below the title within the
            //     image-centered block).
            //   Phase B target (b=1): visual center at the block layout's
            //     diagramCenterX / diagramCenterY — exactly to the LEFT
            //     of the card with the fixed gap between them.
            // Use px (not vw/vh) for translate so the diagram lands at
            // a precise position relative to the card on any viewport.
            const txEndPx = diagramCenterX - vw / 2;
            const tyEndPx = diagramCenterY - vh / 2;
            const tyStartPx = phaseA_diagCenterY - vh / 2;
            const txPx = lerp(0, txEndPx, b);
            const tyPx = lerp(tyStartPx, tyEndPx, b);
            const diagScale = lerp(1, DIAG_END_SCALE, b);
            diagram.style.transform =
              `translate(calc(-50% + ${txPx}px), calc(-50% + ${tyPx}px)) scale(${diagScale})`;

            // --- PHASE C: 0.45 → 1.00 (pillar deep-dives) ---------
            // Phase C is divided into N equal segments, one per pillar.
            // Pillar 1 is SPECIAL: it fades in during Phase B (not C)
            // and is at full opacity by p=0.45, so it's already
            // visible when Phase C begins. Pillars 2..N cycle through
            // their segments with crossfades on the boundaries.
            const phaseC_start = 0.45;
            const phaseC_range = 1 - phaseC_start;
            const segWidth = phaseC_range / panels.length; // p-space width
            // fadeBand controls how much scroll distance each crossfade
            // takes. Higher = longer/softer transition. At 1.0 the
            // crossfades meet exactly (panel i hits 0 as i+1 hits 1)
            // with zero hold-at-full time. Above 1.0 panels overlap,
            // which reads as muddled.
            const fadeBand = segWidth * 0.95;

            panels.forEach((panel, i) => {
              // `panelOpacity` is the EASED final value driving both
              // CSS opacity and the coupled emerges-from-diagram scale.
              // We compute a linear `t` in [0, 1] for whichever ramp
              // applies (entrance / exit / hold), then run it through
              // easeInOutCubic so neither end of the crossfade snaps in.
              let panelOpacity = 0;
              if (i === 0) {
                // Pillar 1 fades in during Phase B.
                if (p < 0.30) {
                  panelOpacity = 0;
                } else if (p < phaseC_start) {
                  // Linear progress through Phase B, eased.
                  const t = (p - 0.30) / 0.15;
                  panelOpacity = easeInOutCubic(clamp(t, 0, 1));
                } else {
                  // After Phase B: stay at 1 until pillar 2 starts
                  // fading in, then crossfade out.
                  const segCenter = phaseC_start + segWidth * 0.5;
                  const distFromCenter = Math.abs(p - segCenter);
                  if (distFromCenter < segWidth * 0.5 - fadeBand * 0.5) {
                    panelOpacity = 1;
                  } else if (distFromCenter < segWidth * 0.5 + fadeBand * 0.5) {
                    const t = (segWidth * 0.5 + fadeBand * 0.5 - distFromCenter) / fadeBand;
                    panelOpacity = easeInOutCubic(clamp(t, 0, 1));
                  }
                  // While the user is still scrolling INTO pillar 1's
                  // segment (left half), keep opacity at 1 — they just
                  // arrived from Phase B.
                  if (p < segCenter) panelOpacity = 1;
                }
              } else {
                // Pillars 2..N: standard segment-centered crossfade.
                const segCenter = phaseC_start + segWidth * (i + 0.5);
                const distFromCenter = Math.abs(p - segCenter);
                if (distFromCenter < segWidth * 0.5 - fadeBand * 0.5) {
                  panelOpacity = 1;
                } else if (distFromCenter < segWidth * 0.5 + fadeBand * 0.5) {
                  const t = (segWidth * 0.5 + fadeBand * 0.5 - distFromCenter) / fadeBand;
                  panelOpacity = easeInOutCubic(clamp(t, 0, 1));
                }
              }
              panel.style.opacity = String(panelOpacity);

              // === Per-panel vertical centering =====================
              // Measure THIS panel's natural content height and center
              // it on vh/2. Each panel computes its own top so a short
              // panel (e.g. Flow, just a header) sits at viewport center
              // instead of inheriting a tall panel's top offset.
              // scrollHeight ignores the current scale transform but
              // does reflect width — converges on the next frame after
              // cardW changes.
              const panelNaturalH = panel.scrollHeight || 200;
              const panelUsedH = Math.min(panelNaturalH, maxAllowedCardH);
              const panelTopPx = Math.max(
                minTopMargin,
                (vh - panelUsedH) / 2,
              );
              const panelMaxH = vh - 2 * panelTopPx;

              // === Place card at the computed block-layout position ===
              // left + width are shared across panels (same diagram).
              // top + max-height are PER-PANEL so each panel centers
              // its own content vertically.
              panel.style.left = `${cardLeftPx}px`;
              panel.style.width = `${cardW}px`;
              panel.style.top = `${panelTopPx}px`;
              panel.style.maxHeight = `${panelMaxH}px`;

              // === Card "emerges from diagram" effect ============
              // transform-origin = diagram's CURRENT visual center,
              // expressed in the card's own local coordinate system
              // (relative to its top-left). Scale ramps with opacity
              // so the card appears to grow OUT OF the diagram on
              // fade-in and shrink BACK INTO it on fade-out.
              const diagCurrentCenterX = vw / 2 + txPx;
              const diagCurrentCenterY = vh / 2 + tyPx;
              const originX = diagCurrentCenterX - cardLeftPx;
              const originY = diagCurrentCenterY - panelTopPx;
              panel.style.transformOrigin = `${originX}px ${originY}px`;

              // Scale starts close to 1 — just enough to read as a
              // gentle emergence from the diagram. Starting smaller
              // (e.g. 0.15) makes cards feel like they "fly out" of
              // the origin, which reads as aggressive at scroll speed.
              const cardScale = lerp(0.85, 1, panelOpacity);
              const drift = (1 - panelOpacity) * 14;
              // No -50% horizontal translate — `left` is already at the
              // card's target x position from the block layout.
              panel.style.transform = `translate(0, ${drift}px) scale(${cardScale})`;
              panel.style.pointerEvents = panelOpacity > 0.7 ? 'auto' : 'none';
            });

            // Sync the diagram's active slice. During Phase A/B,
            // pillar 1 is the relevant one (it's the first one to
            // appear). In Phase C, compute from progress within
            // the segment grid.
            let activeIdx = 0;
            if (p >= phaseC_start) {
              const phaseCProgress = (p - phaseC_start) / phaseC_range;
              activeIdx = clamp(
                Math.floor(phaseCProgress * panels.length),
                0,
                panels.length - 1,
              );
            }
            if (activeIdx !== lastActiveRef.current) {
              lastActiveRef.current = activeIdx;
              setActiveIndex(activeIdx);
            }
          },
        });

        cleanup = () => st.kill();
      },
    );

    return () => cleanup();
  }, []);

  return (
    <div ref={sectionRef} class="pc-section" style={{ height: `${SCROLL_VH * 100}vh` }}>
      <div ref={pinRef} class="pc-pin">
        {/* === Layer 1: pool image, full bleed ===================== */}
        <div
          ref={bgRef}
          class="pc-bg"
          style={{ backgroundImage: `url('${BG_IMAGE}')` }}
          aria-hidden="true"
        />

        {/* === Layer 2: centered title (Phase A only) =============== */}
        <div ref={titleRef} class="pc-title">
          <h2>Three pillars of Perfect Pool care</h2>
          <p>
            Every visit is built on chemistry, equipment health, and
            transparency — working together as one system.
          </p>
        </div>

        {/* === Layer 3: triangle diagram (center → top-left) ======= */}
        <div ref={diagramRef} class="pc-diagram">
          <PillarsTriangle
            active={MAIN_PILLARS[activeIndex].id}
            onHover={(id) => {
              const i = MAIN_PILLARS.findIndex((p) => p.id === id);
              if (i >= 0) {
                lastActiveRef.current = i;
                setActiveIndex(i);
              }
            }}
          />
        </div>

        {/* === Layer 4: per-pillar full-area panels (Phase C) ====== */}
        <div class="pc-panels">
          {MAIN_PILLARS.map((pillar, i) => (
            <div
              key={pillar.id}
              ref={(el) => { panelRefs.current[i] = el; }}
              class={`pc-panel pc-panel--${pillar.id}`}
              style={{ opacity: 0, '--accent': pillar.color } as any}
            >
              <header class="pc-panel-head">
                <div class="pc-panel-icon" style={{ background: pillar.color }}>
                  <img src={assetPath(pillar.icon)} alt="" />
                </div>
                <div>
                  <span class="pc-panel-kicker">Pillar 0{i + 1}</span>
                  <h3 class="pc-panel-title">{pillar.heading}</h3>
                </div>
              </header>
              <div class="pc-panel-body">
                {pillar.id === 'sanitation' && <SanitationTabs />}
                {pillar.id === 'filtration' && <FiltrationDiagram />}
                {pillar.id === 'balance' && <LSICalculator />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
