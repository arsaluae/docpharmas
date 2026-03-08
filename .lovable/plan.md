

# Plan: Dashboard Redesign, Build Fixes, WhatsApp Ledger Sharing

## 1. Fix Build Errors (3 files)

All three files have leftover `</main></div>` or `</SidebarProvider>` from incomplete AppLayout migration.

**PrintJobs.tsx** (line 273-274): Remove `</main></div>` — content is already inside AppLayout.

**BankAccounts.tsx** (line 79-131): Fix indentation and wrap content in proper `<div>` containers inside AppLayout. Remove orphaned `</div>` at line 97.

**Expenses.tsx** (line 302-320): Remove `</main></div></SidebarProvider>` at lines 303-320, replace with proper `</AppLayout>` closing. The AlertDialog should be inside AppLayout.

## 2. Dashboard Redesign (Index.tsx)

Replace current quick actions and widget layout with **grouped action hubs**, each with a distinct color theme:

| Group | Actions | Color |
|-------|---------|-------|
| Sales | Sales Order, Invoice, Warranty, Payment | Blue/Indigo |
| Purchase | Purchase Order | Emerald/Teal |
| Inventory | Products, Stock Movements | Amber/Orange |
| Printing | Print Jobs | Violet/Purple |
| Finance | Expenses, Bank Accounts | Rose/Pink |

Each group is a card with a colored left border and icon header, containing 2-4 small action buttons inside.

**Remove**: Inactive Customers widget entirely (state, load function, and JSX).

**Move**: Smart Reorder Alerts to the bottom, just above the AI Insights CTA card.

Keep: Stats strip (week/month/margin), New Stock In, Top Selling, Top Customers panels.

## 3. WhatsApp Ledger Sharing (CustomerLedger.tsx + SupplierLedger.tsx)

Add a "Share via WhatsApp" button in the headerActions of both ledger pages:
- Generates a text summary: Party name, Total Sales/Purchases, Total Payments, Outstanding balance, date range
- Opens WhatsApp with pre-filled message to the party's phone number (from customer/supplier record)
- If no phone number, show toast "No phone number on record"

## Files Changed

| File | Action |
|------|--------|
| `src/pages/PrintJobs.tsx` | Fix — remove `</main></div>` remnants |
| `src/pages/BankAccounts.tsx` | Fix — proper container wrapping inside AppLayout |
| `src/pages/Expenses.tsx` | Fix — remove SidebarProvider remnant, close AppLayout properly |
| `src/pages/Index.tsx` | Redesign — grouped action hubs, remove inactive customers, move reorder to bottom |
| `src/pages/CustomerLedger.tsx` | Add WhatsApp share button |
| `src/pages/SupplierLedger.tsx` | Add WhatsApp share button |

