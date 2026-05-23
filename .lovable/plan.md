
# Settled light theme — companion to the dark sidebar

The sidebar is already the anchor: near-black `#08080A`, hairline borders, a single 2px indigo active rail, Geist-ish wordmark. The main canvas is currently fighting it with gradient mesh hero, glowing KPI tiles, neon ticker, fuchsia/amber/rose accents. We strip all of that and rebuild the workspace as a quiet, paper-grade light surface so the sidebar reads as the only piece of "chrome" in the room.

No gradients. No glow shadows. No glass/blur. No mesh radials. No rainbow quick-action tiles. One accent color (indigo), used sparingly — only for the active state, the primary CTA, and the single hairline rail that mirrors the sidebar's active rail.

## The light palette (re-tuned)

Replace the current `--background: #F7F6F2` paper with a cooler, near-white that complements the sidebar's cool near-black instead of fighting it warm-vs-cool:

```
--background:      #FAFAFB   (app canvas)
--surface-1:       #FFFFFF   (cards, tables, panels)
--surface-2:       #F4F4F6   (raised wells: ticker strip, code blocks, KPI footer)
--border:          #ECECEF   (hairline, 1px, the only divider we use)
--border-strong:   #E0E0E4   (used only for table header underline + KPI tile)
--foreground:      #0A0A0B   (matches sidebar bg — same ink, inverted role)
--muted-foreground:#6B6B72   (secondary)
--subtle:          #9A9AA0   (tertiary / micro-labels)
--primary:         #4F46E5   (indigo — same as sidebar rail)
--primary-soft:    #EEF0FF   (selection fill, hover wash — never a gradient)
```

Status colors stay muted, no neon:
```
--success: #2F7A52   on  #EAF3EE
--warning: #8A6A2E   on  #F5EFE3
--danger:  #A8392F   on  #F5E8E6
--info:    #2E5A8A   on  #E8EEF5
```

Dark mode is left as-is for now (it's already calm). Scope of this change is the light theme + the dashboard.

## Foundations to delete / neutralize

In `src/index.css`, remove or empty out:
- `.gradient-indigo / violet / cyan / emerald / amber / rose / fuchsia / sky`
- `.glow-indigo / violet / cyan / emerald / amber / rose`
- `.text-gradient-primary`
- `.card-vibrant` (and its `::before` radial)
- `.mesh-hero-vibrant`
- `.ticker-vibrant`

These either become no-ops or are replaced with a single shared `.panel` / `.well` / `.kpi` set:

```
.panel  { background: var(--surface-1); border: 1px solid var(--border); border-radius: 6px; }
.well   { background: var(--surface-2); border: 1px solid var(--border); border-radius: 6px; }
.kpi    { background: var(--surface-1); border: 1px solid var(--border); border-radius: 6px;
          transition: border-color 120ms ease-out, background-color 120ms ease-out; }
.kpi:hover { border-color: var(--border-strong); background: #FCFCFD; }
.kpi[data-active="true"] { border-left: 2px solid var(--primary); padding-left: calc(1rem - 1px); }
```

That `border-left: 2px solid indigo` is the *only* visual echo of the sidebar's active rail. It's the one moment of color on the entire canvas.

## Dashboard rebuild (`src/pages/Index.tsx`)

A four-zone layout, all on a 4px grid, all aligned to the same gutter as the page header (`px-8`, the existing AppLayout gutter — no change needed there):

```
┌─────────────────────────────────────────────────────────────────┐
│  Page header (Dashboard · Saturday, 23 May 2026)                │  (already in AppLayout)
├─────────────────────────────────────────────────────────────────┤
│  TICKER STRIP — single row, .well, mono 11px, hairline divider  │
│  MTD · WTD · A/R · A/P · NET · PO Open · Expiring 90d           │  height: 36px exactly
├─────────────────────────────────────────────────────────────────┤
│  KPI ROW — 4 tiles, equal width, .kpi                           │
│  ┌─Week────┐ ┌─Month───┐ ┌─Gross───┐ ┌─Upcoming┐               │  height: 112px exactly
│  │ label   │ │ label   │ │ label   │ │ label   │                │  no icons-in-gradient-pills
│  │ value   │ │ value Δ │ │ value Δ │ │ value   │                │  Δ as plain ±N.N%, color-coded
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘                │
├─────────────────────────────────────────────────────────────────┤
│  TWO-COLUMN BODY                                                │
│  ┌─────────────── 8 col ────────────┐ ┌──── 4 col ──────┐      │
│  │ Daily sales · 30d (area, indigo) │ │ Quick actions   │      │
│  │ panel, header underline          │ │ panel, list     │      │
│  ├──────────────────────────────────┤ ├─────────────────┤      │
│  │ Top customers · MTD              │ │ Reorder alerts  │      │
│  │ panel, table                     │ │ panel, list     │      │
│  └──────────────────────────────────┘ ├─────────────────┤      │
│                                       │ Expiry · 90d    │      │
│                                       │ panel, list     │      │
│                                       └─────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

Specific replacements:

- **Hero greeting block** — delete entirely. The page header (`AppLayout title="Dashboard" subtitle="Saturday · 23 May 2026"`) already greets. A second "Good morning, Mouj Pharma" hero is the kind of "AI element" the user explicitly rejected.
- **Live ping dot** — delete. Pings are SaaS-template tells.
- **Ticker strip** — keep the data, lose the gradient wash. Render as `.well` with `border-y` only, 36px tall, items separated by a 1px vertical hairline (`divide-x divide-border`). Mono 11px, label in `--subtle`, value in `--foreground`. Up/down deltas as a small caret + percentage in `--success` / `--danger` text only — no pill, no glow.
- **KPI tiles** — render as `.kpi`. Layout: label (11px, uppercase, tracking 0.12em, `--subtle`) → value (28px, Geist/Sora 500, tabular-nums, `--foreground`, PKR prefix in `--muted-foreground` 14px) → footnote row (12px `--muted-foreground` left, delta right). No icon. No gradient pill. No sparkline inside the tile — sparklines move to the chart panel where they belong. On hover: border darkens one step, background lifts to `#FCFCFD`. On click (active dialog): `data-active="true"` adds the 2px indigo left rail. That's it.
- **Quick actions** — was an 8-tile rainbow grid. Becomes a single panel with a vertical list of 8 rows. Each row: 32px tall, hairline divider between rows, icon 14px in `--muted-foreground`, label 13px in `--foreground`, chevron-right 12px in `--subtle` on the right. Hover: `background: --primary-soft`, icon + label shift to `--primary`. No gradient backgrounds, no scale transforms.
- **Daily sales chart** — Recharts `<Area>`, single series, stroke `--primary` 1.5px, fill `--primary` at 8% opacity (flat fill, not a gradient defs block). Grid: horizontal hairlines only, `--border`. Axis text: 10px `--subtle`. Tooltip: white card, 1px border, no shadow.
- **Tables (top customers, expiry, reorder)** — already standardized to 44px rows / mono columns in Phase 1. Just confirm the header has a 1px `--border-strong` underline and the row hover is `--primary-soft` at 40% — not the current `foreground/0.03` wash.
- **All emoji-ish color usage** (`text-emerald-500`, `text-rose-500`, `text-amber-500` literal Tailwind) — replace with semantic `text-success` / `text-danger` / `text-warning` tokens. No raw Tailwind palette colors anywhere on the page.

## Pixel discipline rules applied across the dashboard

- Vertical rhythm: 4px base. Section gaps = 24px. Inside-panel padding = 16px. Inside-tile padding = 16px. Header-to-content gap inside panel = 12px.
- Every panel: 6px radius, 1px `--border`, no shadow, ever.
- Every number: `font-mono`, `tabular-nums`, `font-variant-numeric: tabular-nums`. PKR prefix always in `--muted-foreground`, never bold.
- Every micro-label: 11px, 600 weight, 0.12em tracking, uppercase, `--subtle`.
- Every divider: 1px `--border`. Never 2px. The only 2px line on the canvas is the active-state rail (mirroring the sidebar).
- Animations: only `border-color` and `background-color`, 120ms ease-out. No transforms, no scale, no translate-y on hover.

## Files to touch

1. `src/index.css` — re-tune `:root` light tokens (lines ~13–67), neutralize the vibrant utilities block (lines ~169–230), add the new `.panel` / `.well` / `.kpi` primitives.
2. `src/pages/Index.tsx` — rebuild the four zones above; delete the hero greeting and the live-ping; rewrite the ticker, KPI tiles, and quick-actions per spec; switch the chart to a flat single-color area.
3. `src/components/ui/metric-card.tsx` — already exists from Phase 1 and matches this discipline; re-adopt it on the dashboard instead of the bespoke vibrant tiles.

Dark mode tokens, sidebar, AppLayout, tables, buttons, inputs, and all inner pages are out of scope for this pass — same as the user asked ("something that complements the left sidebar in lighter color"). Once approved I'll roll the same discipline outward in a follow-up if you want.

After implementation I'll take a screenshot of `/dashboard` at the current viewport (1061×673) and verify pixel rhythm before handing back.
