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
import { Plus, Search, ClipboardList, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; cost_price: number; }
interface POItem { product_id: string; description: string; quantity: number; rate: number; amount: number; }

interface PO {
  id: string; po_number: string; supplier_id: string | null; date: string; expected_delivery: string | null;
  subtotal: number; gst: number; total: number; status: string; created_at: string;
  suppliers?: { name: string } | null;
}

export default function PurchaseOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [supplierId, setSupplierId] = useState("");
  const [poDate, setPoDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDelivery, setExpectedDelivery] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<POItem[]>([]);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [po, sup, prod] = await Promise.all([
      supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name"),
      supabase.from("products").select("id, name, cost_price"),
    ]);
    if (po.data) setOrders(po.data as any);
    if (sup.data) setSuppliers(sup.data);
    if (prod.data) setProducts(prod.data);
  };

  const addItem = () => setItems([...items, { product_id: "", description: "", quantity: 1, rate: 0, amount: 0 }]);

  const updateItem = (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].description = p.name; u[idx].rate = Number(p.cost_price); }
    }
    u[idx].amount = Number(u[idx].quantity) * Number(u[idx].rate);
    setItems(u);
  };

  const calcTotals = () => {
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const gst = subtotal * 0.17;
    return { subtotal, gst, total: subtotal + gst };
  };

  const handleSave = async () => {
    if (!supplierId || items.length === 0) { toast.error("Supplier and items required"); return; }
    const { subtotal, gst, total } = calcTotals();
    const { count } = await supabase.from("purchase_orders").select("id", { count: "exact", head: true });
    const poNumber = `PO-${String((count || 0) + 1).padStart(4, "0")}`;

    const { data: po } = await supabase.from("purchase_orders").insert({
      po_number: poNumber, supplier_id: supplierId, date: poDate,
      expected_delivery: expectedDelivery || null, subtotal, gst, total, status: "draft", notes: notes || null,
    }).select().single();

    if (po) {
      await supabase.from("purchase_order_items").insert(
        items.map(i => ({ po_id: po.id, product_id: i.product_id || null, description: i.description || null, quantity: Number(i.quantity), rate: Number(i.rate), amount: i.amount }))
      );
      toast.success(`PO ${poNumber} created`);
      setOpen(false); setSupplierId(""); setItems([]); setNotes(""); load();
    }
  };

  const { subtotal, gst, total } = calcTotals();
  const filtered = orders.filter(o => o.po_number.toLowerCase().includes(search.toLowerCase()));

  const statusColor = (s: string) => {
    if (s === "received") return "bg-emerald-50 text-emerald-700";
    if (s === "sent") return "bg-primary/10 text-primary";
    if (s === "cancelled") return "bg-destructive/10 text-destructive";
    return "bg-muted text-muted-foreground";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Purchase Orders</h1>
              <p className="text-sm text-muted-foreground">Create and track purchase orders to suppliers</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New PO</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Purchase Order</DialogTitle></DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <Label>Supplier *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} /></div>
                  <div><Label>Expected Delivery</Label><Input type="date" value={expectedDelivery} onChange={e => setExpectedDelivery(e.target.value)} /></div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Items</Label>
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-4">
                        <Select value={item.product_id} onValueChange={v => updateItem(idx, "product_id", v)}>
                          <SelectTrigger className="text-xs"><SelectValue placeholder="Product/Material" /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="text-xs" placeholder="Qty" /></div>
                      <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" /></div>
                      <div className="col-span-3 text-right text-sm font-mono pt-2">{item.amount.toLocaleString()}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST 17%</span><span className="font-mono">{gst.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {total.toLocaleString()}</span></div>
                </div>
                <div className="mt-3"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
                <Button onClick={handleSave} className="w-full mt-4">Create Purchase Order</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search POs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                      <TableHead>Delivery</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-40" />No purchase orders yet.
                      </TableCell></TableRow>
                    ) : filtered.map(po => (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium font-mono">{po.po_number}</TableCell>
                        <TableCell>{(po.suppliers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{po.date}</TableCell>
                        <TableCell className="text-muted-foreground">{po.expected_delivery || "—"}</TableCell>
                        <TableCell><span className={`status-pill ${statusColor(po.status)}`}>{po.status}</span></TableCell>
                        <TableCell className="text-right font-mono font-medium">{Number(po.total).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
