import { supabase } from "@/integrations/supabase/client";

export type VoidableTable =
  | "sales_invoices"
  | "purchase_invoices"
  | "goods_received_notes"
  | "payments";

/**
 * Atomically voids a document and reverses its stock/ledger impact via the
 * `void_document` Postgres RPC. Returns { ok, error }.
 */
export async function voidDocument(
  table: VoidableTable,
  id: string,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  if (!reason || reason.trim().length < 3) {
    return { ok: false, error: "A reason (min 3 chars) is required to void a document." };
  }
  const { error } = await supabase.rpc("void_document" as any, {
    p_table: table,
    p_id: id,
    p_reason: reason.trim(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
