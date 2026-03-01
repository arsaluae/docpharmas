import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, PackageCheck, Trash2, Download, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

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

  const updateItem = (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    u[idx].amount = Number(u[idx].quantity_received) * Number(u[idx].rate);
    setItems(u);
  };

  const handleSave = async () => {
    if (!poId) { toast.error("A Purchase Order is required to create a GRN"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    if (!items.every(i => i.batch_number)) { toast.error("Batch number required for all items"); return; }
    if (!items.every(i => i.expiry_date)) { toast.error("Expiry date required for all items"); return; }

    const { data: grnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "goods_received_note" });
    if (!grnNumber) { toast.error("Failed to generate GRN number"); return; }
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

      // Create stock movements
      for (const item of items) {
        if (item.product_id) {
          await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: Number(item.quantity_received),
            movement_type: "purchase_in", batch_number: item.batch_number || null,
            reference_type: "grn", reference_id: grn.id, date: grnDate,
            notes: `GRN ${grnNumber}`,
          });

          const variance = Number(item.quantity_received) - Number(item.quantity_confirmed);
          if (variance !== 0 && item.quantity_confirmed > 0) {
            await supabase.from("stock_movements").insert({
              product_id: item.product_id, quantity: variance,
              movement_type: "adjustment", batch_number: item.batch_number || null,
              reference_type: "grn_variance", reference_id: grn.id, date: grnDate,
              notes: `Variance: confirmed ${item.quantity_confirmed}, received ${item.quantity_received} (diff: ${variance > 0 ? "+" : ""}${variance})`,
            });
          }

          await supabase.rpc("is_authenticated");
          const { data: prod } = await supabase.from("products").select("stock_quantity").eq("id", item.product_id).single();
          if (prod) {
            await supabase.from("products").update({ stock_quantity: Number(prod.stock_quantity) + Number(item.quantity_received) }).eq("id", item.product_id);
          }
        }
      }

      if (poId) await supabase.from("purchase_orders").update({ status: "received" }).eq("id", poId);
      toast.success(`GRN ${grnNumber} created with stock updated`);

      // Auto-download GRN PDF
      const { data: gItems } = await supabase.from("grn_items").select("*").eq("grn_id", grn.id);
      generatePdf({
        title: "GOODS RECEIVED NOTE", documentNumber: grnNumber, date: grnDate,
        partyLabel: "Supplier", partyName: (selectedPO?.suppliers as any)?.name || "—",
        columns: [
              { header: "#", key: "idx" }, { header: "Item", key: "item_name" },
                          { header: "Batch", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
                          { header: "Qty Ordered", key: "quantity_ordered", align: "right" },
                          { header: "Qty Received", key: "quantity_received", align: "right" },
                        ],
        rows: (gItems || []).map((i: any, idx: number) => ({
          idx: idx + 1, item_name: i.item_name, batch_number: i.batch_number || "—",
          expiry_date: i.expiry_date || "—", quantity_ordered: i.quantity_ordered, quantity_received: i.quantity_received,
        })),
        settings,
        template: getTemplate("grn"),
      });

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
              <p className="text-sm text-muted-foreground">GRNs are created from Purchase Orders. Record batch/expiry and auto-update stock.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/purchase-orders")}>
              <ArrowRight className="h-4 w-4 mr-1" /> Go to Purchase Orders
            </Button>
          </header>

          <div className="p-6">
            {/* Flow indicator */}
            <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border">
              <span className="font-semibold text-muted-foreground">① Proforma</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-muted-foreground">② Purchase Order</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-primary">③ GRN</span>
              <span className="ml-auto italic">Create GRN from PO page via "Create GRN" button</span>
            </div>

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
                        <PackageCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No GRNs yet.</p>
                        <p className="text-xs mt-1">Go to Purchase Orders and click "Create GRN" on a confirmed PO.</p>
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
                                { header: "Qty Ordered", key: "quantity_ordered", align: "right" },
                                { header: "Qty Received", key: "quantity_received", align: "right" },
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

          {/* GRN Creation Dialog - opened via ?po= param from PO page */}
          <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); setPoId(""); setItems([]); } else setOpen(true); }}>
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
                <Label className="text-sm font-semibold mb-2 block">Items Received</Label>
                <div className="text-xs text-muted-foreground grid grid-cols-12 gap-2 mb-1 px-1">
                  <span className="col-span-2">Item</span>
                  <span className="col-span-2">Batch # *</span>
                  <span className="col-span-1">Ordered</span>
                  <span className="col-span-1">Confirmed</span>
                  <span className="col-span-1">Received</span>
                  <span className="col-span-2">Expiry *</span>
                  <span className="col-span-1">Rate</span>
                  <span className="col-span-1">Amount</span>
                  <span className="col-span-1"></span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                    <div className="col-span-2"><Input value={item.item_name} disabled className="text-xs bg-muted" /></div>
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
        </main>
      </div>
    </SidebarProvider>
  );
}
