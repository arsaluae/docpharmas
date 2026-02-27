import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ReturnItem { product_id: string; product_name: string; batch_number: string; quantity: string; rate: string; }

export default function SalesReturns() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([{ product_id: "", product_name: "", batch_number: "", quantity: "1", rate: "0" }]);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check(); loadData();
  }, [navigate]);

  const loadData = async () => {
    const [{ data: r }, { data: c }, { data: inv }, { data: p }] = await Promise.all([
      supabase.from("sales_returns").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name"),
      supabase.from("sales_invoices").select("id, invoice_number, customer_id"),
      supabase.from("products").select("id, name, selling_price"),
    ]);
    if (r) setReturns(r);
    if (c) setCustomers(c);
    if (inv) setInvoices(inv);
    if (p) setProducts(p);
  };

  const handleSave = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    const validItems = items.filter(i => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) { toast.error("Add at least one item"); return; }

    const total = validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const { data: last } = await supabase.from("sales_returns").select("return_number").order("created_at", { ascending: false }).limit(1);
    const num = last && last.length > 0 ? `SR-${String(parseInt(last[0].return_number.replace("SR-", "")) + 1).padStart(4, "0")}` : "SR-0001";

    const { data: sr, error } = await supabase.from("sales_returns").insert({
      return_number: num, customer_id: customerId, invoice_id: invoiceId || null, reason: reason || null, total, status: "confirmed",
    }).select().single();
    if (error || !sr) { toast.error("Failed to create return"); return; }

    await supabase.from("sales_return_items").insert(validItems.map(i => ({
      return_id: sr.id, product_id: i.product_id, batch_number: i.batch_number || null,
      quantity: Number(i.quantity), rate: Number(i.rate), amount: Number(i.quantity) * Number(i.rate),
    })));

    toast.success(`Sales Return ${num} created`);
    setOpen(false); setCustomerId(""); setInvoiceId(""); setReason("");
    setItems([{ product_id: "", product_name: "", batch_number: "", quantity: "1", rate: "0" }]);
    loadData();
  };

  const addItem = () => setItems([...items, { product_id: "", product_name: "", batch_number: "", quantity: "1", rate: "0" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    const next = [...items];
    (next[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { next[idx].product_name = p.name; next[idx].rate = String(p.selling_price); }
    }
    setItems(next);
  };

  const filteredInvoices = invoices.filter(inv => !customerId || inv.customer_id === customerId);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Sales Returns</h1>
              <p className="text-sm text-muted-foreground">Credit notes with item-level returns</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Return</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Sales Return</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label>Customer *</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Invoice (optional)</Label>
                    <Select value={invoiceId} onValueChange={setInvoiceId}>
                      <SelectTrigger><SelectValue placeholder="Link invoice" /></SelectTrigger>
                      <SelectContent>{filteredInvoices.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.invoice_number}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2"><Label>Reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between"><Label className="text-sm font-semibold">Return Items</Label><Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add</Button></div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Select value={item.product_id} onValueChange={v => updateItem(idx, "product_id", v)}>
                          <SelectTrigger className="text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2"><Input placeholder="Batch" className="text-xs" value={item.batch_number} onChange={e => updateItem(idx, "batch_number", e.target.value)} /></div>
                      <div className="col-span-2"><Input type="number" className="text-xs" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} /></div>
                      <div className="col-span-2"><Input type="number" className="text-xs" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} /></div>
                      <div className="col-span-1 text-right text-xs font-mono pt-2">{(Number(item.quantity) * Number(item.rate)).toLocaleString()}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}><Trash2 className="h-3 w-3" /></Button></div>
                    </div>
                  ))}
                </div>
                <Button onClick={handleSave} className="w-full mt-4">Create Sales Return</Button>
              </DialogContent>
            </Dialog>
          </header>
          <div className="p-6">
            <Card className="glass-card"><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {returns.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-40" />No sales returns yet.</TableCell></TableRow> :
                    returns.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.return_number}</TableCell>
                        <TableCell>{r.date}</TableCell>
                        <TableCell>{r.customers?.name || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.reason || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{Number(r.total).toLocaleString()}</TableCell>
                        <TableCell><span className="status-pill bg-amber-50 text-amber-700">{r.status}</span></TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
