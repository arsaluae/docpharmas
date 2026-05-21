/**
 * Batch utilities — derive active batches for a product from stock_movements.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ActiveBatch {
  batch_number: string;
  on_hand: number;
  mfg_date?: string | null;
  expiry_date?: string | null;
  status: "active" | "expiring" | "expired";
}

const IN_TYPES = ["purchase", "purchase_in", "return_in", "adjustment_in", "opening"];
const OUT_TYPES = ["sale", "sale_out", "return_out", "adjustment_out", "damage", "expired"];

export async function getActiveBatches(productId: string): Promise<ActiveBatch[]> {
  if (!productId) return [];

  const [{ data: movements }, { data: grn }] = await Promise.all([
    supabase
      .from("stock_movements")
      .select("batch_number, quantity, movement_type, date")
      .eq("product_id", productId),
    supabase
      .from("grn_items")
      .select("batch_number, expiry_date")
      .eq("product_id", productId),
  ]);

  const expiryMap: Record<string, string> = {};
  (grn || []).forEach((g: any) => {
    if (g.batch_number && g.expiry_date) expiryMap[g.batch_number] = g.expiry_date;
  });

  const acc: Record<string, { qty: number; mfg?: string }> = {};
  (movements || []).forEach((m: any) => {
    const batch = m.batch_number;
    if (!batch) return;
    if (!acc[batch]) acc[batch] = { qty: 0, mfg: m.date };
    if (IN_TYPES.includes(m.movement_type)) acc[batch].qty += Number(m.quantity);
    else if (OUT_TYPES.includes(m.movement_type)) acc[batch].qty -= Number(m.quantity);
  });

  const today = new Date();
  const ninety = new Date();
  ninety.setDate(today.getDate() + 90);

  const list: ActiveBatch[] = Object.entries(acc)
    .filter(([, info]) => info.qty > 0)
    .map(([batch_number, info]) => {
      const exp = expiryMap[batch_number] || null;
      let status: ActiveBatch["status"] = "active";
      if (exp) {
        const d = new Date(exp);
        if (d < today) status = "expired";
        else if (d < ninety) status = "expiring";
      }
      return {
        batch_number,
        on_hand: info.qty,
        mfg_date: info.mfg,
        expiry_date: exp,
        status,
      };
    })
    // FEFO — earliest expiry first
    .sort((a, b) => {
      if (!a.expiry_date && !b.expiry_date) return 0;
      if (!a.expiry_date) return 1;
      if (!b.expiry_date) return -1;
      return a.expiry_date.localeCompare(b.expiry_date);
    });

  return list;
}
