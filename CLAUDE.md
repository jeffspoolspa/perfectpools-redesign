# CLAUDE.md — Project Instructions for Claude Code

## What This Project Is
Full website rebuild for perfectpoolscleaning.com — migrating from WordPress/Elementor to a clean static Astro site deployed on Vercel.

## Tech Stack
- **Framework:** Astro (static output)
- **Interactive components:** Preact (calculator tools only)
- **CSS:** Custom CSS with CSS variables (NO Tailwind/Bootstrap)
- **Deployment:** Vercel (static)
- **Integrations:** @astrojs/sitemap, @astrojs/preact

## Workflow
1. **Phase 1 (Done):** Project scaffolding — Astro setup, all pages created with structure, images downloaded, components built
2. **Phase 2 (Current):** Design pages together — fill in real content, style each page, iterate on design
3. **Phase 3:** Deploy to Vercel

## Key Rules
- Custom CSS only — NO Tailwind, Bootstrap, or CSS frameworks
- Minimal dependencies — only what's in package.json
- Mobile-first responsive design
- Every page needs: unique meta title/description, JSON-LD schema, OG tags, canonical URL
- Service pages need 800-1200 words of real SEO content each
- All images from `/images/` (no external WordPress URLs)
- No JS on pages that don't need interactivity (Astro outputs pure HTML)

## Commands
- `npm run dev` — Start dev server (port 4321)
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build

## File Structure
```
src/
  layouts/BaseLayout.astro      — Shared HTML shell, head, header, footer
  components/
    Header.astro                — Nav with mobile menu & services dropdown
    Footer.astro                — Contact info, links, copyright
    ServiceCard.astro           — Reusable card for service grids
    TestimonialCarousel.astro   — Review carousel
    FAQ.astro                   — Accordion with FAQPage schema support
    CTASection.astro            — Reusable call-to-action block
    tools/
      PoolVolumeCalculator.tsx  — Preact interactive calculator
      ChemicalDosageCalculator.tsx — Preact interactive calculator
  pages/
    index.astro                 — Homepage
    services/                   — Services overview + 6 individual service pages
    about.astro                 — About page
    contact.astro               — Contact with form + map
    blog/index.astro            — Blog listing (empty state for now)
    tools/                      — Tools landing + 2 calculator pages
    privacy.astro               — Privacy policy
    terms.astro                 — Terms & conditions
  content/blog/                 — Empty, ready for .md blog posts
  styles/global.css             — Single global stylesheet with CSS vars
public/
  images/                       — All static images
  robots.txt
  favicon.ico
astro.config.mjs
vercel.json                     — Redirects + security headers
```

## Business Info
- **Company:** Perfect Pools
- **Location:** 8989 Ford Ave, Richmond Hill, GA 31324
- **Phone:** (912) 459-0160
- **Hours:** Mon–Fri 8:00 AM – 5:00 PM
- **Quote Form:** https://forms.jeffspoolspa.com/jeffspoolspaservice1/form/MaintenanceLeads/formperma/sZ_cHMy_F4pf-JTi8aCRtmGr78z4LJNGBj_w8_dtEIc
- **Google Reviews:** https://g.page/r/CVrU0W_3-NRyEAE/review
