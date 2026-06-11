# Sales Order / Invoice Form Redesign

Rebuilds the "Create Sales Order" dialog in `src/pages/ProformaInvoices.tsx` (currently `max-w-2xl` cramped modal at lines 1020–1142) into a production-grade ERP composer, and upgrades the matching print template. Sales Invoice in this app is auto-generated from the same Sales Order data path, so one composer + one print template covers both.

## What changes (user-visible)

1. **Full-screen composer** — replaces the small modal. Sticky header (title + doc#), scrollable body, sticky footer (totals + actions). 90vw / max 1400px on desktop, full-screen on mobile.
2. **Premium customer panel** — large customer search; on select, shows business name, city, address, phone, sales agent, payment terms, current balance, credit limit, outstanding. Visible warning chip if outstanding > credit limit.
3. **Wide item table** — columns: #, Product Code, Product Name (wide), Batch, Expiry, Available Stock, Qty, Rate, Disc %, Tax %, Line Total, Action. Product search by name/code/supplier/batch. Batch dropdown auto-fills expiry & available stock; blocks save if qty > stock or required batch missing.
4. **Sticky totals card** — right rail on desktop / bottom bar on mobile: Subtotal, Discount, Tax, Net Total, Previous Balance, Grand Payable. Grand total in 32px bold.
5. **Actions** — Save Draft · Create Sales Order · Create & Print · Cancel (with unsaved-changes confirm).
6. **Mobile** — item rows collapse to stacked cards instead of horizontal table.
7. **Print template** — A4-tuned layout in `src/lib/pdf-generator.ts` with the required field set, larger type scale, amount in words, terms, signature block. Used by both Sales Order and Sales Invoice (shared template path).

## Typography tokens (form)
Title 26px · Section 18px · Label 14px · Input 16px · Table header 14px · Table body 15px · Grand total 32px bold.

## Files touched

- `src/pages/ProformaInvoices.tsx` — extract the create dialog into a new component and switch the trigger to open it full-screen.
- `src/components/sales/SalesOrderComposer.tsx` *(new)* — the full composer (header, customer panel, item table, totals rail, footer, mobile card view, validation, unsaved-changes guard, keyboard shortcut `Alt+N` to add row).
- `src/components/sales/CustomerSummaryCard.tsx` *(new)* — read-only panel populated on customer select (balance/credit/outstanding pulled from existing customer query already in the page).
- `src/components/sales/ItemRow.tsx` *(new)* — desktop row + mobile card variants; batch & expiry selectors wired to existing `src/lib/batches.ts`.
- `src/lib/pdf-generator.ts` — extend `PdfOptions` with `batch`/`expiry`/`discount`/`tax` per row already supported via aliases; bump print type scale (company 22, title 20, body 13, grand total 22) and ensure A4 layout for sales-order/invoice themes.
- No DB / RPC / accounting logic changes. Save handler, totals math, draft autosave, and downstream invoice generation stay identical — this is a UI/UX refactor only.

## Technical notes

- Use existing `Dialog` with `DialogContent className="max-w-[1400px] w-[95vw] h-[92vh] p-0 flex flex-col"` so we keep the existing open/close state, focus trap, and ESC handling rather than introducing a new Drawer primitive.
- Layout inside content:
  ```text
  ┌─ sticky header (title, doc#, close) ──────────────┐
  │ customer panel (4-col grid)  | summary chips      │
  ├──────────────────────────────┬────────────────────┤
  │ items table (scroll-y)       │ sticky totals card │
  ├──────────────────────────────┴────────────────────┤
  │ sticky footer: Cancel · Save Draft · Create · Print│
  └────────────────────────────────────────────────────┘
  ```
- Customer summary reads from the customer row already fetched for `customerOptions`; outstanding comes from the existing receivables query path (no new RPC).
- Batch + available-stock data uses `src/lib/batches.ts` helpers already in the codebase.
- Validation: block submit with inline field errors when (a) no customer, (b) zero items, (c) qty > available stock, (d) batch required but missing, (e) credit limit exceeded → confirm dialog.
- Unsaved-changes guard wraps the existing `setCreateOpen(false)`.

## Out of scope (ask first if you want these)

- Changing how Sales Invoice is generated from Sales Order (data flow stays).
- Accounting/ledger logic, RPCs, or migrations.
- Redesigning the Sales Order **list** table on the page (only the create/edit composer).

## Acceptance

- Composer opens at 95vw / 1400px max, sticky header+footer, no inner page scroll except item list.
- Product name column never truncates above 1024px.
- Customer details visible immediately after select; credit warning visible when exceeded.
- Grand total renders at 32px bold in the totals card.
- Print preview renders clean on A4 with the full field set and amount-in-words.
- Mobile shows stacked item cards; tablet shows horizontally scrollable table.
- Existing save / draft / print / payment flows still work unchanged.
