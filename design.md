# Perfect Pools — Design System

> Extracted from `global.css`. Single source of truth for all design decisions.

---

## 1. Color Palette

### Brand Colors
| Token | Hex | Name | Usage |
|---|---|---|---|
| `--color-primary` | `#1E3A5F` | Primary Navy | Headers, nav, primary buttons, links |
| `--color-primary-dark` | `#0B1320` | Deep Slate | Hover states, footer bg, darkest text |
| `--color-primary-light` | `#e0f2fe` | Light Blue | Subtle backgrounds |
| `--color-deep-blue` | `#145BB8` | Deep Blue | Secondary brand accent |
| `--color-cyan` | `#06b6d4` | Cyan | Gradient endpoints, icon accents |

### Accent / CTA
| Token | Hex | Name | Usage |
|---|---|---|---|
| `--color-orange` | `#E28D33` | Accent Amber | Primary CTA buttons |
| `--color-orange-hover` | `#d47e28` | Amber Hover | CTA hover state |
| `--color-cta` | `#E28D33` | CTA Amber | Alias of orange (buttons) |
| `--color-gold` | `#F59E0B` | Sun-Warmed Gold | Highlights, star ratings |

### Neutrals
| Token | Hex | Name |
|---|---|---|
| `--color-white` | `#ffffff` | Pure White |
| `--color-gray-50` | `#F9F6F0` | Warm Sand (bg-alt) |
| `--color-gray-100` | `#f3f0ea` | Light Sand |
| `--color-gray-200` | `#e5e7eb` | Border Gray |
| `--color-gray-300` | `#d1d5db` | Muted Border |
| `--color-gray-400` | `#8BA1B5` | Sea Mist Gray |
| `--color-gray-500` | `#6b7280` | Mid Gray |
| `--color-gray-600` | `#4b5563` | Dark Gray |
| `--color-gray-700` | `#374151` | Charcoal |
| `--color-gray-800` | `#1f2937` | Near Black |
| `--color-gray-900` | `#0B1320` | Deep Slate |

### Semantic
| Token | Hex | Usage |
|---|---|---|
| `--color-text` | `#2C3E50` | Body text |
| `--color-text-light` | `#5a6c7d` | Paragraph text, descriptions |
| `--color-text-muted` | `#8BA1B5` | Labels, captions, meta text |
| `--color-bg` | `#ffffff` | Page background |
| `--color-bg-alt` | `#F9F6F0` | Alternating section background |
| `--color-border` | `#e5e7eb` | Default borders |
| `--color-warning` | `#d97706` | Warning states |
| `--color-success` | `#059669` | Success states, accent buttons |

### Duplicate / Alias Tokens (cleanup candidates)
- `--color-dark-blue` = `--color-primary` (both `#1E3A5F`)
- `--color-light-bg` = `--color-gray-50` = `--color-bg-alt` (all `#F9F6F0`)
- `--color-cta` = `--color-orange` (both `#E28D33`)
- `--color-gray-900` = `--color-primary-dark` (both `#0B1320`)

---

## 2. Typography

### Font Family
| Token | Value |
|---|---|
| `--font-heading` | `'Plus Jakarta Sans', system-ui, sans-serif` |
| `--font-body` | `'Plus Jakarta Sans', system-ui, sans-serif` |

> Single typeface for both headings and body. Weight differentiation only.

### Font Size Scale
| Token | Value | px equiv |
|---|---|---|
| `--text-xs` | `0.75rem` | 12px |
| `--text-sm` | `0.875rem` | 14px |
| `--text-base` | `1rem` | 16px |
| `--text-lg` | `1.125rem` | 18px |
| `--text-xl` | `1.25rem` | 20px |
| `--text-2xl` | `1.5rem` | 24px |
| `--text-3xl` | `1.875rem` | 30px |
| `--text-4xl` | `2.25rem` | 36px |
| `--text-5xl` | `3rem` | 48px |

### Heading Styles (clamp-based responsive)
| Element | Size Range | Weight | Line Height | Letter Spacing |
|---|---|---|---|---|
| `h1` | `clamp(2.25rem, 5vw, 4rem)` (36–64px) | 800 | 1.1 | -0.02em |
| `h2` | `clamp(1.75rem, 4vw, 3rem)` (28–48px) | 700 | 1.2 | — |
| `h3` | `clamp(1.25rem, 2vw, 1.5rem)` (20–24px) | 700 | 1.4 | — |
| `h4` | `var(--text-lg)` (18px) | 600 | — | — |
| `p` | `1.125rem` (18px) | 400 | 1.6 | — |

### Font Weights Used
- **800** — h1 only (Extra Bold)
- **700** — h2, h3 (Bold)
- **600** — h4, buttons, labels (Semi Bold)
- **400** — body text (Regular)

---

## 3. Spacing Scale

| Token | Value | px equiv |
|---|---|---|
| `--space-1` | `0.25rem` | 4px |
| `--space-2` | `0.5rem` | 8px |
| `--space-3` | `0.75rem` | 12px |
| `--space-4` | `1rem` | 16px |
| `--space-5` | `1.25rem` | 20px |
| `--space-6` | `1.5rem` | 24px |
| `--space-8` | `2rem` | 32px |
| `--space-10` | `2.5rem` | 40px |
| `--space-12` | `3rem` | 48px |
| `--space-16` | `4rem` | 64px |
| `--space-20` | `5rem` | 80px |
| `--space-24` | `6rem` | 96px |

> Missing: `--space-7`, `--space-9`, `--space-11`, `--space-13`–`--space-15`, `--space-17`–`--space-19`, `--space-21`–`--space-23`. Intentional jumps at the upper end.

### Section Spacing
- `.section` padding: `var(--space-20)` (80px) mobile → `7.5rem` (120px) desktop

---

## 4. Layout

| Token | Value | Usage |
|---|---|---|
| `--container-max` | `1280px` | Main content width |
| `--container-narrow` | `800px` | Narrow content (blog, text) |
| `--container-padding` | `1.25rem` → `2rem` → `2.5rem` | Responsive padding (mobile → tablet → desktop) |
| `--header-height` | `64px` | Sticky header |
| `--topbar-height` | `40px` | Top utility bar |

### Breakpoints (inconsistent — cleanup candidate)
| Value | Occurrences | Usage |
|---|---|---|
| `400px` | 2 | Small mobile adjustments |
| `480px` | 3 | Mobile form/card stacking |
| `520px` | 1 | One-off card layout |
| `640px` | 2 | Small tablet |
| `768px` | 18 | **Primary tablet breakpoint** |
| `900px` | 7 | Section/hero adjustments |
| `1024px` | 4 | Desktop grid columns |
| `1100px` | 5 | Wide desktop tweaks |

> Recommended consolidation: **480px** (mobile), **768px** (tablet), **1024px** (desktop), **1280px** (wide).

### Grid System
- `.grid--2`: 1col → 2col @ 768px
- `.grid--3`: 1col → 2col @ 768px → 3col @ 1024px
- `.grid--4`: 1col → 2col @ 768px → 4col @ 1024px
- Default gap: `var(--space-6)` (24px)

---

## 5. Borders & Shadows

### Border Radius
| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | `12px` | Small elements, inputs |
| `--radius-md` | `16px` | Medium cards, modals |
| `--radius-lg` | `24px` | Large cards, feature blocks |
| `--radius-full` | `99px` | Pill buttons, tags |

### Box Shadows
| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 4px 12px rgba(30,58,95, 0.04)` | Subtle elevation (inputs, small cards) |
| `--shadow-md` | `0 10px 40px rgba(30,58,95, 0.08)` | Default card elevation |
| `--shadow-lg` | `0 20px 60px rgba(30,58,95, 0.12)` | Hover / lifted state |

> All shadows use navy-tinted rgba, not pure black. This is intentional — keeps shadows warm.

---

## 6. Buttons

### Base
- Padding: `0.75rem 1.5rem`
- Font: `var(--text-base)` / weight 600
- Border: `2px solid transparent`
- Radius: `var(--radius-full)` (pill)
- Transition: `all var(--transition-fast)`

### Variants
| Class | Background | Text | Border | Hover |
|---|---|---|---|---|
| `.btn--primary` | Navy | White | — | Deep Slate bg |
| `.btn--cta` | Amber gradient (135deg) | White | none | Lift -1px + stronger shadow |
| `.btn--outline` | Transparent | Navy | Navy | Fill navy, white text |
| `.btn--outline-white` | Transparent | White | White | Fill white, navy text |
| `.btn--white` | White | Navy | White | Gray-100 bg |
| `.btn--accent` | Success green | White | — | Darker green `#047857` |

### Sizes
- `.btn--sm`: `0.5rem 1.25rem`, `var(--text-sm)`
- `.btn--lg`: `1rem 2rem`, `var(--text-lg)`

---

## 7. Transitions & Animation

### Transition Tokens
| Token | Value | Usage |
|---|---|---|
| `--transition-fast` | `150ms ease` | Hover color, button state, small UI |
| `--transition-base` | `250ms ease` | Card transforms, accordion, larger movement |
| `--transition-slow` | `400ms ease` | Large reveals, section transitions |

### Hardcoded Transitions (cleanup candidates)
Many components use raw durations instead of tokens:
- `0.1s` — button active press
- `0.15s` — form focus, link hover, toggles
- `0.2s` — card hover, icon transforms
- `0.25s` — overlays, fade-in, reveal
- `0.3s` — navigation, slide transforms
- `0.4s` — larger transforms
- `0.5s` — progress bars, large reveals

> Recommendation: Map to 3 tokens — `--transition-fast` (150ms), `--transition-base` (250ms), `--transition-slow` (400ms).

### Keyframe Animations
| Name | Duration | Usage |
|---|---|---|
| `chem-shimmer` | `1.5s ease-in-out infinite` | Loading skeleton shimmer |
| `gs-fade-in` | `0.25s ease` | Get Started form fade-in |
| `intake-slide-down` | `0.25s ease-out` | Intake form slide down |
| `acc-reveal` | `0.25s ease forwards` | Accordion content reveal |

---

## 8. Gradients

### Primary Patterns
| Pattern | Usage |
|---|---|
| `linear-gradient(135deg, navy → cyan)` | Feature icons, badges, decorative elements |
| `linear-gradient(135deg, dark-blue → navy)` | Dark sections, hero overlays |
| `linear-gradient(135deg, amber → amber-hover)` | CTA buttons |
| `linear-gradient(135deg, navy → #0369a1)` | Form headers |
| `linear-gradient(180deg, #f0f9ff → white → #f0f9ff)` | Soft blue section backgrounds |

### Status Bar Gradients (hardcoded)
- Blue: `#93c5fd → #60a5fa`
- Green: `#86efac → #22c55e`
- Yellow: `#fcd34d → #f59e0b`
- Orange: `#fdba74 → #ea580c`

---

## 9. Component Patterns

### Cards
- Background: white
- Radius: `--radius-lg` (24px)
- Shadow: `--shadow-md`
- Hover: translateY(-2px) + `--shadow-lg`
- Image aspect ratio: `16 / 10`
- Body padding: `var(--space-6)`

### Sections
- Vertical padding: 80px mobile / 120px desktop
- Alternating bg: white ↔ Warm Sand (`#F9F6F0`)

### Forms
- Input padding: ~`0.75rem 1rem`
- Border: 1px solid `--color-border`
- Radius: `--radius-sm` (12px)
- Focus: blue ring / border-color change

---

## 10. Motion & Scroll Architecture

### Smooth Scroll Layer — Lenis
Global smooth scroll via [Lenis](https://github.com/darkroomengineering/lenis). Initialized once in `BaseLayout.astro`, synced to GSAP's ticker for a single unified RAF loop.

| Setting | Value | Notes |
|---|---|---|
| `duration` | `1.2` | Smoothness factor (higher = smoother) |
| `touchMultiplier` | `2` | Mobile touch sensitivity |
| Sync | `lenis.on('scroll', ScrollTrigger.update)` | Feeds smoothed position to ScrollTrigger |
| Drive | `gsap.ticker.add(time => lenis.raf(time * 1000))` | One RAF loop for both |
| API | `window.__lenis` | `.stop()` / `.start()` for modals |

> CSS `scroll-behavior: smooth` is removed — Lenis handles all scroll smoothing.

### Motion Tokens (CSS Custom Properties)
| Token | Value | Usage |
|---|---|---|
| `--ease-smooth` | `cubic-bezier(0.25, 0.1, 0.25, 1)` | Standard eased motion |
| `--ease-snap` | `cubic-bezier(0.16, 1, 0.3, 1)` | Quick snap-in, slow settle |
| `--ease-dramatic` | `cubic-bezier(0.33, 0, 0.2, 1)` | Hero reveals, large transforms |
| `--scrub-tight` | `0.3` | Responsive scroll-linked feel |
| `--scrub-default` | `0.5` | Standard scrub smoothing |
| `--scrub-loose` | `0.8` | Cinematic, lagging motion |
| `--duration-reveal` | `0.5` | Card/element enter duration |
| `--duration-hold` | `1` | Hold at full visibility |
| `--duration-dismiss` | `0.4` | Card/element exit duration |

> GSAP uses string easing names (`'power2.out'`), not CSS beziers. These tokens document the system and are used for CSS transitions on non-GSAP elements.

### Scroll Card Stack Utility
`src/utils/card-stack-timeline.ts` — `buildCardStackTimeline(gsap, cards, options?)`

Uses **crossfade overlap** — outgoing card exits while incoming card enters simultaneously,
so every pixel of scroll produces visual movement (no dead zones).

Configurable via `CardStackOptions`:
```
enterStyle        — how cards appear: 'fade-up' | 'slide-left' | 'slide-right' | 'scale-fade' | 'slide-up'
exitStyle         — how cards leave: 'fade-out-up' | 'fade-out-left' | 'scale-down' | 'fade-out'
enterEase         — GSAP ease string (default 'power2.out')
exitEase          — GSAP ease string (default 'power1.in')
holdDuration      — time at full visibility before crossfade begins (default 0.6)
crossfadeDuration — length of the overlap zone where exit + enter happen together (default 1)
onCardEnter       — callback(card, index) fired on enter
onCardExit        — callback(card, index) fired on exit
```

### Enter Style Reference
| Style | From Values | Character |
|---|---|---|
| `fade-up` | `opacity: 0, y: 30` | Default, gentle rise |
| `slide-left` | `opacity: 0, x: 60` | Horizontal swap, decisive |
| `slide-right` | `opacity: 0, x: -60` | Reverse horizontal |
| `scale-fade` | `opacity: 0, scale: 0.92` | Zoom-in focus |
| `slide-up` | `opacity: 0, y: 40, scale: 0.98` | Dramatic rise |

### Exit Style Reference
| Style | To Values | Character |
|---|---|---|
| `fade-out-up` | `opacity: 0, y: -20, scale: 0.97` | Default, recedes up |
| `fade-out-left` | `opacity: 0, x: -40` | Slides off left |
| `scale-down` | `opacity: 0, scale: 0.9` | Shrinks away |
| `fade-out` | `opacity: 0` | Simple dissolve |

### Section Animation Profiles
| Section | Component | Enter | Exit | Ease | Scrub | Character |
|---|---|---|---|---|---|---|
| Why We Exist | ProblemScroll | `fade-up` | `fade-out-up` | `power2.out` | 1 | Cinematic, slow |
| What Sets Us Apart | CompareScroll | `slide-left` | `fade-out-left` | `power3.out` | 1 | Sharp, decisive |
| Three Pillars | PillarsScroll | `fade-up` | `fade-out-up` | `power2.out` | 1 | Methodical |
| 45 Min Visit | VisitScroll | `scale-fade` | `fade-out` | `power2.out` | 1 | Technical precision |
| Our Story | TimelineScroll | `slide-up` | `fade-out-up` | `power2.out` | 1 | Historical narrative |

> All sections use `scrub: 1` — the playhead takes 1 second to catch up to scroll position, creating smooth inertial animation.

---

## 11. Issues & Cleanup Opportunities

### Duplicate Tokens
4 pairs of duplicate CSS variables should be consolidated (see Section 1).

### Inconsistent Breakpoints
8 different breakpoint values used across the file. Recommend standardizing to 4: 480 / 768 / 1024 / 1280.

### Hardcoded Transitions
~60+ transition declarations use raw values instead of the 2 defined tokens. Should map to `--transition-fast`, `--transition-base`, and a new `--transition-slow`.

### Hardcoded Colors
Several one-off hex values appear outside the variable system:
- `#047857` (accent hover green)
- `#0369a1` (form gradient blue)
- `#22c55e`, `#16a34a` (greens)
- `#93c5fd`, `#60a5fa`, `#3b82f6` (blues)
- `#fcd34d`, `#fdba74`, `#ea580c` (warm tones)
- `#f0f9ff`, `#eff6ff` (light blue bgs)

> These should either become tokens or be documented as intentional one-offs.

### Missing Token Gaps
- ~~No `--transition-slow` for larger animations (400ms+)~~ **Added**
- No explicit z-index scale
- No defined aspect ratios beyond 16/10
- Spacing scale jumps from 12 to 16 (no 14)
