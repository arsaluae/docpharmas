import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/SearchableSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** "credit" applies a credit note to a sales_invoice; "debit" applies a debit note to a purchase_invoice */
  kind: "credit" | "debit";
  noteId: string;
  noteNumber?: string;
  partyId: string;
  noteAmount: number;
  appliedAlready: number;
  onApplied?: () => void;
}

interface InvoiceOpt { id: string; number: string; total: number; paid: number; }

export function ApplyNoteDialog({ open, onOpenChange, kind, noteId, noteNumber, partyId, noteAmount, appliedAlready, onApplied }: Props) {
  const remaining = noteAmount - appliedAlready;
  const [invoices, setInvoices] = useState<InvoiceOpt[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !partyId) return;
    (async () => {
      if (kind === "credit") {
        const { data } = await supabase.from("sales_invoices")
          .select("id, invoice_number, total, amount_paid, status")
          .eq("customer_id", partyId)
          .in("status", ["dispatched","partial","sent","overdue"])
          .order("date", { ascending: true }).limit(200);
        setInvoices(((data || []) as any[]).map((r) => ({ id: r.id, number: r.invoice_number, total: Number(r.total), paid: Number(r.amount_paid) })));
      } else {
        const { data } = await supabase.from("purchase_invoices")
          .select("id, bill_number, total, status")
          .eq("supplier_id", partyId)
          .in("status", ["unpaid","partial"])
          .order("date", { ascending: true }).limit(200);
        setInvoices(((data || []) as any[]).map((r) => ({ id: r.id, number: r.bill_number, total: Number(r.total), paid: 0 })));
      }
    })();
  }, [open, partyId, kind]);

  const selectedInv = invoices.find(i => i.id === invoiceId);
  const maxApply = selectedInv ? Math.min(remaining, selectedInv.total - selectedInv.paid) : remaining;

  const submit = async () => {
    if (!invoiceId) { toast.error("Pick an invoice"); return; }
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("Amount required"); return; }
    if (n > maxApply + 0.001) { toast.error(`Max applicable here is PKR ${maxApply.toLocaleString()}`); return; }
    setBusy(true);
    const table = kind === "credit" ? "credit_note_applications" : "debit_note_applications";
    const payload: any = kind === "credit"
      ? { credit_note_id: noteId, invoice_id: invoiceId, amount: n }
      : { debit_note_id: noteId, invoice_id: invoiceId, amount: n };
    const { error } = await supabase.from(table as any).insert(payload);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    logAudit({
      action: kind === "credit" ? "credit_note_issued" : "debit_note_issued",
      entity_type: kind === "credit" ? "credit_note" : "debit_note",
      entity_id: noteId, entity_number: noteNumber,
      changes: { applied_to_invoice: selectedInv?.number, amount: n },
    });
    toast.success(`Applied PKR ${n.toLocaleString()} to ${selectedInv?.number}`);
    setInvoiceId(""); setAmount(""); onApplied?.(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply {kind === "credit" ? "Credit" : "Debit"} Note {noteNumber}</DialogTitle>
          <DialogDescription>
            Remaining: <span className="font-mono font-semibold text-foreground">PKR {remaining.toLocaleString()}</span> of {noteAmount.toLocaleString()}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label>Invoice *</Label>
            <SearchableSelect
              options={invoices.map(i => ({ value: i.id, label: `${i.number} — outstanding PKR ${(i.total - i.paid).toLocaleString()}` }))}
              value={invoiceId} onChange={setInvoiceId}
              placeholder={invoices.length ? "Pick an open invoice..." : "No open invoices for this party"}
            />
          </div>
          <div>
            <Label>Amount to Apply (PKR) *</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder={maxApply.toString()} />
            {selectedInv && (
              <p className="text-[10px] text-muted-foreground mt-1">Max applicable: PKR {maxApply.toLocaleString()}</p>
            )}
          </div>
          <Button onClick={submit} disabled={busy || !invoiceId || !amount} className="w-full">
            {busy ? "Applying..." : "Apply"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
