## Phase 1 — Foundation: precision-industrial design system

Lock the visual language across tokens, type, shell, tables, forms and primitives. Every inner page picks this up for free. After Phase 1 lands, you'll have the new aesthetic on the shell + every table/form/button across the app, and we move to Phase 2 (dashboard) and Phase 3 (page-by-page refinement).

### Locked decisions

- **Accent:** Electric indigo `#6366F1` (Linear-grade vibrancy on near-black). One color, used surgically. Overrides the brief's "no purple" since you asked for vibrant purple/blue.
- **Type:** Geist (UI) + Geist Mono (numbers/data), loaded from Google Fonts.
- **Themes:** Both dark and light, both redesigned to the same precision standard. Dark is the hero.
- **Sequence:** Foundation now → Dashboard next → inner pages after.

### 1. Token rewrite (`src/index.css`, `tailwind.config.ts`)

Replace the existing teal/violet/sage palette and the glassmorphism tokens. All values in HSL.

**Dark (hero):**
```
--background: 240 6% 5%       /* #0A0A0B */
--surface:    240 4% 9%       /* #141416 */
--surface-2:  240 4% 12%      /* hover/raised */
--foreground: 40 25% 93%      /* #F0EEE8 warm off-white */
--muted-foreground: 36 4% 47% /* #7A7873 */
--tertiary-foreground: 30 3% 24% /* #3D3C3A */
--border:    0 0% 100% / 0.07 /* hairline */
--border-strong: 0 0% 100% / 0.12
--accent:    239 84% 67%      /* #6366F1 indigo */
--accent-foreground: 0 0% 100%
--success: 150 33% 36%        /* #3D7A5F muted */
--warning: 36 50% 36%         /* #8A6A2E muted */
--danger:  0 38% 34%          /* #7A3535 muted */
--info:    210 40% 30%        /* #2E4A6B muted */
--radius: 6px
```

**Light variant:** inverted neutrals, same accent, same muted status colors. Paper `#F7F6F2`, surface `#FFFFFF`, text `#15151A`, borders `rgba(0,0,0,0.08)`. Same restraint — no shadows, hairline borders only.

Remove from index.css: glass-card, mesh-gradient, gradient-border, glow utilities, all the `--pharma-*` and `--medical-*` legacy tokens. They contradict the new direction.

Add utilities: `.mono`, `.tabular`, `.label-micro` (11px / 600 / 0.1em / uppercase), `.data` (Geist Mono / tabular-nums), `.hairline` (1px border-border), `.row-hover` (rgba 0.03 hover).

### 2. Typography (`index.css` + `tailwind.config.ts`)

- Swap the `@import` line to Geist + Geist Mono (Google Fonts URL).
- `body { font-family: 'Geist', ui-sans-serif; }`
- Add `font-mono: ['Geist Mono', 'ui-monospace']` in tailwind config.
- Headings:
  - `h1` 36px / weight 300 / -0.02em tracking
  - `h2` 20px / weight 500
  - `h3` 15px / weight 500
- Body 13-14px / weight 400. Tables 13px Geist Mono with `tabular-nums`.
- All `<th>` get `.label-micro` styling globally.

### 3. Shell — sidebar + top bar

**`src/components/AppSidebar.tsx`**
- Width 220px expanded / 60px collapsed (rail). Currently uses shadcn sidebar — keep the primitive but restyle.
- Background `--surface`, no gradients. Hairline right border.
- Group labels rendered with `.label-micro` (`INVENTORY`, `FINANCE`, `REPORTS`, `SETTINGS`).
- Icons: switch all sidebar icons to `strokeWidth={1.25}` Lucide, monochrome `--muted-foreground`.
- Active route: 2px left border in `--accent` + `bg-white/[0.04]`. No pill, no rounded highlight.
- Bottom: avatar + role + cog icon. Remove any colorful badges.

**`src/components/AppLayout.tsx`**
- Top bar 48px, borderless, blends into page.
- Left: page title (h1 light-weight, 32px). Right: CMD+K trigger (placeholder "Search or jump to…"), bell, help, avatar — all monochrome icons, no labels.
- Content max-width 1280px, 32px side padding, page header row title-left / actions-right.

### 4. Primitive overhaul (shadcn components — restyle, don't replace)

Files in `src/components/ui/`:

- **`button.tsx`** — radius 4px max, no shadows. Variants: `default` (accent bg, white fg), `secondary` (white/8 bg, foreground), `ghost` (transparent → white/5 hover), `outline` (hairline border). All 150ms ease-out transitions.
- **`input.tsx`, `textarea.tsx`, `select.tsx`** — 36px height, `bg-white/[0.04]`, `border-white/[0.12]`, focus border `--accent` (no glow). Currency-prefix variant for amount fields (used in Payments, Invoices, Expenses).
- **`table.tsx`** — row height 44px, `<th>` auto `.label-micro` color `--muted-foreground`, dividers `border-white/[0.04]`, hover `bg-white/[0.03]`, selected `bg-accent/12 + 1px left accent`. Number columns auto-detect via `text-right` → apply mono + tabular-nums.
- **`badge.tsx`** — flatten to muted pills, 10px, no shadow. Status variants pull from new muted status tokens.
- **`dialog.tsx`** — kept for confirmations only. Add new `Drawer` variant that slides from right (use existing sheet primitive) for detail views.
- **`card.tsx`** — `bg-surface`, 6px radius, hairline border, no shadow.
- **`PaginationControls.tsx`** — replace with "Previous / 1 2 3 … 24 / Next". Drop per-page selector.

### 5. New primitives

- **`src/components/ui/data-table.tsx`** — opinionated wrapper around table with built-in skeleton shimmer, empty state slot, bulk-action bar that slides up from bottom when rows are selected (uses Motion). Replaces the ad-hoc `<Table>` in every page.
- **`src/components/ui/metric-card.tsx`** — for dashboard: monospaced number that counts up on mount (Motion), trend pill, inline sparkline (Recharts `<Line>` 40px tall, accent stroke).
- **`src/components/ui/skeleton-row.tsx`** — dark shimmer for table loading.
- **`src/components/ui/status-pill.tsx`** — single source of truth for status badges (VALID / EXPIRING / EXPIRED / DRAFT / PAID / VOIDED / …).
- **`src/components/ui/empty-state.tsx`** — centered, thin icon, 2 lines, single action. Replaces all the current empty states.

### 6. Pharma trust signals (one pass across product tables)

- Date formatter helper `formatDateDDMMMYYYY(d)` in `src/lib/utils.ts`. Wire into every expiry/batch column.
- Batch number rendering helper that wraps in Geist Mono + expiry pill (uses `expiry_date` from `grn_items` / batch joins).
- Product name renderer: small `⊗` icon if `is_controlled`, thermometer icon if `temperature_sensitive` (add columns later if absent — out of scope for Phase 1).

### 7. Cleanup

- Remove old design utilities still referenced anywhere: `glass-card`, `glass-kpi`, `summary-card`, `mesh-gradient`, `gradient-border`, `search-pill`, `status-pill` (old version), `stagger-children` if it depends on the removed mesh. Replace usages with new tokens via search-replace.
- Drop `Sora` + `Manrope` from Google Fonts import.

### Files touched in Phase 1

```
src/index.css                              (full rewrite of tokens + utilities)
tailwind.config.ts                         (font families, color tokens)
src/components/AppLayout.tsx               (top bar)
src/components/AppSidebar.tsx              (full restyle)
src/components/ThemeToggle.tsx             (keep — still toggles dark/light)
src/components/ui/{button,input,textarea,select,table,badge,dialog,card,sheet}.tsx
src/components/ui/data-table.tsx           (new)
src/components/ui/metric-card.tsx          (new)
src/components/ui/skeleton-row.tsx         (new)
src/components/ui/status-pill.tsx          (new)
src/components/ui/empty-state.tsx          (new)
src/components/PaginationControls.tsx      (simplified)
src/lib/utils.ts                           (date helper, batch helper)
mem://style/theme  +  mem://style/typography  +  mem://style/ui-patterns  (rewrite)
```

### Out of scope for Phase 1

- Per-page refactors (Dashboard, Products, Invoices, Reports, etc.) — those land in Phase 2/3 and pick up the new system for free via tokens + primitives.
- New DB columns (`is_controlled`, `temperature_sensitive`) — Phase 3 if you want those badges to be data-driven.
- Invoice PDF redesign — Phase 3 (touches `pdf-generator.ts` + `document-templates`).
- Command palette UX rebuild — already exists, will pick up new tokens; deeper Raycast-style polish is Phase 3.
- Removing per-page bespoke styling that contradicts the new system (e.g. existing mesh gradients on Dashboard) — done in Phase 2.

### After Phase 1

You'll see: new sidebar + top bar, new tables/forms/buttons/badges everywhere, new typography, new color system in both themes. Inner pages will look 70% there immediately. We then sequence Phase 2 (Dashboard rebuilt as a Bloomberg-style terminal) and Phase 3 (per-page sweep: Products, Sales hub, Purchase hub, Finance, Reports, Settings, Auth, PDF templates).

Tell me to proceed and I'll execute Phase 1 in one pass.