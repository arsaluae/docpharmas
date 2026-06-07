import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { voidDocument, type VoidableTable } from "@/lib/void-document";
import { useRoles } from "@/hooks/useRoles";
import type { Resource } from "@/lib/rbac";

const TABLE_RESOURCE: Record<VoidableTable, Resource> = {
  sales_invoices: "sales",
  purchase_invoices: "purchase",
  goods_received_notes: "purchase",
  payments: "finance",
};

interface VoidDocumentButtonProps {
  table: VoidableTable;
  id: string;
  label?: string;
  size?: "sm" | "default" | "icon";
  variant?: "outline" | "ghost" | "destructive";
  disabled?: boolean;
  onDone?: () => void;
}

/**
 * Reusable Void action: shows confirm dialog requiring a reason, then calls
 * the void_document RPC which reverses stock movements and marks the doc voided.
 */
export function VoidDocumentButton({ table, id, label = "Void", size = "sm", variant = "outline", disabled, onDone }: VoidDocumentButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const { can, loading: rolesLoading } = useRoles();
  const allowed = can(TABLE_RESOURCE[table], "void");
  if (rolesLoading || !allowed) return null;

  const handleConfirm = async () => {
    setBusy(true);
    const res = await voidDocument(table, id, reason);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error || "Void failed");
      return;
    }
    toast.success("Document voided. Stock and balances reversed.");
    setOpen(false);
    setReason("");
    onDone?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled} className="gap-1">
          <Ban className="h-3.5 w-3.5" /> {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void this document?</AlertDialogTitle>
          <AlertDialogDescription>
            This will reverse all linked stock movements and balance impacts, and mark the document as voided. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2">
          <Label htmlFor="void-reason">Reason (required)</Label>
          <Textarea id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer cancelled order; duplicate entry" rows={3} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={busy || reason.trim().length < 3}>
            {busy ? "Voiding..." : "Confirm Void"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
