

# Segregate Expenses: Personal vs Business + UX Improvements

## Database Change
Add an `expense_type` column to the `expenses` table:
- `expense_type` text, default `'business'`, values: `'business'` or `'personal'`

## UI Redesign (`src/pages/Expenses.tsx`)

### Tab-based segregation
- Add **Tabs** at the top: "Business" | "Personal" | "All" -- each tab filters by `expense_type`
- Show separate totals per tab (Business total, Personal total)
- Summary cards above the table: Total Business, Total Personal, Grand Total

### Improved Add Expense dialog
- Add a **Business / Personal** toggle (radio group) at the top of the form -- defaults to whichever tab is active
- Auto-suggest category based on type: personal tab defaults to "personal" category, business tab defaults to "other"
- Categories split contextually:
  - **Business**: salaries, rent, utilities, transport, travel, maintenance, marketing, regulatory, license_renewal, insurance, office_supplies, communication, professional_fees, depreciation, other
  - **Personal**: food, transport, travel, personal, other

### Filter improvements
- Add a **Type filter** dropdown alongside category filter (or use the tabs)
- Keep search + category filter working within the selected tab

### Table enhancements
- Add a colored badge for expense type: blue for Business, purple for Personal
- Show type column in the "All" tab

## Files Changed

| File | Change |
|------|--------|
| New migration | Add `expense_type` text column to `expenses` |
| `src/pages/Expenses.tsx` | Tabs for Business/Personal/All, summary cards, type toggle in form, contextual categories, type badge in table |

