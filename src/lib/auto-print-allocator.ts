import { supabase } from "@/integrations/supabase/client";

export interface AllocationLine {
  print_job_id: string;
  job_number?: string;
  source: "at_supplier" | "at_factory" | "in_progress";
  qty: number;
  cost_per_unit: number;
}

export interface AllocationResult {
  product_id: string;
  required: number;
  allocated: number;
  shortfall: number;
  lines: AllocationLine[];
}

/**
 * FIFO printed-packaging allocation:
 *   1. at_supplier (allotted_supplier_id = supplier)
 *   2. at_factory  (any job, will auto-dispatch on GRN)
 *   3. in_progress (ordered – delivered)
 * Persists rows in purchase_print_allocations as `reserved`.
 */
export async function allocatePrinting(
  productId: string,
  supplierId: string | null,
  required: number,
  purchaseInvoiceId: string,
): Promise<AllocationResult> {
  const out: AllocationResult = { product_id: productId, required, allocated: 0, shortfall: 0, lines: [] };
  if (!productId || !required || required <= 0) return out;

  const { data: jobs } = await supabase
    .from("print_jobs")
    .select("id, job_number, quantity_ordered, quantity_delivered, quantity_dispatched_to_supplier, quantity_at_factory, allotted_supplier_id, status, cost_per_unit")
    .eq("product_id", productId)
    .neq("status", "settled")
    .order("created_at", { ascending: true });

  if (!jobs?.length) { out.shortfall = required; return out; }

  // Already-reserved per job, to avoid double allocation
  const jobIds = jobs.map(j => j.id);
  const { data: existingAllocs } = await supabase
    .from("purchase_print_allocations")
    .select("print_job_id, quantity_reserved, quantity_consumed, status")
    .in("print_job_id", jobIds)
    .eq("status", "reserved");
  const reservedByJob = new Map<string, number>();
  (existingAllocs || []).forEach(a => {
    reservedByJob.set(a.print_job_id, (reservedByJob.get(a.print_job_id) || 0) + (Number(a.quantity_reserved) - Number(a.quantity_consumed)));
  });

  let remaining = required;
  const lines: AllocationLine[] = [];

  const takeFrom = (jobId: string, jobNumber: string | undefined, source: AllocationLine["source"], available: number, cost: number) => {
    const free = available - (reservedByJob.get(jobId) || 0);
    if (free <= 0) return;
    const qty = Math.min(free, remaining);
    if (qty <= 0) return;
    lines.push({ print_job_id: jobId, job_number: jobNumber, source, qty, cost_per_unit: cost });
    reservedByJob.set(jobId, (reservedByJob.get(jobId) || 0) + qty);
    remaining -= qty;
  };

  // 1. at_supplier
  if (supplierId) {
    for (const j of jobs) {
      if (remaining <= 0) break;
      if (j.allotted_supplier_id !== supplierId) continue;
      takeFrom(j.id, j.job_number, "at_supplier", Number(j.quantity_dispatched_to_supplier || 0), Number(j.cost_per_unit || 0));
    }
  }
  // 2. at_factory
  for (const j of jobs) {
    if (remaining <= 0) break;
    takeFrom(j.id, j.job_number, "at_factory", Number(j.quantity_at_factory || 0), Number(j.cost_per_unit || 0));
  }
  // 3. in_progress
  for (const j of jobs) {
    if (remaining <= 0) break;
    const pipeline = Math.max(Number(j.quantity_ordered || 0) - Number(j.quantity_delivered || 0), 0);
    takeFrom(j.id, j.job_number, "in_progress", pipeline, Number(j.cost_per_unit || 0));
  }

  out.lines = lines;
  out.allocated = lines.reduce((s, l) => s + l.qty, 0);
  out.shortfall = Math.max(required - out.allocated, 0);

  if (lines.length) {
    await supabase.from("purchase_print_allocations").insert(
      lines.map(l => ({
        purchase_invoice_id: purchaseInvoiceId,
        product_id: productId,
        supplier_id: supplierId,
        print_job_id: l.print_job_id,
        source: l.source,
        quantity_reserved: l.qty,
        printing_cost_per_unit: l.cost_per_unit,
        status: "reserved",
      }))
    );
  }
  return out;
}

/** Release all reserved allocations for a PO (used on void). */
export async function releasePurchaseAllocations(purchaseInvoiceId: string) {
  await supabase
    .from("purchase_print_allocations")
    .update({ status: "released" })
    .eq("purchase_invoice_id", purchaseInvoiceId)
    .eq("status", "reserved");
}
