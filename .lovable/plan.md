## MOUJ Editorial-Precision Dashboard

Rebuild the dashboard around the selected "Editorial precision" direction. Lock MOUJ brand tokens system-wide so the rest of the app inherits them over time. Sidebar untouched.

### Brand tokens (index.css + tailwind.config.ts)

Replace the indigo/pastel system with the MOUJ palette:

- `--brand-navy: 217 76% 20%` (#0C2B5C) — primary text, brand color, active states
- `--brand-blue: 197 80% 55%` (#2EB4E8) — single accent (active KPI, hero metric, "Live" pill, active tab underline, sparkline bar of the day)
- `--surface-page: 220 25% 97%` (#F4F6FA) — page background
- `--surface-card: 220 20% 98.5%` (#FAFAFB) — card background
- `--hairline: 217 76% 20% / 0.10` — all borders
- Remap shadcn semantic tokens: `--background`, `--foreground`, `--primary`, `--border`, `--muted-foreground`, `--card` to the above so existing pages don't break.
- Delete the pastel chip utilities (`.chip-*`, `.wash-*`) and the SunCloud/EmptyBox illustrations — they don't belong in this aesthetic.

### Typography

Keep Sora (headings) + Manrope (body) + JetBrains Mono (numbers). Set tracking: H1 -0.02em, eyebrow uppercase 0.2em, micro-labels uppercase 0.15em with 700 weight at 11px.

### Dashboard layout — `src/pages/Index.tsx`

Mirror the prototype 1:1, wired to real data already in the page:

```
┌─ Eyebrow: "OVERVIEW DASHBOARD" ────── Date · Fiscal period ┐
│  H1: "Good morning, {firstName}"                            │
├─────────────────────────────────────────────────────────────┤
│  Glance strip (hairline top+bottom, dot dividers):          │
│  [LIVE] N pending orders │ N overdue invoices │             │
│  Inventory health: 98.2%                                     │
├──────┬──────┬──────┬──────────────────────────────────────┐ │
│ Sales│ Recv │ Pay  │ Cash (with 2px blue accent bar)      │ │
│ KPI  │ KPI  │ KPI  │ — divided by 1px hairline grid       │ │
├──────┴──────┴──────┴──────────────────────────────────────┤ │
│  30-Day Performance Trend [Volume│Margin tabs]   col-8     │
│  Recharts bar chart, navy/10 fill, brand-blue today bar    │
│  ─────────────────────────────────                          │
│                                            ┌─ col-4 ──────┐│
│                                            │ Quick Actions││
│                                            │ (4 outlined  ││
│                                            │  buttons)    ││
│                                            │              ││
│                                            │ Recent       ││
│                                            │ Activity     ││
└────────────────────────────────────────────┴──────────────┘
```

Strip everything else from the current Index.tsx: no "Today at a glance" pastel card, no SunCloud illustration, no emoji greeting, no pastel KPI chips, no Up-Late copy.

### Data wiring (preserve existing logic)

- Greeting: keep `greetingFor(today)` + firstName from `useAuth`.
- Glance strip: pull from already-computed counts (pending sales orders, overdue receivables count, inventory health = stock-in-range %).
- KPI tiles: reuse the four primary metrics already fetched (Gross Sales MTD, Receivables, Payables, Cash on hand). Format with `formatAmount` + JetBrains Mono. Show one delta line per tile; Sales delta uses brand-blue, others use muted.
- Trend chart: replace existing Area chart with Recharts `BarChart`, 30 daily bars, today highlighted in brand-blue, all others navy/10. Volume/Margin tabs toggle dataset.
- Quick Actions: 4 outlined buttons → New Sales Order, New Purchase Order, Record Payment, Stock Audit (route via existing nav).
- Recent Activity: reuse current activity feed source, simplified to dot + title + relative time (max 5 rows).

### Files

- Edit `src/index.css` — swap palette tokens, remove pastel utilities and illustration glue, add hairline + eyebrow utility classes.
- Edit `tailwind.config.ts` — register `brand-navy`, `brand-blue`, `hairline` color tokens.
- Rewrite `src/pages/Index.tsx` — new layout matching prototype, wired to existing data hooks.
- Delete `src/components/dashboard/illustrations/` (SunCloud, EmptyBox) if present.
- Leave `AppSidebar.tsx`, `AppLayout.tsx`, all other pages, all business logic untouched.

### Out of scope (this turn)

- Sidebar redesign (user said keep it).
- Inner pages (Customers, Invoices, Reports, etc.) — they'll inherit the new tokens but won't be re-laid-out.
- Dark mode tuning beyond ensuring tokens resolve.
- Any backend, RLS, or schema work.
