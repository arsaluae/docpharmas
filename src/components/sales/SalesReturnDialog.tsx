import { useEffect, useState } from "react";
import { logAudit } from "@/lib/audit";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RotateCcw } from "lucide-react";

const RETURN_REASONS = [
  { value: "damaged", label: "Damaged in transit" },
  { value: "wrong_product", label: "Wrong product / mis-shipment" },
  { value: "expiry", label: "Expired / near-expiry stock" },
  { value: "customer_request", label: "Customer cancelled / refused" },
  { value: "quality_issue", label: "Quality issue" },
  { value: "other", label: "Other (specify in notes)" },
];
import { toast } from "sonner";

interface Props {
 open: boolean;
 onOpenChange: (o: boolean) => void;
 /** Source sales invoice ID — items will be loaded from sales_invoice_items */
 invoiceId: string | null;
 invoiceNumber?: string;
 customerId: string | null;
 onSaved?: () => void;
}

interface ReturnLine {
 product_id: string | null;
 product_name: string;
 batch_number: string | null;
 sold_qty: number;
 already_returned: number;
 return_qty: number;
 rate: number;
 amount: number;
}

export function SalesReturnDialog({ open, onOpenChange, invoiceId, invoiceNumber, customerId, onSaved }: Props) {
 const [lines, setLines] = useState<ReturnLine[]>([]);
 const [reason, setReason] = useState("");
 const [reasonCode, setReasonCode] = useState<string>("");
 const [loading, setLoading] = useState(false);
 const [saving, setSaving] = useState(false);

 useEffect(() => {
 if (!open || !invoiceId) return;
 (async () => {
 setLoading(true);
 const itemsRes: any = await supabase.from("sales_invoice_items").select("product_id, quantity, rate, batch_number, products(name)").eq("invoice_id", invoiceId);
 const retRes: any = await (supabase as any).from("sales_returns").select("id").eq("invoice_id", invoiceId);
 const items = itemsRes.data; const returns = retRes.data;

 // Build returned-qty map from sales_return_items
 const returnIds = ((returns as any[]) || []).map(r => r.id);
 let returnedMap: Record<string, number> = {};
 if (returnIds.length > 0) {
 const { data: ri } = await (supabase as any).from("sales_return_items")
 .select("product_id, batch_number, quantity")
 .in("return_id", returnIds);
 ((ri as any[]) || []).forEach(r => {
 const key = `${r.product_id}__${r.batch_number || ""}`;
 returnedMap[key] = (returnedMap[key] || 0) + Number(r.quantity || 0);
 });
 }

 const ls: ReturnLine[] = ((items as any[]) || []).map(it => {
 const key = `${it.product_id}__${it.batch_number || ""}`;
 const returned = returnedMap[key] || 0;
 return {
 product_id: it.product_id,
 product_name: it.products?.name || "Item",
 batch_number: it.batch_number,
 sold_qty: Number(it.quantity),
 already_returned: returned,
 return_qty: 0,
 rate: Number(it.rate),
 amount: 0,
 };
 });
 setLines(ls);
 setLoading(false);
 })();
 }, [open, invoiceId]);

 const updateLine = (idx: number, qty: string) => {
 const u = [...lines];
 const max = u[idx].sold_qty - u[idx].already_returned;
 let q = Number(qty);
 if (q < 0) q = 0;
 if (q > max) { q = max; toast.error(`Max returnable for ${u[idx].product_name}: ${max}`); }
 u[idx].return_qty = q;
 u[idx].amount = q * u[idx].rate;
 setLines(u);
 };

 const totalReturn = lines.reduce((s, l) => s + l.amount, 0);
 const canSubmit = lines.some(l => l.return_qty > 0) && reasonCode.length > 0;

 const handleSubmit = async () => {
 if (!invoiceId || !customerId) return;
 setSaving(true);
 try {
 const { data: srNum } = await supabase.rpc("generate_document_number", { p_document_type: "sales_return" });
 if (!srNum) throw new Error("Could not generate return number");
 const subtotal = totalReturn;
 const srRes: any = await (supabase as any).from("sales_returns").insert({
 return_number: srNum,
 customer_id: customerId,
 invoice_id: invoiceId,
 date: new Date().toISOString().split("T")[0],
 total: subtotal,
 return_reason: reasonCode,
 reason: reason || RETURN_REASONS.find(r => r.value === reasonCode)?.label || reasonCode,
 status: "active",
 }).select("id").single();
 if (srRes.error || !srRes.data) throw new Error(srRes.error?.message || "Return create failed");
 const returnId = srRes.data.id;

 const itemsPayload = lines.filter(l => l.return_qty > 0).map(l => ({
 return_id: returnId,
 product_id: l.product_id,
 quantity: l.return_qty,
 rate: l.rate,
 amount: l.amount,
 batch_number: l.batch_number,
 }));
 const itemsRes: any = await (supabase as any).from("sales_return_items").insert(itemsPayload);
 if (itemsRes.error) throw new Error(itemsRes.error.message);

 // Stock back in
 for (const l of lines.filter(l => l.return_qty > 0 && l.product_id)) {
 await supabase.from("stock_movements").insert({
 product_id: l.product_id, quantity: l.return_qty,
 movement_type: "return_in", batch_number: l.batch_number,
 reference_type: "sales_return", reference_id: returnId,
 notes: `Return ${srNum} from invoice ${invoiceNumber || ""}`,
 } as any);
 }
  logAudit({ action: "return_raised", entity_type: "sales_return", entity_id: returnId, entity_number: srNum, changes: { reason, total: subtotal, invoice_number: invoiceNumber } });
  toast.success(`Sales Return ${srNum} created (PKR ${subtotal.toLocaleString()})`);
 onSaved?.();
 onOpenChange(false);
 } catch (e: any) {
 toast.error(e.message || "Failed to create return");
 } finally {
 setSaving(false);
 }
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2 font-heading">
 <RotateCcw className="h-4 w-4 text-warning" /> Return Items {invoiceNumber ? `— ${invoiceNumber}` : ""}
 </DialogTitle>
 </DialogHeader>

 {!invoiceId ? (
 <p className="text-sm text-muted-foreground py-6 text-center">
 Returns can only be created against a dispatched invoice. Submit this order first.
 </p>
 ) : loading ? (
 <div className="py-12 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></div>
 ) : (
 <>
 <p className="text-xs text-muted-foreground">Quantity is capped at sold − already returned per batch.</p>
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Item</TableHead>
 <TableHead>Batch</TableHead>
 <TableHead className="text-right">Sold</TableHead>
 <TableHead className="text-right">Max</TableHead>
 <TableHead className="w-24">Return Qty</TableHead>
 <TableHead className="text-right">Price</TableHead>
 <TableHead className="text-right">Amount</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {lines.map((l, idx) => {
 const max = l.sold_qty - l.already_returned;
 return (
 <TableRow key={idx}>
 <TableCell className="text-sm">{l.product_name}</TableCell>
 <TableCell className="font-mono text-xs">{l.batch_number || "—"}</TableCell>
 <TableCell className="text-right text-xs">{l.sold_qty}</TableCell>
 <TableCell className="text-right text-xs text-muted-foreground">{max}</TableCell>
 <TableCell>
 <Input type="number" min={0} max={max} value={l.return_qty || ""}
 onChange={e => updateLine(idx, e.target.value)} className="h-8 text-xs" disabled={max === 0} />
 </TableCell>
 <TableCell className="text-right font-mono text-xs">{l.rate.toLocaleString()}</TableCell>
 <TableCell className="text-right font-mono text-sm">{l.amount.toLocaleString()}</TableCell>
 </TableRow>
 );
 })}
 </TableBody>
 </Table>
  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">Reason *</Label>
      <Select value={reasonCode} onValueChange={setReasonCode}>
        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select reason..." /></SelectTrigger>
        <SelectContent>{RETURN_REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
    <div className="sm:col-span-2 space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
      <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
        placeholder="Optional detail — batch, vehicle, contact..." />
    </div>
  </div>
 <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
 <span className="text-sm text-muted-foreground">Total Return Value</span>
 <span className="text-lg font-bold font-mono">PKR {totalReturn.toLocaleString()}</span>
 </div>
 <div className="flex gap-2 mt-4">
 <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">Cancel</Button>
 <Button onClick={handleSubmit} disabled={!canSubmit || saving} className="flex-1 bg-warning/10 hover:bg-warning/10 text-white">
 {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Return
 </Button>
 </div>
 </>
 )}
 </DialogContent>
 </Dialog>
 );
}
