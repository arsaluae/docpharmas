# Warranty Invoice — UI + Template Rebuild

Goal: match the supplied "Warranty Note" PDF format precisely, fix the misaligned party block, allow scratch creation, and polish the dialog.

---

## Part 1 — Warranty Note PDF template (dedicated renderer)

Today the warranty PDF is generated through the generic `generatePdfHtml(...)` invoice template. That template can't reproduce the warranty layout (distributor block on the right, dual License Number/Expiry rows, MRP Inc. Tax column, full statutory "Note", Total in Words + Inv Balance in Words, single "Sales Rep / Prepared By" signature). I'll add a dedicated branch.

Files: `src/lib/pdf-generator.ts`, `src/pages/WarrantyInvoices.tsx`.

**Header (top of page):**
- Larger company logo + name block on the left (per the global design pass already in place).
- Centered title: `Warranty Note`.
- Right side: `Inv No.`, `Date`, `Due Date`, `Created By` rows.

**Party block (two columns, exactly like the sample):**
- Left column: `Mobile` (distributor phone), `NTN`, `CNIC`, `License Number`, `Expiry` — each on its own line with label + value (fixes the current bug where labels stack with no values).
- Right column header: **`Warranty Address`** followed by the full distributor block: distributor name (e.g. "M/S ALI PHARMA"), address, `Licence No: …`, `Valid up to: …`.
- Important: this prints the **distributor** (warranty address), never the customer's own address. The customer is only used internally for lookup.

**Items table — exact columns from the sample:**
`SrNo · Product Name · Product Description · Quantity · Rate · Batch No. · Batch Expiry · Discount · Amount · MRP Inc. Tax`

- Product Description falls back to product name when no separate description exists.
- Batch Expiry rendered as `MM-YY` (matches sample).
- Numbers right-aligned, `tabular-nums`, two-decimal money.
- MRP Inc. Tax column renders the product's MRP (gross) — `—` when 0.

**Totals strip:** single `Total: Rs. <amount>` row (no GST/Subtotal split, matching sample). Underneath:
- `Total in Words` line.
- `Inv Balance in Words` line.

**Note block (compliance text):** rendered verbatim from `document_templates.footer_text` for `warranty_invoice` (already seeded with the correct legal paragraph). Numbered points kept.

**Signature:** single `Sales Rep / Prepared By` label, right side.

**Footer:** `This is a system generated invoice and does not require any signatures.`

No gradients/shadows in print. A4 single-page, 11mm margins.

---

## Part 2 — Use distributor (warranty address) as printed party

Already stored on the row (`pharmacy_name`, `pharmacy_address`, `pharmacy_license_no`, plus `distributor_id`). The new renderer reads `customer_distributors` for `phone` and `license_expiry` (currently dropped on the floor) so all five left-column fields populate. The customer's own address/phone is never printed on the warranty note.

---

## Part 3 — Allow "Create from scratch" when no sales invoice exists

File: `src/pages/WarrantyInvoices.tsx`.

In Step 2 (`select_invoice`):
- Always show a **`Start blank — no sales invoice`** button at the top of the list (not only when the list is empty).
- Clicking it sets `selectedInvoiceId=""`, leaves `items` empty, and jumps to Step 3.

In Step 3 (`edit_items`) add an **`+ Add Item`** row picker:
- `SearchableSelect` of all active products.
- On pick, push a `LineItem` with `mrp = product.mrp || product.selling_price`, `tp_rate = round(mrp * 0.85, 2)`, `quantity = 1`, empty batch/expiry, `amount = tp_rate`.
- Same row is also useful for invoice-sourced flows when the user wants to add an extra line.

Save path already works for `source_invoice_id = null`.

---

## Part 4 — Dialog UI polish

File: `src/pages/WarrantyInvoices.tsx`.

- Wider dialog (`max-w-5xl`) and roomier spacing — matches the global premium scale already shipped.
- Step indicator (`1 Customer → 2 Invoice → 3 Items`) at the top of the dialog.
- Step 1: stack `Customer` picker on top, with a secondary `Distributor (Warranty Address)` pre-selector visible so users know that's the printed party.
- Step 3 grid uses the larger inputs/labels (Date, Distributor with **Add Distributor** button already present, plus a new **Source Invoice** read-only chip showing `SI-####` or `Blank`).
- Items table given the same +25% row height + larger fonts as the rest of the app (uses standard `Table` primitives now).
- Totals block enlarged: prominent `Total` in 24px tabular-nums.
- Inline preview of the Warranty Address chosen distributor — name + address + license — so the user can confirm before saving.

---

## Part 5 — List screen polish

- Add `Distributor` column (currently shown as "Pharmacy") and a `Source Invoice` column showing the linked SI number or `—`.
- Use the same larger row height / typography as the rest of the redesign.

---

## Acceptance
- Warranty PDF visually matches the supplied "Warranty Note" sample (header, party block, columns including `MRP Inc. Tax`, totals, words, legal note, signature, footer).
- Left party block labels (`Mobile / NTN / CNIC / License Number / Expiry`) each have their value on the same line — no more orphan labels.
- Right party block is titled **Warranty Address** and shows the **distributor**, never the customer's own address.
- "New Warranty Invoice" works end-to-end with **no sales invoice selected** (Start blank → add products → save).
- Product MRP is fetched from `products.mrp` and printed in the `MRP Inc. Tax` column; TP rate auto = MRP × 0.85.
- Dialog feels premium: larger fonts, clear step header, distributor preview card.

## Open question
The sample shows a generic statutory note tied to a specific agent ("Miss UFAQ ISHIAQ … 09-341-0157-041722D"). Should this be:
- **(A)** kept as static text in `document_templates.footer_text` (one note for all warranty invoices), or
- **(B)** stored per-tenant in `company_settings.warranty_note_text` so admins can edit the agent name/license/expiry once in Settings and have every warranty note reflect it?

I'll go with **(B)** unless you say otherwise — it's only a settings field + one textarea in Settings, and avoids ever shipping the wrong agent name.
