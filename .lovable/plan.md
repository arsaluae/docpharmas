

# Plan: Fix Import Errors + Premium UI Overhaul

## Root Cause of "221 skipped"

The `products` table has a CHECK constraint (`products_category_check`) that only allows **lowercase** values: `tablet`, `capsule`, `syrup`, `injection`, `cream`, `ointment`, `drops`, `sachet`, `other`.

The Excel file has **capitalized** values like "Syrup", "Tablet" — these fail the constraint and every single row is rejected.

## Fix #1: Auto-lowercase category during import

In `buildRowObjects()`, normalize the `category` field to lowercase before inserting. Also map any unrecognized categories to `"other"` so the constraint never fails.

## Fix #2: Premium UI overhaul for DataImport page

Current UI uses plain HTML file input, basic colored chips, and utilitarian layout. Redesign to match the "Ivory Clinical" premium theme:

- **Drag-and-drop upload zone** with dashed border, icon, and hover animation (replacing raw `<input type="file">`)
- **Glass-card styling** with subtle shadows and backdrop blur on the mapping chips
- **Premium mapping badges** using the theme's Electric Sapphire for mapped columns, soft lavender for special columns, and muted for ignored
- **Animated progress bar** with sapphire gradient during import
- **Results card** with premium styling — success count in sapphire, errors in rose pink (matching theme's destructive color)
- **Tab pills** styled to match the rest of the app
- **Better typography** — Sora for headings, DM Sans for data, proper spacing
- **File info card** showing filename, row count, and column match summary in a polished layout
- **Error details** in a collapsible section with rose-themed styling instead of amber

## Changes

### Database Migration
- Drop the `products_category_check` constraint and replace with a more flexible validation trigger that lowercases input — OR simply lowercase in the app code before insert (simpler, no migration needed)

### `src/pages/DataImport.tsx`
1. **Category normalization**: In `buildRowObjects`, add `obj.category = obj.category?.toLowerCase()` and map unknown values to `"other"`
2. **Drag-and-drop upload**: Replace `<input type="file">` with a styled drop zone using `onDragOver`/`onDrop` handlers
3. **Premium mapping badges**: Redesign column mapping chips with theme colors (sapphire for mapped, lavender for special, muted for ignored)
4. **Glass-card results section**: Redesign the import result area with gradient accents and better visual hierarchy
5. **Animated progress**: Add gradient styling to the Progress component during import
6. **File info display**: Show file name and stats in a polished card after parsing
7. **Better table preview**: Add alternating row colors, rounded container, and max-height with smooth scroll

## Files Changed

| File | Change |
|------|--------|
| `DataImport.tsx` | Fix category lowercase, premium drag-drop UI, theme-matched colors, better results display |

