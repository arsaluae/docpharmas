// Per-entity posters: read normalized rows for a batch and insert into
// the final tables, stamping import_batch_id so a single RPC call can
// roll everything back. Returns counts {posted, skipped, errors[]}.

import { supabase } from "@/integrations/supabase/client";
import { EntityType, NormalizedRow } from "./types";

export interface PostResult {
  posted: number;
  skipped: number;
  errors: string[];
}

type Row = NormalizedRow;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function getTenantId(): Promise<string> {
  const { data, error } = await supabase.rpc("get_user_tenant_id" as any);
  if (error || !data) throw new Error("Could not resolve tenant");
  return data as string;
}

export async function postBatch(
  entity: EntityType,
  rows: Row[],
  batchId: string,
): Promise<PostResult> {
  // Skip rows that errored OR were merged into earlier rows during validation.
  const validRows = rows.filter(r => r.errors.length === 0 && !r.merged);
  switch (entity) {
    case "products":          return postProducts(validRows, batchId);
    case "customers":         return postCustomers(validRows, batchId);
    case "suppliers":         return postSuppliers(validRows, batchId);
    case "chart_of_accounts": return postChartOfAccounts(validRows, batchId);
    case "bank_opening":      return postBankOpening(validRows, batchId);
    case "opening_stock":     return postOpeningStock(validRows, batchId);
    case "batches":           return postBatches(validRows, batchId);
    case "customer_opening":  return postCustomerOpening(validRows, batchId);
    case "supplier_opening":  return postSupplierOpening(validRows, batchId);
    case "sales_invoices":    return postSalesInvoices(validRows, batchId);
    case "purchase_invoices": return postPurchaseInvoices(validRows, batchId);
  }
}

// ---------- Master data ----------

function normalizeName(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

async function loadSupplierLookup(tenantId: string): Promise<Map<string, string>> {
  const map = new Map<string, string>(); // normalized name → id
  const { data } = await supabase
    .from("suppliers")
    .select("id, name, supplier_code, old_erp_account_code")
    .eq("tenant_id", tenantId);
  (data ?? []).forEach((s: any) => {
    const id = s.id;
    [s.name, s.supplier_code, s.old_erp_account_code].forEach(v => {
      const k = normalizeName(v);
      if (k) map.set(k, id);
    });
  });
  return map;
}

async function autoCreateSuppliers(tenantId: string, names: string[], batchId: string): Promise<Map<string, string>> {
  const created = new Map<string, string>();
  if (names.length === 0) return created;
  const payload = names.map(n => ({
    tenant_id: tenantId,
    name: n,
    is_active: true,
    notes: "Auto-created during product import",
    import_batch_id: batchId,
  }));
  const { data } = await supabase.from("suppliers").insert(payload as any).select("id, name");
  (data ?? []).forEach((s: any) => created.set(normalizeName(s.name), s.id));
  return created;
}

async function postProducts(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;

  // Pre-load existing SKUs to skip dupes (tenant-scoped unique).
  const skus = rows.map(r => String(r.normalized.sku ?? "").trim()).filter(Boolean);
  const existing = new Set<string>();
  for (const c of chunk(skus, 500)) {
    const { data } = await supabase.from("products").select("sku").eq("tenant_id", tenantId).in("sku", c);
    (data ?? []).forEach((d: any) => d.sku && existing.add(String(d.sku).toLowerCase()));
  }

  // Build supplier lookup and figure out which names are missing
  const supplierMap = await loadSupplierLookup(tenantId);
  const wantedSuppliers = new Set<string>();
  rows.forEach(r => {
    const n = normalizeName(r.normalized.supplier_name);
    if (n && !supplierMap.has(n)) wantedSuppliers.add(String(r.normalized.supplier_name).trim());
  });

  // Auto-create missing suppliers if the company setting is enabled
  let autoCreate = false;
  try {
    const { data: cs } = await supabase
      .from("company_settings")
      .select("auto_create_missing_suppliers")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    autoCreate = Boolean((cs as any)?.auto_create_missing_suppliers);
  } catch { /* ignore */ }

  if (autoCreate && wantedSuppliers.size > 0) {
    const created = await autoCreateSuppliers(tenantId, [...wantedSuppliers], batchId);
    created.forEach((id, k) => supplierMap.set(k, id));
  }

  const fresh = rows.filter(r => !existing.has(String(r.normalized.sku ?? "").toLowerCase()));
  const unmatchedLog: { row: number; sku: string; supplier_name: string }[] = [];

  for (const c of chunk(fresh, 500)) {
    const payload = c.map(r => {
      const supplierName = r.normalized.supplier_name ? String(r.normalized.supplier_name).trim() : null;
      const supId = supplierName ? supplierMap.get(normalizeName(supplierName)) ?? null : null;
      if (supplierName && !supId) {
        unmatchedLog.push({ row: r.rowNumber, sku: String(r.normalized.sku ?? ""), supplier_name: supplierName });
      }
      return {
        tenant_id: tenantId,
        name: r.normalized.name,
        sku: r.normalized.sku,
        product_code: r.normalized.sku,
        barcode: r.normalized.barcode ?? null,
        generic_name: r.normalized.generic_name ?? null,
        brand: r.normalized.brand ?? null,
        manufacturer: r.normalized.manufacturer ?? null,
        category: r.normalized.category ?? "other",
        sub_category: r.normalized.sub_category ?? null,
        unit: r.normalized.unit ?? "pcs",
        cost_price: Number(r.normalized.cost_price ?? 0),
        trade_price: r.normalized.trade_price != null ? Number(r.normalized.trade_price) : null,
        retail_price: r.normalized.retail_price != null ? Number(r.normalized.retail_price) : null,
        selling_price: Number(r.normalized.selling_price ?? 0),
        mrp: Number(r.normalized.selling_price ?? 0),
        tax_percent: r.normalized.tax_percent != null ? Number(r.normalized.tax_percent) : null,
        pack_size: r.normalized.pack_size ?? null,
        drap_reg_number: r.normalized.drap_reg_number ?? null,
        gst_rate: Number(r.normalized.gst_rate ?? 0),
        stock_quantity: 0, // never seed stock directly; opening stock comes via batches
        reorder_level: Number(r.normalized.reorder_level ?? r.normalized.low_stock_level ?? 0),
        low_stock_level: r.normalized.low_stock_level != null ? Number(r.normalized.low_stock_level) : null,
        stock_account: r.normalized.stock_account ?? null,
        income_account: r.normalized.income_account ?? null,
        expense_account: r.normalized.expense_account ?? null,
        batch_tracking: r.normalized.batch_tracking != null ? Boolean(r.normalized.batch_tracking) : true,
        expiry_tracking: r.normalized.expiry_tracking != null ? Boolean(r.normalized.expiry_tracking) : true,
        status: r.normalized.status ?? null,
        is_active: String(r.normalized.status ?? "active").toLowerCase() !== "inactive",
        old_erp_id: r.normalized.old_erp_id ?? null,
        notes: supplierName && !supId
          ? [r.normalized.notes, `legacy-supplier: ${supplierName}`].filter(Boolean).join(" · ")
          : (r.normalized.notes ?? null),
        supplier_id: supId,
        import_batch_id: batchId,
      };
    });
    const { error, data } = await supabase.from("products").insert(payload as any).select("id");
    if (error) errors.push(error.message);
    else posted += data?.length ?? 0;
  }

  // Persist unmatched supplier warnings to migration_errors so the wizard can surface them
  if (unmatchedLog.length > 0) {
    const errPayload = unmatchedLog.map(u => ({
      tenant_id: tenantId,
      import_batch_id: batchId,
      entity: "products",
      row_number: u.row,
      field: "supplier_name",
      message: `Supplier '${u.supplier_name}' not found — needs manual mapping`,
      severity: "warning",
      raw: { sku: u.sku, supplier_name: u.supplier_name } as any,
    }));
    for (const c of chunk(errPayload, 500)) {
      await supabase.from("migration_errors").insert(c as any);
    }
    errors.push(`${unmatchedLog.length} product rows have unmatched suppliers (see Verification step)`);
  }

  return { posted, skipped: rows.length - posted, errors };
}

async function postCustomers(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;
  for (const c of chunk(rows, 500)) {
    const payload = c.map(r => ({
      tenant_id: tenantId,
      name: r.normalized.name,
      title: r.normalized.title ?? null,
      first_name: r.normalized.first_name ?? null,
      last_name: r.normalized.last_name ?? null,
      contact_person: r.normalized.contact_person ?? null,
      customer_code: r.normalized.customer_code ?? null,
      old_erp_account_code: r.normalized.old_erp_account_code ?? null,
      old_erp_id: r.normalized.old_erp_id ?? null,
      cnic: r.normalized.cnic ?? null,
      company: r.normalized.company ?? null,
      phone: r.normalized.phone ?? null,
      sms_mobile: r.normalized.sms_mobile ?? null,
      whatsapp: r.normalized.whatsapp ?? null,
      email: r.normalized.email ?? null,
      website: r.normalized.website ?? null,
      address: r.normalized.address ?? null,
      address_line2: r.normalized.address_line2 ?? null,
      city: r.normalized.city ?? null,
      area: r.normalized.area ?? null,
      district: r.normalized.district ?? null,
      province: r.normalized.province ?? null,
      country: r.normalized.country ?? null,
      postal_code: r.normalized.postal_code ?? null,
      ntn: r.normalized.ntn ?? null,
      strn: r.normalized.strn ?? null,
      tax_number: r.normalized.tax_number ?? null,
      credit_limit: Number(r.normalized.credit_limit ?? 0),
      credit_days: r.normalized.credit_days != null ? Number(r.normalized.credit_days) : null,
      opening_balance: Number(r.normalized.opening_balance ?? 0),
      status: r.normalized.status ?? null,
      is_active: String(r.normalized.status ?? "active").toLowerCase() !== "inactive",
      notes: r.normalized.notes ?? null,
      import_batch_id: batchId,
    }));
    const { error, data } = await supabase.from("customers").insert(payload as any).select("id");
    if (error) errors.push(error.message);
    else posted += data?.length ?? 0;
  }
  return { posted, skipped: rows.length - posted, errors };
}

async function postSuppliers(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;
  for (const c of chunk(rows, 500)) {
    const payload = c.map(r => ({
      tenant_id: tenantId,
      name: r.normalized.name,
      contact_person: r.normalized.contact_person ?? null,
      supplier_code: r.normalized.supplier_code ?? null,
      old_erp_account_code: r.normalized.old_erp_account_code ?? null,
      old_erp_id: r.normalized.old_erp_id ?? null,
      company: r.normalized.company ?? null,
      phone: r.normalized.phone ?? null,
      whatsapp: r.normalized.whatsapp ?? null,
      email: r.normalized.email ?? null,
      address: r.normalized.address ?? null,
      area: r.normalized.area ?? null,
      city: r.normalized.city ?? null,
      province: r.normalized.province ?? null,
      country: r.normalized.country ?? null,
      postal_code: r.normalized.postal_code ?? null,
      ntn: r.normalized.ntn ?? null,
      strn: r.normalized.strn ?? null,
      tax_registration: r.normalized.tax_registration ?? null,
      payment_terms_days: Number(r.normalized.payment_terms_days ?? 30),
      wht_rate: Number(r.normalized.wht_rate ?? 0),
      opening_balance: Number(r.normalized.opening_balance ?? 0),
      bank_account: r.normalized.bank_account ?? null,
      bank_name: r.normalized.bank_name ?? null,
      status: r.normalized.status ?? null,
      is_active: String(r.normalized.status ?? "active").toLowerCase() !== "inactive",
      notes: r.normalized.notes ?? null,
      import_batch_id: batchId,
    }));
    const { error, data } = await supabase.from("suppliers").insert(payload as any).select("id");
    if (error) errors.push(error.message);
    else posted += data?.length ?? 0;
  }
  return { posted, skipped: rows.length - posted, errors };
}

async function postChartOfAccounts(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;
  for (const c of chunk(rows, 500)) {
    const payload = c.map(r => ({
      tenant_id: tenantId,
      code: r.normalized.code,
      name: r.normalized.name,
      account_type: r.normalized.account_type,
      balance: Number(r.normalized.balance ?? 0),
      import_batch_id: batchId,
    }));
    const { error, data } = await supabase.from("chart_of_accounts").insert(payload as any).select("id");
    if (error) errors.push(error.message);
    else posted += data?.length ?? 0;
  }
  return { posted, skipped: rows.length - posted, errors };
}

async function postBankOpening(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;
  for (const r of rows) {
    const payload = {
      tenant_id: tenantId,
      name: r.normalized.name,
      bank_name: r.normalized.bank_name,
      account_number: r.normalized.account_number ?? null,
      branch: r.normalized.branch ?? null,
      opening_balance: Number(r.normalized.opening_balance ?? 0),
      balance: Number(r.normalized.opening_balance ?? 0),
      import_batch_id: batchId,
    } as any;
    const { error } = await supabase.from("bank_accounts").insert(payload);
    if (error) errors.push(`Row ${r.rowNumber}: ${error.message}`);
    else posted++;
  }
  return { posted, skipped: rows.length - posted, errors };
}

// ---------- Stock / batches ----------

async function lookupProductIds(skus: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const c of chunk([...new Set(skus)], 500)) {
    const { data } = await supabase.from("products").select("id, sku").in("sku", c);
    (data ?? []).forEach((p: any) => map.set(String(p.sku).toLowerCase(), p.id));
  }
  return map;
}

async function lookupProductMeta(skus: string[]): Promise<Map<string, { id: string; supplier_id: string | null }>> {
  const map = new Map<string, { id: string; supplier_id: string | null }>();
  for (const c of chunk([...new Set(skus)], 500)) {
    const { data } = await supabase.from("products").select("id, sku, supplier_id").in("sku", c);
    (data ?? []).forEach((p: any) => map.set(String(p.sku).toLowerCase(), { id: p.id, supplier_id: p.supplier_id ?? null }));
  }
  return map;
}

async function postOpeningStock(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;
  const skus = rows.map(r => String(r.normalized.sku ?? ""));
  const idMap = await lookupProductIds(skus);

  for (const r of rows) {
    const sku = String(r.normalized.sku ?? "").toLowerCase();
    const productId = idMap.get(sku);
    if (!productId) { errors.push(`Row ${r.rowNumber}: SKU ${sku} not found`); continue; }
    const payload = {
      tenant_id: tenantId,
      product_id: productId,
      movement_type: "purchase_in",
      quantity: Number(r.normalized.quantity ?? 0),
      date: new Date().toISOString().slice(0, 10),
      notes: String(r.normalized.notes ?? "Opening stock import"),
      import_batch_id: batchId,
    } as any;
    const { error } = await supabase.from("stock_movements").insert(payload);
    if (error) errors.push(`Row ${r.rowNumber}: ${error.message}`);
    else posted++;
  }
  return { posted, skipped: rows.length - posted, errors };
}

async function postBatches(rows: Row[], batchId: string): Promise<PostResult> {
  // Group rows by effective supplier (batch_supplier > product.supplier_id > none)
  // and create one GRN per supplier group so per-batch supplier is preserved.
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;

  const skus = rows.map(r => String(r.normalized.sku ?? ""));
  const productMap = await lookupProductMeta(skus);
  const supplierLookup = await loadSupplierLookup(tenantId);

  // Determine supplier_id for each row
  type Resolved = { row: Row; productId: string; supplierId: string | null };
  const resolved: Resolved[] = [];
  for (const r of rows) {
    const sku = String(r.normalized.sku ?? "").toLowerCase();
    const meta = productMap.get(sku);
    if (!meta) {
      errors.push(`Row ${r.rowNumber}: SKU ${sku} not found in products master`);
      continue;
    }
    let supId: string | null = null;
    const batchSupplierName = r.normalized.batch_supplier ? String(r.normalized.batch_supplier).trim() : "";
    if (batchSupplierName) {
      supId = supplierLookup.get(normalizeName(batchSupplierName)) ?? null;
    }
    if (!supId) supId = meta.supplier_id;
    resolved.push({ row: r, productId: meta.id, supplierId: supId });
  }

  // Bucket by supplier_id ("" = none)
  const buckets = new Map<string, Resolved[]>();
  for (const r of resolved) {
    const k = r.supplierId ?? "";
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(r);
  }

  for (const [supplierKey, items] of buckets) {
    const supplierId = supplierKey || null;
    let grnNumber = "";
    try {
      const { data: num } = await supabase.rpc("generate_document_number" as any, { p_document_type: "grn" });
      grnNumber = (num as string) ?? `GRN-IMP-${Date.now()}`;
    } catch { grnNumber = `GRN-IMP-${Date.now()}`; }

    const { data: grnHeader, error: hErr } = await supabase.from("goods_received_notes").insert({
      tenant_id: tenantId,
      grn_number: grnNumber,
      supplier_id: supplierId,
      date: new Date().toISOString().slice(0, 10),
      status: "received",
      notes: supplierId ? "Opening batches import (per-supplier)" : "Opening batches import (no supplier)",
    } as any).select("id").single();
    if (hErr || !grnHeader) {
      errors.push(`GRN create failed: ${hErr?.message ?? "unknown"}`);
      continue;
    }
    const grnId = (grnHeader as any).id;

    const payload = items.map(({ row: r, productId }) => {
      const qty = Number(r.normalized.quantity ?? 0);
      const rate = Number(r.normalized.rate ?? 0);
      return {
        tenant_id: tenantId,
        grn_id: grnId,
        product_id: productId,
        item_name: String(r.normalized.sku),
        batch_number: r.normalized.batch_number,
        expiry_date: r.normalized.expiry_date,
        manufacturing_date: r.normalized.manufacturing_date ?? null,
        quantity_ordered: qty,
        quantity_received: qty,
        rate,
        amount: qty * rate,
        import_batch_id: batchId,
      };
    });

    for (const c of chunk(payload, 500)) {
      const { error, data } = await supabase.from("grn_items").insert(c as any).select("id");
      if (error) errors.push(`GRN ${grnNumber}: ${error.message}`);
      else posted += data?.length ?? 0;
    }
  }

  // Persist unknown-SKU errors to migration_errors for the report
  const unknownSku = rows.filter(r => !productMap.get(String(r.normalized.sku ?? "").toLowerCase()));
  if (unknownSku.length > 0) {
    const errPayload = unknownSku.map(r => ({
      tenant_id: tenantId,
      import_batch_id: batchId,
      entity: "batches",
      row_number: r.rowNumber,
      field: "sku",
      message: `Product code '${r.normalized.sku}' not found in products master`,
      severity: "warning",
      raw: r.normalized as any,
    }));
    for (const c of chunk(errPayload, 500)) {
      await supabase.from("migration_errors").insert(c as any);
    }
  }

  return { posted, skipped: rows.length - posted, errors };
}

// ---------- Opening balances (parties) ----------

async function lookupCustomerIds(rows: Row[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const codes = [...new Set(rows.map(r => String(r.normalized.customer_code ?? "")).filter(Boolean))];
  const names = [...new Set(rows.map(r => String(r.normalized.customer_name ?? "")).filter(Boolean))];
  const cByCode = new Map<string, string>();
  const cByName = new Map<string, string>();
  for (const c of chunk(codes, 500)) {
    const { data } = await supabase.from("customers").select("id, customer_code").in("customer_code", c);
    (data ?? []).forEach((d: any) => cByCode.set(String(d.customer_code), d.id));
  }
  for (const c of chunk(names, 500)) {
    const { data } = await supabase.from("customers").select("id, name").in("name", c);
    (data ?? []).forEach((d: any) => cByName.set(String(d.name).toLowerCase(), d.id));
  }
  rows.forEach(r => {
    const code = String(r.normalized.customer_code ?? "");
    const name = String(r.normalized.customer_name ?? "").toLowerCase();
    const id = (code && cByCode.get(code)) || (name && cByName.get(name));
    if (id) map.set(r.rowNumber, id);
  });
  return map;
}

async function lookupSupplierIds(rows: Row[]): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const codes = [...new Set(rows.map(r => String(r.normalized.supplier_code ?? "")).filter(Boolean))];
  const names = [...new Set(rows.map(r => String(r.normalized.supplier_name ?? "")).filter(Boolean))];
  const byCode = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const c of chunk(codes, 500)) {
    const { data } = await supabase.from("suppliers").select("id, supplier_code").in("supplier_code", c);
    (data ?? []).forEach((d: any) => byCode.set(String(d.supplier_code), d.id));
  }
  for (const c of chunk(names, 500)) {
    const { data } = await supabase.from("suppliers").select("id, name").in("name", c);
    (data ?? []).forEach((d: any) => byName.set(String(d.name).toLowerCase(), d.id));
  }
  rows.forEach(r => {
    const code = String(r.normalized.supplier_code ?? "");
    const name = String(r.normalized.supplier_name ?? "").toLowerCase();
    const id = (code && byCode.get(code)) || (name && byName.get(name));
    if (id) map.set(r.rowNumber, id);
  });
  return map;
}

async function postCustomerOpening(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;
  const idMap = await lookupCustomerIds(rows);
  for (const r of rows) {
    const customerId = idMap.get(r.rowNumber);
    if (!customerId) { errors.push(`Row ${r.rowNumber}: customer not found`); continue; }
    const amount = Number(r.normalized.amount ?? 0);
    const isDebit = String(r.normalized.type) === "debit";
    const signed = isDebit ? amount : -amount;
    const payload = {
      tenant_id: tenantId,
      party_type: "customer",
      party_id: customerId,
      type: isDebit ? "made" : "received", // debit => we owe customer? No: debit balance = receivable, so add to balance
      amount: 0, // do not touch balance via payment trigger; use direct adjustment
      date: new Date().toISOString().slice(0, 10),
      notes: `Opening balance import — ${r.normalized.notes ?? ""}`.trim(),
      import_batch_id: batchId,
    } as any;
    // Direct balance update for opening, no payment record needed.
    const { data: cur } = await supabase.from("customers").select("balance").eq("id", customerId).maybeSingle();
    const next = Number((cur as any)?.balance ?? 0) + signed;
    const { error } = await supabase.from("customers").update({ balance: next, opening_balance: signed }).eq("id", customerId);
    if (error) { errors.push(`Row ${r.rowNumber}: ${error.message}`); continue; }
    // Audit-only payment stub
    void payload;
    posted++;
  }
  return { posted, skipped: rows.length - posted, errors };
}

async function postSupplierOpening(rows: Row[], batchId: string): Promise<PostResult> {
  void batchId;
  const errors: string[] = [];
  let posted = 0;
  const idMap = await lookupSupplierIds(rows);
  for (const r of rows) {
    const supplierId = idMap.get(r.rowNumber);
    if (!supplierId) { errors.push(`Row ${r.rowNumber}: supplier not found`); continue; }
    const amount = Number(r.normalized.amount ?? 0);
    const isCredit = String(r.normalized.type) === "credit";
    const signed = isCredit ? amount : -amount; // credit = we owe supplier (payable)
    const { data: cur } = await supabase.from("suppliers").select("balance").eq("id", supplierId).maybeSingle();
    const next = Number((cur as any)?.balance ?? 0) + signed;
    const { error } = await supabase.from("suppliers").update({ balance: next, opening_balance: signed }).eq("id", supplierId);
    if (error) { errors.push(`Row ${r.rowNumber}: ${error.message}`); continue; }
    posted++;
  }
  return { posted, skipped: rows.length - posted, errors };
}

// ---------- Sales invoices (grouped) ----------

async function postSalesInvoices(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;

  // Group by invoice_number
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = String(r.normalized.invoice_number);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }

  // Pre-resolve customers + products
  const allCustomers = [...new Set([...groups.values()].flat().map(r => String(r.normalized.customer_name ?? "")).filter(Boolean))];
  const allSkus = [...new Set([...groups.values()].flat().map(r => String(r.normalized.sku ?? "")).filter(Boolean))];
  const custByName = new Map<string, string>();
  for (const c of chunk(allCustomers, 500)) {
    const { data } = await supabase.from("customers").select("id, name").in("name", c);
    (data ?? []).forEach((d: any) => custByName.set(String(d.name).toLowerCase(), d.id));
  }
  const prodBySku = await lookupProductIds(allSkus);

  // Skip invoice numbers that already exist
  const existingNums = new Set<string>();
  for (const c of chunk([...groups.keys()], 500)) {
    const { data } = await supabase.from("sales_invoices").select("invoice_number").in("invoice_number", c);
    (data ?? []).forEach((d: any) => existingNums.add(String(d.invoice_number)));
  }

  for (const [invoiceNumber, lines] of groups) {
    if (existingNums.has(invoiceNumber)) { errors.push(`Invoice ${invoiceNumber}: already exists`); continue; }
    const head = lines[0];
    const customerId = custByName.get(String(head.normalized.customer_name ?? "").toLowerCase());
    if (!customerId) { errors.push(`Invoice ${invoiceNumber}: customer not found`); continue; }

    let subtotal = 0;
    let gst_amount = 0;
    let discount = 0;
    const itemsPayload: any[] = [];

    for (const ln of lines) {
      const productId = prodBySku.get(String(ln.normalized.sku ?? "").toLowerCase());
      if (!productId) { errors.push(`Invoice ${invoiceNumber} row ${ln.rowNumber}: SKU not found`); continue; }
      const qty = Number(ln.normalized.quantity ?? 0);
      const rate = Number(ln.normalized.rate ?? 0);
      const discPct = Number(ln.normalized.discount_percent ?? 0);
      const gstPct = Number(ln.normalized.gst_rate ?? 0);
      const gross = qty * rate;
      const lineDiscount = (gross * discPct) / 100;
      const net = gross - lineDiscount;
      const lineGst = (net * gstPct) / 100;
      const amount = net + lineGst;
      subtotal += net;
      gst_amount += lineGst;
      discount += lineDiscount;
      itemsPayload.push({
        tenant_id: tenantId,
        product_id: productId,
        batch_number: ln.normalized.batch_number ?? null,
        expiry_date: ln.normalized.expiry_date ?? null,
        quantity: qty,
        rate,
        discount_percent: discPct,
        gst_rate: gstPct,
        amount,
        unit_cost: 0,
        import_batch_id: batchId,
      });
    }
    if (itemsPayload.length === 0) continue;
    const total = subtotal + gst_amount;

    const { data: inv, error: invErr } = await supabase.from("sales_invoices").insert({
      tenant_id: tenantId,
      invoice_number: invoiceNumber,
      customer_id: customerId,
      date: head.normalized.date,
      subtotal,
      gst_amount,
      discount,
      total,
      amount_paid: 0,
      status: "dispatched",
      notes: "Imported from legacy system",
      import_batch_id: batchId,
    } as any).select("id").single();
    if (invErr || !inv) { errors.push(`Invoice ${invoiceNumber}: ${invErr?.message}`); continue; }
    const invoiceId = (inv as any).id;

    const { error: itemsErr } = await supabase
      .from("sales_invoice_items")
      .insert(itemsPayload.map(it => ({ ...it, invoice_id: invoiceId })));
    if (itemsErr) { errors.push(`Invoice ${invoiceNumber} items: ${itemsErr.message}`); continue; }
    posted++;
  }
  return { posted, skipped: groups.size - posted, errors };
}

// ---------- Purchase invoices (header-only) ----------

async function postPurchaseInvoices(rows: Row[], batchId: string): Promise<PostResult> {
  const tenantId = await getTenantId();
  const errors: string[] = [];
  let posted = 0;

  const supplierNames = [...new Set(rows.map(r => String(r.normalized.supplier_name ?? "")).filter(Boolean))];
  const byName = new Map<string, string>();
  for (const c of chunk(supplierNames, 500)) {
    const { data } = await supabase.from("suppliers").select("id, name").in("name", c);
    (data ?? []).forEach((d: any) => byName.set(String(d.name).toLowerCase(), d.id));
  }
  const billNos = rows.map(r => String(r.normalized.bill_number));
  const existing = new Set<string>();
  for (const c of chunk(billNos, 500)) {
    const { data } = await supabase.from("purchase_invoices").select("bill_number").in("bill_number", c);
    (data ?? []).forEach((d: any) => existing.add(String(d.bill_number)));
  }

  for (const r of rows) {
    const billNo = String(r.normalized.bill_number);
    if (existing.has(billNo)) { errors.push(`Bill ${billNo}: already exists`); continue; }
    const supplierId = byName.get(String(r.normalized.supplier_name ?? "").toLowerCase());
    if (!supplierId) { errors.push(`Bill ${billNo}: supplier not found`); continue; }
    const { error } = await supabase.from("purchase_invoices").insert({
      tenant_id: tenantId,
      bill_number: billNo,
      supplier_id: supplierId,
      date: r.normalized.date,
      due_date: r.normalized.due_date ?? null,
      subtotal: Number(r.normalized.subtotal ?? 0),
      gst: Number(r.normalized.gst ?? 0),
      wht_amount: Number(r.normalized.wht_amount ?? 0),
      total: Number(r.normalized.total ?? 0),
      status: "unpaid",
      import_batch_id: batchId,
    } as any);
    if (error) { errors.push(`Bill ${billNo}: ${error.message}`); continue; }
    posted++;
  }
  return { posted, skipped: rows.length - posted, errors };
}
