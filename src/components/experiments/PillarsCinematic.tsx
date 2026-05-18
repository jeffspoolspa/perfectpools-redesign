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
import PillarsTriangle from '../PillarsTriangle';
import PillarsTriangleHeaders from './PillarsTriangleHeaders';
import { assetPath } from '../../utils/base-url';

// Section was 5 viewports long while Phase C cycled through every
// pillar. With Phase C disabled (only sanitation ships for now), the
// section only needs A + B + a short "card visible, exit" tail — so
// we shrink it to 3 viewports total to avoid wasted scroll.
const SCROLL_VH = 3;
// Phase boundaries rescaled to match the original A/B durations
// inside the new SCROLL_VH window:
//   A: 0  → 0.50  (1.5vh of scroll — same as before)
//   B: 0.50 → 0.75 (0.75vh — same as before)
//   Tail (card visible, exit): 0.75 → 1.0
const PHASE_A_END = 0.5;
const PHASE_B_END = 0.75;
const BG_IMAGE = assetPath('/images/hero-pool.png');

/**
 * Modes the embedded card cycles through during Phase C. Order
 * matches scroll progress — sanitation gets the first half of the
 * deep-dive window, balance the second half. Filtration and flow
 * will be added once their card states exist.
 */
type CardMode = 'sanitation' | 'balance';

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
  // Ref to the embedded card so we can measure its header triangle
  // slot at runtime — the diagram's Phase B landing target is that
  // slot's center, computed in pin-local coordinates.
  const cardRef = useRef<HTMLDivElement>(null);

  /** Card mode + which triangle slice is "live" both come from
   *  scroll progress during Phase C. */
  const [mode, setMode] = useState<CardMode>('sanitation');
  const lastModeRef = useRef<CardMode>('sanitation');
  /** Continuous 0..1 crossfade value passed into the embedded card.
   *  Drives a CSS variable so the changing elements (HOCl ↔ LSI,
   *  bullets+CTA ↔ status cards) ramp opacity + max-height with
   *  scroll instead of snapping at the mode-flip threshold. */
  const [balanceAmount, setBalanceAmount] = useState(0);
  const lastBalanceRef = useRef(0);

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
        const cardWrap = cardRef.current!;

        // Extract onUpdate body so we can call it once at mount with
        // progress=0 — without that, the diagram (CSS opacity 0) only
        // becomes visible the moment ScrollTrigger fires its first
        // update, which is AFTER the user has already scrolled into
        // the section's pin range. By prepainting Phase A's start
        // state, the diagram appears at the bottom of the photo as
        // soon as the section enters the viewport.
        const runUpdate = (p: number) => {

            // === Pin-local viewport dimensions ===
            // All positions below are in pin-local coords (relative
            // to pin.getBoundingClientRect()) so the math works the
            // same whether this mounts on /our-approach or inside a
            // sandbox container.
            const pinR = pin.getBoundingClientRect();
            const vw = pinR.width;
            const vh = pinR.height;
            const diagBaseW = diagram.offsetWidth || 410;

            // --- PHASE A: 0 → PHASE_A_END (reveal) ---------------
            const a = clamp(p / PHASE_A_END, 0, 1);
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
            // Title fade-in occupies the back ~73% of Phase A — same
            // proportional window as the original (0.08–0.30 of a
            // 0.30-long phase).
            const titleFadeIn = clamp(
              (p - PHASE_A_END * 0.27) / (PHASE_A_END * 0.73),
              0,
              1,
            );
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

            // --- PHASE B: PHASE_A_END → PHASE_B_END (transition) -
            // Title fades out, image dims, diagram tweens to top-left,
            // and PILLAR 1 fades in — all timed to complete together
            // at p=PHASE_B_END so the diagram "lands" at the exact
            // moment the first card is fully visible. After this
            // the section just holds the card for a short tail and
            // unpins (Phase C is no longer used — only sanitation
            // ships for now).
            const b = clamp(
              (p - PHASE_A_END) / (PHASE_B_END - PHASE_A_END),
              0,
              1,
            );
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

            // === Diagram landing target ===
            // Measure the (visibility:hidden) in-card header triangle
            // slot. Its center IS the diagram's Phase B destination —
            // by the end of Phase B the cinematic's overlay diagram
            // overlaps the card's header slot pixel-perfect, so it
            // visually becomes the card's pillar icon.
            let landingCenterX = vw / 2;
            let landingCenterY = vh / 2;
            let landingScale = 0.14;
            const slot = cardWrap.querySelector(
              '.pth-pillar-head__triangle',
            ) as HTMLElement | null;
            if (slot) {
              const sR = slot.getBoundingClientRect();
              landingCenterX = sR.left + sR.width / 2 - pinR.left;
              landingCenterY = sR.top + sR.height / 2 - pinR.top;
              if (sR.width > 0) {
                landingScale = Math.max(0.08, sR.width / diagBaseW);
              }
            }

            // Diagram tween: Phase A end → Phase B end.
            //   start (b=0): visual center at phaseA_diagCenterY
            //   end   (b=1): visual center at landingCenterX/Y, scaled
            //                down to fit the header slot.
            const txEndPx = landingCenterX - vw / 2;
            const tyEndPx = landingCenterY - vh / 2;
            const tyStartPx = phaseA_diagCenterY - vh / 2;
            const txPx = lerp(0, txEndPx, b);
            const tyPx = lerp(tyStartPx, tyEndPx, b);
            const diagScale = lerp(1, landingScale, b);
            diagram.style.transform =
              `translate(calc(-50% + ${txPx}px), calc(-50% + ${tyPx}px)) scale(${diagScale})`;
            // Fade the diagram in once it has its computed transform.
            // CSS keeps it at opacity 0 until this point so it doesn't
            // flash at viewport-center (the CSS top:50%/translate
            // default) before snapping down to the photo's bottom.
            diagram.style.opacity = '1';

            // === Card fade-in + scale-emerge from triangle ===
            // The card's opacity ramps with Phase B so the diagram
            // lands at the exact moment the card is fully visible.
            // transform-origin tracks the diagram's CURRENT center so
            // the card visually grows OUT of the triangle.
            // IMPORTANT: the base CSS transform is translate(-50%, -50%)
            // for centering — we must KEEP that and append the scale,
            // otherwise the card anchors from its top-left and shoots
            // off the right side of the viewport.
            const cardOpacity = easeInOutCubic(b);
            const cardScale = lerp(0.92, 1, b);
            cardWrap.style.opacity = String(cardOpacity);
            const cardR = cardWrap.getBoundingClientRect();
            const originX = landingCenterX + pinR.left - cardR.left;
            const originY = landingCenterY + pinR.top - cardR.top;
            cardWrap.style.transformOrigin = `${originX}px ${originY}px`;
            cardWrap.style.transform = `translate(-50%, -50%) scale(${cardScale})`;
            cardWrap.style.pointerEvents = cardOpacity > 0.7 ? 'auto' : 'none';

            // === Phase C disabled ===
            // The balance pillar isn't shipping yet — we only show
            // sanitation. Pin balanceAmount to 0 so the card stays
            // in sanitation mode for the entire pin, and after
            // Phase B ends (PHASE_B_END) the user just scrolls
            // through the short tail to unpin the section.
            const nextBalance = 0;
            if (Math.abs(nextBalance - lastBalanceRef.current) > 0.01) {
              lastBalanceRef.current = nextBalance;
              setBalanceAmount(nextBalance);
            }
            const nextMode: CardMode = 'sanitation';
            if (nextMode !== lastModeRef.current) {
              lastModeRef.current = nextMode;
              setMode(nextMode);
            }
        };

        const st = ScrollTrigger.create({
          trigger: sectionRef.current!,
          start: 'top top',
          end: 'bottom bottom',
          pin: pinRef.current!,
          pinSpacing: false,
          scrub: 0.6,
          onUpdate: (self: any) => runUpdate(self.progress),
        });

        // Prepaint the Phase A start state so the diagram (CSS
        // opacity 0) is in its bottom-of-photo position before the
        // user reaches the trigger range. Without this the diagram
        // pops in only after the first scroll event inside the pin,
        // making it disappear during the section's reveal.
        runUpdate(0);

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

        {/* === Layer 3: triangle diagram (center → into card header) ===
            During Phase A it sits centered over the pool image. During
            Phase B it tweens to the embedded card's hidden header
            triangle slot, ending up pixel-perfect over the spot the
            card reserved for it. Active slice tracks the card's mode. */}
        <div ref={diagramRef} class="pc-diagram">
          <PillarsTriangle active={mode} />
        </div>

        {/* === Layer 4: embedded card (Phase B fade-in + Phase C modes) ===
            One PillarsTriangleHeaders mount that flips between
            sanitation and balance based on scroll progress. The
            card's in-header triangle slot is visibility:hidden so the
            Phase B-landed overlay diagram becomes the visual pillar
            icon. */}
        <div ref={cardRef} class="pc-card-wrap">
          <PillarsTriangleHeaders
            embedded
            mode={mode}
            balanceAmount={balanceAmount}
          />
        </div>
      </div>
    </div>
  );
}
