# CLAUDE.md — Project Instructions for Claude Code

## What This Project Is
A home page redesign for perfectpoolscleaning.com. Read `SPEC.md` for the full brief
including all content, design direction, SEO requirements, and deployment steps.

## Workflow
1. **Research**: Browse competitor sites listed in SPEC.md for design inspiration
2. **Build**: Create the page in `src/home.html` — preview locally in browser
3. **Iterate**: Refine design based on feedback
4. **Deploy**: Push to WordPress via MCP tools when approved

## Key Rules
- Read SPEC.md before doing anything
- All content must match SPEC.md exactly (typos are already fixed there)
- Use Tailwind CSS via CDN — no build tools
- Vanilla HTML/CSS only — no JS frameworks
- Mobile-first responsive design
- The WordPress MCP connector is `claudeus-wp-mcp` (site alias: `default_test`)

## MCP Tools Available
WordPress REST API tools are available under `claudeus-wp-mcp`:
- Pages: create, update, delete
- Media: list, upload
- Menus: full CRUD
- Astra theme: settings, custom layouts, custom CSS
- Plugins: list, activate, deactivate
- Site settings: update

## File Structure
```
SPEC.md          — Master brief (READ THIS FIRST)
CLAUDE.md        — You're reading it
src/home.html    — The page being built
assets/images/   — Local image staging if needed
```
