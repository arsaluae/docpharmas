

# Fix: Data Import Only Supports CSV, Not Excel (.xlsx)

## Problem
The user uploaded an `.xlsx` (Excel) file, but the import page only has a CSV parser. It reads the raw binary content of the Excel file as text, producing garbled XML output (the internal structure of .xlsx files) instead of actual row data.

## Solution
Add Excel (.xlsx) file support using the `xlsx` (SheetJS) library to parse Excel files client-side, alongside the existing CSV parser.

## Changes

### 1. Install `xlsx` package
- Add `xlsx` (SheetJS Community Edition) — a client-side Excel parser, no server needed.

### 2. Update `src/pages/DataImport.tsx`
- Change the file input `accept` attribute from `.csv` to `.csv,.xlsx,.xls`
- Detect file type by extension
- For `.xlsx`/`.xls`: use `xlsx.read()` to parse the workbook, extract the first sheet, convert to array-of-arrays via `xlsx.utils.sheet_to_json({ header: 1 })`
- For `.csv`: keep existing `parseCSV` logic
- Both paths produce the same `headers[]` + `parsedRows[][]` format, so the rest of the page (preview table, import logic, batch delete) works unchanged

### 3. No database or backend changes needed

