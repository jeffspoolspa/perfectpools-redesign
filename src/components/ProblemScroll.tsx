/**
 * ProblemScroll — "Why We Exist" disconnected → connected hero.
 *
 * 5 system cards begin scattered with red "problem" captions, then drift
 * into a halo arc above and around a pool image as the user scrolls.
 * Dashed connector lines draw outward from the pool, captions flip
 * red→green, and the headline crossfades from "too many handoffs" to
 * "nothing falls through".
 *
 * Final layout (matches design vision):
 *   • Repairs       — top center
 *   • Maintenance   — upper-left of arc
 *   • Communication — upper-right of arc
 *   • Expertise     — far lower-left, beside the pool
 *   • Billing       — far lower-right, beside the pool
 *
 * The animation is purely scroll-scrubbed (scrub: 0.6 for cinematic
 * inertia). State lives in the DOM via direct mutations from applyState —
 * no React state, no re-renders during scroll.
 */

import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { assetPath } from '../utils/base-url';

interface NodeData {
  title: string;
  bad: string;
  good: string;
  icon: ComponentChildren;
}

const NODES: NodeData[] = [
  {
    title: 'Maintenance',
    bad: 'Visits get skipped',
    good: 'On schedule, every week',
    icon: <path d="M3 12h4l2-7 4 14 2-7h6" />,
  },
  {
    title: 'Repairs',
    bad: '"Call someone else"',
    good: 'Pumps, heaters, automation',
    icon: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />,
  },
  {
    title: 'Communication',
    bad: 'Texts go unread',
    good: 'Real humans, fast replies',
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    title: 'Billing',
    bad: 'Surprise charges',
    good: 'Clear, predictable invoices',
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>
    ),
  },
  {
    title: 'Expertise',
    bad: "Cleans, can't diagnose",
    good: '20+ yrs technical depth',
    icon: <path d="M12 2L4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4z" />,
  },
];

const NODE_W = 188;
const NODE_H = 90;

// Canvas (logical px, scaled by CSS) — wider than tall so the arc has room.
const CANVAS_W = 1100;
const CANVAS_H = 680;

// Logo centerpiece. Sits low-center; cards arc above and around it on a
// horizontal-major ellipse (wider than tall), so the side cards extend
// further out than the top card — matches the visual shape the design
// vision calls for.
const HUB_CX = CANVAS_W / 2; // 550
const HUB_CY = 460;
const ARC_RX = 440;
const ARC_RY = 280;

// Cards sit on the ellipse at parameter values 45° apart. With t as the
// ellipse's parametric angle (NOT the real polar angle), cards land at
// t = 0°, 45°, 90°, 135°, 180° — five cards on the upper half of the line.
// Listed in NODES order: Maintenance, Repairs, Communication, Billing, Expertise.
const CARD_ANGLES_DEG = [
  135, // Maintenance — upper-left
  90, // Repairs — top of ellipse
  45, // Communication — upper-right
  0, // Billing — far right (level with logo)
  180, // Expertise — far left (level with logo)
];

const FINAL_CENTERS = CARD_ANGLES_DEG.map((deg) => {
  const t = (deg * Math.PI) / 180;
  return {
    cx: HUB_CX + ARC_RX * Math.cos(t),
    cy: HUB_CY - ARC_RY * Math.sin(t),
  };
});

const FINAL_POSITIONS = FINAL_CENTERS.map(({ cx, cy }) => ({
  x: cx - NODE_W / 2,
  y: cy - NODE_H / 2,
}));

// Scattered start positions (pre-scroll). Cards drift toward FINAL_POSITIONS.
const START_POSITIONS = [
  { x: 230, y: 60, rot: -6, scale: 0.94 }, // Maintenance
  { x: 760, y: 90, rot: 5, scale: 0.95 }, // Repairs
  { x: 870, y: 470, rot: -4, scale: 0.94 }, // Communication
  { x: 180, y: 500, rot: 7, scale: 0.93 }, // Billing
  { x: 50, y: 220, rot: -8, scale: 0.95 }, // Expertise
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function ProblemScroll() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hubRef = useRef<HTMLDivElement>(null);
  const arcRef = useRef<SVGSVGElement>(null);
  const headBadRef = useRef<HTMLDivElement>(null);
  const headGoodRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);

  // Fit the fixed-design canvas into whatever space the stage gives it.
  useEffect(() => {
    if (typeof window === 'undefined' || !stageRef.current || !canvasRef.current) return;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const fit = () => {
      const cs = getComputedStyle(stage);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      const availW = Math.max(0, stage.clientWidth - padX);
      const availH = Math.max(0, stage.clientHeight - padY);
      const scale = Math.min(availW / CANVAS_W, availH / CANVAS_H, 1);
      canvas.style.setProperty('--prb-scale', String(scale));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !scrollRef.current) return;

    const apply = (p: number) => {
      const drift = Math.min(1, p / 0.6);
      const ease =
        drift < 0.5 ? 2 * drift * drift : 1 - Math.pow(-2 * drift + 2, 2) / 2;

      nodeRefs.current.forEach((n, i) => {
        if (!n) return;
        const s = START_POSITIONS[i];
        const f = FINAL_POSITIONS[i];
        n.style.left = `${lerp(s.x, f.x, ease)}px`;
        n.style.top = `${lerp(s.y, f.y, ease)}px`;
        n.style.transform = `rotate(${lerp(s.rot, 0, ease)}deg) scale(${lerp(s.scale, 1, ease)})`;
      });

      const isOn = p > 0.55;
      hubRef.current?.classList.toggle('is-on', isOn);
      arcRef.current?.classList.toggle('is-on', isOn);

      nodeRefs.current.forEach((n, i) => {
        if (!n) return;
        n.classList.toggle('is-good', p > 0.62 + i * 0.04);
      });

      const t = clamp01((p - 0.4) / 0.25);
      if (headBadRef.current) {
        headBadRef.current.style.opacity = String(1 - t);
        headBadRef.current.style.transform = `translateY(${-t * 18}px)`;
      }
      if (headGoodRef.current) {
        headGoodRef.current.style.opacity = String(t);
        headGoodRef.current.style.transform = `translateY(${(1 - t) * 18}px)`;
      }

      if (progressRef.current) progressRef.current.style.width = `${p * 100}%`;
      hintRef.current?.classList.toggle('is-hidden', p > 0.05);
    };

    apply(0);

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      apply(1);
      return;
    }

    let st: any = null;
    let cleanup = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);
        st = ScrollTrigger.create({
          trigger: scrollRef.current!,
          pin: stickyRef.current!,
          // Offset by the *sticky* header height only (not topbar). The
          // topbar isn't sticky — it scrolls away — so including it here
          // would leave a 40px white strip between the header and the dark
          // section once the user scrolls past the topbar.
          start: () =>
            `top top+=${
              parseInt(
                getComputedStyle(document.documentElement).getPropertyValue('--header-height'),
              ) || 64
            }`,
          end: 'bottom bottom',
          pinSpacing: false,
          scrub: 0.6,
          onUpdate: (self: any) => apply(self.progress),
        });
        cleanup = () => st.kill();
      },
    );

    return () => cleanup();
  }, []);

  return (
    <div ref={scrollRef} class="prb">
      <div ref={stickyRef} class="prb__sticky">
        <div ref={progressRef} class="prb__progress" />

        <div class="prb__fg">
          <span class="prb__kicker">WHY WE EXIST</span>
          <div class="prb__headlines">
            <div ref={headBadRef} class="prb__headline prb__headline--bad">
              <h2>
                The pool industry has <em>too many handoffs.</em>
              </h2>
              <p>
                Maintenance, repairs, communication, and billing usually live in different places —
                or fall through the cracks entirely.
              </p>
            </div>
            <div ref={headGoodRef} class="prb__headline prb__headline--good">
              <h2>
                We bring them together so <em>nothing falls through.</em>
              </h2>
              <p>
                One team. One standard. End-to-end accountability for every part of caring for your pool.
              </p>
            </div>
          </div>
        </div>

        <div ref={stageRef} class="prb__stage">
          <div ref={canvasRef} class="prb__canvas">
            {/* Hidden semicircle "shelf" — the cards sit on this elliptical arc.
                Path traces the upper half of an ellipse with rx=ARC_RX, ry=ARC_RY
                centered at (HUB_CX, HUB_CY): from (HUB_CX-ARC_RX, HUB_CY) to
                (HUB_CX+ARC_RX, HUB_CY) sweeping over the top. */}
            <svg
              ref={arcRef}
              class="prb__arc"
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={`M ${HUB_CX - ARC_RX} ${HUB_CY} A ${ARC_RX} ${ARC_RY} 0 0 1 ${HUB_CX + ARC_RX} ${HUB_CY}`}
              />
            </svg>

            <div ref={hubRef} class="prb__hub">
              <img
                class="prb__hub-logo"
                src={assetPath('/images/perfect-pools-logo.png')}
                alt="Perfect Pools"
              />
            </div>

            {NODES.map((node, i) => (
              <div
                key={i}
                ref={(el) => {
                  nodeRefs.current[i] = el;
                }}
                class="prb__node"
              >
                <div class="prb__node-row">
                  <span class="prb__node-icon">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      {node.icon}
                    </svg>
                  </span>
                  <span class="prb__node-title">{node.title}</span>
                </div>
                <div class="prb__node-cap">
                  <span class="prb__node-cap-bad">
                    <span class="prb__node-dot prb__node-dot--bad" />
                    {node.bad}
                  </span>
                  <span class="prb__node-cap-good">
                    <span class="prb__node-dot prb__node-dot--good" />
                    {node.good}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div ref={hintRef} class="prb__hint">
          SCROLL
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      <div class="prb__spacer" />
    </div>
  );
}
