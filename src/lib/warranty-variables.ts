// ============================================================================
// Warranty Invoice token replacement.
// Tokens are written in {{name}} form by users in the rich-text notes editor
// (Settings template OR per-invoice notes). They are substituted at render time
// — never at save time, so historical invoices always reflect the same source
// of truth.
// ============================================================================

export interface WarrantyVarContext {
  company_name?: string | null;
  distributor_name?: string | null;
  distributor_mobile?: string | null;
  distributor_address?: string | null;
  license_number?: string | null;
  license_expiry?: string | null;
  ntn?: string | null;
  cnic?: string | null;
  warranty_invoice_number?: string | null;
  date?: string | null;
  due_date?: string | null;
  created_by?: string | null;
  sales_rep_name?: string | null;
}

const BLANK = "______________";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function replaceWarrantyTokens(html: string, ctx: WarrantyVarContext): string {
  if (!html) return "";
  return html.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
    const value = (ctx as any)[key.toLowerCase()];
    if (value === null || value === undefined || value === "") return BLANK;
    return escapeHtml(String(value));
  });
}

export const WARRANTY_TOKENS: { token: string; description: string }[] = [
  { token: "{{company_name}}", description: "Your company name" },
  { token: "{{distributor_name}}", description: "Distributor / customer name" },
  { token: "{{distributor_mobile}}", description: "Distributor mobile" },
  { token: "{{distributor_address}}", description: "Distributor address" },
  { token: "{{license_number}}", description: "Customer license number" },
  { token: "{{license_expiry}}", description: "Customer license expiry" },
  { token: "{{ntn}}", description: "NTN" },
  { token: "{{cnic}}", description: "CNIC" },
  { token: "{{warranty_invoice_number}}", description: "This warranty invoice #" },
  { token: "{{date}}", description: "Invoice date" },
  { token: "{{due_date}}", description: "Due date" },
  { token: "{{created_by}}", description: "User who created the invoice" },
  { token: "{{sales_rep_name}}", description: "Sales representative" },
];

export const DEFAULT_WARRANTY_NOTES_HTML = `
<p>It is hereby certified that the goods listed in this invoice have been supplied by <strong>{{company_name}}</strong> to <strong>{{distributor_name}}</strong> against License No. <strong>{{license_number}}</strong>.</p>
<ol>
  <li>The undersigned undertakes that the above-mentioned products of the specified batch numbers do not contravene any provision of the Drug Act 1976 and rules framed thereunder.</li>
  <li>The authorized distributor shall pass on this warranty to retailers in their jurisdiction during onward supply.</li>
</ol>
<p><em>Issued on {{date}} — Warranty Invoice <strong>{{warranty_invoice_number}}</strong>.</em></p>
`.trim();
