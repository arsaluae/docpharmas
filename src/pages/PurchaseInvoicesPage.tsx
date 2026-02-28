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
import { Plus, Search, Receipt, Download, FileOutput, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";

interface Supplier { id: string; name: string; wht_rate: number; }
interface GRN { id: string; grn_number: string; supplier_id: string | null; }

interface PurchaseInvoice {
  id: string; bill_number: string; supplier_id: string | null; grn_id: string | null; date: string;
  due_date: string | null; subtotal: number; gst: number; wht_amount: number; total: number;
  status: string; created_at: string;
  suppliers?: { name: string } | null;
}

export default function PurchaseInvoicesPage() {
  const navigate = useNavigate();
  const [bills, setBills] = useState<PurchaseInvoice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [grns, setGrns] = useState<GRN[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { settings } = useCompanySettings();

  const [supplierId, setSupplierId] = useState("");
  const [grnId, setGrnId] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [subtotal, setSubtotal] = useState("0");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [b, s, g] = await Promise.all([
      supabase.from("purchase_invoices").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name, wht_rate"),
      supabase.from("goods_received_notes").select("id, grn_number, supplier_id"),
    ]);
    if (b.data) setBills(b.data as any);
    if (s.data) setSuppliers(s.data);
    if (g.data) setGrns(g.data);
  };

  const calcTotals = () => {
    const sub = Number(subtotal);
    const gst = sub * 0.17;
    const supplier = suppliers.find(s => s.id === supplierId);
    const whtRate = supplier ? Number(supplier.wht_rate) : 4.5;
    const wht = sub * whtRate / 100;
    const total = sub + gst - wht;
    return { gst, wht, whtRate, total };
  };

  const handleSave = async () => {
    if (!supplierId) { toast.error("Select a supplier"); return; }
    const sub = Number(subtotal);
    if (sub <= 0) { toast.error("Enter subtotal"); return; }
    const { gst, wht, total } = calcTotals();
    const { count } = await supabase.from("purchase_invoices").select("id", { count: "exact", head: true });
    const billNumber = `PI-${String((count || 0) + 1).padStart(4, "0")}`;

    await supabase.from("purchase_invoices").insert({
      bill_number: billNumber, supplier_id: supplierId, grn_id: grnId || null,
      date: billDate, due_date: dueDate || null, subtotal: sub, gst, wht_amount: wht, total, status: "unpaid",
    });
    toast.success(`Bill ${billNumber} created`);
    setOpen(false); setSupplierId(""); setGrnId(""); setSubtotal("0"); load();
  };

  const { gst, wht, whtRate, total } = calcTotals();
  const filtered = bills.filter(b => b.bill_number.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(b => b.id)));

  const handleBulkDelete = async (ids: string[]) => {
    if (!window.confirm(`Delete ${ids.length} purchase bill(s)?`)) return;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await supabase.from("purchase_invoices").delete().in("id", chunk);
    }
    toast.success(`${ids.length} deleted`);
    setSelected(new Set());
    load();
  };

  const statusColor = (s: string) => {
    if (s === "paid") return "bg-emerald-50 text-emerald-700";
    if (s === "partial") return "bg-amber-50 text-amber-700";
    return "bg-destructive/10 text-destructive";
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Purchase Bills</h1>
              <p className="text-sm text-muted-foreground">Supplier invoices with WHT deduction</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Bill</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>New Purchase Bill</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label>Supplier *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name} (WHT {s.wht_rate}%)</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>GRN (optional)</Label>
                    <Select value={grnId} onValueChange={setGrnId}>
                      <SelectTrigger><SelectValue placeholder="Link GRN..." /></SelectTrigger>
                      <SelectContent>{grns.map(g => <SelectItem key={g.id} value={g.id}>{g.grn_number}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Bill Date</Label><Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} /></div>
                  <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                  <div className="col-span-2"><Label>Subtotal (PKR)</Label><Input type="number" value={subtotal} onChange={e => setSubtotal(e.target.value)} /></div>
                </div>
                <div className="mt-4 border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{Number(subtotal).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST 17%</span><span className="font-mono">+{gst.toLocaleString()}</span></div>
                  <div className="flex justify-between text-amber-700"><span>WHT {whtRate}%</span><span className="font-mono">-{wht.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>Net Payable</span><span className="font-mono">PKR {total.toLocaleString()}</span></div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">Create Bill</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search bills..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>Bill #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead><TableHead className="text-right">WHT</TableHead>
                      <TableHead className="text-right">Net Total</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />No purchase bills yet.
                      </TableCell></TableRow>
                    ) : filtered.map(b => (
                      <TableRow key={b.id} data-state={selected.has(b.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(b.id)} onCheckedChange={() => toggleSelect(b.id)} /></TableCell>
                        <TableCell className="font-medium font-mono">{b.bill_number}</TableCell>
                        <TableCell>{(b.suppliers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{b.date}</TableCell>
                        <TableCell className="text-right font-mono">{Number(b.subtotal).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono text-amber-700">-{Number(b.wht_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{Number(b.total).toLocaleString()}</TableCell>
                        <TableCell><span className={`status-pill ${statusColor(b.status)}`}>{b.status}</span></TableCell>
                        <TableCell className="space-x-1">
                          <Button variant="outline" size="sm" onClick={() => {
                            generatePdf({
                              title: "PURCHASE BILL", documentNumber: b.bill_number, date: b.date,
                              partyLabel: "Supplier", partyName: (b.suppliers as any)?.name || "—",
                              columns: [
                                { header: "Subtotal", key: "subtotal", align: "right" },
                                { header: "GST", key: "gst", align: "right" },
                                { header: "WHT", key: "wht", align: "right" },
                                { header: "Net Total", key: "total", align: "right" },
                              ],
                              rows: [{ subtotal: Number(b.subtotal).toLocaleString(), gst: Number(b.gst).toLocaleString(), wht: `-${Number(b.wht_amount).toLocaleString()}`, total: Number(b.total).toLocaleString() }],
                              settings,
                            });
                          }} className="text-xs"><Download className="h-3 w-3 mr-1" />PDF</Button>
                          <Button variant="outline" size="sm" onClick={async () => {
                            const { count } = await supabase.from("delivery_notes").select("id", { count: "exact", head: true });
                            const dnNumber = `DN-${String((count || 0) + 1).padStart(4, "0")}`;
                            await supabase.from("delivery_notes").insert({
                              dn_number: dnNumber, reference_type: "purchase_invoice", reference_id: b.id,
                              supplier_id: b.supplier_id, items: [],
                            });
                            toast.success(`Delivery Note ${dnNumber} created`);
                          }} className="text-xs"><FileOutput className="h-3 w-3 mr-1" />DN</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkDelete([b.id])}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          {selected.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-3 z-50">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" variant="secondary" onClick={() => handleBulkDelete(Array.from(selected))}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
