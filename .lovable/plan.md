## Goal
Lift the entire app shell from "generic SaaS" to a **deliberate, premium pharma-ops aesthetic** — Midnight Indigo palette, Sora + Manrope, with consistent depth, motion, and density rules across every surface.

## Direction (locked)
- **Palette**: Midnight Indigo — `#0a0a1a`, `#141432`, `#1e1e5a`, `#4f46e5` (electric indigo accent)
- **Type**: Sora (headings) + Manrope (body & data) — swap DM Sans → Manrope
- **Mood**: deep, quiet, confident. Indigo accents do the talking; surfaces stay calm.

## Scope (full app shell)
Auth → Sidebar → Top header → Listing pages (tables, summary strips) → Dashboard (KPIs, hero, quick actions) → Dialogs/sheets → Buttons, inputs, badges, pills.

## Plan

### 1. Design tokens (`src/index.css` + `tailwind.config.ts`)
- Rewrite `:root` and `.dark` HSL tokens to Midnight Indigo:
  - Light: ivory `#fafbfc` background, deep navy text, indigo `#4f46e5` primary, subtle indigo-tinted borders.
  - Dark: `#0a0a1a` base, `#141432` cards, `#1e1e5a` elevated, indigo-glow primary.
- Add new tokens: `--surface-1/2/3` (elevation), `--indigo-glow`, `--shadow-sm/md/lg/glow`, `--gradient-hero`, `--gradient-accent-line`.
- Swap font import: Sora + **Manrope** (replace DM Sans). Update `body` and `tailwind.config.ts › fontFamily.sans`.
- Tighten `--radius` system: 6 / 10 / 16 scale.

### 2. Component primitives
- **Buttons** (`button.tsx`): refine `default` to use indigo with inset highlight + soft glow on hover; add `premium` variant (gradient indigo→violet) for primary CTAs only.
- **Inputs**: thinner border, indigo focus ring (already present, retune opacity), subtle inner shadow on dark.
- **Cards**: replace ad-hoc shadows with token-driven `shadow-sm/md`. Add a unified `.surface-elevated` class.
- **Badges / status pills**: re-tone to indigo/violet family; keep semantic colors but desaturate.

### 3. Auth page (`src/pages/Auth.tsx`)
- Two-pane layout on ≥md: left = brand panel with mesh-indigo gradient, orbital glow, Mouj mark, single-line value prop; right = form on calm surface.
- Form: larger Sora heading, Manrope helper text, indigo primary button with glow, refined tab switch (Sign in / Sign up).
- Mobile: collapse to single column, keep gradient as top band.

### 4. Sidebar (`AppSidebar.tsx` + `ui/sidebar.tsx` tokens)
- Darker sidebar surface in light mode (subtle indigo tint), crisper active-state: 2px indigo left accent + soft indigo bg.
- Section labels in Sora uppercase tracking-wider, smaller weight.
- Collapsed (icon) state: indigo dot indicator for active route.
- Footer block: tenant + user with small avatar ring.

### 5. Top header / breadcrumbs (`AppLayout.tsx`)
- Frosted header retuned for indigo tint, thinner border, integrated breadcrumb + global Ctrl+K pill + ThemeToggle + user.
- Page title block standardized: H1 (Sora 28/32), subtitle (Manrope muted), right-aligned primary action.

### 6. Listing pages pattern (Customers, Suppliers, Products, Proforma, etc.)
- Standardize the "summary strip" (3–4 icon-ring cards) using new tokens, identical spacing.
- Table card: `premium-table-card` retuned — frosted sticky head, zebra off, hover = indigo 4% wash, selected = indigo 8% + left accent.
- Search pill, filters, and pagination unified.
- *No business-logic changes* — purely presentational.

### 7. Dashboard (`Index.tsx`)
- Mesh-hero recolored to indigo radial + violet secondary; Sora display greeting; date/tenant chip.
- KPI cards: `glass-kpi` retuned with indigo border-glow on hover, tabular-nums counters, micro sparkline slot.
- Quick actions: 2×4 grid keeps structure, but icons get indigo gradient ring + subtle hover lift.
- Alerts widgets: tighter spacing, consistent header treatment.

### 8. Dialogs & sheets
- `dialog-accent` top stripe → indigo gradient.
- Standard header (icon-ring + title + subtitle), body padding, sticky footer with primary/secondary buttons.

### 9. Motion
- Keep existing `stagger-fade-up`, `press-scale`. Add: `indigo-pulse` on primary CTA (very subtle, 4s loop), `border-shine` on hover for KPI cards. No heavy framer-motion additions — CSS only to stay light.

### 10. QA pass
- Walk: `/auth → /dashboard → /customers → /products → /proforma-invoices → /reports → /settings` in both light & dark, mobile (384) and desktop (1280).
- Check contrast (WCAG AA), focus rings, hover states, table density, dialog stacking.

## Out of scope
- No schema, RLS, or business-logic changes.
- No new pages or features. No restructuring of navigation.
- No framer-motion install; CSS + existing animations only.

## Technical notes
- All color changes flow through HSL CSS variables — no hard-coded hex in components.
- Tailwind config gets new `fontFamily.sans = ['Manrope', ...]` and the indigo tokens are exposed as `bg-primary` etc. (already wired).
- Font swap requires updating the Google Fonts `@import` in `index.css` and the `body` fallback.
- Migration is **CSS-token first**: ~80% of the lift lands by retoning `index.css`; component edits are surgical (Auth, AppSidebar, AppLayout, dashboard hero, Button variants).

After approval I'll execute steps 1→9 in that order and screenshot key routes for verification.