// Lightweight column-name auto-detection. Maps common header variants
// found in Tally / QuickBooks / SAP / Zoho / generic ERP exports onto
// the canonical field keys declared in src/lib/import/types.ts.

import { ENTITIES, EntityType } from "./types";

const ALIASES: Record<string, string> = {
  // names
  "name": "name", "customer name": "name", "supplier name": "name", "product name": "name",
  "item name": "name", "party name": "name", "account name": "name", "vendor name": "name",
  "ledger name": "name", "description": "name", "particulars": "name",
  "business name": "name", "business": "name", "firm name": "name",
  "title": "title", "first name": "first_name", "first": "first_name",
  "last name": "last_name", "last": "last_name", "surname": "last_name",
  "contact person": "contact_person", "contact name": "contact_person", "attention": "contact_person",
  // codes / skus
  "sku": "sku", "code": "sku", "item code": "sku", "product code": "sku",
  "sku code": "sku", "barcode": "barcode", "gtin": "barcode", "ean": "barcode",
  "part no": "sku", "part number": "sku",
  // contact
  "phone": "phone", "mobile": "phone", "contact": "phone", "contact number": "phone",
  "phone number": "phone", "telephone": "phone", "tel": "phone",
  "cell": "phone", "cell phone": "phone",
  "mobile #": "phone", "mobile number": "phone", "mobile no": "phone", "mobile no.": "phone",
  "contact #": "phone", "contact no": "phone", "contact no.": "phone",
  "sms": "sms_mobile", "sms mobile": "sms_mobile", "sms number": "sms_mobile", "sms #": "sms_mobile",
  "whatsapp": "whatsapp", "wa": "whatsapp", "whatsapp number": "whatsapp", "whatsapp #": "whatsapp",
  "email": "email", "e-mail": "email", "email address": "email",
  "address": "address", "addr": "address", "address 1": "address", "address line 1": "address",
  "address 2": "address_line2", "address line 2": "address_line2",
  "city": "city", "town": "city", "location": "city",
  "area": "area", "zone": "area", "territory": "area",
  "district": "district",
  "province": "province", "state": "province",
  "postal code": "postal_code", "zip": "postal_code", "zip code": "postal_code", "post code": "postal_code",
  "country": "country", "county": "county", "website": "website",
  "cnic": "cnic", "nic": "cnic", "id card": "cnic",
  // company
  "company": "company", "company name": "company", "firm": "company", "organization": "company",
  // legacy account code variants (customers/suppliers ledger no.)
  "a/c no": "old_erp_account_code", "a/c no.": "old_erp_account_code",
  "a/c #": "old_erp_account_code", "a/c number": "old_erp_account_code",
  "ac no": "old_erp_account_code", "ac no.": "old_erp_account_code",
  "account no": "old_erp_account_code", "account no.": "old_erp_account_code",
  "account #": "old_erp_account_code",
  // tax
  "ntn": "ntn", "ntn no": "ntn", "ntn number": "ntn",
  "strn": "strn", "strn no": "strn", "stn": "strn", "sales tax no": "strn",
  "tax number": "tax_number", "tax no": "tax_number", "tax id": "tax_number",
  "tax registration": "tax_registration", "tax reg": "tax_registration", "tax reg no": "tax_registration",
  // prices / money
  "cost": "cost_price", "cost price": "cost_price", "purchase price": "cost_price",
  "buy price": "cost_price", "cp": "cost_price", "pp": "cost_price",
  "trade price": "trade_price", "tp": "trade_price",
  "retail price": "retail_price",
  "selling price": "selling_price", "sale price": "selling_price", "sales price": "selling_price", "mrp": "selling_price",
  "sp": "selling_price", "rate": "rate", "price": "rate",
  "tax %": "tax_percent", "tax percent": "tax_percent", "tax percentage": "tax_percent",
  // category / unit
  "category": "category", "type": "category", "product type": "category",
  "sub category": "sub_category", "subcategory": "sub_category", "sub-category": "sub_category",
  "generic": "generic_name", "generic name": "generic_name", "salt": "generic_name",
  "brand": "brand", "brand name": "brand",
  "manufacturer": "manufacturer", "mfg": "manufacturer", "made by": "manufacturer",
  "unit": "unit", "uom": "unit", "base unit": "unit",
  "pack size": "pack_size", "pack": "pack_size", "packing": "pack_size",
  "large pack size": "pack_size", "large pack": "pack_size", "outer pack": "pack_size", "outer pack size": "pack_size",
  "weight": "weight",
  "drap": "drap_reg_number", "drap no": "drap_reg_number", "drap reg": "drap_reg_number",
  "drap reg number": "drap_reg_number", "registration": "drap_reg_number",
  "batch tracking": "batch_tracking", "batch tracked": "batch_tracking",
  "expiry tracking": "expiry_tracking", "expiry tracked": "expiry_tracking",
  // accounts on product
  "expense account": "expense_account", "income account": "income_account",
  "stock account": "stock_account", "sale information": "sale_information",
  // stock / batch
  "quantity": "quantity", "qty": "quantity", "stock": "quantity", "stock qty": "quantity",
  "base quantity": "quantity",
  "stock quantity": "stock_quantity", "opening stock": "stock_quantity",
  "batch": "batch_number", "batch no": "batch_number", "batch number": "batch_number",
  "batch no.": "batch_number", "batch #": "batch_number",
  "lot": "batch_number", "lot no": "batch_number", "lot no.": "batch_number", "lot number": "batch_number",
  "expiry": "expiry_date", "expiry date": "expiry_date", "exp": "expiry_date",
  "exp date": "expiry_date", "exp.": "expiry_date", "expiration": "expiry_date", "expiration date": "expiry_date",
  "batch expiry": "expiry_date",
  "manufacturing date": "manufacturing_date", "mfg date": "manufacturing_date", "mfd": "manufacturing_date",
  "batch supplier": "batch_supplier",
  "purchase reference": "purchase_reference", "purchase ref": "purchase_reference", "po ref": "purchase_reference",
  "to location": "to_location", "from location": "from_location", "warehouse": "to_location",
  // tax/discount
  "gst": "gst_rate", "gst rate": "gst_rate", "gst %": "gst_rate", "tax rate": "gst_rate",
  "wht": "wht_rate", "wht rate": "wht_rate", "wht %": "wht_rate",
  "discount": "discount_percent", "discount %": "discount_percent", "disc": "discount_percent",
  "low stock": "low_stock_level", "low stock level": "low_stock_level",
  // balances / opening
  "opening balance": "opening_balance", "ob": "opening_balance",
  "credit limit": "credit_limit", "limit": "credit_limit",
  "credit days": "credit_days", "credit period": "credit_days",
  "balance": "balance", "amount": "amount",
  "debit": "debit", "credit": "credit",
  "reorder": "reorder_level", "reorder level": "reorder_level", "min stock": "reorder_level",
  "payment terms": "payment_terms_days", "terms days": "payment_terms_days", "pay terms": "payment_terms_days", "terms": "payment_terms_days",
  // status
  "status": "status", "active": "status", "customer status": "status", "supplier status": "status", "product status": "status",
  // legacy ids
  "old erp id": "old_erp_id", "legacy id": "old_erp_id", "erp id": "old_erp_id",
  // accounting
  "account type": "account_type", "account": "code",
  "bank": "bank_name", "bank name": "bank_name", "account number": "account_number",
  "bank account": "bank_account", "bank a/c": "bank_account", "bank ac": "bank_account",
  "branch": "branch",
  // supplier link on product master
  "supplier": "supplier_name", "vendor": "supplier_name", "preferred supplier": "supplier_name",
  // invoices
  "invoice": "invoice_number", "invoice no": "invoice_number", "invoice number": "invoice_number",
  "inv no": "invoice_number", "inv #": "invoice_number", "bill": "bill_number",
  "bill no": "bill_number", "bill number": "bill_number",
  "date": "date", "invoice date": "date", "bill date": "date",
  "due date": "due_date",
  "customer": "customer_name",
  "subtotal": "subtotal", "sub total": "subtotal", "net": "subtotal",
  "total": "total", "grand total": "total", "invoice total": "invoice_total",
  "supplier code": "supplier_code", "vendor code": "supplier_code",
  "customer code": "customer_code", "client code": "customer_code",
  "type debit credit": "type", "dr/cr": "type",
  "notes": "notes", "remarks": "notes", "comments": "notes",
  // product field-name on batch sheets (informational only)
  "product": "product_name",
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
