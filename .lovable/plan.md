

# Fix: Remove Print Job Double-Counting in Product Costing

## Problem

Printing costs are counted **twice** in the Product Costing report:

1. Once from `additional_costs` table (where settled print jobs auto-insert a record via `handleSettle()`)
2. Again directly from the `print_jobs` table (lines 72-76 of ProductCosting.tsx add `total_cost` as "printing")

Since the settle flow already syncs print job costs into `additional_costs`, the direct `print_jobs` query in ProductCosting is redundant and inflates margins incorrectly.

## Fix

**File: `src/pages/reports/ProductCosting.tsx`**

- Remove the `print_jobs` query from the `Promise.all` call (no longer needed)
- Remove lines 72-76 that add `print_jobs.total_cost` directly as "printing" costs
- Keep the `additional_costs` processing for `reference_type === "print_job"` (this already captures settled print job costs correctly)
- For the PO item distribution logic that references `printJobsRes`, update to resolve `print_job` reference types by querying `print_jobs` only for the product_id lookup (or better: add `product_id` context when inserting the `additional_costs` record from PrintJobs settle, eliminating the need entirely)

**Simpler approach**: Since `additional_costs` for print jobs don't currently store `product_id` directly (they use `reference_id` pointing to the print job), we still need the `print_jobs` query for the product lookup — but we must remove the separate "also add settled print job costs" block (lines 72-76).

### Changes

1. **`src/pages/reports/ProductCosting.tsx`**: Remove lines 72-76 (the block that adds `pj.total_cost` as duplicate "printing" costs). Keep the `print_jobs` query only for resolving `product_id` from `reference_type === "print_job"` additional costs.

One file, ~5 lines removed. No other changes needed.

