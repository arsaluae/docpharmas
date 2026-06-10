// Entity definitions for the Data Import / Migration Wizard.
// One spec per importable entity: required fields, optional fields,
// enums, value coercion, and friendly help text used by the template
// builder and validators.

export type EntityType =
  | "products"
  | "customers"
  | "suppliers"
  | "chart_of_accounts"
  | "bank_opening"
  | "opening_stock"
  | "batches"
  | "customer_opening"
  | "supplier_opening"
  | "sales_invoices"
  | "purchase_invoices";

export type FieldType = "text" | "number" | "integer" | "date" | "enum" | "boolean";

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  enumValues?: string[];
  help?: string;
  example?: string | number;
}

export interface EntitySpec {
  type: EntityType;
  label: string;
  group: "master" | "opening" | "transaction";
  description: string;
  fields: FieldSpec[];
  example: Record<string, string | number>[];
  // For invoice-style entities: rows are grouped by this field to form a parent record.
  groupBy?: string;
}

export const PRODUCT_CATEGORIES = [
  "tablet","capsule","syrup","injection","cream","ointment","drops","sachet","other",
];

export const ACCOUNT_TYPES = ["asset","liability","equity","income","expense"];

export const ENTITIES: Record<EntityType, EntitySpec> = {
  products: {
    type: "products",
    label: "Products",
    group: "master",
    description: "Product master with SKU, category, pack size, costs and tax rates.",
    fields: [
      { key: "name", label: "Product Name", type: "text", required: true },
      { key: "sku", label: "SKU / Product Code", type: "text", required: true },
      { key: "category", label: "Category / Type", type: "text", help: "tablet, capsule, syrup, injection, cream, ointment, drops, sachet, other" },
      { key: "unit", label: "Unit / Base Unit", type: "text", required: true, example: "pcs" },
      { key: "cost_price", label: "Cost Price (PKR)", type: "number", required: true },
      { key: "selling_price", label: "Sale Price / MRP (PKR)", type: "number", required: true },
      { key: "pack_size", label: "Pack Size / Large Pack Size", type: "text" },
      { key: "drap_reg_number", label: "DRAP Reg #", type: "text" },
      { key: "gst_rate", label: "GST Rate (%)", type: "number", help: "0–100" },
      { key: "stock_quantity", label: "Opening Stock Qty", type: "number" },
      { key: "reorder_level", label: "Low Stock / Reorder Level", type: "number" },
      { key: "weight", label: "Weight", type: "text" },
      { key: "supplier_name", label: "Preferred Supplier", type: "text" },
      { key: "expense_account", label: "Expense Account (legacy)", type: "text" },
      { key: "income_account", label: "Income Account (legacy)", type: "text" },
      { key: "stock_account", label: "Stock Account (legacy)", type: "text" },
      { key: "sale_information", label: "Sale Information (legacy)", type: "text" },
      { key: "notes", label: "Notes", type: "text" },
    ],
    example: [
      { name: "Paracetamol 500mg", sku: "PAR-500", category: "tablet", unit: "pcs", cost_price: 1.5, selling_price: 2.5, pack_size: "10x10", gst_rate: 0, stock_quantity: 0, reorder_level: 500 },
      { name: "Augmentin 625mg", sku: "AUG-625", category: "tablet", unit: "pcs", cost_price: 25, selling_price: 35, pack_size: "14s", gst_rate: 0, stock_quantity: 0, reorder_level: 100 },
    ],
  },

  customers: {
    type: "customers",
    label: "Customers",
    group: "master",
    description: "Customer master. Title/First/Last are merged into Name when a Business Name is missing.",
    fields: [
      { key: "name", label: "Customer / Business Name", type: "text", required: true },
      { key: "title", label: "Title", type: "text" },
      { key: "first_name", label: "First Name", type: "text" },
      { key: "last_name", label: "Last Name", type: "text" },
      { key: "customer_code", label: "Customer Code", type: "text" },
      { key: "old_erp_account_code", label: "A/C No. (Legacy)", type: "text" },
      { key: "company", label: "Company / Pharmacy", type: "text" },
      { key: "phone", label: "Mobile / Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "address", label: "Address", type: "text" },
      { key: "city", label: "City", type: "text" },
      { key: "area", label: "Area", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "county", label: "County", type: "text" },
      { key: "website", label: "Website", type: "text" },
      { key: "cnic", label: "CNIC", type: "text" },
      { key: "ntn", label: "NTN", type: "text" },
      { key: "strn", label: "STRN", type: "text" },
      { key: "credit_limit", label: "Credit Limit (PKR)", type: "number" },
      { key: "notes", label: "Notes", type: "text" },
    ],
    example: [
      { name: "Rehman Medicos", company: "Rehman Pharmacy", phone: "03001234567", city: "Lahore", area: "DHA", credit_limit: 50000 },
    ],
  },

  suppliers: {
    type: "suppliers",
    label: "Suppliers",
    group: "master",
    description: "Supplier master. First+Last names roll up into Name if Business Name is missing.",
    fields: [
      { key: "name", label: "Supplier / Business Name", type: "text", required: true },
      { key: "first_name", label: "First Name", type: "text" },
      { key: "last_name", label: "Last Name", type: "text" },
      { key: "supplier_code", label: "Supplier Code", type: "text" },
      { key: "old_erp_account_code", label: "A/C No. (Legacy)", type: "text" },
      { key: "company", label: "Company", type: "text" },
      { key: "phone", label: "Mobile / Phone", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "address", label: "Address", type: "text" },
      { key: "city", label: "City", type: "text" },
      { key: "country", label: "Country", type: "text" },
      { key: "county", label: "County", type: "text" },
      { key: "ntn", label: "NTN", type: "text" },
      { key: "strn", label: "STRN", type: "text" },
      { key: "payment_terms_days", label: "Payment Terms (days)", type: "integer" },
      { key: "wht_rate", label: "WHT Rate (%)", type: "number", help: "0–100, typically 4.5" },
      { key: "notes", label: "Notes", type: "text" },
    ],
    example: [
      { name: "GSK Pakistan", company: "GlaxoSmithKline", phone: "0211234567", city: "Karachi", payment_terms_days: 30, wht_rate: 4.5 },
    ],
  },

  chart_of_accounts: {
    type: "chart_of_accounts",
    label: "Chart of Accounts",
    group: "master",
    description: "GL account codes. Codes must be unique within the workspace.",
    fields: [
      { key: "code", label: "Account Code", type: "text", required: true, example: "1100" },
      { key: "name", label: "Account Name", type: "text", required: true },
      { key: "account_type", label: "Account Type", type: "enum", enumValues: ACCOUNT_TYPES, required: true },
      { key: "balance", label: "Opening Balance (PKR)", type: "number" },
    ],
    example: [
      { code: "1100", name: "Trade Receivables", account_type: "asset", balance: 0 },
      { code: "2100", name: "Trade Payables", account_type: "liability", balance: 0 },
    ],
  },

  bank_opening: {
    type: "bank_opening",
    label: "Bank / Cash Opening Balances",
    group: "opening",
    description: "Bank and cash accounts with opening balances.",
    fields: [
      { key: "name", label: "Account Display Name", type: "text", required: true },
      { key: "bank_name", label: "Bank Name", type: "text", required: true, example: "Cash" },
      { key: "account_number", label: "Account Number", type: "text" },
      { key: "branch", label: "Branch", type: "text" },
      { key: "opening_balance", label: "Opening Balance (PKR)", type: "number", required: true },
    ],
    example: [
      { name: "Petty Cash", bank_name: "Cash", opening_balance: 25000 },
      { name: "HBL Current", bank_name: "Habib Bank", account_number: "1234-5678-9012", branch: "Gulberg", opening_balance: 500000 },
    ],
  },

  opening_stock: {
    type: "opening_stock",
    label: "Opening Stock",
    group: "opening",
    description: "Opening stock per product. Matched by SKU; unknown SKUs are rejected.",
    fields: [
      { key: "sku", label: "Product SKU", type: "text", required: true },
      { key: "quantity", label: "Quantity", type: "number", required: true },
      { key: "notes", label: "Notes", type: "text" },
    ],
    example: [
      { sku: "PAR-500", quantity: 1000, notes: "as on 30 Jun 2026" },
    ],
  },

  batches: {
    type: "batches",
    label: "Batch & Opening Stock",
    group: "opening",
    description: "Per-batch opening stock with expiry. Duplicate (SKU + batch) rows are auto-merged; rows with qty=0, missing batch, or invalid expiry are skipped.",
    fields: [
      { key: "sku", label: "Product Code / SKU", type: "text", required: true },
      { key: "product_name", label: "Product Name (informational)", type: "text" },
      { key: "batch_number", label: "Batch No.", type: "text", required: true },
      { key: "expiry_date", label: "Batch Expiry (YYYY-MM-DD)", type: "date", required: true },
      { key: "quantity", label: "Base Quantity", type: "number", required: true },
      { key: "unit", label: "Base Unit", type: "text" },
      { key: "to_location", label: "To Location / Warehouse", type: "text" },
      { key: "rate", label: "Cost Rate (PKR)", type: "number" },
      { key: "notes", label: "Notes", type: "text" },
    ],
    example: [
      { sku: "PAR-500", batch_number: "B2401", expiry_date: "2027-06-30", quantity: 500, unit: "pcs", rate: 1.5 },
    ],
  },

  customer_opening: {
    type: "customer_opening",
    label: "Customer Opening Balances",
    group: "opening",
    description: "Outstanding receivable / advance per customer. Matched by code or name.",
    fields: [
      { key: "customer_code", label: "Customer Code", type: "text" },
      { key: "customer_name", label: "Customer Name", type: "text" },
      { key: "amount", label: "Amount (PKR)", type: "number", required: true },
      { key: "type", label: "Type (debit = receivable, credit = advance)", type: "enum", enumValues: ["debit","credit"], required: true },
      { key: "notes", label: "Notes", type: "text" },
    ],
    example: [
      { customer_name: "Rehman Medicos", amount: 12500, type: "debit", notes: "Bill #1234 unpaid" },
    ],
  },

  supplier_opening: {
    type: "supplier_opening",
    label: "Supplier Opening Balances",
    group: "opening",
    description: "Outstanding payable / advance per supplier. Matched by code or name.",
    fields: [
      { key: "supplier_code", label: "Supplier Code", type: "text" },
      { key: "supplier_name", label: "Supplier Name", type: "text" },
      { key: "amount", label: "Amount (PKR)", type: "number", required: true },
      { key: "type", label: "Type (credit = payable, debit = advance)", type: "enum", enumValues: ["debit","credit"], required: true },
      { key: "notes", label: "Notes", type: "text" },
    ],
    example: [
      { supplier_name: "GSK Pakistan", amount: 75000, type: "credit", notes: "GRN 099 pending" },
    ],
  },

  sales_invoices: {
    type: "sales_invoices",
    label: "Historical Sales Invoices",
    group: "transaction",
    description:
      "One row per invoice line. Lines sharing the same invoice_number are grouped into a single invoice.",
    groupBy: "invoice_number",
    fields: [
      { key: "invoice_number", label: "Invoice Number", type: "text", required: true },
      { key: "date", label: "Invoice Date (YYYY-MM-DD)", type: "date", required: true },
      { key: "customer_name", label: "Customer Name", type: "text", required: true },
      { key: "sku", label: "Product SKU", type: "text", required: true },
      { key: "quantity", label: "Quantity", type: "number", required: true },
      { key: "rate", label: "Rate (PKR)", type: "number", required: true },
      { key: "batch_number", label: "Batch #", type: "text" },
      { key: "expiry_date", label: "Expiry Date", type: "date" },
      { key: "discount_percent", label: "Line Discount (%)", type: "number" },
      { key: "gst_rate", label: "Line GST (%)", type: "number" },
      { key: "invoice_total", label: "Invoice Total (PKR)", type: "number" },
    ],
    example: [
      { invoice_number: "INV-9001", date: "2026-05-01", customer_name: "Rehman Medicos", sku: "PAR-500", quantity: 100, rate: 2.5, discount_percent: 0, gst_rate: 0, invoice_total: 250 },
    ],
  },

  purchase_invoices: {
    type: "purchase_invoices",
    label: "Historical Purchase Invoices",
    group: "transaction",
    description: "One row per purchase invoice. Header-level only.",
    fields: [
      { key: "bill_number", label: "Bill Number", type: "text", required: true },
      { key: "date", label: "Bill Date (YYYY-MM-DD)", type: "date", required: true },
      { key: "supplier_name", label: "Supplier Name", type: "text", required: true },
      { key: "subtotal", label: "Subtotal (PKR)", type: "number", required: true },
      { key: "gst", label: "GST (PKR)", type: "number" },
      { key: "wht_amount", label: "WHT (PKR)", type: "number" },
      { key: "total", label: "Total (PKR)", type: "number", required: true },
      { key: "due_date", label: "Due Date", type: "date" },
    ],
    example: [
      { bill_number: "BILL-7001", date: "2026-05-02", supplier_name: "GSK Pakistan", subtotal: 100000, gst: 17000, wht_amount: 0, total: 117000 },
    ],
  },
};

export const ENTITY_LIST: EntityType[] = [
  "suppliers","customers","products","batches","chart_of_accounts",
  "opening_stock","customer_opening","supplier_opening","bank_opening",
  "sales_invoices","purchase_invoices",
];

export type BatchStatus = "uploaded"|"validated"|"failed"|"posting"|"completed"|"rolled_back";

export interface ValidationError { field: string; message: string }
export interface NormalizedRow {
  rowNumber: number;
  raw: Record<string, unknown>;
  normalized: Record<string, unknown>;
  errors: ValidationError[];
  warnings?: string[]; // soft notes shown to user but don't block posting
  merged?: boolean;    // batch row whose qty was merged into an earlier row
}
