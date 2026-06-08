import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Factory, ClipboardCheck, AlertTriangle, Plus } from "lucide-react";

interface Props {
  productId: string;
  productName?: string;
  requiredQty: number;
  supplierId?: string;
  purchaseInvoiceId?: string;
}

interface PrintJobRow {
  id: string;
  job_number: string;
  quantity_ordered: number;
  quantity_delivered: number;
  quantity_dispatched_to_supplier: number;
  quantity_at_factory: number;
  allotted_supplier_id: string | null;
  status: string;
}

/**
 * Inline panel for a Purchase Order line.
 * Shows packaging already at the supplier/our factory and open print jobs,
 * with a one-click button to create a new print job for any shortfall.
 * Purely advisory — never blocks order creation.
 */
export function PrintAvailabilityPanel({ productId, productName, requiredQty, supplierId, purchaseInvoiceId }: Props) {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<PrintJobRow[]>([]);
  const [dispatchedAtSupplier, setDispatchedAtSupplier] = useState(0);
  const [allocations, setAllocations] = useState<Array<{ source: string; quantity_reserved: number; quantity_consumed: number; status: string; print_job_id: string; printing_cost_per_unit: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productId) { setJobs([]); setAllocations([]); return; }
    (async () => {
      setLoading(true);
      const [jobsRes, allocRes] = await Promise.all([
        supabase
          .from("print_jobs")
          .select("id, job_number, quantity_ordered, quantity_delivered, quantity_dispatched_to_supplier, quantity_at_factory, allotted_supplier_id, status")
          .eq("product_id", productId)
          .neq("status", "settled")
          .order("created_at", { ascending: false })
          .limit(20),
        purchaseInvoiceId
          ? supabase
              .from("purchase_print_allocations")
              .select("source, quantity_reserved, quantity_consumed, status, print_job_id, printing_cost_per_unit")
              .eq("purchase_invoice_id", purchaseInvoiceId)
              .eq("product_id", productId)
              .neq("status", "released")
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const jobList = (jobsRes.data as any) || [];
      setJobs(jobList);
      setAllocations((allocRes.data as any) || []);

      // Compute dispatched-to-this-supplier from print_dispatches (multi-supplier splits)
      if (supplierId && jobList.length) {
        const jobIds = jobList.map((j: any) => j.id);
        const { data: disp } = await supabase
          .from("print_dispatches" as any)
          .select("qty_dispatched, supplier_id")
          .in("print_job_id", jobIds)
          .eq("supplier_id", supplierId);
        setDispatchedAtSupplier((disp as any[] || []).reduce((s, d) => s + Number(d.qty_dispatched), 0));
      } else {
        setDispatchedAtSupplier(0);
      }
      setLoading(false);
    })();
  }, [productId, purchaseInvoiceId, supplierId]);

  if (!productId) return null;

  // Already dispatched to THIS supplier — sourced from print_dispatches (multi-supplier splits).
  // Falls back to legacy allotted_supplier_id for older jobs without dispatch rows.
  const legacyAtSupplier = supplierId && dispatchedAtSupplier === 0
    ? jobs.filter(j => j.allotted_supplier_id === supplierId)
          .reduce((s, j) => s + Number(j.quantity_dispatched_to_supplier || 0), 0)
    : 0;
  const atSupplier = dispatchedAtSupplier + legacyAtSupplier;

  // Sitting at our floor, undispatched
  const atOurFactory = jobs.reduce((s, j) => s + Number(j.quantity_at_factory || 0), 0);

  // In-progress (ordered but not yet delivered)
  const inProgress = jobs
    .filter(j => j.status !== "settled")
    .reduce((s, j) => s + Math.max(Number(j.quantity_ordered) - Number(j.quantity_delivered), 0), 0);

  const totalAvailable = atSupplier + atOurFactory;
  const shortfall = Math.max(Number(requiredQty || 0) - totalAvailable - inProgress, 0);

  const handleCreatePrintJob = () => {
    const params = new URLSearchParams();
    if (productId) params.set("product_id", productId);
    if (supplierId) params.set("supplier_id", supplierId);
    if (shortfall > 0) params.set("qty", String(shortfall));
    navigate(`/print-jobs?${params.toString()}`);
  };

  if (loading) return null;

  // ── Auto-reservation summary (after PO confirm) ──
  if (allocations.length > 0) {
    const totalReserved = allocations.reduce((s, a) => s + Number(a.quantity_reserved), 0);
    const totalConsumed = allocations.reduce((s, a) => s + Number(a.quantity_consumed), 0);
    const bySource = allocations.reduce((acc, a) => {
      acc[a.source] = (acc[a.source] || 0) + Number(a.quantity_reserved);
      return acc;
    }, {} as Record<string, number>);
    const avgCost = allocations.reduce((s, a) => s + Number(a.quantity_reserved) * Number(a.printing_cost_per_unit), 0) / Math.max(totalReserved, 1);
    return (
      <div className="col-span-12 -mt-1 mb-2 ml-[1px] rounded-md border border-success/40 bg-success/5 px-3 py-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-medium text-success">✓ Printing auto-reserved</span>
          <span className="text-muted-foreground">for <b className="text-foreground">{productName}</b>:</span>
          <span>Reserved <b className="font-mono">{totalReserved.toLocaleString()}</b></span>
          {totalConsumed > 0 && <span className="text-success">Consumed <b className="font-mono">{totalConsumed.toLocaleString()}</b></span>}
          {Object.entries(bySource).map(([src, q]) => (
            <span key={src} className="text-muted-foreground">{src.replace("_", " ")}: <b className="font-mono text-foreground">{q.toLocaleString()}</b></span>
          ))}
          <span className="text-muted-foreground">Cost/pc <b className="font-mono text-foreground">{avgCost.toFixed(2)}</b></span>
        </div>
      </div>
    );
  }

  // If nothing relevant and no requirement, hide
  if (totalAvailable === 0 && inProgress === 0 && !requiredQty) return null;

  return (
    <div className="col-span-12 -mt-1 mb-2 ml-[1px] rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-[11px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Printing for <b className="text-foreground">{productName || "this product"}</b>:</span>
        <span className="inline-flex items-center gap-1 text-success">
          <Factory className="h-3 w-3" /> At {supplierId ? "supplier" : "factories"}: <b className="font-mono">{atSupplier.toLocaleString()}</b>
        </span>
        <span className="inline-flex items-center gap-1 text-foreground">
          <ClipboardCheck className="h-3 w-3" /> At our factory: <b className="font-mono">{atOurFactory.toLocaleString()}</b>
        </span>
        {inProgress > 0 && (
          <span className="inline-flex items-center gap-1 text-warning">
            In progress: <b className="font-mono">{inProgress.toLocaleString()}</b>
          </span>
        )}
        {shortfall > 0 && (
          <span className="inline-flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" /> Shortfall: <b className="font-mono">{shortfall.toLocaleString()}</b>
          </span>
        )}
        <Button type="button" variant="outline" size="sm" className="ml-auto h-6 text-[10px]" onClick={handleCreatePrintJob}>
          <Plus className="h-3 w-3 mr-1" />
          {shortfall > 0 ? `Create Print Job (${shortfall.toLocaleString()})` : "Create Print Job"}
        </Button>
      </div>
    </div>
  );
}
