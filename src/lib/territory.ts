/**
 * Territory Exclusivity Engine
 * If a product is already invoiced to a distributor in a city,
 * it is LOCKED to that distributor for that entire city.
 */
import { supabase } from "@/integrations/supabase/client";

export interface TerritoryConflict {
  city: string;
  locked_to_customer_id: string;
  locked_to_customer_name: string;
}

/**
 * Returns a conflict if `productId` is already invoiced to another customer
 * in the same city as `customerId`. Returns null when free.
 */
export async function checkTerritoryLock(
  productId: string,
  customerId: string
): Promise<TerritoryConflict | null> {
  if (!productId || !customerId) return null;

  const { data: cust } = await supabase
    .from("customers")
    .select("city")
    .eq("id", customerId)
    .maybeSingle();

  const city = cust?.city?.trim();
  if (!city) return null;

  // All customers in the same city (excluding the current one)
  const { data: cityPeers } = await supabase
    .from("customers")
    .select("id, name")
    .ilike("city", city)
    .neq("id", customerId);

  if (!cityPeers || cityPeers.length === 0) return null;
  const peerIds = cityPeers.map((c) => c.id);
  const peerMap = Object.fromEntries(cityPeers.map((c) => [c.id, c.name]));

  // Did any of them buy this product on an active invoice?
  const { data: items } = await supabase
    .from("sales_invoice_items")
    .select("invoice_id, sales_invoices!inner(customer_id, status)")
    .eq("product_id", productId)
    .limit(50);

  if (!items) return null;
  for (const row of items as any[]) {
    const inv = row.sales_invoices;
    if (!inv) continue;
    if (inv.status === "cancelled") continue;
    if (peerIds.includes(inv.customer_id)) {
      return {
        city,
        locked_to_customer_id: inv.customer_id,
        locked_to_customer_name: peerMap[inv.customer_id] || "another distributor",
      };
    }
  }
  return null;
}
