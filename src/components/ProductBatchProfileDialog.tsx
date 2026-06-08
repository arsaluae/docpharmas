import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Package, Banknote, Truck, Printer } from "lucide-react";
import { getActiveBatches, type ActiveBatch } from "@/lib/batches";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string | null;
  productName?: string;
  productCode?: string;
  currentCost?: number;
}

export function ProductBatchProfileDialog({ open, onOpenChange, productId, productName, productCode, currentCost = 0 }: Props) {
  const [batches, setBatches] = useState<ActiveBatch[]>([]);
  const [loading, setLoading] = useState(false);

  // Landed cost calc
  const [base, setBase] = useState(String(currentCost || 0));
  const [printing, setPrinting] = useState("0");
  const [freight, setFreight] = useState("0");
  const [saving, setSaving] = useState(false);

  const trueCost = useMemo(
    () => Number(base || 0) + Number(printing || 0) + Number(freight || 0),
    [base, printing, freight]
  );

  useEffect(() => {
    if (!open || !productId) return;
    setBase(String(currentCost || 0));
    setPrinting("0");
    setFreight("0");
    setLoading(true);
    getActiveBatches(productId)
      .then((list) => setBatches(list))
      .finally(() => setLoading(false));
  }, [open, productId, currentCost]);

  const statusBadge = (s: ActiveBatch["status"]) => {
    if (s === "expired") return <Badge variant="destructive" className="rounded-sm">Expired</Badge>;
    if (s === "expiring") return <Badge className="rounded-sm bg-warning text-warning-foreground">Expiring &lt;90d</Badge>;
    return <Badge className="rounded-sm bg-success text-success-foreground">Active</Badge>;
  };

  const handleSaveCost = async () => {
    if (!productId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("products").update({ cost_price: trueCost }).eq("id", productId);
      if (error) throw error;
      // Persist component breakdown for audit
      const rows: any[] = [];
      if (Number(printing) > 0) rows.push({ reference_type: "product", reference_id: productId, cost_type: "printing", amount: Number(printing), description: "Landed cost — printing" });
      if (Number(freight) > 0) rows.push({ reference_type: "product", reference_id: productId, cost_type: "freight", amount: Number(freight), description: "Landed cost — inward freight" });
      if (rows.length) await supabase.from("additional_costs").insert(rows);
      toast.success(`True cost updated to PKR ${trueCost.toLocaleString()}`);
    } catch (e: any) {
      toast.error("Failed to save: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl rounded-[4px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs text-muted-foreground">{productCode || "—"}</span>
            <span>{productName || "Product"}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Landed cost engine */}
        <div className="rounded-[4px] border border-border bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Banknote className="h-4 w-4 text-primary" /> Landed Cost Engine
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">Supplier Base</Label>
              <Input value={base} onChange={(e) => setBase(e.target.value)} type="number" className="rounded-[4px] tabular-nums" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Printer className="h-3 w-3" />Printing</Label>
              <Input value={printing} onChange={(e) => setPrinting(e.target.value)} type="number" className="rounded-[4px] tabular-nums" />
            </div>
            <div>
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Truck className="h-3 w-3" />Inward Freight</Label>
              <Input value={freight} onChange={(e) => setFreight(e.target.value)} type="number" className="rounded-[4px] tabular-nums" />
            </div>
            <div className="flex flex-col justify-end">
              <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">True Cost</Label>
              <div className="h-9 px-3 flex items-center rounded-[4px] bg-primary text-primary-foreground font-mono text-sm tabular-nums">
                PKR {trueCost.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <Button size="sm" className="rounded-[4px]" onClick={handleSaveCost} disabled={saving}>
              {saving ? "Saving…" : "Save True Cost"}
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
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No active batches.</TableCell></TableRow>
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
