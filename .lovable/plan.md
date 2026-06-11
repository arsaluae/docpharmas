# Premium Pharma ERP Redesign — Phase 1

Scope: app shell, dashboard, and Sales/Purchase hubs. Visual direction: Stripe-style light premium. Density: balanced. Adds an AI Command Center (palette + insights chat + proactive alerts).

Out of scope this pass: reports, finance, inventory, settings, auth, PDFs. They will inherit the new tokens/typography automatically but keep their current layouts.

## 1. Design tokens (light-first)

Update `src/index.css` light theme + `tailwind.config.ts`:

- Surfaces: `--background: #FFFFFF`, `--muted: #F6F8FA`, `--card: #FFFFFF`, `--sidebar: #FAFBFC`.
- Ink: `--foreground: #0A2540` (Stripe navy), `--muted-foreground: #4F5B6B`.
- Borders: `--border: #E3E8EE` hairline; `--ring: #635BFF`.
- Brand: `--primary: #635BFF` (Stripe indigo) with `--primary-foreground: #FFFFFF`; keep current dark theme intact (toggle still works).
- Status: success `#0E9F6E`, warning `#D97706`, danger `#E11D48`, info `#0EA5E9` — used in pills/KPIs, not chrome.
- Elevation: introduce 3 shadow tokens (`--shadow-xs/sm/md`) using soft Stripe-like `rgba(10,37,64,.06/.08/.12)`. Cards get `shadow-xs` resting, `shadow-sm` on hover.
- Radius: bump `--radius` to `10px` for cards, `8px` for inputs/buttons.
- Type scale: keep Sora/Manrope/JetBrains Mono. Adjust scale to: display 30/36, h1 22/28, h2 16/22, body 14/20, meta 12/16, micro 11/14 uppercase tracking-wider. `tabular-nums` everywhere numeric.

## 2. App shell (`AppSidebar.tsx`, `AppLayout.tsx`)

Sidebar:
- Width 304px expanded (was ~240), collapses to 64px icon rail.
- Brand block top: 56px tall, logo + tenant name + tenant switcher chevron.
- Workspace KPI strip under brand: today's sales, receivables, cash — one line each, mono, click-through.
- Sections: Overview, Sales, Purchase, Inventory, Finance, Reports, Admin. Each section a `SidebarGroup` with uppercase 11px label and 4px row gap.
- Nav rows: 40px tall, 14px label, icon 18px, active state = left 2px indigo bar + `bg-primary/[0.06]` + indigo text. Hover = `bg-foreground/[0.04]`.
- Footer pinned: user avatar, role pill, settings, theme toggle.

Top bar (`AppLayout`):
- Height 56px, white, hairline bottom border.
- Left: SidebarTrigger + breadcrumb (section › page) at 12px.
- Center: AI Command Center launcher — pill input 420px wide with `⌘K`, sparkle icon, placeholder "Ask or search anything…".
- Right: date chip, notifications bell with unread dot, environment pill (Live/Sandbox), user menu.
- Page header band: 28/32px title (light tracking), subtitle 13px muted, right-aligned action cluster. Sticky on scroll with a thin shadow when stuck.

## 3. AI Command Center

One unified surface, three modes inside the same overlay:

- Trigger: `⌘K` or click the launcher in the top bar. Opens a 720px centered overlay.
- Tabs along the top: **Jump to** (search/nav), **Ask** (chat), **Alerts** (proactive feed).
- **Jump to** mode: reuses current CommandPalette index (pages, recent, customers, invoices). Add fuzzy + section grouping.
- **Ask** mode: AI SDK `useChat` against a new Supabase Edge Function `ai-command` using Lovable AI Gateway, `google/gemini-3-flash-preview`. System prompt scopes to read-only pharma context. Streams answers with markdown. Suggested prompts row: "Top 5 overdue customers", "Stock expiring next 60 days", "This month vs last month sales". AI Elements (`Conversation`, `Message`, `PromptInput`, `Shimmer`) used per chat-ui-composition rules.
- **Alerts** mode: pulls from existing `reorder_alerts`, overdue receivables (computed from `customers.balance` + invoice due dates), credit-limit breaches, expiring stock (`grn_items` 30/60/90). Each row is click-through to the relevant page with prefilters.
- Persistence: none (single session). Storage choice is "no persistence" — chat resets on close, matching the command-palette mental model.

## 4. Dashboard (`src/pages/Index.tsx` admin view)

Layout (12-col grid, 24px gutters):

```text
┌──────────────────────────────────────────────────────────┐
│  KPI strip — 4 metric cards with sparkline + delta       │
├───────────────────────────┬──────────────────────────────┤
│  Sales trend (8 col)      │  AI insight card (4 col)     │
│  Recharts area, 6mo       │  1 hero insight + CTA        │
├───────────────────────────┼──────────────────────────────┤
│  Receivables aging (6)    │  Top customers MTD (6)       │
├───────────────────────────┴──────────────────────────────┤
│  Proactive alerts feed (full width, 3-col cards)         │
├──────────────────────────────────────────────────────────┤
│  Recent activity timeline (full width)                   │
└──────────────────────────────────────────────────────────┘
```

KPI cards:
- 4 metrics: MTD Sales, Receivables, Cash on hand, Stock value.
- Each card: 11px uppercase label, 28px value with `tabular-nums`, 12px delta vs last month with arrow + color, 40px sparkline (Recharts mini area).
- Card chrome: white, 10px radius, hairline border, `shadow-xs`, 20px padding. Hover lifts to `shadow-sm` + border darken.

AI insight card: pulls latest result from `ai-insights` function, shows headline + 2 bullets + "Open insights" link.

Alerts feed: 3-column card grid (Reorder · Overdue · Expiring) with count badge and top 3 rows + "View all".

Activity timeline: reuse `ActivityTimeline` with denser styling.

## 5. Sales hub (`ProformaInvoices.tsx` list view only)

Keep the recently redesigned composer untouched. Rework only the list page:

- Header band: title + status filter pills (All · Draft · Sent · Paid · Overdue · Voided) with counts.
- Toolbar row: search, customer filter, date range, city filter, agent filter, "Columns" menu, "Export". Filters render as removable chips below the toolbar.
- Summary strip: 4 mini-KPIs (Open value, Overdue value, Collected MTD, Avg days to pay) — same KPI chrome as dashboard but compact.
- Table: 44px rows, balanced density, columns Inv# · Date · Customer · City · Total · Paid · Status · Due. Sticky header, zebra off, hairline row dividers. Row hover = `bg-muted/40`. Status as pill component, amounts mono right-aligned, dates `DD MMM YYYY`.
- Bulk action bar appears on row selection (mark paid, send, export, void).
- Pagination strip bottom: 50/page server pagination preserved, page X of Y mono.
- Mobile: stacked cards (existing pattern) restyled to match.

## 6. Purchase hub (`PurchaseProforma.tsx` list view only)

Same pattern as Sales hub, columns: PO# · Date · Supplier · Items · Total · GRN status · Payment status. Summary strip: Open PO value, Pending GRN, Payable this week, Avg lead time.

## 7. Files touched

- `src/index.css` — light token overhaul + shadow vars.
- `tailwind.config.ts` — shadow utilities, radius bump.
- `src/components/AppSidebar.tsx` — width, sections, KPI block, footer.
- `src/components/AppLayout.tsx` — top bar redesign, AI launcher, sticky page header.
- `src/components/CommandPalette.tsx` — refactor into tabbed AI Command Center.
- `src/components/ai/AICommandCenter.tsx` *(new)* — overlay shell with Jump/Ask/Alerts tabs.
- `src/components/ai/AskPanel.tsx` *(new)* — AI Elements chat surface.
- `src/components/ai/AlertsPanel.tsx` *(new)* — proactive alerts list.
- `supabase/functions/ai-command/index.ts` *(new)* — streaming chat endpoint via Lovable AI Gateway.
- `src/pages/Index.tsx` (admin dashboard branch) — new grid, KPI cards, alerts feed.
- `src/components/ui/metric-card.tsx` — restyle to premium KPI card with sparkline slot.
- `src/components/ui/status-pill.tsx` — light-theme palette.
- `src/pages/ProformaInvoices.tsx` — list-view header/toolbar/table chrome only.
- `src/pages/PurchaseProforma.tsx` — same.

## 8. Technical notes

- Keep existing dark theme working; only the light theme is retuned now.
- Sidebar width change requires updating `--sidebar-width` CSS var consumed by `components/ui/sidebar.tsx` (no fork of the primitive).
- AI Command Center uses AI SDK + AI Elements (`bun x ai-elements@latest add conversation message prompt-input shimmer`). New edge function follows `connecting-to-ai-models-classic-stack`. `LOVABLE_API_KEY` is server-only.
- Alerts feed is read-only aggregation over existing tables — no schema changes.
- No business logic changes anywhere; numbers, totals, document numbering, RLS, triggers untouched.
- All numeric cells `tabular-nums`; dates via `formatDateDDMMMYYYY`.

## 9. Acceptance

- Sidebar 304px, sections labeled, active state has indigo bar + tint.
- Top bar AI launcher opens overlay with three working tabs; Ctrl+K still works.
- Dashboard KPI cards show value + delta + sparkline; alerts feed shows live counts; no layout shift on load.
- Sales and Purchase hubs show status pills, filter chips, summary strip, 44px rows, server pagination still 50/page.
- Light theme passes contrast on text/borders/status pills; dark theme unchanged.
- No regressions in composer flows, PDF generation, or list pagination.
