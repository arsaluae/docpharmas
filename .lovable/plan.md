## Goal
The Dashboard currently reads as one flat tone of navy on off-white. Add restrained, meaningful color — never neon, never washes covering whole cards — so each section has its own quiet identity and the eye knows where to land. Scope is **`src/pages/Index.tsx`** only.

## Design rules (still locked)
- No gradients, no glass, no shadows, no rounded-2xl pillows.
- Color is used as **signal**, not decoration. Each color earns its place.
- Hairlines stay 1px `--border`. Radius stays 4–6px. Typography unchanged.

## Color system on the dashboard
Reuse existing tokens only — no new hex:
- `--brand-blue` (MOUJ light blue) → primary metric, trend "today" bar, live indicator
- `--brand-navy` → headings/numbers (unchanged)
- `--success` (muted green) → collections, positive deltas, in-stock
- `--warning` (muted amber) → expiring 30–60d, low stock soon
- `--danger` (muted red) → overdue, expired, critical reorder
- `--info` / soft violet token → upcoming POs / scheduled
- `--subtle` → secondary copy (unchanged)

Apply each as: **2px left rail + tiny tinted icon chip (24px, color/10 background, color/40 border) + colored numeric value where it's a signal**. Card body stays `bg-card`.

## Per-section changes

**1. Glance strip**
- Today sold → blue dot + `--brand-blue` value
- Today collected → success dot + `--success` value
- Open POs → info dot + `--info` value
- Needs attention → danger dot + `--danger` value (already red)
- Dot replaces the vertical hairline separator between items so the strip reads as 4 colored signals on a hairline rail.

**2. KPI grid (4 tiles)**
Each tile gets a 2px left rail in its semantic color + matching 24px icon chip top-right:
- MTD Sales → `--brand-blue` (primary, already has rail) + TrendingUp chip
- Receivables → `--success` rail + Wallet chip (money owed *to* us)
- Payables → `--warning` rail + CreditCard chip (money we owe)
- Gross Profit → `--info` rail + Flame chip
Numbers stay navy mono. Delta pill keeps blue/red.

**3. 30-Day trend bars**
- Default bars: `--brand-navy / 18` (current flat)
- Today's bar: solid `--brand-blue`
- Highest bar of the month: `--brand-blue / 40` (subtle peak highlight)
- Hover bar: `--brand-blue / 70`
- Grid line at average: 1px dashed `--brand-blue / 30` with a tiny "Avg" tag

**4. Sidebar panels (right column)**
Each panel header gets a single 8px colored square before the title (color-coded by domain):
- Reorder Alerts → `--danger`
- Expiring Batches → `--warning`
- Top Selling → `--success`
- Top Customers → `--brand-blue`
- Recent Stock In → `--info`
Row severity dots already exist; keep them, just ensure they use the same token mapping.

**5. Quick Actions row**
Currently uniform. Give each action a tiny 1px hover ring in `--brand-blue / 30` and a 16px icon in its domain color (Sales=blue, Purchase=info, Payment=success, Warranty=navy, Inventory=warning, Expense=danger, Credit=muted). No background fills — just the icon picks up color, label stays navy.

**6. Hero greeting**
Add a single 2px × 28px `--brand-blue` accent bar to the left of the greeting H1. One pixel of color anchors the page.

## Out of scope
- Other pages, components, sidebar chrome, dialogs.
- New tokens, new fonts, new layouts.
- Backend, data, business logic.

## Files
- `src/pages/Index.tsx` (only file edited)

## Verification
- Visual: page reads with 5–6 distinct quiet colors, none dominating, no card has a colored background fill.
- `rg "bg-gradient|shadow-xl|rounded-2xl|rounded-3xl"` in Index.tsx → 0 hits.
- All colors via `hsl(var(--token))` — no raw hex added.
