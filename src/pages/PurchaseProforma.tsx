import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Trash2, ArrowRight, DollarSign, Download, CheckCircle, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

interface Supplier { id: string; name: string; }
interface Product { id: string; name: string; cost_price: number; }

interface PPItem { product_id: string; product_name: string; quantity_requested: number; rate: number; amount: number; }
interface AdditionalCost { cost_type: string; description: string; amount: number; vendor_id: string; }

interface PurchaseProformaRow {
  id: string; proforma_number: string; supplier_id: string | null; date: string;
  validity_days: number; subtotal: number; gst: number; total: number;
  status: string; converted_po_id: string | null; notes: string | null; created_at: string;
  suppliers?: { name: string } | null;
}

export default function PurchaseProforma() {
  const navigate = useNavigate();
  const [proformas, setProformas] = useState<PurchaseProformaRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [costOpen, setCostOpen] = useState(false);
  const [selectedProformaId, setSelectedProformaId] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [ppDate, setPpDate] = useState(new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PPItem[]>([]);

  const [costs, setCosts] = useState<AdditionalCost[]>([]);
  const [costType, setCostType] = useState("printing");
  const [costDesc, setCostDesc] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costVendorId, setCostVendorId] = useState("");
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  // Detail/Edit
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPP, setDetailPP] = useState<PurchaseProformaRow | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailCosts, setDetailCosts] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editValidity, setEditValidity] = useState("30");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<PPItem[]>([]);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [pp, sup, prod] = await Promise.all([
      supabase.from("purchase_proformas").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name"),
      supabase.from("products").select("id, name, cost_price"),
    ]);
    if (pp.data) setProformas(pp.data as any);
    if (sup.data) setSuppliers(sup.data);
    if (prod.data) setProducts(prod.data);
  };

  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity_requested: 1, rate: 0, amount: 0 }]);

  const updateItem = (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.cost_price); }
    }
    u[idx].amount = Number(u[idx].quantity_requested) * Number(u[idx].rate);
    setItems(u);
  };

  const calcTotals = () => {
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const gst = settings?.gst_enabled ? subtotal * (Number(settings.default_gst_rate) / 100) : 0;
    return { subtotal, gst, total: subtotal + gst };
  };

  const handleSave = async () => {
    if (!supplierId || items.length === 0) { toast.error("Supplier and items required"); return; }
    const { subtotal, gst, total } = calcTotals();
    const { data: ppNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_proforma" });
    if (!ppNumber) { toast.error("Failed to generate number"); return; }

    const { data: pp } = await supabase.from("purchase_proformas").insert({
      proforma_number: ppNumber, supplier_id: supplierId, date: ppDate,
      validity_days: Number(validityDays), subtotal, gst, total, status: "draft", notes: notes || null,
    }).select().single();

    if (pp) {
      await supabase.from("purchase_proforma_items").insert(
        items.map(i => ({
          proforma_id: pp.id, product_id: i.product_id || null,
          quantity_requested: Number(i.quantity_requested), rate: Number(i.rate), amount: i.amount,
        }))
      );
      if (costs.length > 0) {
        await supabase.from("additional_costs").insert(
          costs.map(c => ({
            reference_type: "purchase_proforma", reference_id: pp.id,
            cost_type: c.cost_type, description: c.description, amount: Number(c.amount),
            vendor_id: c.vendor_id || null,
          }))
        );
      }
      toast.success(`Purchase Proforma ${ppNumber} created`);
      setOpen(false); setSupplierId(""); setItems([]); setNotes(""); setCosts([]); load();
    }
  };

  const addCostLine = () => {
    if (!costAmount) return;
    setCosts([...costs, { cost_type: costType, description: costDesc, amount: Number(costAmount), vendor_id: costVendorId }]);
    setCostDesc(""); setCostAmount(""); setCostVendorId("");
  };

  const convertToPO = async (pp: PurchaseProformaRow) => {
    const { data: poNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_order" });
    if (!poNumber) { toast.error("Failed to generate PO number"); return; }
    const { data: po } = await supabase.from("purchase_orders").insert({
      po_number: poNumber, supplier_id: pp.supplier_id, date: new Date().toISOString().split("T")[0],
      subtotal: pp.subtotal, gst: pp.gst, total: pp.total, status: "draft", proforma_id: pp.id,
    }).select().single();
    if (po) {
      const { data: ppItems } = await supabase.from("purchase_proforma_items").select("*").eq("proforma_id", pp.id);
      if (ppItems && ppItems.length > 0) {
        await supabase.from("purchase_order_items").insert(
          ppItems.map((i: any) => ({
            po_id: po.id, product_id: i.product_id, description: null,
            quantity: Number(i.quantity_requested), rate: Number(i.rate), amount: Number(i.amount),
          }))
        );
      }
      const { data: ppCosts } = await supabase.from("additional_costs").select("*").eq("reference_type", "purchase_proforma").eq("reference_id", pp.id);
      if (ppCosts && ppCosts.length > 0) {
        await supabase.from("additional_costs").insert(
          ppCosts.map((c: any) => ({
            reference_type: "purchase_order", reference_id: po.id,
            cost_type: c.cost_type, description: c.description, amount: Number(c.amount), vendor_id: c.vendor_id,
          }))
        );
      }
      await supabase.from("purchase_proformas").update({ status: "ordered", converted_po_id: po.id }).eq("id", pp.id);
      toast.success(`Converted to ${poNumber} — opening PO with PDF...`);
      navigate(`/purchase-orders?print=${po.id}`);
    }
  };

  const addCostToExisting = async () => {
    if (!selectedProformaId || !costAmount) return;
    await supabase.from("additional_costs").insert({
      reference_type: "purchase_proforma", reference_id: selectedProformaId,
      cost_type: costType, description: costDesc, amount: Number(costAmount),
      vendor_id: costVendorId || null,
    });
    toast.success("Additional cost added");
    setCostOpen(false); setCostDesc(""); setCostAmount(""); setCostVendorId("");
  };

  const { subtotal, gst, total } = calcTotals();
  const filtered = proformas.filter(p => p.proforma_number.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const handleBulkDelete = async (ids: string[]) => {
    if (!window.confirm(`Delete ${ids.length} purchase proforma(s)?`)) return;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await supabase.from("purchase_proforma_items").delete().in("proforma_id", chunk);
      await supabase.from("additional_costs").delete().eq("reference_type", "purchase_proforma").in("reference_id", chunk);
      await supabase.from("purchase_proformas").delete().in("id", chunk);
    }
    toast.success(`${ids.length} deleted`);
    setSelected(new Set()); load();
  };

  const handleApprove = async (id: string) => {
    await supabase.from("purchase_proformas").update({ status: "approved" }).eq("id", id);
    toast.success("Proforma approved — converting to PO...");
    await load();
    // Auto-convert to PO
    const pp = proformas.find(p => p.id === id) || (await supabase.from("purchase_proformas").select("*, suppliers(name)").eq("id", id).single()).data;
    if (pp) await convertToPO(pp as any);
  };

  // Detail/Edit
  const openDetail = async (pp: PurchaseProformaRow) => {
    setDetailPP(pp);
    const [itemsRes, costsRes] = await Promise.all([
      supabase.from("purchase_proforma_items").select("*, products(name)").eq("proforma_id", pp.id),
      supabase.from("additional_costs").select("*").eq("reference_type", "purchase_proforma").eq("reference_id", pp.id),
    ]);
    setDetailItems(itemsRes.data || []);
    setDetailCosts(costsRes.data || []);
    setEditMode(false);
    setDetailOpen(true);
  };

  const enterEditMode = () => {
    if (!detailPP) return;
    setEditSupplierId(detailPP.supplier_id || "");
    setEditDate(detailPP.date);
    setEditValidity(String(detailPP.validity_days));
    setEditNotes(detailPP.notes || "");
    setEditItems(detailItems.map((i: any) => ({
      product_id: i.product_id || "", product_name: i.products?.name || "Item",
      quantity_requested: i.quantity_requested, rate: Number(i.rate), amount: Number(i.amount),
    })));
    setEditMode(true);
  };

  const updateEditItem = (idx: number, field: string, value: any) => {
    const u = [...editItems];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.cost_price); }
    }
    u[idx].amount = Number(u[idx].quantity_requested) * Number(u[idx].rate);
    setEditItems(u);
  };

  const handleEditSave = async () => {
    if (!detailPP) return;
    const subtotal = editItems.reduce((s, i) => s + i.amount, 0);
    const gst = settings?.gst_enabled ? subtotal * (Number(settings.default_gst_rate) / 100) : 0;
    const total = subtotal + gst;
    await supabase.from("purchase_proformas").update({
      supplier_id: editSupplierId || null, date: editDate, validity_days: Number(editValidity),
      notes: editNotes || null, subtotal, gst, total,
    }).eq("id", detailPP.id);
    // Replace items
    await supabase.from("purchase_proforma_items").delete().eq("proforma_id", detailPP.id);
    if (editItems.length > 0) {
      await supabase.from("purchase_proforma_items").insert(editItems.map(i => ({
        proforma_id: detailPP.id, product_id: i.product_id || null,
        quantity_requested: Number(i.quantity_requested), rate: Number(i.rate), amount: i.amount,
      })));
    }
    toast.success("Proforma updated");
    setDetailOpen(false); setEditMode(false); load();
  };

  const statusColor = (s: string) => {
    if (s === "ordered") return "bg-blue-50 text-blue-700";
    if (s === "converted") return "bg-emerald-50 text-emerald-700";
    if (s === "approved") return "bg-primary/10 text-primary";
    if (s === "confirmed") return "bg-primary/10 text-primary";
    if (s === "sent") return "bg-amber-50 text-amber-700";
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
              <h1 className="text-xl font-bold text-foreground font-heading">Purchase Proformas</h1>
              <p className="text-sm text-muted-foreground">Create proformas to suppliers with additional costs, convert to PO</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Proforma</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Purchase Proforma</DialogTitle></DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <Label>Supplier *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={ppDate} onChange={e => setPpDate(e.target.value)} /></div>
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
                      <div className="col-span-2"><Input type="number" value={item.quantity_requested} onChange={e => updateItem(idx, "quantity_requested", e.target.value)} className="text-xs" placeholder="Qty" /></div>
                      <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" /></div>
                      <div className="col-span-3 text-right text-sm font-mono pt-2">{item.amount.toLocaleString()}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <Label className="text-sm font-semibold">Additional Costs (Printing, Packaging, Freight)</Label>
                  <p className="text-xs text-muted-foreground mb-2">These costs affect the item's landed cost.</p>
                  {costs.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1 text-xs">
                      <span className="bg-muted px-2 py-1 rounded capitalize">{c.cost_type}</span>
                      <span className="flex-1">{c.description}</span>
                      <span className="font-mono">PKR {Number(c.amount).toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCosts(costs.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <div className="grid grid-cols-12 gap-2 mt-2 items-end">
                    <div className="col-span-2">
                      <Select value={costType} onValueChange={setCostType}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="printing">Printing</SelectItem><SelectItem value="packaging">Packaging</SelectItem>
                          <SelectItem value="freight_in">Freight In</SelectItem><SelectItem value="freight_out">Freight Out</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input className="text-xs" placeholder="Description" value={costDesc} onChange={e => setCostDesc(e.target.value)} /></div>
                    <div className="col-span-2"><Input className="text-xs" type="number" placeholder="Amount" value={costAmount} onChange={e => setCostAmount(e.target.value)} /></div>
                    <div className="col-span-3">
                      <Select value={costVendorId} onValueChange={setCostVendorId}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Vendor" /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Button variant="outline" size="sm" onClick={addCostLine} className="text-xs w-full">+ Add</Button></div>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{subtotal.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST 17%</span><span className="font-mono">{gst.toLocaleString()}</span></div>
                  {costs.length > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Additional Costs</span><span className="font-mono">{costs.reduce((s, c) => s + Number(c.amount), 0).toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {total.toLocaleString()}</span></div>
                </div>
                <div className="mt-3"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
                <Button onClick={handleSave} className="w-full mt-4">Create Purchase Proforma</Button>
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
                      <TableHead><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>Proforma #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                      <TableHead>Validity</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />No purchase proformas yet.
                      </TableCell></TableRow>
                    ) : filtered.map(pp => (
                      <TableRow key={pp.id} className="cursor-pointer" data-state={selected.has(pp.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(pp.id)} onCheckedChange={() => toggleSelect(pp.id)} /></TableCell>
                        <TableCell className="font-medium font-mono" onClick={() => openDetail(pp)}>{pp.proforma_number}</TableCell>
                        <TableCell onClick={() => openDetail(pp)}>{(pp.suppliers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground" onClick={() => openDetail(pp)}>{pp.date}</TableCell>
                        <TableCell onClick={() => openDetail(pp)}>{pp.validity_days}d</TableCell>
                        <TableCell onClick={() => openDetail(pp)}><span className={`status-pill ${statusColor(pp.status)}`}>{pp.status}</span></TableCell>
                        <TableCell className="text-right font-mono font-medium" onClick={() => openDetail(pp)}>{Number(pp.total).toLocaleString()}</TableCell>
                        <TableCell className="space-x-1">
                          {pp.status === "draft" && (
                            <Button variant="outline" size="sm" onClick={() => handleApprove(pp.id)} className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve & Create PO
                            </Button>
                          )}
                          {pp.status === "approved" && (
                            <Button variant="outline" size="sm" onClick={() => convertToPO(pp)} className="text-xs">
                              <ArrowRight className="h-3 w-3 mr-1" /> To PO
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedProformaId(pp.id); setCostOpen(true); }} className="text-xs">
                            <DollarSign className="h-3 w-3 mr-1" /> Costs
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkDelete([pp.id])}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={async () => {
                            const { data: ppItems } = await supabase.from("purchase_proforma_items").select("*, products(name)").eq("proforma_id", pp.id);
                            generatePdf({
                              title: "PURCHASE PROFORMA", documentNumber: pp.proforma_number, date: pp.date,
                              partyLabel: "Supplier", partyName: (pp.suppliers as any)?.name || "—",
                              meta: [{ label: "Validity", value: `${pp.validity_days} days` }],
                              columns: [
                                { header: "#", key: "idx" }, { header: "Product", key: "name" },
                                { header: "Qty", key: "quantity_requested", align: "right" }, { header: "Rate", key: "rate", align: "right" },
                                { header: "Amount", key: "amount", align: "right" },
                              ],
                              rows: (ppItems || []).map((i: any, idx: number) => ({
                                idx: idx + 1, name: i.products?.name || "Item",
                                quantity_requested: i.quantity_requested, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
                              })),
                              totals: [
                                { label: "Subtotal", value: `PKR ${Number(pp.subtotal).toLocaleString()}` },
                                { label: "GST", value: `PKR ${Number(pp.gst).toLocaleString()}` },
                                { label: "Total", value: `PKR ${Number(pp.total).toLocaleString()}` },
                              ],
                              notes: pp.notes || undefined, settings,
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

          {selected.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-3 z-50">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" variant="secondary" onClick={() => handleBulkDelete(Array.from(selected))}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          )}

          {/* Detail/Edit Dialog */}
          <Dialog open={detailOpen} onOpenChange={o => { if (!o) { setDetailOpen(false); setEditMode(false); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{detailPP?.proforma_number} — Detail</span>
                  {!editMode && (detailPP?.status === "draft" || detailPP?.status === "approved") && (
                    <Button variant="outline" size="sm" onClick={enterEditMode}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  )}
                </DialogTitle>
              </DialogHeader>

              {!editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Supplier:</span> <strong>{(detailPP?.suppliers as any)?.name || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Date:</span> {detailPP?.date}</div>
                    <div><span className="text-muted-foreground">Validity:</span> {detailPP?.validity_days} days</div>
                    <div><span className="text-muted-foreground">Status:</span> <span className={`status-pill ${statusColor(detailPP?.status || "")}`}>{detailPP?.status}</span></div>
                  </div>
                  {detailPP?.notes && <p className="text-sm text-muted-foreground mt-2">Notes: {detailPP.notes}</p>}
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>#</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailItems.map((i: any, idx: number) => (
                        <TableRow key={i.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{i.products?.name || "Item"}</TableCell>
                          <TableCell className="text-right">{i.quantity_requested}</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.rate).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {detailCosts.length > 0 && (
                    <div className="mt-3">
                      <Label className="text-sm font-semibold">Additional Costs</Label>
                      {detailCosts.map((c: any) => (
                        <div key={c.id} className="flex justify-between text-xs py-1">
                          <span className="capitalize">{c.cost_type}: {c.description}</span>
                          <span className="font-mono">PKR {Number(c.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-border pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">PKR {Number(detailPP?.subtotal || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">PKR {Number(detailPP?.gst || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {Number(detailPP?.total || 0).toLocaleString()}</span></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Supplier</Label>
                      <Select value={editSupplierId} onValueChange={setEditSupplierId}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
                    <div><Label>Validity (days)</Label><Input type="number" value={editValidity} onChange={e => setEditValidity(e.target.value)} /></div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Items</Label>
                      <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", product_name: "", quantity_requested: 1, rate: 0, amount: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    {editItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-4">
                          <Select value={item.product_id} onValueChange={v => updateEditItem(idx, "product_id", v)}>
                            <SelectTrigger className="text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2"><Input type="number" value={item.quantity_requested} onChange={e => updateEditItem(idx, "quantity_requested", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-3 text-right text-sm font-mono pt-2">{item.amount.toLocaleString()}</div>
                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3"><Label>Notes</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} /></div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleEditSave} className="flex-1">Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Add cost to existing proforma */}
          <Dialog open={costOpen} onOpenChange={setCostOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Additional Cost</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Cost Type</Label>
                  <Select value={costType} onValueChange={setCostType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="printing">Printing</SelectItem><SelectItem value="packaging">Packaging</SelectItem>
                      <SelectItem value="freight_in">Freight In</SelectItem><SelectItem value="freight_out">Freight Out</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Input value={costDesc} onChange={e => setCostDesc(e.target.value)} /></div>
                <div><Label>Amount</Label><Input type="number" value={costAmount} onChange={e => setCostAmount(e.target.value)} /></div>
                <div>
                  <Label>Vendor (Printer/Packager)</Label>
                  <Select value={costVendorId} onValueChange={setCostVendorId}>
                    <SelectTrigger><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                    <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={addCostToExisting} className="w-full">Add Cost</Button>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
