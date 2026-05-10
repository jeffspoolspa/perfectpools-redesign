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
            // diagVisualW/H: rendered triangle dimensions after scale.
            // The PillarsTriangle SVG aspect is roughly 1:0.91, NOT
            // square — using width for Y math would push the diagram
            // ~10px lower than the card top.
            const diagVisualW = 225; // = base 410 × scale 0.55
            const diagVisualH = 205; // actual SVG-aspect rendered height
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
            // Card top edge = CSS clamp(60, 8vh, 100). Resolve once.
            const cardTopPx = Math.min(100, Math.max(60, vh * 0.08));
            // Use visual HEIGHT (not width) so the diagram's TOP
            // edge lands exactly on the card's TOP edge.
            const diagramCenterY = cardTopPx + diagVisualH / 2;

            // --- PHASE A: 0.00 → 0.30 (reveal) ---------------------
            const a = clamp(p / 0.30, 0, 1);
            // clip-path inset shrinks toward 0 as `a` grows
            const insetTop = lerp(14, 0, a);
            const insetSide = lerp(8, 0, a);
            const insetBottom = lerp(22, 0, a);
            bg.style.clipPath = `inset(${insetTop}% ${insetSide}% ${insetBottom}% ${insetSide}% round ${lerp(28, 0, a)}px)`;
            bg.style.opacity = String(lerp(0.65, 1, a));

            // Title & diagram fade in over Phase A.
            const titleFadeIn = clamp((p - 0.08) / 0.22, 0, 1);
            title.style.opacity = String(titleFadeIn);
            title.style.transform = `translate(-50%, ${lerp(20, 0, titleFadeIn)}px)`;

            // --- PHASE B: 0.30 → 0.45 (transition) ----------------
            // Title fades out, image dims, diagram tweens to top-left,
            // and PILLAR 1 fades in — all timed to complete together
            // at p=0.45 so the diagram "lands" at the exact moment
            // the first card is fully visible.
            const b = clamp((p - 0.30) / 0.15, 0, 1);
            title.style.opacity = String(lerp(titleFadeIn, 0, b));
            bg.style.opacity = String(lerp(1, 0.18, b));

            // Diagram positioning across Phases A → B:
            //   Phase A baseline (b=0): visual center at (vw/2, vh/2 + 22vh)
            //     — horizontally centered, BELOW the title text.
            //   Phase B target  (b=1): visual center at the block layout's
            //     diagramCenterX / diagramCenterY — exactly to the LEFT
            //     of the card with the fixed gap between them.
            // Use px (not vw/vh) for translate so the diagram lands at
            // a precise position relative to the card on any viewport.
            const txEndPx = diagramCenterX - vw / 2;
            const tyEndPx = diagramCenterY - vh / 2;
            const tyStartPx = vh * 0.22; // 22vh in px
            const txPx = lerp(0, txEndPx, b);
            const tyPx = lerp(tyStartPx, tyEndPx, b);
            const diagScale = lerp(1, 0.55, b);
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
            const fadeBand = segWidth * 0.3;

            panels.forEach((panel, i) => {
              let panelOpacity = 0;
              if (i === 0) {
                // Pillar 1 fades in during Phase B.
                if (p < 0.30) {
                  panelOpacity = 0;
                } else if (p < phaseC_start) {
                  panelOpacity = (p - 0.30) / 0.15; // matches `b`
                } else {
                  // After Phase B: stay at 1 until pillar 2 starts
                  // fading in, then crossfade out.
                  const segCenter = phaseC_start + segWidth * 0.5;
                  const distFromCenter = Math.abs(p - segCenter);
                  if (distFromCenter < segWidth * 0.5 - fadeBand * 0.5) {
                    panelOpacity = 1;
                  } else if (distFromCenter < segWidth * 0.5 + fadeBand * 0.5) {
                    const t = (segWidth * 0.5 + fadeBand * 0.5 - distFromCenter) / fadeBand;
                    panelOpacity = clamp(t, 0, 1);
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
                  panelOpacity = clamp(t, 0, 1);
                }
              }
              panel.style.opacity = String(panelOpacity);

              // === Place card at the computed block-layout position ===
              // left + width are JS-set so the card always sits next
              // to the diagram with the fixed gap. We override the
              // CSS fallback positioning.
              panel.style.left = `${cardLeftPx}px`;
              panel.style.width = `${cardW}px`;

              // === Card "emerges from diagram" effect ============
              // transform-origin = diagram's CURRENT visual center,
              // expressed in the card's own local coordinate system
              // (relative to its top-left). Scale ramps with opacity
              // so the card appears to grow OUT OF the diagram on
              // fade-in and shrink BACK INTO it on fade-out.
              const diagCurrentCenterX = vw / 2 + txPx;
              const diagCurrentCenterY = vh / 2 + tyPx;
              const originX = diagCurrentCenterX - cardLeftPx;
              const originY = diagCurrentCenterY - cardTopPx;
              panel.style.transformOrigin = `${originX}px ${originY}px`;

              // Scale starts at 0.15 (visible emergence, not literal 0)
              const cardScale = lerp(0.15, 1, panelOpacity);
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
