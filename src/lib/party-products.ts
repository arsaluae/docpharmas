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

/**
 * Get the most recent transacted rate for a (party, product) pair.
 * Returns { rate, date, doc_number } or null when there's no history.
 */
export async function getLastRate(
  partyType: "customer" | "supplier",
  partyId: string,
  productId: string,
): Promise<{ rate: number; date: string; doc_number: string } | null> {
  if (!partyId || !productId) return null;
  if (partyType === "customer") {
    const { data: invs } = await supabase
      .from("sales_invoices")
      .select("id, date, invoice_number")
      .eq("customer_id", partyId)
      .order("date", { ascending: false })
      .limit(50);
    const ids = (invs || []).map((i: any) => i.id);
    if (!ids.length) return null;
    const { data: items } = await supabase
      .from("sales_invoice_items")
      .select("invoice_id, rate")
      .in("invoice_id", ids)
      .eq("product_id", productId);
    for (const inv of invs as any[]) {
      const it = (items || []).find((x: any) => x.invoice_id === inv.id);
      if (it) return { rate: Number(it.rate), date: inv.date, doc_number: inv.invoice_number };
    }
    return null;
  }
  // supplier — look at GRNs
  const { data: grns } = await supabase
    .from("goods_received_notes")
    .select("id, date, grn_number")
    .eq("supplier_id", partyId)
    .order("date", { ascending: false })
    .limit(50);
  const ids = (grns || []).map((g: any) => g.id);
  if (!ids.length) return null;
  const { data: items } = await supabase
    .from("grn_items")
    .select("grn_id, rate")
    .in("grn_id", ids)
    .eq("product_id", productId);
  for (const g of grns as any[]) {
    const it = (items || []).find((x: any) => x.grn_id === g.id);
    if (it) return { rate: Number(it.rate), date: g.date, doc_number: g.grn_number };
  }
  return null;
}
