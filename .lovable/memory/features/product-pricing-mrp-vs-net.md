---
name: Product pricing — Net Price vs MRP
description: selling_price = Net Price (all math/ledger); mrp = display-only Market Retail Price on invoices
type: feature
---
`products.selling_price` is the **Net Price** — source of truth for every invoice line `rate`, GST, WHT, COGS, customer balance, P&L, receivables, and stock valuation. UI labels it "Net Price" everywhere; the DB column name stays `selling_price` (renaming would touch hundreds of files / triggers).

`products.mrp` is **Market Retail Price** — informational, printed on invoices/proformas/delivery-notes for reference, never used in any aggregate, ledger posting, or report calculation. When `mrp = 0` the PDFs render "—" rather than falling back to selling_price (the old behaviour was misleading).

Forms (`Products.tsx`, `QuickCreateProductDialog.tsx`) expose both fields side-by-side. MRP is optional.
