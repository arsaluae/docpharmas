import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, Banknote, Plus, Trash2, Info } from "lucide-react";
import { getActiveBatches, type ActiveBatch } from "@/lib/batches";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

  const landedCost = useMemo(
    () => Number(purchaseCost || 0) + rows.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    [rows, purchaseCost]
  );

  const grossMarginPct = useMemo(() => {
    if (!salePrice || salePrice <= 0) return null;
    return ((salePrice - landedCost) / salePrice) * 100;
  }, [salePrice, landedCost]);

  useEffect(() => {
    if (!open || !productId) return;
    setRows([{ type: "printing", amount: "0" }, { type: "freight", amount: "0" }]);
    setLoading(true);
    Promise.all([
      getActiveBatches(productId),
      supabase.from("products").select("stock_quantity").eq("id", productId).single(),
    ]).then(([list, prod]) => {
      setBatches(list);
      setStockQty(Number((prod.data as any)?.stock_quantity ?? 0));
    }).finally(() => setLoading(false));
  }, [open, productId]);

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
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Gross Margin</Label>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">Loading…</TableCell></TableRow>
                ) : batches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                      {stockQty > 0 ? (
                        <div className="flex items-center justify-center gap-2 text-warning">
                          <Info className="h-4 w-4" />
                          Stock present ({stockQty.toLocaleString()}) but no batch history. Use “Add Opening Stock” to record batches.
                        </div>
                      ) : (
                        "No active batches."
                      )}
                    </TableCell>
                  </TableRow>
                ) : batches.map((b) => (
                  <TableRow key={b.batch_number}>
                    <TableCell className="font-mono text-xs">{b.batch_number}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{b.mfg_date || "—"}</TableCell>
                    <TableCell className="text-xs">{b.expiry_date || "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{b.on_hand.toLocaleString()}</TableCell>
                    <TableCell className="text-center">{statusBadge(b.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
