# GridLock Command — Visual Identity

**Theme name:** Civic Aurora Command — Dusk Edition

**Product:** GridLock Command — Parking Impact Intelligence for Bengaluru Traffic Police

**Document purpose:** Single source of truth for color, layout, motion, and component styling across the React frontend. All new UI work must reference this document before adding colors, effects, or animation patterns.

---

## 1. Theme Vision

Civic Aurora Command — **Dusk Edition** is a **deep-canvas cinematic command theme** — a dark Command Navy / Ink Blue stage lit by aurora blue/cyan glow, with warm ivory/white glass surfaces carrying the actual operational content.

> **Primary canvas rule (Dusk Edition):** Civic Ivory is **not** the whole page background. It is used as a warm **content surface** (cards, panels, tables). The main website canvas should use **Command Navy / Ink Blue gradients with aurora glow layers**. The shell, landing, and hero regions are dark and cinematic; content cards inside them are light for readability.

- **Deep canvas, light content** — The app background is a navy/ink gradient with subtle cyan/blue aurora orbs and a faint map grid. Operational content (KPIs, lists, tables, forms) sits on ivory/white glass cards floating over that dark canvas.
- **Where ivory still leads** — Dense data tables, long forms, and reading-heavy detail panels may use a lighter local surface for legibility. The Command Center map area uses a dark map panel with light side cards.
- **Map-first traffic intelligence** — Layout, motion, and color hierarchy assume Bengaluru geospatial context: hotspots, patrol routes, station boundaries, and ROI signals are the visual spine.
- **Glassmorphism with discipline** — Frosted white and navy glass panels create premium elevation; blur, glow, and transparency are rationed — never on every element at once. Border glow stays at ~10–20% opacity, never loud.
- **Aurora accents, not neon** — Cyan/blue glow signals "live"; amber/red are reserved strictly for enforcement/escalation; route orange is reserved for route motion. No rainbow, no random color.
- **Motion tied to traffic logic** — Animations represent workflow states (route draw, structural escalation, dispatch reveal), not decorative bounce or particle noise.
- **Official but premium** — Typography, spacing, and palette evoke Bengaluru Traffic Police credibility while remaining hackathon-demo memorable.
- **Suitable for BTP / evaluator demo** — Readable KPIs, clear status semantics (STRUCTURAL / RESPONSIVE / SEASONAL), and human-in-the-loop approval cues are always legible on camera and on mobile.

**Core visual metaphor:** A premium Bengaluru traffic command center at dusk — a deep command-blue stage glowing with traffic-intelligence signals, where warm ivory glass panels hold the real operational data.

**Canvas depth colors:** Dusk Navy `#06111F` → Command Navy `#08111F` → Ink Blue `#0B1F33`, layered with cyan/blue radial aurora glows and a faint cyan map grid.

**The UI must feel like:**

- Bengaluru Traffic Police command center
- Modern geospatial intelligence product
- Not a SaaS template
- Not neon cyberpunk
- Not plain government form UI

---

## 2. Color Palette

All colors below are canonical. Do not introduce new hex values without updating this document.

### Foundation colors

| Name | Hex | Tailwind token | Usage |
|------|-----|----------------|-------|
| Dusk Navy | `#06111F` | `civic.dusk` | Deepest canvas base; body background floor (Dusk Edition) |
| Civic Ivory | `#F7F2E8` | `civic.ivory` | Warm content surface (cards/panels) — **not** the full page background |
| Mist Blue | `#EAF3F8` | `civic.mist` | Light card wash; soft surface inside dark canvas |
| Command Navy | `#08111F` | `civic.navy` | Main app canvas; shell/hero depth; dark map panels |
| Ink Blue | `#0B1F33` | `civic.ink` | Primary text; headings |
| Slate Graphite | `#475569` | `civic.graphite` | Muted body text; captions; secondary labels |
| Cloud White | `#FFFFFF` | `civic.white` | Cards; elevated surfaces; modal bodies |

### Primary brand colors

| Name | Hex | Tailwind token | Usage |
|------|-----|----------------|-------|
| BTP Command Blue | `#0B3A6F` | `btp.blue` | Primary buttons; active nav; section headers |
| Signal Blue | `#146C94` | `btp.signal` | Links; map route lines; secondary accents |
| Electric Cyan | `#22D3EE` | `btp.cyan` | Responsive hotspots; route pulse; live signal highlights |

### Operational status colors

| Name | Hex | Tailwind token | Usage |
|------|-----|----------------|-------|
| Structural Red | `#D62828` | `status.structural` | Structural hotspot; escalation state; high-risk marker |
| Enforcement Amber | `#F59E0B` | `status.amber` | Warning; patrol attention; pending action |
| Route Orange | `#F97316` | `status.route` | Route path highlight; active patrol motion |
| Seasonal Violet | `#7C3AED` | `status.seasonal` | Seasonal hotspot classification only |
| Cleared Green | `#16A34A` | `status.cleared` | Resolved; cleared; successful enforcement |

### Glow / effect colors

| Name | Value | Tailwind / CSS token | Usage |
|------|-------|----------------------|-------|
| Blue Glow | `rgba(34, 211, 238, 0.35)` | `glow.blue` | Responsive pulse; live route highlight |
| Amber Glow | `rgba(245, 158, 11, 0.35)` | `glow.amber` | Pending enforcement; attention ring |
| Red Glow | `rgba(214, 40, 40, 0.32)` | `glow.red` | Structural hotspot halo; escalation emphasis |
| Navy Glass | `rgba(8, 17, 31, 0.72)` | `glass.navy` | Hero panels; command-depth overlays |
| White Glass | `rgba(255, 255, 255, 0.72)` | `glass.white` | Standard dashboard cards |

---

## 3. Color Usage Rules

### Background usage

- **Default app canvas:** Civic Ivory (`#F7F2E8`) with optional subtle map-grid texture at ≤4% opacity.
- **Section washes:** Mist Blue (`#EAF3F8`) gradients — e.g. `linear-gradient(180deg, civic.ivory 0%, civic.mist 100%)`.
- **Command Navy:** Reserved for hero bands, map overlay chrome, and cinematic landing sections — max ~30% of any operational screen viewport.

### Card usage

- **Standard data cards:** Cloud White or White Glass on ivory/mist background.
- **Emphasis cards:** Navy Glass with white/cyan text for hero KPI strips or map-adjacent panels.
- **Never** stack more than two glass layers in the same visual cluster.

### Sidebar usage

- Background: White Glass or Cloud White with `border-subtle` (ink blue at 12% opacity).
- Active item: `btp.blue` at 8–12% tint fill; text/icon `btp.blue`.
- Inactive: `civic.graphite` text; hover `civic.mist` fill.

### Topbar usage

- Background: White Glass, sticky, light bottom border.
- Product title: `civic.ink`.
- API / mode chips: semantic status backgrounds (green tint = connected, amber = mock/fallback, red = offline).

### CTA usage

- **Primary:** BTP Command Blue background, white text.
- **Secondary:** Cloud White background, `btp.blue` border and text.
- **Danger / escalation confirm:** Structural Red — only for irreversible or high-risk actions.
- **Ghost:** Transparent; `civic.graphite` text.

### Status badge usage

| Status | Background | Text / border | Icon |
|--------|------------|---------------|------|
| STRUCTURAL | `#D62828` at 10% | `status.structural` | Alert / shield |
| RESPONSIVE | `#22D3EE` at 10% | `btp.cyan` | Pulse / radar |
| SEASONAL | `#7C3AED` at 10% | `status.seasonal` | Calendar |
| PENDING | `#F59E0B` at 10% | `status.amber` | Clock |
| APPROVED | `#146C94` at 10% | `btp.signal` | Check |
| DISPATCHED | `#22D3EE` at 10% | `btp.cyan` | Send |
| RECURRENCE | `#7C3AED` at 10% | `status.seasonal` | Repeat |
| CLEARED | `#16A34A` at 10% | `status.cleared` | Check circle |

Always pair color with a text label. Never rely on color alone.

### Map marker usage

- **Structural:** Structural Red fill; optional Red Glow ring at high ROI.
- **Responsive:** Electric Cyan fill; Blue Glow on selection.
- **Seasonal:** Seasonal Violet fill; no red/cyan confusion.
- **Selected hotspot:** 2px white ring + classification glow.
- **Station boundary:** Signal Blue dashed line at 40% opacity.

### Chart color usage

- Primary series: BTP Command Blue.
- Comparison / secondary series: Signal Blue or Slate Graphite.
- Structural counts: Structural Red (bars or segments only — not chart background).
- Responsive counts: Electric Cyan.
- Seasonal counts: Seasonal Violet.
- Grid lines: ink blue at 8% opacity.
- Chart backgrounds: transparent or Cloud White — never Command Navy for standard dashboard charts.

### Route line usage

- Default route: Signal Blue (`#146C94`), 2–3px stroke.
- Active / animating route: Route Orange (`#F97316`) with Blue Glow shadow.
- Completed leg: fade to 50% opacity Signal Blue.

### PDF / escalation usage

- Escalation cards: white glass with Structural Red left accent bar (4px).
- PDF brief links: `btp.signal` text; document icon in `civic.ink`.
- Escalation-ready badge: Structural Red + "ESCALATION READY" label.

### Hard rules

- Do not use random colors outside this palette.
- Red only for structural / escalation — not for generic form errors (use amber + message for validation).
- Amber for attention / pending enforcement.
- Cyan / blue for responsive intelligence / live route signals.
- Violet only for seasonal classification.
- Green only for resolved / cleared.
- Navy for depth and official command feel — not to make the full app dark.

---

## 4. Light-Hybrid Layout System

### Layer stack (bottom to top)

1. **Canvas** — Civic Ivory + optional map-grid texture.
2. **Section wash** — Mist Blue gradient bands between major modules.
3. **Content cards** — Frosted white (`glass.white`) with soft shadow.
4. **Command panels** — Navy Glass for map chrome, hero KPI rail, or landing feature bands.
5. **Signal layer** — Glow accents on hotspots, routes, and live status only.

### Landing vs operational

| Context | Background | Cards | Navy usage | Motion |
|---------|------------|-------|------------|--------|
| Landing / Mission Brief | Ivory → mist gradient; cinematic navy hero band | White glass + one navy glass hero panel | High — City Pulse Hero | Stagger reveal, pulse nodes |
| Command Center | Ivory canvas; mist map section | White glass KPI + map placeholder | Medium — map chrome only | Metric stagger, soft page enter |
| Module dashboards | Ivory; mist section headers | White glass; minimal navy | Low | Tab fade, card hover lift |
| Mobile field views | Ivory | Solid white cards preferred over heavy blur | None | Minimal; readability first |

**Principle:** Landing can be more cinematic. Operational dashboards stay readable and officer-friendly — no full-screen navy, no heavy glow on data tables.

### Spacing rhythm

- Page padding: `1.5rem` mobile → `2rem` desktop.
- Card padding: `1.25rem` standard, `1.5rem` hero metrics.
- Section gap: `1.5rem` between card rows, `2.5rem` between major sections.
- Max content width: `80rem` (`max-w-7xl`).

---

## 5. Glassmorphism Rules

### White glass card (default)

```css
.glass-white {
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(11, 31, 51, 0.08);
  border-radius: 1rem;
  box-shadow: 0 8px 32px rgba(11, 58, 111, 0.08);
}
```

**Tailwind guidance:** `bg-glass-white backdrop-blur-xl border border-civic-ink/10 rounded-2xl shadow-glass`

### Navy glass card (command / hero)

```css
.glass-navy {
  background: rgba(8, 17, 31, 0.72);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(34, 211, 238, 0.15);
  border-radius: 1rem;
  box-shadow: 0 12px 40px rgba(8, 17, 31, 0.25);
  color: #FFFFFF;
}
```

### Border colors

- White glass: `civic.ink` at 8–12% opacity.
- Navy glass: `btp.cyan` at 12–18% opacity (subtle aurora edge).
- Glow border (selected / live): 1px solid classification color at 40% + matching `glow.*` box-shadow.

### Blur intensity

- Standard cards: `blur(16px)` / `backdrop-blur-xl`.
- Hero / map overlay: `blur(20px)` / `backdrop-blur-2xl`.
- **Never** exceed `blur(24px)` — readability drops on low-end hardware.

### Shadow style

- Soft elevation: `0 4px 20px rgba(11, 58, 111, 0.06)` — `shadow-soft`
- Glass panel: `0 8px 32px rgba(11, 58, 111, 0.08)` — `shadow-glass`
- Command depth: `0 12px 40px rgba(8, 17, 31, 0.20)` — `shadow-command`

### When to use glow border

- Selected map hotspot.
- Active patrol route segment.
- Live API / agent-running indicator.
- Escalation-ready cluster highlight.

### When NOT to use glass

- Dense data tables (use solid Cloud White).
- Mobile officer forms (solid cards; reduce blur for performance).
- Long-scroll lists (>10 items) — solid backgrounds prevent visual fatigue.
- Print / PDF export views.

---

## 6. Typography

### Font stack

- **Primary:** `Inter`, fallback `Segoe UI`, `system-ui`, sans-serif.
- **Optional display upgrade (landing hero only):** `Plus Jakarta Sans` for H1 — load only on landing route to limit bundle weight.

### Scale

| Role | Size | Weight | Tracking | Color |
|------|------|--------|----------|-------|
| Hero heading | `2.25–3rem` | 700 | `-0.02em` | `civic.ink` on ivory; white on navy |
| Section heading | `1.25–1.5rem` | 600 | `-0.01em` | `civic.ink` |
| Card title | `0.875–1rem` | 600 | normal | `civic.ink` |
| Body | `0.875rem` | 400 | normal | `civic.graphite` |
| Eyebrow / label | `0.6875rem` | 600 | `0.08em` uppercase | `btp.blue` at 70% |
| Metric number | `1.75–2.25rem` | 600–700 | normal | tone per KPI; `tabular-nums` |
| Operational table | `0.8125rem` | 400–500 | normal | `civic.ink` / `civic.graphite` |

### Rules

- Headings: bold, slightly tight tracking — authoritative, not shouty.
- Body: minimum `14px` (`0.875rem`) on desktop; `13px` floor on mobile only for captions.
- Numeric KPIs: always `font-variant-numeric: tabular-nums` for aligned dashboards.
- Do not use all-caps except eyebrows, status chips, and map legend labels.

---

## 7. Motion Language

**Engine:** Framer Motion  
**Easing default:** `easeOut` for enter; `easeInOut` for loops; spring `{ stiffness: 400, damping: 25 }` for buttons.

### Global durations

- Page transition: `250ms`
- Card stagger item: `60ms` delay increment, `300ms` duration
- Hover lift: `150ms`
- Route draw: `800–1200ms` (tied to stop count)
- Status morph: `400ms`

### Motion catalog

| Motion | Trigger | Behavior | Meaning |
|--------|---------|----------|---------|
| Page enter | Route change | Fade + `y: 8 → 0` | New operational context |
| Stagger reveal | Dashboard load | Children fade up sequentially | KPI priority order |
| Hover lift | Button / card | `y: -1` or `scale: 1.01` | Affordance |
| Route draw | Route planner | SVG path `pathLength 0 → 1` | M10 patrol sequence |
| Feedback → structural morph | Recurrence event | Badge color amber → red; label change | Enforcement failed → structural watch |
| Dispatch reveal | Notification preview | Slide down + fade | Plan dispatched to field |
| PDF slide-in | Escalation brief | `x: 24 → 0` + opacity | Official document arrival |
| Demo stepper | Demo mode | Step card border glow + scale pulse | Guided workflow progress |

### Prohibited motion

- Random bouncing logos.
- Continuous parallax on data tables.
- Particle fields unrelated to map/hotspot data.
- Spinners on every card simultaneously.
- Animation duration > `1.5s` for UI chrome (except hero loop).

**Rule:** Every animation must represent workflow or spatial intelligence.

---

## 8. Signature Visual Effects

Build phase-wise. Reference this section before implementing each effect.

### 1. City Pulse Hero

- **Where:** Landing `/` Mission Brief.
- **Visual:** Abstract Bengaluru traffic network — nodes at cluster centroids, edges as patrol corridors.
- **Motion:** Slow pulse on structural nodes (red glow); cyan ripple on responsive nodes; orange beam along primary route.
- **Tech:** Three.js / R3F (Phase 2) — keep fallback static SVG for reduced motion.
- **Colors:** Navy Glass panel; nodes use status palette; background ivory with grid.

### 2. Command Map Glow

- **Where:** Command Center, Hotspot Intelligence map tab.
- **Visual:** ROI-sized markers; classification fill; selected state glow ring.
- **Motion:** Selected marker scale `1 → 1.15` with classification glow.
- **Tech:** MapLibre GL layers (Phase 2+).

### 3. Route Reveal

- **Where:** Patrol Operations route planner.
- **Visual:** Signal Blue base path; Route Orange active segment.
- **Motion:** Path draws in stop order; stop pins appear with `80ms` stagger.
- **Meaning:** M10 VRP optimized sequence.

### 4. Feedback Structural Boost

- **Where:** Feedback & Escalation module.
- **Visual:** Flow chip: "Enforced but recurred" → badge morphs to **STRUCTURAL WATCH**.
- **Motion:** Amber glow → Red Glow pulse (2 cycles, then steady).
- **Meaning:** Officer feedback loop increases structural score.

### 5. Escalation Brief Reveal

- **Where:** Feedback & Escalation → Escalation Briefs tab.
- **Visual:** PDF card with official header strip (`btp.blue`), document thumbnail, BBMP/BTP agency tag.
- **Motion:** Slide-in from right `300ms`; subtle paper shadow.

### 6. Week 1 vs Week 2 Impact Motion

- **Where:** Impact & Evidence module.
- **Visual:** Side-by-side metric counters; trend line chart.
- **Motion:** Count-up `600ms`; line draw `800ms`.
- **Required:** Synthetic disclaimer banner always visible — violet-tint glass, never hidden.

---

## 9. Component Theme Mapping

| Component | Background | Text | Border / accent | Motion |
|-----------|------------|------|-----------------|--------|
| **Sidebar** | White glass | Graphite / ink active | `btp.blue` active fill | Nav item hover scale 1.02 |
| **Topbar** | White glass sticky | Ink title | Bottom `ink/10` | Chip entrance fade |
| **GlassCard** | `glass.white` default | Ink title, graphite body | `ink/8` | Optional hover shadow-soft |
| **MetricCard** | White glass | Tone-colored value | None | Stagger reveal on load |
| **StatusBadge** | Status at 10% tint | Status solid | Status at 20% ring | Morph on status change |
| **CommandButton** | `btp.blue` primary | White | Secondary: `btp.blue` border | Hover lift `y: -1` |
| **ModuleTabs** | Transparent | Graphite inactive; white on active tab | Active: `btp.blue` fill | Tab content fade `200ms` |
| **Map markers** | Classification fill | White label on navy tooltip | Glow on select | Pulse if live route |
| **Route cards** | White glass | Ink | Left accent `status.route` | RouteReveal inside |
| **Approval cards** | White glass | Ink | Amber border if pending | Stepper fill animation |
| **Notification preview** | White glass | Ink subject, graphite meta | `btp.cyan` left bar if dispatched | Dispatch slide reveal |
| **Mobile officer preview** | Device frame navy chrome | Ink on white inner | `btp.blue` header strip | Minimal |
| **Escalation cards** | White glass | Ink | Structural Red left bar | PDF slide-in child |
| **Report cards** | White glass | Ink | `btp.signal` icon | Stagger on grid |

---

## 10. Accessibility and Readability

### Contrast

- Body text on ivory: minimum **4.5:1** (`civic.ink` on `#F7F2E8` passes).
- White text on `btp.blue` and `civic.navy`: minimum **4.5:1**.
- Status badge text: use solid status color on 10% tint background — verify per badge.
- Cyan (`#22D3EE`) on white: use only for large text, icons, or charts — not small body copy.

### Keyboard focus

- All interactive elements: `focus-visible:ring-2 ring-btp.blue/40 ring-offset-2 ring-offset-civic.ivory`.
- Skip link to main content on landing and dashboard shells.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- City Pulse Hero → static network image.
- Route draw → instant full path.
- Count-up metrics → show final value immediately.

### Visual overlays

- No text directly on map or hero visuals without scrim: minimum `rgba(8, 17, 31, 0.55)` overlay or navy glass panel behind text.

### Mobile readability

- Touch targets minimum `44px`.
- Single-column card stack; no horizontal scroll tables — convert to stacked rows.

### Status accessibility

- Always show text label + icon + color (e.g. `STRUCTURAL` + alert icon + red tint).
- Tooltips repeat classification and ROI for map markers.

---

## 11. Responsive Design Rules

### Desktop (≥1024px)

- Fixed sidebar `16rem` width + topbar + scrollable main.
- KPI grid: 4–5 columns.
- Map + side panel: 2/3 + 1/3 split.

### Tablet (768–1023px)

- Collapsible sidebar (icon-only or overlay).
- KPI grid: 2 columns.
- Module tabs wrap; map full width below KPIs.

### Mobile (<768px)

- Topbar + hamburger → slide-out sidebar overlay with scrim.
- KPI grid: 1–2 columns.
- Cards full width; no side-by-side map panels.
- Officer / tow previews: full-width device frame.

### Sidebar collapse

- Tablet: toggle to `5rem` icon rail.
- Mobile: off-canvas; close on route change.

### Card stacking

- Always vertical stack on mobile; `gap-4` minimum.

### Hero stacking

- Landing: headline → hero visual → KPI strip → CTAs (never side-by-side hero + copy on mobile).

### Map / table fallback

- If map unavailable: show ivory card with cluster count summary table.
- Tables >4 columns: horizontal scroll only as last resort; prefer card list on mobile.

---

## 12. Do / Don’t List

### Do

- Use traffic-linked motion (route draw, hotspot pulse, structural escalation).
- Keep BTP credibility — official copy, disciplined palette.
- Keep dashboards readable — solid cards for dense data.
- Use Command Navy for depth and official command feel in heroes and map chrome.
- Use amber / red / cyan meaningfully per classification and workflow state.
- Document any palette extension in this file first.

### Don’t

- Plain white admin panel with zero warmth or depth.
- Random neon AI look (purple gradients everywhere, "AI Insights" chrome).
- Full dark cyberpunk shell.
- Overuse glass blur on tables and forms.
- Too many colors on one screen — max 3 semantic colors visible per viewport region.
- Meaningless particle effects.
- Tiny unreadable charts (< `12px` labels).
- Cluttered sidebar — keep 6–7 primary modules only.
- Introduce colors not listed in Section 2 without updating this document.

---

## 13. Implementation Notes for Tailwind

### Suggested `tailwind.config.js` extension

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        civic: {
          ivory: '#F7F2E8',
          mist: '#EAF3F8',
          navy: '#08111F',
          ink: '#0B1F33',
          graphite: '#475569',
          white: '#FFFFFF',
        },
        btp: {
          blue: '#0B3A6F',
          signal: '#146C94',
          cyan: '#22D3EE',
        },
        status: {
          structural: '#D62828',
          amber: '#F59E0B',
          route: '#F97316',
          seasonal: '#7C3AED',
          cleared: '#16A34A',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.72)',
          navy: 'rgba(8, 17, 31, 0.72)',
        },
        glow: {
          blue: 'rgba(34, 211, 238, 0.35)',
          amber: 'rgba(245, 158, 11, 0.35)',
          red: 'rgba(214, 40, 40, 0.32)',
        },
      },
      boxShadow: {
        soft: '0 4px 20px rgba(11, 58, 111, 0.06)',
        glass: '0 8px 32px rgba(11, 58, 111, 0.08)',
        command: '0 12px 40px rgba(8, 17, 31, 0.20)',
        'glow-cyan': '0 0 24px rgba(34, 211, 238, 0.35)',
        'glow-amber': '0 0 24px rgba(245, 158, 11, 0.35)',
        'glow-red': '0 0 24px rgba(214, 40, 40, 0.32)',
      },
      backgroundImage: {
        'civic-gradient': 'linear-gradient(180deg, #F7F2E8 0%, #EAF3F8 100%)',
        'command-gradient': 'linear-gradient(135deg, #08111F 0%, #0B3A6F 100%)',
        'grid-map': `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%230B3A6F' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4z'/%3E%3C/g%3E%3C/svg%3E")`,
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```

### Suggested utility classes (`src/index.css`)

```css
@layer components {
  .glass-white {
    @apply rounded-2xl border border-civic-ink/10 bg-glass-white shadow-glass backdrop-blur-xl;
  }
  .glass-navy {
    @apply rounded-2xl border border-btp-cyan/15 bg-glass-navy text-civic-white shadow-command backdrop-blur-2xl;
  }
  .bg-app {
    @apply bg-civic-ivory bg-grid-map;
  }
  .focus-ring-command {
    @apply outline-none ring-offset-2 ring-offset-civic-ivory focus-visible:ring-2 focus-visible:ring-btp-blue/40;
  }
}
```

### Migration note

The current Phase 0/1 frontend uses an earlier palette (`#f4f6f9`, `#1a4b8c`). When implementing Civic Aurora Command, update `tailwind.config.js` and `index.css` to match this document in a dedicated theme migration pass — do not mix old and new tokens on the same screen.

---

## 14. Phase Usage

How Civic Aurora Command rolls out across frontend phases:

| Phase | Scope | Theme application |
|-------|--------|-------------------|
| **Phase 2** | Landing page + City Pulse Hero | Full cinematic treatment: ivory canvas, navy hero band, City Pulse effect, stagger KPI reveal, mission copy typography |
| **Phase 3** | Command Center | Operational light-hybrid: white glass KPI row, map glow placeholder → MapLibre, navy map chrome only, metric stagger |
| **Phase 4** | Hotspot Intelligence | Classification colors on board/map; ROI chart uses palette strictly; tab fade between Priority / Map / Detail |
| **Phase 5** | Patrol Operations | Route Orange reveal animation; master plan amber pending states; dispatch cyan accents |
| **Phase 6** | Feedback & Escalation | Structural boost morph; recurrence amber → red; officer mobile solid cards; escalation red accent bars |
| **Phase 7** | Impact & Evidence | Week comparison count-up; synthetic disclaimer violet glass; validation credibility cards on ivory |
| **Phase 8** | Demo Mode | Stepper progression glow; cross-module links; consistent chips and motion from this document |

---

## 15. Multi-theme Support

GridLock Command supports **two visual modes** via a navbar toggle: **Aurora Command — Dusk** (dark, default) and **Bengaluru Daylight** (light). Evaluators switch with one click; the choice persists across refresh.

### Default and storage

| Property | Value |
|----------|--------|
| Default theme | `bengaluru-daylight` (Bengaluru Daylight) |
| Alternate theme | `aurora-dusk` (Aurora Command — Dusk) |
| Persistence | `localStorage` key `gridlock-command-theme` |
| DOM attribute | `document.documentElement[data-theme="<id>"]` |
| Mode flag | `document.documentElement[data-theme-mode="dark" \| "light"]` |
| UI control | Moon/Sun toggle in `ThemeSelector` (Topbar + landing header) |

Theme is bootstrapped in `main.tsx` before React render to reduce flash-of-wrong-theme. Legacy stored ids (`mint-command`, `arctic-slate`, `periwinkle-ops`) normalize to `bengaluru-daylight`.

### Theme registry

Defined in `frontend/src/theme/themes.ts` and applied via CSS variables in `frontend/src/theme/theme-variables.css`.

| ID | Display name | Mode | Character |
|----|--------------|------|-----------|
| `aurora-dusk` | Aurora Command — Dusk | Dark | Default cinematic command navy + cyan aurora (unchanged baseline) |
| `bengaluru-daylight` | Bengaluru Daylight | Light | Warm paper canvas, indigo primary, teal secondary, terracotta accent |

### Canonical palette table (theme tokens)

Each theme sets the following CSS variables (do not hardcode hex in components):

| Variable | Purpose |
|----------|---------|
| `--color-bg` | Page / canvas base |
| `--color-bg-muted` | Muted canvas wash |
| `--color-surface` | Elevated card surface |
| `--color-surface-glass` | Glass panel fill |
| `--color-primary` | Primary brand / buttons |
| `--color-secondary` | Secondary brand / links |
| `--color-accent` | Live signal / eyebrow / glow accent |
| `--color-critical` | Structural / escalation |
| `--color-text` | Primary readable text |
| `--color-text-muted` | Secondary text |
| `--color-border` | Default borders |
| `--color-glow` | Aurora / focus glow |

Legacy Tailwind tokens (`civic.*`, `btp.*`, `status.*`) map to these variables in `tailwind.config.js` so existing utility classes theme-switch automatically.

### Per-theme palette values

**Aurora Command — Dusk (default)**

| Token | Hex |
|-------|-----|
| bg | `#06111F` |
| primary | `#0B3A6F` |
| secondary | `#146C94` |
| accent | `#22D3EE` |
| warning | `#F59E0B` |
| critical | `#D62828` |
| surface | `#FFFFFF` (glass `rgba(255,255,255,0.72)`) |
| text | `#FFFFFF` / `#EAF3F8` on dark sections |

**Bengaluru Daylight**

| Token | Hex |
|-------|-----|
| bg | `#FBF7F0` |
| primary | `#2D3A66` |
| secondary | `#3D4F7C` |
| accent | `#C2410C` |
| critical | `#C0392B` |
| surface | `#FFFFFF` |
| muted surface | `#F3EBDD` |
| text primary | `#172033` |
| text secondary | `#5B6475` |

### Implementation rules

1. **New colors** must be added to `frontend/src/theme/themes.ts` (swatches), `frontend/src/theme/theme-variables.css` (variables), and this section before merge.
2. **Do not** introduce ad-hoc hex in page components; use Tailwind tokens backed by CSS variables or shared classes in `index.css` (`.glass-white`, `.text-shell`, `.bg-app`, etc.).
3. **Operational semantics** stay fixed across themes: structural red, amber warning, route orange, seasonal violet, cleared green — only luminance/saturation may shift slightly per theme.
4. **Light themes** use `[data-theme-mode="light"]` overrides so navy operational panels and `text-civic-white` remain readable (mapped to dark text on light surfaces). Primary buttons keep `.text-on-primary` (white) for contrast.
5. **Theme toggle** lives in `Topbar` (dashboard shell) and landing header (`ThemeSelector`). Moon = Dusk, Sun = Daylight; `role="switch"` with descriptive `aria-label`. Keyboard focusable.

### Files

| File | Role |
|------|------|
| `frontend/src/theme/themes.ts` | Theme registry (id, name, swatches, isDark) |
| `frontend/src/theme/ThemeProvider.tsx` | Context, localStorage, `useTheme()` |
| `frontend/src/theme/theme-variables.css` | Per-theme CSS variable blocks |
| `frontend/src/components/layout/ThemeSelector.tsx` | Navbar moon/sun toggle UI |
| `frontend/tailwind.config.js` | Maps Tailwind color tokens → CSS variables |

---

## Document control

- **Version:** 1.0  
- **Created for:** GridLock Command React frontend  
- **Authority:** This file supersedes ad-hoc color choices in code comments and scratch notes.  
- **Changes:** Any new color, shadow, or motion pattern requires an update to this document before merge.
