import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { Wallet, Printer, Plus } from "lucide-react";

type Customer = { id: string; name: string; balance: number | null; phone: string | null; city: string | null };
type Payment = {
  id: string; payment_number: string; party_id: string; amount: number; payment_method: string;
  date: string; reference: string | null; notes: string | null; status: string | null;
};

const fmtPKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function CollectPayment() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [customerId, setCustomerId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from("customers").select("id, name, balance, phone, city").order("name"),
      supabase.from("payments").select("id, payment_number, party_id, amount, payment_method, date, reference, notes, status")
        .eq("type", "received").eq("party_type", "customer").order("date", { ascending: false }).limit(50),
    ]);
    setCustomers((cs as any[]) ?? []);
    setPayments((ps as any[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const selectedCustomer = customers.find(c => c.id === customerId);

  const handleSave = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    try {
      const { data: numData } = await supabase.rpc("generate_document_number", { p_document_type: "payment" });
      const { error } = await supabase.from("payments").insert({
        payment_number: numData as string,
        type: "received",
        party_type: "customer",
        party_id: customerId,
        amount: amt,
        payment_method: method,
        bank_account_id: null,
        date,
        reference: reference || null,
        notes: notes || null,
      } as any);
      if (error) { toast.error(error.message); setLoading(false); return; }
      toast.success(`Collected ${fmtPKR(amt)} from ${selectedCustomer?.name ?? "customer"}`);
      setAmount(""); setReference(""); setNotes("");
      load();
    } finally { setLoading(false); }
  };

  const printReceipt = (p: Payment) => {
    const cust = customers.find(c => c.id === p.party_id);
    const w = window.open("", "_blank", "width=420,height=600");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Receipt ${p.payment_number}</title>
      <style>body{font-family:-apple-system,sans-serif;padding:24px;color:#111} h2{margin:0 0 4px} .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #ddd} .total{font-size:22px;font-weight:700;padding:14px 0;border-top:2px solid #111;margin-top:12px;display:flex;justify-content:space-between}</style>
      </head><body>
      <h2>Payment Receipt</h2>
      <div style="color:#666;font-size:12px;margin-bottom:16px">${p.payment_number}</div>
      <div class="row"><span>Date</span><span>${fmtDate(p.date)}</span></div>
      <div class="row"><span>Customer</span><span>${cust?.name ?? "—"}</span></div>
      <div class="row"><span>Method</span><span style="text-transform:capitalize">${p.payment_method}</span></div>
      ${p.reference ? `<div class="row"><span>Reference</span><span>${p.reference}</span></div>` : ""}
      ${p.notes ? `<div class="row"><span>Notes</span><span>${p.notes}</span></div>` : ""}
      <div class="total"><span>Amount Received</span><span>${fmtPKR(Number(p.amount))}</span></div>
      <div style="margin-top:32px;font-size:11px;color:#666;text-align:center">Thank you for your payment.</div>
      <script>window.print();</script>
      </body></html>`);
    w.document.close();
  };

  return (
    <AppLayout title="Record Payment" subtitle="Collect payment from your assigned customer">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Card className="glass-card lg:col-span-2"><CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Plus className="h-3.5 w-3.5" /> New Collection
          </div>
          <div>
            <Label className="text-xs">Customer *</Label>
            <SearchableSelect
              value={customerId} onChange={setCustomerId}
              options={customers.map(c => ({ value: c.id, label: c.name + (c.city ? ` — ${c.city}` : "") }))}
              placeholder="Search customer..."
            />
            {selectedCustomer && (
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                Outstanding: <span className="font-mono tabular-nums text-foreground">{fmtPKR(Math.max(0, Number(selectedCustomer.balance) || 0))}</span>
                {selectedCustomer.phone && <> · {selectedCustomer.phone}</>}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Amount (PKR) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
            <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="online">Online / Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Reference #</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Cheque / TX ID" /></div>
          </div>
          <div><Label className="text-xs">Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <Button className="w-full" onClick={handleSave} disabled={loading}>
            <Wallet className="h-4 w-4 mr-2" /> {loading ? "Recording…" : "Record Collection"}
          </Button>
          <p className="text-[10px] text-muted-foreground">Payment goes for admin reconciliation. Cash collections are stamped to your agent profile automatically.</p>
        </CardContent></Card>

        <Card className="glass-card lg:col-span-3"><CardContent className="p-0">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> My Recent Collections
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Receipt #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center w-16">Print</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">No collections yet.</TableCell></TableRow>
              ) : payments.map(p => {
                const cust = customers.find(c => c.id === p.party_id);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{fmtDate(p.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{p.payment_number}</TableCell>
                    <TableCell>{cust?.name ?? "—"}</TableCell>
                    <TableCell className="capitalize text-xs">{p.payment_method?.replace("_", " ")}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtPKR(Number(p.amount))}</TableCell>
                    <TableCell><Badge variant={p.status === "approved" ? "default" : "secondary"} className="text-[10px] capitalize">{p.status ?? "pending"}</Badge></TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => printReceipt(p)}><Printer className="h-3.5 w-3.5" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
}
