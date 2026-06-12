# Warranty Note — Polished Declaration + Clean PDF Download

Two changes, both isolated to warranty-note rendering. No business logic touched.

## 1. New declaration text & resolved variables

Update `DEFAULT_WARRANTY_DECLARATION` in `src/lib/warranty-declaration.ts` to the exact paragraph the user pasted, with proper variable tokens so admin data fills in automatically:

```
It is certified that I, {{sales_rep_name}} D/O {{father_name}}
having NIC # {{sales_rep_cnic}}, being an authorized agent
No. {{agent_license_number}} valid up to {{agent_license_expiry}},
on behalf of M/s {{company_name}}:

1. It is hereby certified that the following finished products have been supplied by me.

2. It is hereby certified and I undertake that the above-mentioned finished
   products of the specified Batch Number supplied by me do not contravene any
   provision of the Act and rules framed thereunder.

The Authorized Agent shall pass on this warranty to the retailers in his area
of jurisdiction during the supply of medicines and health products.
```

Add a new variable `{{relation}}` (defaults to "S/O" or "D/O" based on `sales_agents.gender`, falling back to "S/O") so the certificate reads correctly for male or female reps. Add `gender` column to `sales_agents` (text, nullable) and a small select in the Sales Agents dialog.

Anyone who already customised their declaration keeps their version — only the default seed and the "Restore Default" button are updated. Existing tenants with the old default text get a one-time migration that rewrites `company_settings.warranty_note_text` only when it still matches the previous default string.

## 2. Polished PDF layout

In `buildWarrantyNoteHtml` (`src/lib/pdf-generator.ts`):

- Replace the boxed "Warranty Declaration" panel with a typographically clean block: justified body, 13px / line-height 1.8, numbered list rendered as a real `<ol>` with hanging indent, and a hairline rule above instead of a filled card.
- Bold the resolved values (name, NIC, license, expiry, company) inline so reviewers can scan the certificate at a glance.
- Tighten the signature row: stamp left + signature right with a single shared baseline, "Sales Rep" / "Prepared By" labels matching the screenshot.
- Remove the muted "System generated warranty note · INV-…" footer line — the user wants the page to feel like a real document.

## 3. Clean "Save as PDF" (no browser URL/timestamp)

The current Download button opens `window.print()`, which lets Chrome inject the URL + date footer. To produce a truly clean file:

- Add `html2pdf.js` (wraps `html2canvas` + `jsPDF`, ~small footprint, MIT).
- In `PdfPreviewDialog`, change the header button to **Save as PDF** which renders the active iframe HTML to A4 via html2pdf and triggers a direct download named `Warranty-Note-{invoiceNumber}.pdf`. Keep a secondary **Print** menu item for users who still want the print dialog.
- For all other documents (sales invoice, proforma, etc.) the same Save as PDF flow applies — same dialog, no per-document change needed.
- Set `@page { size: A4; margin: 0 }` on the print stylesheet so the browser-print fallback also drops headers/footers in Chrome (user still needs to untick "Headers and footers" in some browsers, but html2pdf path makes it irrelevant).

## Files touched

- `src/lib/warranty-declaration.ts` — new default text, add `relation` variable
- `src/lib/pdf-generator.ts` — polished declaration block, remove system footer, `@page` margin 0
- `src/components/PdfPreviewDialog.tsx` — Save as PDF via html2pdf, Print as secondary
- `src/pages/SalesAgents.tsx` — gender select
- `package.json` — add `html2pdf.js`
- One migration: add `sales_agents.gender`, soft-update old default `warranty_note_text`

## Out of scope

- No changes to sales invoice / delivery note layouts beyond the shared Save-as-PDF button.
- Sandbox/UAT and other unrelated features untouched.
