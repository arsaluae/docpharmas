## Goal

Turn the dashboard into a place you *want* to open — warm, playful, pastel — without neon, gradients, or glass. Keep the precision and hairline discipline; add personality through type, soft color chips, and small line illustrations.

## 1. Typography (project-wide)

- Headings: **Sora** (500/600), body: **Manrope** (400/500), mono: **JetBrains Mono** for numbers only.
- Update `tailwind.config.ts` font families + `src/index.css` `@import` lines.
- Dashboard greeting uses Sora 28px / 600 with -0.02em tracking. Section titles Sora 15px / 600. Body 13–14px Manrope.

## 2. Playful pastel palette (additive, flat)

Add six soft category tokens to `src/index.css` (light theme only — sidebar/dark untouched):

```text
--pastel-peach:   #FFE9DE  fg #B5532A
--pastel-mint:    #DDF3E4  fg #2F7A52
--pastel-sky:     #DDEBFB  fg #2E5A8A
--pastel-lilac:   #E8E2FB  fg #5B4BC4
--pastel-butter:  #FCF1CF  fg #8A6A2E
--pastel-blush:   #FBE2EC  fg #B0436B
```

Used only as small icon chips (28–32px rounded-lg), label backgrounds, and empty-state washes. No gradients, no glow. Primary indigo `#4F46E5` stays the action color.

## 3. Hand-drawn micro illustrations

Three inline SVGs in `src/components/dashboard/illustrations/` (single-stroke, currentColor, 1.5px):
- `WavingHand.svg` — for greeting
- `SunCloud.svg` — for "Today at a glance"
- `EmptyBox.svg` — for empty tables

Tiny (48–72px), placed as accents — never decorative noise.

## 4. Dashboard rebuild (`src/pages/Index.tsx`)

```text
┌────────────────────────────────────────────────────────┐
│  Hi, Ahmad 👋  (Sora 28)         Sat, 23 May 2026      │  ← greeting row, no live dot
│  Here's where things stand today.                      │
├────────────────────────────────────────────────────────┤
│  ┌─ Today at a glance ───────────────────[SunCloud]─┐  │  ← replaces ticker
│  │ Sales today   Collections   A/R     A/P   Net    │  │     single panel, soft butter wash
│  │ PKR 230.5K    PKR 88.2K     165.7K  717.5K -551K │  │     5 cells, hairline dividers
│  └──────────────────────────────────────────────────┘  │
├──────────────────────┬─────────────────────────────────┤
│  KPI tile grid       │  Quick actions (list, 8 rows)   │
│  (4 tiles, pastel    │  each row: pastel icon chip +   │
│  icon chip per tile) │  label + chevron, hover lifts   │
├──────────────────────┴─────────────────────────────────┤
│  30-day sales trend (Area, indigo 1.5px, 8% fill)      │
├────────────────────────────────────────────────────────┤
│  Recent activity (table, 44px rows)                    │
└────────────────────────────────────────────────────────┘
```

### Greeting row
- "Hi, {name} 👋" + subtitle "Here's where things stand today." Date right-aligned in `text-muted-foreground`.

### Today at a glance card
- White card, 1px border, 20px padding, soft **butter** wash behind the SunCloud illustration in top-right corner (opacity 0.5).
- 5 cells separated by hairline verticals, each: micro-label (Manrope 10.5px/600/uppercase tracking-0.12em, muted) + value (JetBrains Mono 18px, foreground; negatives in `--danger`).

### KPI tiles (4)
- Each tile: pastel icon chip top-left (28×28 rounded-lg, category color), micro-label, mono value (24px), tiny delta row.
- Categories: Sales=mint, Receivables=sky, Payables=peach, Cash=lilac.
- Hover: border darkens, background to `#FCFCFD`. Active rail: 2px indigo left border.

### Quick actions
- Single panel, 8 rows × 36px. Row = 28px pastel icon chip + label (Manrope 13px) + chevron right.
- Hover: row bg `--primary-soft`, label & chevron shift to `--primary`. No scale.

### Sales trend
- Recharts Area, single indigo series, 8% fill, horizontal hairline grid, white tooltip with 1px border.

### Recent activity
- Existing table primitives; add `EmptyBox` illustration + friendly copy when empty.

## 5. What goes away

- The MTD/WTD/A/R/A/P/NET/PO ticker strip (user dislikes).
- Any remaining `gradient-*`, `glow-*`, `mesh-*`, `text-gradient-*` utilities used on the dashboard. Utility classes stay in CSS but unused on this page.

## Technical notes

**Files touched:**
- `tailwind.config.ts` — Sora/Manrope font families, pastel color tokens
- `src/index.css` — `@import` Sora+Manrope from Google Fonts, add `--pastel-*` tokens, add `.chip-pastel-{name}` and `.wash-{name}` helpers
- `src/pages/Index.tsx` — full rebuild per layout above
- `src/components/dashboard/illustrations/` — 3 new inline SVG components (WavingHand, SunCloud, EmptyBox)

**Out of scope:** sidebar, dark mode, AppLayout, inner pages, tables primitive, buttons. Pure dashboard + tokens.

**Preserved:** existing KPI data queries, dialog wiring (`KpiDialogs.tsx`), navigation routes, all business logic.