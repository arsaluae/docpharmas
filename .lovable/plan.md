# Dashboard Visual Refresh

Going with **Analytical High Density** (v1) — it matches the existing precision-industrial memory best: dense, monospaced, hairline-bordered, Bloomberg-terminal restraint.

## Locked design tokens

- **Surface**: `#0B1437` (main bg) · `#050816` (sidebar) · `#111C44` (cards/inputs)
- **Accent**: `#6366F1` electric indigo
- **Status**: emerald `#10B981`, amber `#F59E0B`, cyan `#22D3EE` (live)
- **Borders**: `indigo-900/30` hairlines, no shadows
- **Type**: Sora (display/headings) · Manrope (body) · JetBrains Mono (numbers, tabular)
- **Radius**: cards `rounded-2xl`, pills `rounded-lg`
- **Motion**: 150ms ease-out only, count-up on mount; no hover scale, no parallax

## Scope (frontend only)

1. **`src/index.css`** — rewrite `:root` + `.dark` semantic tokens to the Midnight Indigo palette. Force dark as default. Add `--sidebar-*` overrides. Replace `--brand-blue`/`--brand-navy` references with indigo.
2. **`tailwind.config.ts`** — swap `fontFamily.sans → Manrope`, `heading → Sora`, `mono → JetBrains Mono`. (Already mostly aligned.)
3. **`index.html`** — load Sora, Manrope, JetBrains Mono from Google Fonts.
4. **`src/pages/Index.tsx`** — rebuild dashboard composition to match v1: hero greeting with left indigo bar, live ticker strip, 4 KPI tiles with colored top borders + corner icons, 30-day trend in 2/3 column with quick-actions list on right. Keep all existing data hooks, KPI dialogs, navigation — only restructure JSX + classNames.
5. **`src/components/AppSidebar.tsx`** — restyle to `#050816` background, indigo active state with border + tinted bg, footer user card.
6. **`src/components/AppLayout.tsx`** — header (h-16, hairline border, ⌘K input pill, date chip).
7. **`src/components/dashboard/PerformanceTrendChart.tsx`** — recolor bars to indigo scale (today = `#6366F1`, peak = emerald, base = `indigo-500/15`), tooltip dark surface.
8. **`src/components/ui/metric-card.tsx`** — tweak surface/border to match new tokens; keep count-up + sparkline.
9. **`src/components/dashboard/SalesAgentDashboard.tsx`** — apply same token classes (already uses semantic tokens, will inherit most changes).

## Out of scope

- No business logic, no data shape changes, no new routes/widgets.
- No light-mode redesign (kept functional but secondary; dark is canonical).
- No changes to forms, dialogs, or non-dashboard pages beyond what token changes flow through automatically.

## Verification

- Visit `/dashboard` in preview at 1440 and 1061 widths, confirm: hero alignment, KPI tile colored top borders, ticker pulse, chart colors, sidebar active state, quick-action hover.
- Confirm no console errors and font loading.
