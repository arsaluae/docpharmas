# Warranty Note — Hardcode Declaration, Remove Sales Rep

Lock the warranty note to the exact template in the screenshot. Strip the sales rep dependency entirely from the warranty workflow.

## 1. Hardcode the declaration

Replace the variable-driven declaration with a single fixed paragraph block, rendered verbatim on every warranty note (no `{{...}}` tokens, no settings template, no per-agent resolution):

```
It is certified that I, Miss UFAQ ISHIAQ D/O Ishtiaq Ahmed, having
NIC # 3520-28328903-4, being an authorized agent No. 09-341-0157-041722D
valid up to 12-04-2028, on behalf of M/s MOUJ PHARMACEUTICALS:

1. It is hereby certified that the following finished products have
   been supplied by me.

2. It is hereby certified and I undertake that the above-mentioned
   finished products of the specified Batch Number supplied by me do
   not contravene any provision of the Act and rules framed thereunder.

The Authorized Agent shall pass on this warranty to the retailers in his
area of jurisdiction during the supply of medicines and health products.
```

- Move the constant into `src/lib/warranty-declaration.ts` as `WARRANTY_NOTE_TEXT` (single export, no renderer, no variables, no defaults function).
- Delete `DECLARATION_VARIABLES`, `renderDeclaration`, `DeclarationVars`, and the `{{relation}}` logic.
- `src/lib/pdf-generator.ts` renders that string directly. Numbered points get a hanging indent; the closing sentence stays as its own paragraph. Font size, alignment, and spacing match the screenshot (≈10.5pt body, justified, 1.35 line-height, 8mm above signature row).

## 2. Remove Sales Rep from warranty

In `src/pages/WarrantyInvoices.tsx`:
- Drop the **Sales Representative** select from the create/edit dialog.
- Remove the agent-completeness validation, the agent-profile warning pill, and the "assign rep on legacy PDF" prompt.
- Stop reading/writing `sales_agent_id` for warranty invoices (column stays in DB, just always saved as `null`). No migration.
- Remove the agent fetch + gender/license/cnic/father-name lookups in the PDF generator path.
- Keep the **Created By** line on the printed note bound to the logged-in user's name (unchanged), since that already matches "Created By Miss. Uffaq Ishtiaq" in the screenshot.

## 3. Settings cleanup

In `src/pages/Settings.tsx` (Documents → Warranty Declaration section):
- Remove the editable template textarea and the variable-token helper.
- Replace with a read-only preview card showing the hardcoded text and a one-line note: *"Warranty declaration text is fixed and cannot be edited."*
- `useCompanySettings` keeps the `warranty_note_text` column for backwards compat but it is no longer read by the PDF generator.

## 4. Batch picker + clean PDF — keep as-is

The previously-shipped batch dropdown (auto-fills expiry from `getActiveBatches`) and the iframe-based clean Save-as-PDF stay in place. No regressions.

## Files touched

- `src/lib/warranty-declaration.ts` — collapse to a single hardcoded constant
- `src/lib/pdf-generator.ts` — render the constant directly, drop variable resolution
- `src/pages/WarrantyInvoices.tsx` — remove sales-rep field, validation, and PDF data-fetch for agent
- `src/pages/Settings.tsx` — replace template editor with read-only preview

## Out of scope

- No DB migration. No changes to Sales Agents, other PDF templates, batch picker, or Save-as-PDF pipeline.

## Acceptance

- Warranty note PDF shows the exact paragraph above on every invoice, regardless of who created it.
- Warranty create/edit dialog has no Sales Representative field.
- Settings → Warranty Declaration shows a read-only preview; no edit affordance.
- No `{{...}}` tokens, no `__________` blanks, no per-agent branches anywhere in the warranty PDF code path.
