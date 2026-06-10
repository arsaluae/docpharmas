// Lightweight column-name auto-detection. Maps common header variants
// found in Tally / QuickBooks / SAP / Zoho / generic ERP exports onto
// the canonical field keys declared in src/lib/import/types.ts.

import { ENTITIES, EntityType } from "./types";

const ALIASES: Record<string, string> = {
  // names
  "name": "name", "customer name": "name", "supplier name": "name", "product name": "name",
  "item name": "name", "party name": "name", "account name": "name", "vendor name": "name",
  "ledger name": "name", "description": "name", "particulars": "name",
  // codes / skus
  "sku": "sku", "code": "sku", "item code": "sku", "product code": "sku",
  "sku code": "sku", "barcode": "sku", "part no": "sku", "part number": "sku",
  // contact
  "phone": "phone", "mobile": "phone", "contact": "phone", "contact number": "phone",
  "phone number": "phone", "telephone": "phone", "whatsapp": "phone", "tel": "phone",
  "email": "email", "e-mail": "email", "email address": "email",
  "address": "address", "addr": "address",
  "city": "city", "town": "city", "location": "city",
  "area": "area", "zone": "area", "territory": "area",
  // company
  "company": "company", "company name": "company", "firm": "company", "organization": "company",
  // tax
  "ntn": "ntn", "ntn no": "ntn", "ntn number": "ntn",
  "strn": "strn", "strn no": "strn", "stn": "strn", "sales tax no": "strn",
  // prices / money
  "cost": "cost_price", "cost price": "cost_price", "purchase price": "cost_price",
  "buy price": "cost_price", "cp": "cost_price", "pp": "cost_price", "tp": "cost_price",
  "selling price": "selling_price", "sale price": "selling_price", "mrp": "selling_price",
  "retail price": "selling_price", "sp": "selling_price", "rate": "rate", "price": "rate",
  // category / unit
  "category": "category", "type": "category", "product type": "category",
  "unit": "unit", "uom": "unit",
  "pack size": "pack_size", "pack": "pack_size", "packing": "pack_size",
  "drap": "drap_reg_number", "drap no": "drap_reg_number", "drap reg": "drap_reg_number",
  "drap reg number": "drap_reg_number", "registration": "drap_reg_number",
  // stock / batch
  "quantity": "quantity", "qty": "quantity", "stock": "quantity", "stock qty": "quantity",
  "stock quantity": "stock_quantity", "opening stock": "stock_quantity",
  "batch": "batch_number", "batch no": "batch_number", "batch number": "batch_number", "lot": "batch_number",
  "expiry": "expiry_date", "expiry date": "expiry_date", "exp": "expiry_date", "exp date": "expiry_date",
  // tax/discount
  "gst": "gst_rate", "gst rate": "gst_rate", "gst %": "gst_rate", "tax rate": "gst_rate",
  "wht": "wht_rate", "wht rate": "wht_rate", "wht %": "wht_rate",
  "discount": "discount_percent", "discount %": "discount_percent", "disc": "discount_percent",
  // balances / opening
  "opening balance": "opening_balance", "ob": "opening_balance",
  "credit limit": "credit_limit", "limit": "credit_limit",
  "balance": "balance", "amount": "amount",
  "debit": "debit", "credit": "credit",
  "reorder": "reorder_level", "reorder level": "reorder_level", "min stock": "reorder_level",
  "payment terms": "payment_terms_days", "terms days": "payment_terms_days", "credit days": "payment_terms_days",
  // accounting
  "account code": "code", "account type": "account_type", "account": "code",
  "bank": "bank_name", "bank name": "bank_name", "account number": "account_number",
  "a/c no": "account_number", "branch": "branch",
  // invoices
  "invoice": "invoice_number", "invoice no": "invoice_number", "invoice number": "invoice_number",
  "inv no": "invoice_number", "inv #": "invoice_number", "bill": "bill_number",
  "bill no": "bill_number", "bill number": "bill_number",
  "date": "date", "invoice date": "date", "bill date": "date",
  "due date": "due_date",
  "customer": "customer_name", "supplier": "supplier_name", "vendor": "supplier_name",
  "subtotal": "subtotal", "sub total": "subtotal", "net": "subtotal",
  "total": "total", "grand total": "total", "invoice total": "invoice_total",
  "supplier code": "supplier_code", "vendor code": "supplier_code",
  "customer code": "customer_code", "client code": "customer_code",
  "type debit credit": "type", "dr/cr": "type",
  "notes": "notes", "remarks": "notes", "comments": "notes",
};

function norm(s: string) {
  return String(s ?? "").trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
}

export function detectMapping(headers: string[], entity: EntityType): (string | null)[] {
  const validKeys = new Set(ENTITIES[entity].fields.map(f => f.key));
  return headers.map(h => {
    const n = norm(h);
    if (validKeys.has(n)) return n;
    const m = ALIASES[n];
    return m && validKeys.has(m) ? m : null;
  });
}
