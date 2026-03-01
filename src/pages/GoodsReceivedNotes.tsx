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
import { Plus, Search, PackageCheck, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { useSearchParams } from "react-router-dom";

interface PO { id: string; po_number: string; supplier_id: string | null; suppliers?: { name: string } | null; }
interface GRNItemForm { product_id: string; item_name: string; batch_number: string; quantity_ordered: number; quantity_confirmed: number; quantity_received: number; expiry_date: string; rate: number; amount: number; }

interface GRN {
  id: string; grn_number: string; po_id: string | null; supplier_id: string | null; date: string;
  received_by: string | null; notes: string | null; created_at: string;
  purchase_orders?: { po_number: string } | null;
  suppliers?: { name: string } | null;
}

export default function GoodsReceivedNotes() {
  const navigate = useNavigate();
  const [grns, setGrns] = useState<GRN[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const [poId, setPoId] = useState("");
  const [grnDate, setGrnDate] = useState(new Date().toISOString().split("T")[0]);
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<GRNItemForm[]>([]);
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  // Auto-open GRN form if navigated from PO page
  useEffect(() => {
    const poParam = searchParams.get("po");
    if (poParam && pos.length > 0) {
      const matchPO = pos.find(p => p.id === poParam);
      if (matchPO) {
        handlePOSelect(poParam);
        setOpen(true);
      }
    }
  }, [pos, searchParams]);

  const load = async () => {
    const [g, p] = await Promise.all([
      supabase.from("goods_received_notes").select("*, purchase_orders(po_number), suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("id, po_number, supplier_id, suppliers(name)").in("status", ["draft", "confirmed"]).order("created_at", { ascending: false }),
    ]);
    if (g.data) setGrns(g.data as any);
    if (p.data) setPos(p.data as any);
  };

  // Auto-populate items from PO
  const handlePOSelect = async (id: string) => {
    setPoId(id);
    if (!id) return;
    const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", id);
    if (poItems) {
      setItems(poItems.map((i: any) => ({
        product_id: i.product_id || "",
        item_name: (i.products as any)?.name || i.description || "",
        batch_number: "",
        quantity_ordered: Number(i.quantity),
        quantity_confirmed: Number(i.quantity_confirmed) || Number(i.quantity),
        quantity_received: Number(i.quantity_confirmed) || Number(i.quantity),
        expiry_date: "",
        rate: Number(i.rate),
        amount: (Number(i.quantity_confirmed) || Number(i.quantity)) * Number(i.rate),
      })));
    }
  };

  const addItem = () => setItems([...items, { product_id: "", item_name: "", batch_number: "", quantity_ordered: 0, quantity_confirmed: 0, quantity_received: 0, expiry_date: "", rate: 0, amount: 0 }]);

  const updateItem = (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    u[idx].amount = Number(u[idx].quantity_received) * Number(u[idx].rate);
    setItems(u);
  };

  const handleSave = async () => {
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    const hasBatch = items.every(i => i.batch_number);
    if (!hasBatch) { toast.error("Batch number required for all items"); return; }

    const { count } = await supabase.from("goods_received_notes").select("id", { count: "exact", head: true });
    const grnNumber = `GRN-${String((count || 0) + 1).padStart(4, "0")}`;
    const selectedPO = pos.find(p => p.id === poId);

    const { data: grn } = await supabase.from("goods_received_notes").insert({
      grn_number: grnNumber, po_id: poId || null, supplier_id: selectedPO?.supplier_id || null,
      date: grnDate, received_by: receivedBy || null, notes: notes || null,
    }).select().single();

    if (grn) {
      await supabase.from("grn_items").insert(
        items.map(i => ({
          grn_id: grn.id, item_name: i.item_name, product_id: i.product_id || null,
          batch_number: i.batch_number || null,
          quantity_ordered: Number(i.quantity_ordered), quantity_received: Number(i.quantity_received),
          expiry_date: i.expiry_date || null, rate: Number(i.rate), amount: i.amount,
        }))
      );

      // Create stock movements for each item
      for (const item of items) {
        if (item.product_id) {
          await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: Number(item.quantity_received),
            movement_type: "purchase_in", batch_number: item.batch_number || null,
            reference_type: "grn", reference_id: grn.id, date: grnDate,
            notes: `GRN ${grnNumber}`,
          });

          // If variance between confirmed and received, create adjustment
          const variance = Number(item.quantity_received) - Number(item.quantity_confirmed);
          if (variance !== 0 && item.quantity_confirmed > 0) {
            await supabase.from("stock_movements").insert({
              product_id: item.product_id, quantity: variance,
              movement_type: "adjustment", batch_number: item.batch_number || null,
              reference_type: "grn_variance", reference_id: grn.id, date: grnDate,
              notes: `Variance: confirmed ${item.quantity_confirmed}, received ${item.quantity_received} (diff: ${variance > 0 ? "+" : ""}${variance})`,
            });
          }

          // Update product stock
          await supabase.rpc("is_authenticated"); // Just to ensure auth
          const { data: prod } = await supabase.from("products").select("stock_quantity").eq("id", item.product_id).single();
          if (prod) {
            await supabase.from("products").update({ stock_quantity: Number(prod.stock_quantity) + Number(item.quantity_received) }).eq("id", item.product_id);
          }
        }
      }

      if (poId) await supabase.from("purchase_orders").update({ status: "received" }).eq("id", poId);
      toast.success(`GRN ${grnNumber} created with stock updated`);
      setOpen(false); setPoId(""); setItems([]); setReceivedBy(""); setNotes(""); load();
    }
  };

  const filtered = grns.filter(g => g.grn_number.toLowerCase().includes(search.toLowerCase()));

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Goods Received Notes</h1>
              <p className="text-sm text-muted-foreground">Record deliveries with batch/expiry, auto stock adjustment on variance</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New GRN</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Goods Received Note</DialogTitle></DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <Label>Purchase Order</Label>
                    <Select value={poId} onValueChange={handlePOSelect}>
                      <SelectTrigger><SelectValue placeholder="Select PO..." /></SelectTrigger>
                      <SelectContent>{pos.map(p => <SelectItem key={p.id} value={p.id}>{p.po_number} — {(p.suppliers as any)?.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={grnDate} onChange={e => setGrnDate(e.target.value)} /></div>
                  <div><Label>Received By</Label><Input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} /></div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Items Received</Label>
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                  <div className="text-xs text-muted-foreground grid grid-cols-12 gap-2 mb-1 px-1">
                    <span className="col-span-2">Item</span>
                    <span className="col-span-2">Batch # *</span>
                    <span className="col-span-1">Ordered</span>
                    <span className="col-span-1">Confirmed</span>
                    <span className="col-span-1">Received</span>
                    <span className="col-span-2">Expiry</span>
                    <span className="col-span-1">Rate</span>
                    <span className="col-span-1">Amount</span>
                    <span className="col-span-1"></span>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-2"><Input value={item.item_name} onChange={e => updateItem(idx, "item_name", e.target.value)} className="text-xs" placeholder="Item" /></div>
                      <div className="col-span-2"><Input value={item.batch_number} onChange={e => updateItem(idx, "batch_number", e.target.value)} className="text-xs" placeholder="Batch #" /></div>
                      <div className="col-span-1"><Input type="number" value={item.quantity_ordered} className="text-xs" disabled /></div>
                      <div className="col-span-1"><Input type="number" value={item.quantity_confirmed} className="text-xs" disabled /></div>
                      <div className="col-span-1"><Input type="number" value={item.quantity_received} onChange={e => updateItem(idx, "quantity_received", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-2"><Input type="date" value={item.expiry_date} onChange={e => updateItem(idx, "expiry_date", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-1"><Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-1 text-right text-xs font-mono pt-2">{item.amount.toLocaleString()}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                  {items.some(i => i.quantity_confirmed > 0 && Number(i.quantity_received) !== Number(i.quantity_confirmed)) && (
                    <p className="text-xs text-amber-600 mt-1">⚠ Variance detected — stock adjustment will be auto-created.</p>
                  )}
                </div>
                <div className="mt-3"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
                <Button onClick={handleSave} className="w-full mt-4">Create GRN & Update Stock</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search GRNs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GRN #</TableHead><TableHead>PO #</TableHead><TableHead>Supplier</TableHead>
                      <TableHead>Date</TableHead><TableHead>Received By</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        <PackageCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />No GRNs yet.
                      </TableCell></TableRow>
                    ) : filtered.map(g => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium font-mono">{g.grn_number}</TableCell>
                        <TableCell className="font-mono text-muted-foreground">{(g.purchase_orders as any)?.po_number || "—"}</TableCell>
                        <TableCell>{(g.suppliers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{g.date}</TableCell>
                        <TableCell>{g.received_by || "—"}</TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" onClick={async () => {
                            const { data: gItems } = await supabase.from("grn_items").select("*").eq("grn_id", g.id);
                            generatePdf({
                              title: "GOODS RECEIVED NOTE", documentNumber: g.grn_number, date: g.date,
                              partyLabel: "Supplier", partyName: (g.suppliers as any)?.name || "—",
                              meta: [{ label: "PO #", value: (g.purchase_orders as any)?.po_number || "—" }],
                              columns: [
                                { header: "#", key: "idx" }, { header: "Item", key: "item_name" },
                                { header: "Batch", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
                                { header: "Ordered", key: "quantity_ordered", align: "right" },
                                { header: "Received", key: "quantity_received", align: "right" },
                              ],
                              rows: (gItems || []).map((i: any, idx: number) => ({
                                idx: idx + 1, item_name: i.item_name, batch_number: i.batch_number || "—",
                                expiry_date: i.expiry_date || "—", quantity_ordered: i.quantity_ordered, quantity_received: i.quantity_received,
                              })),
                              settings,
                              template: getTemplate("grn"),
                            });
                          }} className="text-xs"><Download className="h-3 w-3 mr-1" />PDF</Button>
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
