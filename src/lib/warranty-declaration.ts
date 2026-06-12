// ============================================================================
// Warranty Declaration — variables, defaults, and renderer.
// The declaration text is editable via Settings → Company. All warranty-note
// PDFs render it through `renderDeclaration` so variables resolve at print time
// with values from the assigned Sales Representative + company settings.
// ============================================================================

export const DEFAULT_WARRANTY_DECLARATION =
`It is certified that I, {{sales_rep_name}} {{relation}} {{father_name}} having NIC # {{sales_rep_cnic}}, being an authorized agent No. {{agent_license_number}} valid up to {{agent_license_expiry}}, on behalf of M/s {{company_name}}:

1. It is hereby certified that the following finished products have been supplied by me.

2. It is hereby certified and I undertake that the above-mentioned finished products of the specified Batch Number supplied by me do not contravene any provision of the Act and rules framed thereunder.

The Authorized Agent shall pass on this warranty to the retailers in his area of jurisdiction during the supply of medicines and health products.`;

export interface DeclarationVariableDef {
  key: string;
  label: string;
  example: string;
}

export const DECLARATION_VARIABLES: DeclarationVariableDef[] = [
  { key: "company_name",           label: "Company Name",          example: "DocPharmas (Pvt) Ltd" },
  { key: "sales_rep_name",         label: "Sales Rep Name",        example: "Muhammad Ali" },
  { key: "relation",               label: "Relation (S/O · D/O)",  example: "S/O" },
  { key: "father_name",            label: "Father Name",           example: "Ahmed Khan" },
  { key: "sales_rep_cnic",         label: "Sales Rep CNIC",        example: "35202-1234567-1" },
  { key: "agent_license_number",   label: "Agent License Number",  example: "PUN-DSL-12345" },
  { key: "agent_license_expiry",   label: "Agent License Expiry",  example: "31-12-2027" },
];

export interface DeclarationVars {
  company_name?: string | null;
  sales_rep_name?: string | null;
  father_name?: string | null;
  sales_rep_cnic?: string | null;
  agent_license_number?: string | null;
  agent_license_expiry?: string | null;
  /** "S/O" | "D/O" — derived from sales_agents.gender, defaults to S/O */
  relation?: string | null;
}

/** Replace `{{key}}` tokens with values; missing → blank underline placeholder. */
export function renderDeclaration(template: string, vars: DeclarationVars): string {
  const map: Record<string, string> = {
    company_name:         (vars.company_name ?? "").trim(),
    sales_rep_name:       (vars.sales_rep_name ?? "").trim(),
    father_name:          (vars.father_name ?? "").trim(),
    sales_rep_cnic:       (vars.sales_rep_cnic ?? "").trim(),
    agent_license_number: (vars.agent_license_number ?? "").trim(),
    agent_license_expiry: (vars.agent_license_expiry ?? "").trim(),
    relation:             (vars.relation ?? "S/O").trim() || "S/O",
  };
  return (template || "").replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, k) => {
    const v = map[String(k).toLowerCase()];
    return v ? v : "__________";
  });
}
