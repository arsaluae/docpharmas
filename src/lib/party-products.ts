/**
 * Party-product helpers — return product IDs that are "relevant" to a party
 * based on historical transactions (and explicit allocations for customers).
 */
import { supabase } from "@/integrations/supabase/client";

export async function getSupplierProductIds(supplierId: string): Promise<Set<string>> {
  if (!supplierId) return new Set();
  // Supplier history lives in GRNs (Goods Received Notes) → grn_items
  const { data: grns } = await supabase
    .from("goods_received_notes").select("id").eq("supplier_id", supplierId);
  const ids = (grns || []).map((g: any) => g.id);
  if (!ids.length) return new Set();
  const { data: items } = await supabase
    .from("grn_items").select("product_id").in("grn_id", ids);
  const out = new Set<string>();
  (items || []).forEach((it: any) => { if (it.product_id) out.add(it.product_id); });
  return out;
}

export async function getCustomerProductIds(customerId: string): Promise<Set<string>> {
  if (!customerId) return new Set();
  const out = new Set<string>();
  // Explicit allocations
  const { data: allocs } = await supabase
    .from("customer_products").select("product_id").eq("customer_id", customerId);
  (allocs || []).forEach((a: any) => { if (a.product_id) out.add(a.product_id); });
  // Plus sales invoice history
  const { data: invs } = await supabase
    .from("sales_invoices").select("id").eq("customer_id", customerId);
  const ids = (invs || []).map((i: any) => i.id);
  if (ids.length) {
    const { data: items } = await supabase
      .from("sales_invoice_items").select("product_id").in("invoice_id", ids);
    (items || []).forEach((it: any) => { if (it.product_id) out.add(it.product_id); });
  }
  return out;
}
