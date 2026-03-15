

# Merge "Printing" into "Inventory" Section

## Problem
"Printing" still appears as its own sidebar section even though printing costs now flow through Landed Costs. This creates redundancy and confusion.

## Fix
Move "Printers" and "Print Jobs" into the **Inventory** section and remove the standalone "Printing" section entirely.

**File: `src/components/AppSidebar.tsx`**

Update `allSections`:
- Add `Printers` and `Print Jobs` items to the Inventory section (after Landed Costs)
- Delete the entire `{ label: "Printing", ... }` section object

Result — Inventory section will contain:
1. Products & Stock
2. Stock Movements
3. Landed Costs
4. Printers
5. Print Jobs

One file, ~5 lines changed.

