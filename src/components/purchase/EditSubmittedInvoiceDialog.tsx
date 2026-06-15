import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { toast } from "sonner";
import { Loader2, Save, AlertTriangle } from "lucide-react";
import { LockBanner } from "./LockBanner";

interface Line {
  id: string;
  item_name: string;
  batch_number: string | null;
  quantity_received: number;
  rate: number;
  amount: number;
  _newQty: string;
  _newRate: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoiceId: string | null;
  invoiceNumber?: string;
  onSaved?: () => void;
}

export function EditSubmittedInvoiceDialog({ open, onOpenChange, invoiceId, invoiceNumber, onSaved }: Props) {
  const { settings } = useCompanySettings();
  const windowDays = (settings as any)?.purchase_edit_window_days ?? 30;
  const [lines, setLines] = useState<Line[]>([]);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !invoiceId) return;
    (async () => {
      setLoading(true); setReason("");
      await supabase.rpc("check_purchase_invoice_lock" as any, { p_invoice_id: invoiceId });
      const { data: inv } = await supabase
        .from("purchase_invoices")
        .select("submitted_at, locked_at, grn_id, bill_number")
        .eq("id", invoiceId).single();
      setSubmittedAt(inv?.submitted_at ?? null);
      setLockedAt(inv?.locked_at ?? null);
      if (inv?.grn_id) {
        const { data: items } = await supabase
          .from("grn_items")
          .select("id, item_name, batch_number, quantity_received, rate, amount")
          .eq("grn_id", inv.grn_id)
          .order("item_name");
        setLines((items ?? []).map((r: any) => ({
          ...r,
          _newQty: String(r.quantity_received),
          _newRate: String(r.rate),
        })));
      } else {
        setLines([]);
      }
      setLoading(false);
    })();
  }, [open, invoiceId]);

  const dirtyLines = lines.filter(l =>
    Number(l._newQty) !== Number(l.quantity_received) ||
    Number(l._newRate) !== Number(l.rate)
  );

  const totalImpact = dirtyLines.reduce((acc, l) => {
    const oldAmt = Number(l.quantity_received) * Number(l.rate);
    const newAmt = Number(l._newQty || 0) * Number(l._newRate || 0);
    return acc + (newAmt - oldAmt);
  }, 0);

  const saveAll = async () => {
    if (!invoiceId) return;
    if (reason.trim().length < 3) { toast.error("Enter a reason (min 3 chars)"); return; }
    if (!dirtyLines.length) { toast.info("Nothing changed"); return; }
    setSaving(true);
    let ok = 0, fail = 0;
    for (const l of dirtyLines) {
      const { error } = await supabase.rpc("edit_purchase_bill_line" as any, {
        p_invoice_id: invoiceId,
        p_grn_item_id: l.id,
        p_new_qty: Number(l._newQty),
        p_new_rate: Number(l._newRate),
        p_reason: reason,
      });
      if (error) { fail++; toast.error(`${l.item_name}: ${error.message}`); }
      else ok++;
    }
    setSaving(false);
    if (ok) toast.success(`Updated ${ok} line${ok === 1 ? "" : "s"}. Stock & ledger synced.`);
    if (!fail) { onOpenChange(false); onSaved?.(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Edit Submitted Invoice {invoiceNumber ? `— ${invoiceNumber}` : ""}</DialogTitle>
        </DialogHeader>

        <LockBanner lockedAt={lockedAt} submittedAt={submittedAt} windowDays={windowDays} />

        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-xs tabular-nums">
                <thead className="bg-muted/40">
                  <tr className="text-left">
                    <th className="px-3 py-2">Item</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2 text-right">Old Qty</th>
                    <th className="px-3 py-2 text-right">New Qty</th>
                    <th className="px-3 py-2 text-right">Old Rate</th>
                    <th className="px-3 py-2 text-right">New Rate</th>
                    <th className="px-3 py-2 text-right">Δ Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const oldAmt = Number(l.quantity_received) * Number(l.rate);
                    const newAmt = Number(l._newQty || 0) * Number(l._newRate || 0);
                    const delta = newAmt - oldAmt;
                    const dirty = delta !== 0 || Number(l._newQty) !== Number(l.quantity_received);
                    const disabled = !!lockedAt;
                    return (
                      <tr key={l.id} className={dirty ? "bg-warning/5" : ""}>
                        <td className="px-3 py-1.5">{l.item_name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{l.batch_number || "—"}</td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">{l.quantity_received}</td>
                        <td className="px-3 py-1.5 text-right">
                          <Input
                            type="number" step="any" min="0"
                            disabled={disabled}
                            className="h-8 w-24 text-right ml-auto"
                            value={l._newQty}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines(prev => prev.map((p, j) => j === i ? { ...p, _newQty: v } : p));
                            }}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">{Number(l.rate).toFixed(2)}</td>
                        <td className="px-3 py-1.5 text-right">
                          <Input
                            type="number" step="any" min="0"
                            disabled={disabled}
                            className="h-8 w-28 text-right ml-auto"
                            value={l._newRate}
                            onChange={(e) => {
                              const v = e.target.value;
                              setLines(prev => prev.map((p, j) => j === i ? { ...p, _newRate: v } : p));
                            }}
                          />
                        </td>
                        <td className={`px-3 py-1.5 text-right ${delta > 0 ? "text-success" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {delta === 0 ? "—" : (delta > 0 ? "+" : "") + delta.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                  {lines.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">No lines found for this invoice.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {dirtyLines.length > 0 && (
              <div className="rounded border border-primary/30 bg-primary/5 p-3 text-xs space-y-1.5">
                <p className="font-medium flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-primary" /> Impact Preview</p>
                <p className="text-muted-foreground">
                  {dirtyLines.length} line{dirtyLines.length === 1 ? "" : "s"} will change · Invoice total Δ: <span className={`font-medium ${totalImpact > 0 ? "text-success" : "text-destructive"}`}>{totalImpact > 0 ? "+" : ""}{totalImpact.toFixed(2)}</span>
                </p>
                <p className="text-muted-foreground">Stock will be adjusted with an offsetting movement (history preserved). Supplier ledger updates automatically.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-reason" className="text-xs">Reason for edit (required)</Label>
              <Textarea id="edit-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Supplier short-shipped 2 cartons; corrected rate per revised invoice…"
                disabled={!!lockedAt} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={saveAll} disabled={saving || !!lockedAt || dirtyLines.length === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save {dirtyLines.length > 0 ? `(${dirtyLines.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
