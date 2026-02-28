

# Plan: Bulk Delete, Proforma Approval Flow, Enhanced Expenses & Profitability

## 1. Bulk Select & Delete for Customers and Suppliers

**Files**: `src/pages/Customers.tsx`, `src/pages/Suppliers.tsx`

- Add a `selectedIds: Set<string>` state and a "select all" checkbox in the table header
- Add individual checkboxes per row
- Show a floating action bar when selection is active: "Delete X selected" button
- On bulk delete: cascade-delete related `customer_licenses` for customers, then delete the selected records. Show error if any have linked invoices.

## 2. Proforma Approval Flow (Sales & Purchase)

**Files**: `src/pages/ProformaInvoices.tsx`, `src/pages/PurchaseProforma.tsx`

Currently proformas go from `draft` → `converted`. Add an intermediate `approved` status:

- **Draft** → user clicks "Approve" → status becomes `approved`
- **Approved** → user clicks "Convert to Invoice" → status becomes `converted`
- Only `approved` proformas can be converted (hide Convert button for drafts)
- Add "Approve" button in the actions column for draft proformas
- After invoice is created, show "Create Delivery Note" button on the invoice row (already partially exists via DeliveryNotes page, but add a direct action button)

## 3. Enhanced Expense Categories

**File**: `src/pages/Expenses.tsx`

Expand the `CATEGORIES` array from the current 8 to a comprehensive list:
```
"salaries", "rent", "utilities", "transport", "travel", "food", 
"maintenance", "marketing", "regulatory", "license_renewal", 
"personal", "insurance", "office_supplies", "communication", 
"professional_fees", "depreciation", "other"
```

No database change needed — `category` is a text field.

## 4. Comprehensive P&L Report

**File**: `src/pages/reports/ProfitLoss.tsx`

Enhance to show:
- **Revenue** (sales invoices total)
- **Sales Returns** deducted from revenue → **Net Revenue**
- **COGS** (purchase invoices subtotal)
- **Purchase Returns** deducted from COGS → **Net COGS**
- **Gross Profit** = Net Revenue - Net COGS
- **Gross Margin %**
- **Operating Expenses** broken down by all categories
- **Net Profit** = Gross Profit - Total Expenses
- **Net Profit Margin %**

Query `sales_returns` and `purchase_returns` tables in addition to the existing queries.

## 5. No Database Changes Required

All changes are front-end only:
- Expense categories are stored as text — just expand the dropdown options
- Proforma status is stored as text — `approved` is a new valid value, no constraint needed
- Bulk delete uses existing delete endpoints

## Summary of File Changes

| File | Change |
|------|--------|
| `Customers.tsx` | Add select-all checkbox, bulk delete with cascade |
| `Suppliers.tsx` | Add select-all checkbox, bulk delete |
| `ProformaInvoices.tsx` | Add "Approve" button, restrict Convert to approved only |
| `PurchaseProforma.tsx` | Add "Approve" button, restrict Convert to approved only |
| `Expenses.tsx` | Expand categories list |
| `ProfitLoss.tsx` | Add returns, margins, comprehensive breakdown |

