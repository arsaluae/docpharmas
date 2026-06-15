import { supabase } from "@/integrations/supabase/client";

/**
 * Look up customer ids whose name/company/customer_code matches `q` (ILIKE).
 * Returns up to 500 ids, suitable for use inside a PostgREST `.in()` / `.or(...in.(...))` filter.
 */
export async function searchCustomerIds(q: string): Promise<string[]> {
  const s = (q ?? "").trim();
  if (!s) return [];
  const safe = s.replace(/[%,()]/g, "");
  const [{ data: direct }, { data: aliasRows }] = await Promise.all([
    supabase
      .from("customers")
      .select("id")
      .or(`name.ilike.%${safe}%,company.ilike.%${safe}%,customer_code.ilike.%${safe}%`)
      .limit(500),
    (supabase as any)
      .from("customer_aliases")
      .select("master_id")
      .or(`old_name.ilike.%${safe}%,old_customer_code.ilike.%${safe}%`)
      .limit(500),
  ]);
  const ids = new Set<string>();
  (direct ?? []).forEach((r: any) => ids.add(r.id));
  (aliasRows ?? []).forEach((r: any) => ids.add(r.master_id));
  return Array.from(ids);
}

export async function searchSupplierIds(q: string): Promise<string[]> {
  const s = (q ?? "").trim();
  if (!s) return [];
  const safe = s.replace(/[%,()]/g, "");
  const [{ data: direct }, { data: aliasRows }] = await Promise.all([
    supabase
      .from("suppliers")
      .select("id")
      .or(`name.ilike.%${safe}%,company.ilike.%${safe}%,supplier_code.ilike.%${safe}%`)
      .limit(500),
    (supabase as any)
      .from("supplier_aliases")
      .select("master_id")
      .or(`old_name.ilike.%${safe}%,old_supplier_code.ilike.%${safe}%`)
      .limit(500),
  ]);
  const ids = new Set<string>();
  (direct ?? []).forEach((r: any) => ids.add(r.id));
  (aliasRows ?? []).forEach((r: any) => ids.add(r.master_id));
  return Array.from(ids);
}

export async function searchProductIds(q: string): Promise<string[]> {
  const s = (q ?? "").trim();
  if (!s) return [];
  const safe = s.replace(/[%,()]/g, "");
  const { data } = await supabase
    .from("products")
    .select("id")
    .or(`name.ilike.%${safe}%,sku.ilike.%${safe}%,product_code.ilike.%${safe}%`)
    .limit(500);
  return (data ?? []).map((r: any) => r.id as string);
}

/** Escape a value used inside PostgREST `.or()` strings. */
export const escIlike = (s: string) => (s ?? "").replace(/[%,()]/g, "");
