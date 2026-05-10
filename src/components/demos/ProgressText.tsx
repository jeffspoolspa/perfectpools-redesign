/**
 * ProgressText — word-by-word scroll-linked reveal
 *
 * Adapted from `darkroomengineering/satus` →
 *   `components/effects/progress-text/index.tsx` (lines 73–126)
 *   `components/effects/progress-text/progress-text.module.css`
 *
 * The Satus implementation uses `useScrollTrigger` from `hamo`. We don't
 * have hamo in our stack, so this version uses GSAP ScrollTrigger
 * directly with the same exact behavior:
 *
 *   - Each word starts at `opacity: 0.33` (stale)
 *   - As the section scrolls through a defined range (default: top→bottom of
 *     section through the viewport center), words light up to `opacity: 1`
 *     (fresh) sequentially.
 *   - The transition is `600ms opacity ease-out` per word.
 *   - Words light up when scroll progress > i / total_words.
 *
 * Result: the paragraph "fills in" as the reader scrolls past it,
 * focusing attention on each word as it lights up. Linear, Stripe,
 * Vercel, Apple all use this exact technique.
 */

import { useEffect, useRef } from 'preact/hooks';

interface ProgressTextProps {
  /** Pass the paragraph text as a string prop. Children slot also works,
   *  but `text` is more reliable when crossing Astro's island boundary. */
  text?: string;
  children?: any;
  /** GSAP ScrollTrigger start (default: 'top bottom') — when section top
   *  hits viewport bottom, progress = 0 */
  start?: string;
  /** GSAP ScrollTrigger end (default: 'bottom center') — when section
   *  bottom hits viewport center, progress = 1 */
  end?: string;
  /** Per-word transition duration */
  transitionDuration?: string;
  /** Resting (un-lit) opacity */
  restOpacity?: number;
  className?: string;
  as?: 'p' | 'h2' | 'h3' | 'div' | 'span';
}

/**
 * Walk Preact VNode tree (or strings/arrays) and produce a flat string.
 * Mirrors the recursive extraction in Satus's `extractWords`, simplified
 * for the common case (no per-word style overrides).
 */
function extractText(node: any): string {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractText).join('');
  if (typeof node === 'object' && node.props && 'children' in node.props) {
    return extractText(node.props.children);
  }
  return '';
}

export default function ProgressText({
  text,
  children,
  start = 'top bottom',
  end = 'bottom center',
  transitionDuration = '600ms',
  restOpacity = 0.25,
  className,
  as: Tag = 'p',
}: ProgressTextProps) {
  const rootRef = useRef<HTMLElement>(null);
  const wordsRef = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !rootRef.current) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      // Reduced motion: just show all words at full opacity, no scroll-driven reveal
      wordsRef.current.forEach((node) => {
        node.style.opacity = '1';
      });
      return;
    }

    let st: any;
    let cleanup = () => {};

    Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(
      ([{ gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        st = ScrollTrigger.create({
          trigger: rootRef.current!,
          start,
          end,
          scrub: 0,
          onUpdate: (self: any) => {
            const total = wordsRef.current.length;
            const progress = self.progress;
            wordsRef.current.forEach((node, i) => {
              const lit = progress > i / total;
              node.style.opacity = lit ? '1' : String(restOpacity);
            });
          },
        });
        cleanup = () => st.kill();
      },
    );

    return () => cleanup();
  }, [children, start, end, restOpacity]);

  // Resolve the actual text from either the `text` prop or children.
  // Mirrors Satus's `extractWords` recursive walker.
  const fullText = text ?? extractText(children);
  const words = fullText.split(/\s+/).filter(Boolean);

  return (
    // @ts-expect-error — Preact's typing for ref + dynamic Tag is loose
    <Tag
      ref={rootRef}
      class={className}
      style={{
        '--transition-dur': transitionDuration,
      } as any}
    >
      {words.map((word, i) => (
        <span
          key={`${word}-${i}`}
          class="prog-word"
          ref={(node: HTMLSpanElement | null) => {
            if (node) wordsRef.current[i] = node;
          }}
          style={{
            display: 'inline-block',
            opacity: restOpacity,
            transition: `opacity ${transitionDuration} ease-out`,
          }}
        >
          {word}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}
