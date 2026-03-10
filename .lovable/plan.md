

# Fix WhatsApp, Add Stats to Status Cards, Quick WhatsApp Button

## 1. WhatsApp Fix (COOP Error)
The `web.whatsapp.com/send` URL triggers a Cross-Origin Opener Policy (COOP) block in Firefox (screenshot shows this). Fix: switch to `api.whatsapp.com/send` which is the official WhatsApp API redirect — works universally on desktop, mobile, and web without COOP issues.

**Files**: `ProformaInvoices.tsx`, `PurchaseProforma.tsx`, `SupplierLedger.tsx`, `WhatsAppButton.tsx`

## 2. Quick WhatsApp Button on All Rows (Including Paid)
Currently WhatsApp is buried in the `...` dropdown. Add a visible WhatsApp icon button next to the primary actions for ALL statuses (draft, invoiced, paid, etc.) so it's always one-click accessible.

**Files**: `ProformaInvoices.tsx`, `PurchaseProforma.tsx`

## 3. Rich Stats on Status Cards + Month Selector
Currently each card shows only `count` and `label`. Enhance to show:

| Card | Line 1 | Line 2 |
|------|--------|--------|
| All | Count | Total value (PKR) |
| Draft | Count | Total value |
| Invoice | Count | Total value |
| Paid | Count | Total paid amount |
| Delivery Notes | Count | Total units dispatched |

Add a **month selector** (dropdown or left/right arrows) above the status cards so stats can be filtered by month. Default = current month. Same for Purchase page.

**Files**: `ProformaInvoices.tsx`, `PurchaseProforma.tsx`

## Technical Details

### WhatsApp URL change (all files)
```
- https://web.whatsapp.com/send?phone=...
+ https://api.whatsapp.com/send?phone=...
```

### Status card enhancement
- Add `value` display below count: `PKR ${value.toLocaleString()}`
- For Paid card: show `amount_paid` sum instead of `total`
- For DN card: compute total units from `items` arrays
- Increase card height slightly to accommodate the extra line
- Add month picker state: `const [statsMonth, setStatsMonth] = useState(currentYearMonth)`
- Filter orders by `statsMonth` when computing stats

### Quick WhatsApp button
- Add a small green WhatsApp icon button alongside Submit/Payment for every row status

## Files to Edit
| File | Changes |
|------|---------|
| `src/pages/ProformaInvoices.tsx` | Fix WA URL, add WA button to all rows, enhanced stats cards with month filter |
| `src/pages/PurchaseProforma.tsx` | Mirror all changes |
| `src/pages/SupplierLedger.tsx` | Fix WA URL |
| `src/components/WhatsAppButton.tsx` | Fix WA URL |

