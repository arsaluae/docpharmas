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
import { Plus, Search, FilePlus, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface Customer { id: string; name: string; }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; }

interface ProformaItem { product_id: string; product_name: string; quantity: number; rate: number; gst_rate: number; amount: number; }

interface Proforma {
  id: string; proforma_number: string; customer_id: string | null; date: string; validity_days: number;
  items: any; subtotal: number; gst: number; total: number; status: string;
  converted_invoice_id: string | null; created_at: string;
  customers?: { name: string } | null;
}

export default function ProformaInvoices() {
  const navigate = useNavigate();
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [pfDate, setPfDate] = useState(new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState("30");
  const [items, setItems] = useState<ProformaItem[]>([]);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [pf, cust, prod] = await Promise.all([
      supabase.from("proforma_invoices").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name"),
      supabase.from("products").select("id, name, selling_price, gst_rate"),
    ]);
    if (pf.data) setProformas(pf.data as any);
    if (cust.data) setCustomers(cust.data);
    if (prod.data) setProducts(prod.data);
  };

  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: 17, amount: 0 }]);

  const updateItem = (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = Number(p.gst_rate); }
    }
    const line = Number(u[idx].quantity) * Number(u[idx].rate);
    u[idx].amount = line + (line * Number(u[idx].gst_rate) / 100);
    setItems(u);
  };

  const calcTotals = () => {
    const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const gst = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate) * Number(i.gst_rate) / 100), 0);
    return { subtotal, gst, total: subtotal + gst };
  };

  const handleSave = async () => {
    if (!customerId || items.length === 0) { toast.error("Customer and items required"); return; }
    const { subtotal, gst, total } = calcTotals();
    const { count } = await supabase.from("proforma_invoices").select("id", { count: "exact", head: true });
    const pfNumber = `PF-${String((count || 0) + 1).padStart(4, "0")}`;

    await supabase.from("proforma_invoices").insert({
      proforma_number: pfNumber, customer_id: customerId, date: pfDate,
      validity_days: Number(validityDays), items: JSON.stringify(items), subtotal, gst, total, status: "draft",
    });
    toast.success(`Proforma ${pfNumber} created`);
    setOpen(false); setCustomerId(""); setItems([]); load();
  };

  const convertToInvoice = async (pf: Proforma) => {
    const { count } = await supabase.from("sales_invoices").select("id", { count: "exact", head: true });
    const invNumber = `SI-${String((count || 0) + 1).padStart(4, "0")}`;

    const { data: inv } = await supabase.from("sales_invoices").insert({
      invoice_number: invNumber, customer_id: pf.customer_id, date: new Date().toISOString().split("T")[0],
      subtotal: pf.subtotal, gst_amount: pf.gst, total: pf.total, status: "draft",
    }).select().single();

    if (inv) {
      const pfItems: ProformaItem[] = typeof pf.items === "string" ? JSON.parse(pf.items) : pf.items;
      if (Array.isArray(pfItems)) {
        const lineItems = pfItems.map((i: ProformaItem) => ({
          invoice_id: inv.id, product_id: i.product_id || null,
          quantity: Number(i.quantity), rate: Number(i.rate), gst_rate: Number(i.gst_rate), amount: i.amount,
        }));
        await supabase.from("sales_invoice_items").insert(lineItems);
      }
      await supabase.from("proforma_invoices").update({ status: "converted", converted_invoice_id: inv.id }).eq("id", pf.id);
      toast.success(`Converted to ${invNumber}`);
      load();
    }
  };

  const { subtotal, gst, total } = calcTotals();
  const filtered = proformas.filter(p => p.proforma_number.toLowerCase().includes(search.toLowerCase()));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Proforma Invoices</h1>
              <p className="text-sm text-muted-foreground">Quotations that can be converted to sales invoices</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Proforma</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Proforma Invoice</DialogTitle></DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <Label>Customer *</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={pfDate} onChange={e => setPfDate(e.target.value)} /></div>
                  <div><Label>Validity (days)</Label><Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} /></div>
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
                          <SelectTrigger className="text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-1"><Input type="number" value={item.gst_rate} onChange={e => updateItem(idx, "gst_rate", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-3 text-right text-sm font-mono pt-2">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">{gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">Create Proforma</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search proformas..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proforma #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Validity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <FilePlus className="h-8 w-8 mx-auto mb-2 opacity-40" />No proformas yet.
                      </TableCell></TableRow>
                    ) : filtered.map(pf => (
                      <TableRow key={pf.id}>
                        <TableCell className="font-medium font-mono">{pf.proforma_number}</TableCell>
                        <TableCell>{(pf.customers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{pf.date}</TableCell>
                        <TableCell>{pf.validity_days}d</TableCell>
                        <TableCell>
                          <span className={`status-pill ${pf.status === "converted" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                            {pf.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">{Number(pf.total).toLocaleString()}</TableCell>
                        <TableCell>
                          {pf.status !== "converted" && (
                            <Button variant="outline" size="sm" onClick={() => convertToInvoice(pf)} className="text-xs">
                              <ArrowRight className="h-3 w-3 mr-1" /> Convert
                            </Button>
                          )}
                        </TableCell>
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
