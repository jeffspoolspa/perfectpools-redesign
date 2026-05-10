# Scroll animations & transitions — patterns for this codebase

A working reference for building scroll-driven UI on this site. Captures
the patterns, gotchas, and architectural decisions accumulated while
shipping `/our-approach`'s pinned hero, story split, and pillars
sections. Read this before adding any new scroll-driven section.

---

## 1. Stack: Lenis + GSAP ScrollTrigger

The page uses **Lenis** for smooth scroll and **GSAP ScrollTrigger** for
pinning + scroll-driven progress. They're wired together in
[`src/layouts/BaseLayout.astro`](../src/layouts/BaseLayout.astro):

```js
const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1.2, anchors: true });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
ScrollTrigger.addEventListener('refresh', () => lenis.resize());
```

**Why this works:** ScrollTrigger doesn't poll scroll — it relies on
events. Calling `ScrollTrigger.update` from Lenis's `scroll` event keeps
them in lockstep.

### Lenis resize trick (critical for dynamic content)

Lenis caches the document's scrollable length. When ScrollTrigger adds a
pin-spacer mid-page-load (or HMR injects new content), Lenis's cached
`limit` goes stale and **`lenis.scrollTo(target)` silently does nothing**
if target is past the cached limit.

The BaseLayout uses a `ResizeObserver` on `document.documentElement` to
call `lenis.resize()` whenever body height changes. In debugging, you
can force the fix manually:

```js
window.__lenis.resize(); // now lenis sees the full document height
window.__lenis.scrollTo(20000, { immediate: true });
```

---

## 2. Pin elements — gotchas

### Pin's containing block is NOT always the viewport

ScrollTrigger pins via `position: fixed`. CSS spec: a fixed element's
containing block is the viewport **unless** an ancestor has `transform`,
`filter`, `perspective`, or `will-change: transform`. ScrollTrigger's
`pin-spacer` wrapper sometimes triggers this — so a pin element's
`width: 100%` resolves to the **pin-spacer's** width, not the viewport.

**Concrete bug from this session:** a pinned section mounted inside a
column-constrained sandbox container (`.sb__exp` at 1041px wide) had its
pin element constrained to 1041px even though `position: fixed`. Inside
the pin, `left: 50%` meant 50% of 1041 (520.5), not 50% of viewport.

**Pattern:** if you need accurate positioning inside a pinned element,
compute it from `pin.getBoundingClientRect()`, not `window.innerWidth`:

```js
const pinR = pin.getBoundingClientRect();
const vw = pinR.width;   // actual pin-local width
const vh = pinR.height;  // actual pin-local height
// All inline left/transform values are in pin-local coords
```

### Pre-pin overflow

Before the pin trigger fires, the pin element sits at its natural
document position. If the section's top hasn't reached viewport top
(e.g., a sticky site header below which it lives), the pin's 100vh
height extends past the visible viewport bottom. Two fixes:

- **Pin earlier** — `start: () => 'top top+=' + heroEl.offsetTop` fires
  the pin at scroll=0 so the user never sees the un-pinned overflow
  state. See [`WhyWeExistHero.astro`](../src/components/WhyWeExistHero.astro).
- **Reserve top/bottom buffers in your content** — if you can't pin
  earlier, make sure your content fits within `(100vh - site_nav_height)`.

### Site header buffer

A sticky site nav at the top of the page covers the top N pixels of
viewport. When ScrollTrigger pins at viewport `top: 0`, the pin's top
section is hidden behind the nav. Reserve a `--site-nav` buffer in CSS
and offset content within the pin to start below it.

The hero auto-detects this:

```js
const heroTopFromDoc = heroEl.getBoundingClientRect().top + window.scrollY;
heroEl.style.setProperty('--ww-site-nav', `${heroTopFromDoc}px`);
```

---

## 3. Scrub timing

`scrub` controls how scroll progress maps to animation progress.

- `scrub: true` — animation snaps directly to scroll, feels mechanical.
- `scrub: 0.4–0.6` — animation lerps toward scroll position with 0.4–0.6
  second lag. Used everywhere in this codebase. Sweet spot for "smooth
  but responsive".
- `scrub: 1+` — much smoother but laggy on fast scrolls; feels
  disconnected.

**Default for new scroll-driven sections:** `scrub: 0.4`.

For "soft handoff" between distinct keyframes (not strict scrubbing), a
GSAP timeline with `ease: 'power2.out'` per tween reads more naturally
than pure scrub.

---

## 4. Multi-phase scroll animations

When a single scroll range needs to drive several distinct visual
phases (e.g., "reveal → transition → cycle through panels"), don't
chain timeline tweens — use a single `onUpdate` with progress
thresholds. Easier to read, easier to tune:

```js
onUpdate: (self) => {
  const p = self.progress;
  // Phase A (0 → 0.30): reveal
  const a = clamp(p / 0.30, 0, 1);
  // Phase B (0.30 → 0.45): transition
  const b = clamp((p - 0.30) / 0.15, 0, 1);
  // Phase C (0.45 → 1.00): deep dive
  const c = clamp((p - 0.45) / 0.55, 0, 1);
  // ... apply transforms based on a, b, c
}
```

Examples:
- [`WhyWeExistHero.astro`](../src/components/WhyWeExistHero.astro) — 2-stage hero swap
- [`PillarsCinematic.tsx`](../src/components/experiments/PillarsCinematic.tsx) — 3-phase pinned cinematic

**Pacing rule for crossfades:** when fading out element X and fading in
element Y over the same window, X should reach opacity 0 a bit BEFORE Y
reaches opacity 1. Otherwise you get a flash of "both visible at full".
Tune by giving X a slightly tighter fade window (e.g., X fades 0.30 → 0.55,
Y fades 0.35 → 0.70).

---

## 5. Crossfade pattern — grid stack vs absolute

When you need N panels visible one-at-a-time with crossfade between
them, two patterns work:

### Grid stack (preferred when panel heights vary)

```css
.stage { display: grid; grid-template-columns: minmax(0, 1fr); }
.panel {
  grid-area: 1 / 1;        /* all panels in the same cell */
  opacity: 0;
  pointer-events: none;
  transition: opacity 1.1s var(--gentle-ease);
}
.panel.is-active {
  opacity: 1;
  pointer-events: auto;
}
```

The grid row auto-sizes to the **tallest panel's content**, so the
stage doesn't reflow when active changes. Used in
[`OurStorySplit.tsx`](../src/components/OurStorySplit.tsx).

### Absolute stack (preferred when you want a fixed stage height)

```css
.stage { position: relative; min-height: 220px; }
.panel { position: absolute; inset: 0; opacity: 0; }
.panel.is-active { opacity: 1; }
```

Stage height is independent of panel content. Use when you want
predictable layout but accept that overlong panels will overflow.

### What DOESN'T work — key-based remount

```jsx
<div key={active.id} class="panel">{active.content}</div>
```

This unmounts the outgoing panel before the incoming one mounts, so
there's no overlap → the animation feels abrupt (snap-fade-in instead
of crossfade). We hit this bug in `OurStorySplit` and switched to grid
stacking.

---

## 6. "Element emerges from X" effect (transform-origin tracking)

To make element B appear to grow/shrink out of element A's position,
two pieces work together:

1. **Scale ramps with opacity** (B is invisible at scale ~0, full
   visible at scale 1):
   ```js
   const scale = lerp(0.15, 1, opacity);
   ```

2. **B's transform-origin tracks A's current center**, expressed in B's
   local coordinate system:
   ```js
   const aCenterX = /* A's current viewport center x */;
   const aCenterY = /* A's current viewport center y */;
   const bLeft = /* B's CSS left in viewport coords */;
   const bTop = /* B's CSS top in viewport coords */;
   panel.style.transformOrigin = `${aCenterX - bLeft}px ${aCenterY - bTop}px`;
   ```

Combined: when scale is small, B collapses *toward* A's position; when
scale is 1, B sits at its full CSS-defined position. Reverse the same
animation on fade-out and B retracts back into A. See
[`PillarsCinematic.tsx`](../src/components/experiments/PillarsCinematic.tsx).

**Important:** `transform-origin` is in element-local coords. Negative
values are valid — they point outside the element's box.

---

## 7. Transform-origin: `center` vs `top left`

For scale-around-point math:

- **`center`** — scale shrinks the element around its visual center.
  Layout center stays put; visual box gets smaller. The `translate`
  values control the **center position** directly. Use when you want
  the element's visual center to track a target.

- **`top left`** — scale shrinks the element toward its top-left
  corner. Layout top-left stays put; visual box collapses toward
  top-left. Use when you want the top-left corner pinned during scale.

Mixing them up burns hours. **In this codebase, default to `center`**
unless you have a specific reason — the math is more intuitive for
typical "this thing should land here when full size" reasoning.

---

## 8. Block layout (computed in JS)

When CSS `calc()` mixing `vw`, `vh`, percent, and px becomes
unreadable, compute layout in JS using `getBoundingClientRect()` of the
relevant containing element, then apply inline styles:

```js
const pinR = pin.getBoundingClientRect();
const vw = pinR.width;  // pin-local
const vh = pinR.height;
const diagW = 225;
const cardW = Math.min(820, vw - 80 - diagW - GAP);
const blockTotal = diagW + GAP + cardW;
const blockLeft = (vw - blockTotal) / 2; // center within pin
panel.style.left = `${blockLeft + diagW + GAP}px`;
panel.style.width = `${cardW}px`;
```

Pros: arithmetic in one place, viewport-responsive, no
calc-with-mixed-units. Cons: re-runs on every scroll frame inside
`onUpdate` (cheap, but not free). Use `requestAnimationFrame` if it
ever shows up in a profile.

---

## 9. Pinned page-load behavior — "viewport stuck on landing"

To make a pinned section engage *immediately* on page load (so the
user can't accidentally scroll past it without seeing the animation):

```js
ScrollTrigger.create({
  trigger: hero,
  start: () => `top top+=${hero.getBoundingClientRect().top + window.scrollY}`,
  end: '+=100%',
  pin: pinInner,
  pinSpacing: true,
  scrub: 0.4,
  onUpdate: ...
});
```

`start` returns a *function* so ScrollTrigger evaluates it at refresh
time. At scroll=0, `hero.getBoundingClientRect().top + scrollY` equals
the hero's natural document offset, so `top top+=offset` resolves to
"section.top reaches viewport.top + offset" = at scrollY 0. Pin
engages on first paint.

---

## 10. Reusable scroll components

- **`CardStackReveal`** ([src/components/CardStackReveal.tsx](../src/components/CardStackReveal.tsx))
  — generic vertical card stack with one expanded card at a time and
  auto-cycle. Accepts `items: CardStackItem[]` and an optional
  `cycleMs`. Not scroll-driven; uses `setInterval` with hover/focus
  pause.

- **Sandbox patterns** ([src/components/experiments/](../src/components/experiments/))
  — confirmed-smooth scroll primitives extracted from the
  `darkroomengineering/satus` and `darkroomengineering/lenis` source.
  Each is a self-contained Preact island. See:
  - `TimelineScrollScrub` — scrub-driven step indicator with `lenis.scrollTo` for goTo
  - `PinnedMediaScroll` — picture-pinned, text-crossfade column
  - `PinnedMediaWheel` — picture-pinned, text scrolls vertically like a wheel
  - `WhyWeExistTwoActs` — static two-stage hero (artifacts + dashboard)
  - `PillarsCinematic` — pinned multi-phase cinematic

---

## 11. Tool component CSS architecture

Tool components (`src/components/tools/*.tsx` — LSI calculator,
SanitationTabs, FiltrationDiagram, HOCl waterfall) are **reusable** —
they may render on any page. Their styles must NOT live in any single
page's scoped `<style>` block.

**Pattern:** all tool styles live in
[`src/styles/pool-tools.css`](../src/styles/pool-tools.css), imported
in [`src/layouts/BaseLayout.astro`](../src/layouts/BaseLayout.astro).
They ship globally and apply on any page that mounts a tool component.

We learned this the hard way: when `PillarsCinematic` was sandboxed in
`/our-approach-v2`, the SanitationTabs UI broke because its styles were
scoped to `/our-approach`'s `<style>` block. Extraction made it portable.

---

## 12. Background removal for partner logos

Source partner logos often arrive as JPGs or PNGs with a solid
background (white or black square around the wordmark). Two ways to
handle:

### Best: transparent PNG

Get a real transparent-background PNG (designer export, remove.bg,
macOS Preview "Instant Alpha"). Set component's `logoBlend: 'normal'`
and you're done.

### Fallback: CSS mix-blend-mode

If only an opaque source is available, choose the blend mode by source
bg:
- White bg → `mix-blend-mode: multiply` (white pixels go transparent over white panel)
- Black bg → `mix-blend-mode: lighten` (black pixels go transparent over white panel)

Both fall apart on a non-white panel; ship transparent PNGs in
production.

### Bulk: Python script for thresholded alpha

For files with near-white backgrounds, threshold-based alpha removal
works fine:

```bash
python3 -c "
from PIL import Image
img = Image.open('logo.png').convert('RGBA')
data = img.getdata()
new_data = [
  (255, 255, 255, 0) if (r >= 235 and g >= 235 and b >= 235) else (r, g, b, a)
  for (r, g, b, a) in data
]
img.putdata(new_data)
img.save('logo.png', 'PNG')
"
```

Tweak the threshold per logo.

---

## 13. Easing tokens

Defined in [`src/styles/fluid.css`](../src/styles/fluid.css):

- `--ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1)` — snappy
  entrance, decisive landing. Default for incoming elements.
- `--ease-in-out` (custom `cubic-bezier(0.45, 0, 0.15, 1)`) — gentle
  both ways. Default for crossfades.
- Built-in `ease`, `linear` — avoid; everything should have intentional
  easing.

For GSAP: `'power2.out'` is the equivalent of `ease-out-expo`,
`'power2.inOut'` mirrors the custom ease-in-out.

---

## 14. Sandbox-first iteration

Risky scroll work (anything that pins or changes layout dynamically)
should be staged in `/our-approach-v2/` first. The sandbox imports the
component without affecting the live page, so iteration is safe.

Pattern:
1. Build experiment component in `src/components/experiments/Foo.tsx`
2. Mount it on `/our-approach-v2.astro` in a labeled "Active
   experiments" block
3. Iterate until visual / scroll feel is right
4. Once approved, mount on the live page (replace the existing
   component or add as a new section)
5. Optionally keep the experiment in `/our-approach-v2` for future
   reference

---

## Quick reference

| Need | Use |
|---|---|
| Smooth scroll | Lenis (already wired in BaseLayout) |
| Pin section while scrolling | ScrollTrigger pin + `scrub: 0.4` |
| Get correct viewport dims inside pin | `pin.getBoundingClientRect()` |
| Force lenis to see new content height | `window.__lenis.resize()` |
| Pin engages on page load | `start: () => 'top top+=' + el.offsetTop` |
| Crossfade between panels | grid stack, `grid-area: 1/1`, opacity toggle |
| Element emerges from another | scale + dynamic `transform-origin` |
| Multi-phase scroll animation | single `onUpdate` with `clamp((p - phaseStart) / phaseRange, 0, 1)` |
| Complex responsive positioning | compute in JS, set inline styles |
| Test risky animation safely | mount in `/our-approach-v2/` first |
