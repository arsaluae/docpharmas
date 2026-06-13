import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, Banknote, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getActiveBatches, type ActiveBatch } from "@/lib/batches";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";
import { useIsSalesAgent } from "@/hooks/useIsSalesAgent";

type CostType = "printing" | "freight" | "customs" | "handling" | "other";
interface CostRow { type: CostType; amount: string; label?: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName?: string;
  productCode?: string;
  /** Purchase cost (supplier base only, NEVER overwritten by this dialog). */
  purchaseCost?: number;
  /** Current sale price for live margin preview. */
  salePrice?: number;
  /** Current stored landed cost (for initial display). */
  currentLandedCost?: number;
  onSaved?: () => void;
}

export function ProductBatchProfileDialog({
  open, onOpenChange, productId, productName, productCode,
  purchaseCost = 0, salePrice = 0, currentLandedCost = 0, onSaved,
}: Props) {
  const [batches, setBatches] = useState<ActiveBatch[]>([]);
  const [stockQty, setStockQty] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CostRow[]>([{ type: "printing", amount: "0" }, { type: "freight", amount: "0" }]);
  const [saving, setSaving] = useState(false);
  const [editingBatch, setEditingBatch] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");
  const [busyBatch, setBusyBatch] = useState<string | null>(null);
  const isSalesAgent = useIsSalesAgent();

  const landedCost = useMemo(
    () => Number(purchaseCost || 0) + rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows, purchaseCost]
  );

  // Markup on cost: (Sale − Landed) ÷ Landed × 100.
  const grossMarginPct = useMemo(() => {
    if (!landedCost || landedCost <= 0 || !salePrice || salePrice <= 0) return null;
    return ((salePrice - landedCost) / landedCost) * 100;
  }, [salePrice, landedCost]);

  const reloadBatches = async () => {
    if (!productId) return;
    setLoading(true);
    const [list, prod] = await Promise.all([
      getActiveBatches(productId),
      supabase.from("products").select("stock_quantity").eq("id", productId).single(),
    ]);
    setBatches(list);
    setStockQty(Number((prod.data as any)?.stock_quantity ?? 0));
    setLoading(false);
  };

  useEffect(() => {
    if (!open || !productId) return;
    setRows([{ type: "printing", amount: "0" }, { type: "freight", amount: "0" }]);
    setEditingBatch(null);
    reloadBatches();
  }, [open, productId]);

  const adjustBatch = async (batchNumber: string | null, currentQty: number, newQty: number, reason: string) => {
    if (!productId) return;
    const delta = newQty - currentQty;
    if (delta === 0) { setEditingBatch(null); return; }
    setBusyBatch(batchNumber ?? "__nobatch__");
    try {
      const moveType = delta > 0 ? "adjustment_in" : "adjustment_out";
      const { error } = await supabase.from("stock_movements").insert({
        product_id: productId,
        movement_type: moveType,
        quantity: Math.abs(delta),
        batch_number: batchNumber,
        date: new Date().toISOString().slice(0, 10),
        notes: reason,
      });
      if (error) throw error;
      void logAudit({
        action: "stock_adjusted",
        entity_type: "stock_movement",
        entity_id: productId,
        entity_number: batchNumber || "no-batch",
        changes: { was: currentQty, now: newQty, delta, reason },
      });
      toast.success(`Batch ${batchNumber || ""} updated: ${currentQty.toLocaleString()} → ${newQty.toLocaleString()}`);
      setEditingBatch(null);
      await reloadBatches();
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setBusyBatch(null);
    }
  };

  const deleteBatch = (b: ActiveBatch) =>
    adjustBatch(b.batch_number, b.on_hand, 0, `Batch ${b.batch_number} removed via batch drawer`);

  const updateRow = (i: number, patch: Partial<CostRow>) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const addRow = () => setRows(rs => [...rs, { type: "other", amount: "0", label: "" }]);
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i));

  const statusBadge = (s: ActiveBatch["status"]) => {
    if (s === "expired") return <Badge variant="destructive" className="rounded-sm">Expired</Badge>;
    if (s === "expiring") return <Badge className="rounded-sm bg-warning text-warning-foreground">Expiring &lt;90d</Badge>;
    return <Badge className="rounded-sm bg-success text-success-foreground">Active</Badge>;
  };

  const handleSave = async () => {
    if (!productId) return;
    setSaving(true);
    try {
      const sum = (t: CostType) => rows.filter(r => r.type === t).reduce((s, r) => s + (Number(r.amount) || 0), 0);
      const otherRow = rows.find(r => r.type === "other" && Number(r.amount) > 0);
      const payload: any = {
        product_id: productId,
        purchase_cost: Number(purchaseCost) || 0,
        printing_cost: sum("printing"),
        freight_cost: sum("freight"),
        customs_cost: sum("customs"),
        handling_cost: sum("handling"),
        other_cost: sum("other"),
        other_cost_label: otherRow?.label || null,
        source: "manual",
      };
      const { error } = await supabase.from("product_landed_costs" as any).insert(payload);
      if (error) throw error;
      toast.success(`Landed cost saved — PKR ${landedCost.toLocaleString()}`);
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Failed: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl rounded-[4px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs text-muted-foreground">{productCode || "—"}</span>
            <span>{productName || "Product"}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Landed cost engine */}
        <div className="rounded-[4px] border border-border bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Banknote className="h-4 w-4 text-primary" /> Landed Cost
            </div>
            <div className="text-xs text-muted-foreground">
              Current stored landed cost: <span className="font-mono text-foreground">PKR {Number(currentLandedCost).toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Purchase Cost (locked)</Label>
              <div className="h-9 px-3 flex items-center rounded-md border border-border bg-background font-mono tabular-nums text-sm">
                PKR {Number(purchaseCost).toLocaleString()}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Edit from the product form.</p>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Sale Price</Label>
              <div className="h-9 px-3 flex items-center rounded-md border border-border bg-background font-mono tabular-nums text-sm">
                PKR {Number(salePrice).toLocaleString()}
              </div>
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Markup %</Label>
              <div className={`h-9 px-3 flex items-center rounded-md font-mono tabular-nums text-sm ${grossMarginPct !== null && grossMarginPct >= 0 ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}>
                {grossMarginPct === null ? "—" : `${grossMarginPct.toFixed(2)}%`}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <div className="col-span-3">Cost Type</div>
              <div className="col-span-3">Amount (PKR)</div>
              <div className="col-span-5">Label / Notes</div>
              <div className="col-span-1"></div>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select
                  className="col-span-3 h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={r.type}
                  onChange={e => updateRow(i, { type: e.target.value as CostType })}
                >
                  <option value="printing">Printing</option>
                  <option value="freight">Freight</option>
                  <option value="customs">Customs</option>
                  <option value="handling">Handling / Loading</option>
                  <option value="other">Other</option>
                </select>
                <Input className="col-span-3 tabular-nums" type="number" value={r.amount} onChange={e => updateRow(i, { amount: e.target.value })} />
                <Input className="col-span-5" value={r.label || ""} onChange={e => updateRow(i, { label: e.target.value })} placeholder={r.type === "other" ? "Describe (e.g. insurance)" : "optional notes"} />
                <Button variant="ghost" size="icon" className="col-span-1 h-7 w-7 text-destructive" onClick={() => removeRow(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-3 w-3 mr-1" /> Add cost row
            </Button>
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div className="text-sm">
              <span className="text-muted-foreground">New Landed Cost: </span>
              <span className="font-mono font-bold text-primary tabular-nums">PKR {landedCost.toLocaleString()}</span>
            </div>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Landed Cost"}
            </Button>
          </div>
        </div>

        {/* Active batches */}
        <div>
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">
            Active Batches
            <Badge variant="secondary" className="rounded-sm">{batches.length}</Badge>
          </div>
          <div className="border border-border rounded-[4px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[11px] uppercase tracking-wide">Batch No</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Mfg Date</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Expiry</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">On-hand</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-center">Status</TableHead>
                  {!isSalesAgent && <TableHead className="text-[11px] uppercase tracking-wide text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">Loading…</TableCell></TableRow>
                ) : (() => {
                  const batchSum = batches.reduce((s, b) => s + b.on_hand, 0);
                  const orphanQty = Math.max(0, stockQty - batchSum);
                  const rowsToRender: (ActiveBatch | { batch_number: null; on_hand: number; mfg_date: null; expiry_date: null; status: "active" })[] = [...batches];
                  if (orphanQty > 0) rowsToRender.push({ batch_number: null, on_hand: orphanQty, mfg_date: null, expiry_date: null, status: "active" });
                  if (rowsToRender.length === 0) {
                    return (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">No active batches.</TableCell>
                      </TableRow>
                    );
                  }
                  return rowsToRender.map((b) => {
                    const key = b.batch_number ?? "__nobatch__";
                    const isEditing = editingBatch === key;
                    const isBusy = busyBatch === key;
                    return (
                      <TableRow key={key}>
                        <TableCell className="font-mono text-xs">
                          {b.batch_number || <span className="italic text-muted-foreground">no batch</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{b.mfg_date || "—"}</TableCell>
                        <TableCell className="text-xs">{b.expiry_date || "—"}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {isEditing ? (
                            <Input
                              type="number"
                              autoFocus
                              value={editQty}
                              onChange={e => setEditQty(e.target.value)}
                              className="h-7 w-28 ml-auto text-right tabular-nums"
                            />
                          ) : b.on_hand.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">{statusBadge(b.status as ActiveBatch["status"])}</TableCell>
                        {!isSalesAgent && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-success" disabled={isBusy}
                                    onClick={() => {
                                      const n = Number(editQty);
                                      if (!Number.isFinite(n) || n < 0) { toast.error("Enter a valid quantity ≥ 0"); return; }
                                      adjustBatch(b.batch_number, b.on_hand, n, `Manual batch adjustment — was ${b.on_hand}, now ${n}`);
                                    }}>
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingBatch(null)}>
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" disabled={isBusy}
                                    onClick={() => { setEditingBatch(key); setEditQty(String(b.on_hand)); }} title="Edit qty">
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={isBusy} title="Delete batch">
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove {b.on_hand.toLocaleString()} units{b.batch_number ? ` of batch ${b.batch_number}` : ""}?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Writes a reversing adjustment-out movement. Stock count updates immediately. This is audit-logged.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteBatch(b as ActiveBatch)}>Remove stock</AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  });
                })()}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
