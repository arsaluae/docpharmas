/**
 * WhatsApp Templates Engine
 * Tenant-scoped editable WhatsApp message templates with variable substitution.
 * Templates live in `whatsapp_templates` (RLS: tenant_id + settings.write to edit).
 */
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type WaDocType =
  | "sales_order"
  | "sales_invoice"
  | "delivery_note"
  | "customer_ledger"
  | "payment_receipt"
  | "sales_return"
  | "outstanding_reminder"
  | "expiry_followup";

export const DOC_TYPE_META: { key: WaDocType; label: string }[] = [
  { key: "sales_order",         label: "Sales Order" },
  { key: "sales_invoice",       label: "Sales Invoice" },
  { key: "delivery_note",       label: "Delivery Note" },
  { key: "sales_return",        label: "Sales Return" },
  { key: "payment_receipt",     label: "Payment Receipt" },
  { key: "customer_ledger",     label: "Customer Ledger" },
  { key: "outstanding_reminder",label: "Outstanding Reminder" },
  { key: "expiry_followup",     label: "Expiry / Stock Follow-up" },
];

/** Catalog of supported placeholders, grouped for the editor's variable picker. */
export const VARIABLE_GROUPS: { label: string; vars: string[] }[] = [
  { label: "Company",  vars: ["company_name","company_phone","company_email","company_address"] },
  { label: "Customer", vars: ["customer_name","customer_code","customer_phone","customer_city","customer_address"] },
  { label: "Document", vars: ["document_type","document_number","document_date","due_date","validity_days","document_total","amount_in_words","document_status"] },
  { label: "Sales Agent", vars: ["sales_agent_name","sales_agent_phone"] },
  { label: "Ledger",   vars: ["opening_balance","debit_total","credit_total","closing_balance","outstanding_amount"] },
  { label: "Payment",  vars: ["payment_amount","payment_date","payment_method","payment_reference"] },
  { label: "Link",     vars: ["document_link","ledger_link","payment_receipt_link"] },
];

export const ALL_VARIABLES: string[] = VARIABLE_GROUPS.flatMap(g => g.vars);

/** Default message bodies (used when no DB row exists). */
export const DEFAULT_TEMPLATES: Record<WaDocType, { name: string; body: string }> = {
  sales_order: {
    name: "Sales Order",
    body:
`Hello {{customer_name}},
Your Sales Order #{{document_number}} has been created.

Total: PKR {{document_total}}
Validity: {{validity_days}} days

View Order:
{{document_link}}

Regards,
{{company_name}}
{{company_phone}}`,
  },
  sales_invoice: {
    name: "Sales Invoice",
    body:
`Hello {{customer_name}},
Your {{document_type}} #{{document_number}} dated {{document_date}} has been generated.

Total Amount: PKR {{document_total}}

View / Download:
{{document_link}}

Thank you,
{{company_name}}
{{company_phone}}`,
  },
  delivery_note: {
    name: "Delivery Note",
    body:
`Hello {{customer_name}},
Delivery Note #{{document_number}} dated {{document_date}} has been dispatched.

View Document:
{{document_link}}

Regards,
{{company_name}}
{{company_phone}}`,
  },
  customer_ledger: {
    name: "Customer Ledger",
    body:
`Hello {{customer_name}},
Your ledger statement is ready.

Opening Balance: PKR {{opening_balance}}
Debit: PKR {{debit_total}}
Credit: PKR {{credit_total}}
Closing Balance: PKR {{closing_balance}}

View Ledger:
{{ledger_link}}

Regards,
{{company_name}}`,
  },
  payment_receipt: {
    name: "Payment Receipt",
    body:
`Hello {{customer_name}},
We have received your payment.

Amount: PKR {{payment_amount}}
Date: {{payment_date}}
Method: {{payment_method}}
Reference: {{payment_reference}}

Receipt:
{{payment_receipt_link}}

Thank you,
{{company_name}}`,
  },
  sales_return: {
    name: "Sales Return",
    body:
`Hello {{customer_name}},
Sales Return #{{document_number}} dated {{document_date}} has been processed.

Return Value: PKR {{document_total}}

View Document:
{{document_link}}

Regards,
{{company_name}}`,
  },
  outstanding_reminder: {
    name: "Outstanding Reminder",
    body:
`Hello {{customer_name}},
This is a friendly reminder that an amount of PKR {{outstanding_amount}} is outstanding on your account as of {{document_date}}.

View Ledger:
{{ledger_link}}

We appreciate your prompt settlement.

Regards,
{{company_name}}
{{company_phone}}`,
  },
  expiry_followup: {
    name: "Expiry / Stock Follow-up",
    body:
`Hello {{customer_name}},
This is a follow-up regarding stock from our recent invoice #{{document_number}} dated {{document_date}}.

Kindly check expiry status and let us know if any return or replacement is required.

Regards,
{{company_name}}
{{company_phone}}`,
  },
};

/** Replace {{var}} occurrences. Unknown placeholders are left blank in the output but reported by `findUnknownPlaceholders`. */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    if (v === undefined || v === null) return "";
    return String(v);
  });
}

export function findUnknownPlaceholders(body: string): string[] {
  const found = new Set<string>();
  body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    if (!ALL_VARIABLES.includes(key)) found.add(key);
    return "";
  });
  return Array.from(found);
}

export interface WhatsAppTemplateRow {
  id: string;
  tenant_id: string;
  document_type: WaDocType;
  template_name: string;
  message_body: string;
  is_active: boolean;
  is_default: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchAllTemplates(): Promise<WhatsAppTemplateRow[]> {
  const { data, error } = await (supabase as any)
    .from("whatsapp_templates")
    .select("*")
    .order("document_type");
  if (error) {
    console.error("fetchAllTemplates", error);
    return [];
  }
  return (data || []) as WhatsAppTemplateRow[];
}

/** Resolve template body for a doc type — DB row if active, else default. */
export async function getTemplateBody(documentType: WaDocType): Promise<string> {
  try {
    const { data } = await (supabase as any)
      .from("whatsapp_templates")
      .select("message_body,is_active")
      .eq("document_type", documentType)
      .maybeSingle();
    if (data && data.is_active && data.message_body) return data.message_body as string;
  } catch (e) {
    console.warn("getTemplateBody fallback to default", e);
  }
  return DEFAULT_TEMPLATES[documentType].body;
}

/** Strip non-digits and add Pakistan country code if local. */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "92" + digits.slice(1);
  if (digits.length === 10 && digits.startsWith("3")) digits = "92" + digits;
  return digits;
}

/**
 * Render a template for a document type and open WhatsApp.
 * Validates phone — shows toast and returns false if missing.
 */
export async function sendWhatsAppDoc(opts: {
  documentType: WaDocType;
  phone: string | null | undefined;
  vars: Record<string, string | number | null | undefined>;
}): Promise<boolean> {
  const phone = normalizePhone(opts.phone);
  if (!phone) {
    toast.error("Customer WhatsApp/mobile number is missing.");
    return false;
  }
  const body = await getTemplateBody(opts.documentType);
  const text = renderTemplate(body, opts.vars);
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
  return true;
}
