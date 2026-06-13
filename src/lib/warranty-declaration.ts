// ============================================================================
// Warranty Declaration — token-based template.
// Tokens are replaced at print time from sales-rep + company snapshot fields
// stored on the warranty_invoices row. Editable in Settings → Documents →
// Warranty Note.
// ============================================================================

export const WARRANTY_NOTE_TEXT =
`It is certified that I, {{sales_rep_name}}, {{relation}} {{father_name}}, having NIC # {{sales_rep_cnic}}, being an authorized agent No. {{agent_license_number}} valid up to {{agent_license_expiry}}, on behalf of M/s {{company_name}}:

1. It is hereby certified that the following finished products have been supplied by me.

2. It is hereby certified and I undertake that the above-mentioned finished products of the specified Batch Number supplied by me do not contravene any provision of the Act and rules framed thereunder.

The Authorized Agent shall pass on this warranty to the retailers in his area of jurisdiction during the supply of medicines and health products.`;

export interface WarrantyTokenContext {
  salesRepName?: string | null;
  fatherName?: string | null;
  salesRepCnic?: string | null;
  agentLicenseNumber?: string | null;
  agentLicenseExpiry?: string | null;
  companyName?: string | null;
  gender?: string | null;
}

export function renderWarrantyDeclaration(template: string, ctx: WarrantyTokenContext): string {
  const rel = ctx.gender === "female" ? "D/O" : "S/O";
  const t = (v: string | null | undefined) => (v && v.trim()) ? v : "______________";
  return (template || WARRANTY_NOTE_TEXT)
    .replace(/\{\{\s*sales_rep_name\s*\}\}/gi, t(ctx.salesRepName))
    .replace(/\{\{\s*father_name\s*\}\}/gi, t(ctx.fatherName))
    .replace(/\{\{\s*sales_rep_cnic\s*\}\}/gi, t(ctx.salesRepCnic))
    .replace(/\{\{\s*agent_license_number\s*\}\}/gi, t(ctx.agentLicenseNumber))
    .replace(/\{\{\s*agent_license_expiry\s*\}\}/gi, t(ctx.agentLicenseExpiry))
    .replace(/\{\{\s*company_name\s*\}\}/gi, t(ctx.companyName))
    .replace(/\{\{\s*relation\s*\}\}/gi, rel);
}

export const WARRANTY_TOKEN_HELP = [
  { token: "{{sales_rep_name}}", desc: "Sales rep full name" },
  { token: "{{father_name}}", desc: "Sales rep father name" },
  { token: "{{relation}}", desc: "S/O or D/O (auto from gender)" },
  { token: "{{sales_rep_cnic}}", desc: "Sales rep CNIC" },
  { token: "{{agent_license_number}}", desc: "Agent license number" },
  { token: "{{agent_license_expiry}}", desc: "Agent license expiry" },
  { token: "{{company_name}}", desc: "Your company name" },
];
