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

interface ReturnItem { product_id: string; batch_number: string; quantity: string; rate: string; }

export default function PurchaseReturns() {
  const navigate = useNavigate();
  const [returns, setReturns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [pInvoices, setPInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([{ product_id: "", batch_number: "", quantity: "1", rate: "0" }]);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check(); loadData();
  }, [navigate]);

  const loadData = async () => {
    const [{ data: r }, { data: s }, { data: inv }, { data: p }] = await Promise.all([
      supabase.from("purchase_returns").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name"),
      supabase.from("purchase_invoices").select("id, bill_number, supplier_id"),
      supabase.from("products").select("id, name, cost_price"),
    ]);
    if (r) setReturns(r);
    if (s) setSuppliers(s);
    if (inv) setPInvoices(inv);
    if (p) setProducts(p);
  };

  const handleSave = async () => {
    if (!supplierId) { toast.error("Select a supplier"); return; }
    const validItems = items.filter(i => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) { toast.error("Add at least one item"); return; }

    const total = validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const { data: last } = await supabase.from("purchase_returns").select("return_number").order("created_at", { ascending: false }).limit(1);
    const num = last && last.length > 0 ? `PR-${String(parseInt(last[0].return_number.replace("PR-", "")) + 1).padStart(4, "0")}` : "PR-0001";

    const { data: pr, error } = await supabase.from("purchase_returns").insert({
      return_number: num, supplier_id: supplierId, purchase_invoice_id: invoiceId || null, reason: reason || null, total, status: "confirmed",
    }).select().single();
    if (error || !pr) { toast.error("Failed"); return; }

    await supabase.from("purchase_return_items").insert(validItems.map(i => ({
      return_id: pr.id, product_id: i.product_id, batch_number: i.batch_number || null,
      quantity: Number(i.quantity), rate: Number(i.rate), amount: Number(i.quantity) * Number(i.rate),
    })));

    toast.success(`Purchase Return ${num} created`);
    setOpen(false); setSupplierId(""); setInvoiceId(""); setReason("");
    setItems([{ product_id: "", batch_number: "", quantity: "1", rate: "0" }]);
    loadData();
  };

  const addItem = () => setItems([...items, { product_id: "", batch_number: "", quantity: "1", rate: "0" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    const next = [...items];
    (next[idx] as any)[field] = value;
    if (field === "product_id") { const p = products.find(pr => pr.id === value); if (p) next[idx].rate = String(p.cost_price); }
    setItems(next);
  };

  const filteredInvoices = pInvoices.filter(inv => !supplierId || inv.supplier_id === supplierId);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Purchase Returns</h1>
              <p className="text-sm text-muted-foreground">Returns to suppliers with item-level detail</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Return</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Purchase Return</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label>Supplier *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Purchase Invoice (optional)</Label>
                    <Select value={invoiceId} onValueChange={setInvoiceId}>
                      <SelectTrigger><SelectValue placeholder="Link invoice" /></SelectTrigger>
                      <SelectContent>{filteredInvoices.map(inv => <SelectItem key={inv.id} value={inv.id}>{inv.bill_number}</SelectItem>)}</SelectContent>
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
                <Button onClick={handleSave} className="w-full mt-4">Create Purchase Return</Button>
              </DialogContent>
            </Dialog>
          </header>
          <div className="p-6">
            <Card className="glass-card"><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Return #</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {returns.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground"><RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-40" />No purchase returns yet.</TableCell></TableRow> :
                    returns.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.return_number}</TableCell><TableCell>{r.date}</TableCell>
                        <TableCell>{r.suppliers?.name || "—"}</TableCell><TableCell className="text-xs text-muted-foreground">{r.reason || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{Number(r.total).toLocaleString()}</TableCell>
                        <TableCell><span className="status-pill bg-warning/10 text-warning">{r.status}</span></TableCell>
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
