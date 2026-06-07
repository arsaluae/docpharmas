import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Trash2, Clock, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useRoles } from "@/hooks/useRoles";

interface Props {
  /** "sales_invoices" or "purchase_invoices" */
  table: "sales_invoices" | "purchase_invoices";
  invoiceId: string;
  invoiceNumber?: string;
  approvedAt?: string | null;
  graceHours?: number; // default 48
  /** Called after a successful in-grace delete */
  onDeleted?: () => void;
  /** Called when grace has expired and user clicks "Raise Return" */
  onRaiseReturn?: () => void;
}

function parseInterval(s: string | null | undefined): number {
  // Postgres interval comes as e.g. "1 day 02:03:04.5" or "-00:05:00".
  if (!s) return 0;
  const neg = s.trim().startsWith("-");
  const m = s.match(/(?:(-?\d+)\s+days?)?\s*(-?\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  const days = Number(m[1] || 0);
  const h = Number(m[2]);
  const mins = Number(m[3]);
  const sec = Number(m[4]);
  const ms = ((days * 24 + Math.abs(h)) * 3600 + mins * 60 + sec) * 1000;
  return neg ? -ms : ms;
}

export function GraceDeleteButton({ table, invoiceId, invoiceNumber, approvedAt, graceHours = 48, onDeleted, onRaiseReturn }: Props) {
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!approvedAt) return 0;
    return new Date(approvedAt).getTime() + graceHours * 3600_000 - Date.now();
  });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setInterval(() => {
      if (!approvedAt) return;
      setRemainingMs(new Date(approvedAt).getTime() + graceHours * 3600_000 - Date.now());
    }, 60_000);
    return () => clearInterval(t);
  }, [approvedAt, graceHours]);

  const inGrace = remainingMs > 0;
  const hrs = Math.floor(remainingMs / 3600_000);
  const mins = Math.floor((remainingMs % 3600_000) / 60_000);

  const handleConfirm = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("delete_invoice_with_grace" as any, {
      p_table: table, p_id: invoiceId, p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    logAudit({ action: "deleted", entity_type: table === "sales_invoices" ? "sales_invoice" : "purchase_invoice", entity_id: invoiceId, entity_number: invoiceNumber, changes: { reason, grace_delete: true } });
    toast.success(`Invoice ${invoiceNumber || ""} deleted within grace window`);
    setOpen(false); setReason(""); onDeleted?.();
  };

  if (!inGrace) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <Badge variant="outline" className="gap-1 text-[10px] border-warning/40 text-warning">
          <Clock className="h-3 w-3" /> Grace expired
        </Badge>
        {onRaiseReturn && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRaiseReturn}>
            <RotateCcw className="h-3 w-3 mr-1" /> Raise Return
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Badge variant="outline" className="gap-1 text-[10px] border-success/40 text-success font-mono">
        <Clock className="h-3 w-3" />
        {hrs}h {mins}m
      </Badge>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice {invoiceNumber || ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reverse stock movements and balance impacts. After the {graceHours}h grace window expires, deletion is blocked and you must raise a Return / Credit Note instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="grace-reason">Reason (required)</Label>
            <Textarea id="grace-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong customer; duplicate entry" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={busy || reason.trim().length < 3} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? "Deleting..." : "Confirm Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
