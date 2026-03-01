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
import { Plus, Search, FilePlus, ArrowRight, Trash2, Download, CheckCircle, Pencil } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

interface Customer { id: string; name: string; }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; }
interface ProformaItem { product_id: string; product_name: string; quantity: number; rate: number; gst_rate: number; amount: number; }

interface Proforma {
  id: string; proforma_number: string; customer_id: string | null; date: string; validity_days: number;
  items: any; subtotal: number; gst: number; total: number; status: string;
  payment_instructions: string | null;
  converted_invoice_id: string | null; created_at: string;
  customers?: { name: string } | null;
}

interface BatchOption { batch_number: string; available: number; }

export default function ProformaInvoices() {
  const navigate = useNavigate();
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [customerId, setCustomerId] = useState("");
  const [pfDate, setPfDate] = useState(new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState("30");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [items, setItems] = useState<ProformaItem[]>([]);

  // Convert dialog
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertPf, setConvertPf] = useState<Proforma | null>(null);
  const [convertItems, setConvertItems] = useState<any[]>([]);
  const [batchOptions, setBatchOptions] = useState<Record<string, BatchOption[]>>({});
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  // Detail/Edit dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPf, setDetailPf] = useState<Proforma | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editValidity, setEditValidity] = useState("30");
  const [editPaymentInstr, setEditPaymentInstr] = useState("");
  const [editItems, setEditItems] = useState<ProformaItem[]>([]);

  // Delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

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

  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: settings?.gst_enabled ? Number(settings.default_gst_rate) : 0, amount: 0 }]);

  useEffect(() => {
    if (open && items.length === 0) addItem();
  }, [open]);

  const updateItem = (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = settings?.gst_enabled ? Number(p.gst_rate) : 0; }
    }
    const line = Number(u[idx].quantity) * Number(u[idx].rate);
    u[idx].amount = line + (settings?.gst_enabled ? (line * Number(u[idx].gst_rate) / 100) : 0);
    setItems(u);
  };

  const calcTotals = () => {
    const subtotal = items.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const gst = settings?.gst_enabled ? items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate) * Number(i.gst_rate) / 100), 0) : 0;
    return { subtotal, gst, total: subtotal + gst };
  };

  const calcEditTotals = () => {
    const subtotal = editItems.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const gst = settings?.gst_enabled ? editItems.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate) * Number(i.gst_rate) / 100), 0) : 0;
    return { subtotal, gst, total: subtotal + gst };
  };

  const handleSave = async () => {
    if (!customerId || items.length === 0) { toast.error("Customer and items required"); return; }
    const { subtotal, gst, total } = calcTotals();
    const { data: pfNumber } = await supabase.rpc("generate_document_number", { p_document_type: "proforma_invoice" });
    if (!pfNumber) { toast.error("Failed to generate number"); return; }

    await supabase.from("proforma_invoices").insert({
      proforma_number: pfNumber, customer_id: customerId, date: pfDate,
      validity_days: Number(validityDays), items: JSON.stringify(items), subtotal, gst, total,
      status: "draft", payment_instructions: paymentInstructions || null,
    });
    toast.success(`Proforma ${pfNumber} created`);
    setOpen(false); setCustomerId(""); setItems([]); setPaymentInstructions(""); load();
  };

  const openConvertDialog = async (pf: Proforma) => {
    setConvertPf(pf);
    const pfItems: ProformaItem[] = typeof pf.items === "string" ? JSON.parse(pf.items) : pf.items;
    const productIds = pfItems.filter(i => i.product_id).map(i => i.product_id);
    const batches: Record<string, BatchOption[]> = {};
    if (productIds.length > 0) {
      const { data: movements } = await supabase.from("stock_movements").select("product_id, batch_number, quantity, movement_type").in("product_id", productIds);
      if (movements) {
        const batchMap: Record<string, number> = {};
        movements.forEach((m: any) => {
          const key = `${m.product_id}__${m.batch_number || "no-batch"}`;
          if (!batchMap[key]) batchMap[key] = 0;
          if (m.movement_type === "purchase_in" || m.movement_type === "return_in") batchMap[key] += Number(m.quantity);
          else if (m.movement_type === "sale_out" || m.movement_type === "return_out") batchMap[key] -= Number(m.quantity);
          else if (m.movement_type === "adjustment") batchMap[key] += Number(m.quantity);
        });
        for (const [key, qty] of Object.entries(batchMap)) {
          const [pid, batch] = key.split("__");
          if (!batches[pid]) batches[pid] = [];
          if (qty > 0) batches[pid].push({ batch_number: batch, available: qty });
        }
      }
    }
    setBatchOptions(batches);
    setConvertItems(pfItems.map(i => ({ ...i, batch_number: "", convert_quantity: i.quantity })));
    setConvertOpen(true);
  };

  const handleConvert = async () => {
    if (!convertPf) return;
    const { data: invNumber } = await supabase.rpc("generate_document_number", { p_document_type: "sales_invoice" });
    if (!invNumber) { toast.error("Failed to generate invoice number"); return; }
    const { data: inv } = await supabase.from("sales_invoices").insert({
      invoice_number: invNumber, customer_id: convertPf.customer_id, date: new Date().toISOString().split("T")[0],
      subtotal: convertPf.subtotal, gst_amount: convertPf.gst, total: convertPf.total, status: "draft",
    }).select("*, customers(name)").single();
    if (inv) {
      const lineItems = convertItems.map((i: any) => ({
        invoice_id: inv.id, product_id: i.product_id || null,
        quantity: Number(i.convert_quantity), rate: Number(i.rate), gst_rate: Number(i.gst_rate),
        amount: i.amount, batch_number: i.batch_number || null,
      }));
      await supabase.from("sales_invoice_items").insert(lineItems);
      for (const item of convertItems) {
        if (item.product_id && Number(item.convert_quantity) > 0) {
          await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: Number(item.convert_quantity),
            movement_type: "sale_out", batch_number: item.batch_number || null,
            reference_type: "sales_invoice", reference_id: inv.id, notes: `Invoice ${invNumber}`,
          });
        }
      }
      await supabase.from("proforma_invoices").update({ status: "invoiced", converted_invoice_id: inv.id }).eq("id", convertPf.id);
      toast.success(`Converted to ${invNumber} — downloading PDF...`);
      
      const { data: invItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", inv.id);
      generatePdf({
        title: "SALES INVOICE", documentNumber: invNumber, date: inv.date,
        partyLabel: "Customer", partyName: (inv.customers as any)?.name || (convertPf.customers as any)?.name || "—",
        columns: [
          { header: "#", key: "idx" }, { header: "Product", key: "name" }, { header: "Batch", key: "batch_number" },
          { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
          { header: "Amount", key: "amount", align: "right" },
        ],
        rows: (invItems || []).map((i: any, idx: number) => ({
          idx: idx + 1, name: i.products?.name || "Item", batch_number: i.batch_number || "—",
          quantity: i.quantity, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
        })),
        totals: [
          { label: "Subtotal", value: `PKR ${Number(inv.subtotal).toLocaleString()}` },
          { label: "GST", value: `PKR ${Number(inv.gst_amount).toLocaleString()}` },
          { label: "Total", value: `PKR ${Number(inv.total).toLocaleString()}` },
        ],
        settings,
        template: getTemplate("sales_invoice"),
      });
      
      setConvertOpen(false); load();
      navigate("/sales-invoices");
    }
  };

  const { subtotal, gst, total } = calcTotals();
  const filtered = proformas.filter(p => p.proforma_number.toLowerCase().includes(search.toLowerCase()));

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const handleBulkDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    for (let i = 0; i < deleteIds.length; i += 200) {
      const chunk = deleteIds.slice(i, i + 200);
      await supabase.from("proforma_invoices").delete().in("id", chunk);
    }
    toast.success(`${deleteIds.length} deleted`);
    setSelected(new Set());
    setDeleteConfirmOpen(false);
    setDeleteIds([]);
    load();
  };

  const handleApprove = async (id: string) => {
    await supabase.from("proforma_invoices").update({ status: "approved" }).eq("id", id);
    toast.success("Proforma approved — opening convert dialog...");
    // Fetch directly from DB to avoid stale state
    const { data: pf } = await supabase.from("proforma_invoices").select("*, customers(name)").eq("id", id).single();
    if (pf) await openConvertDialog(pf as any);
    load();
  };

  // Detail/Edit
  const openDetail = (pf: Proforma) => {
    setDetailPf(pf);
    setEditMode(false);
    setDetailOpen(true);
  };

  const enterEditMode = () => {
    if (!detailPf) return;
    setEditCustomerId(detailPf.customer_id || "");
    setEditDate(detailPf.date);
    setEditValidity(String(detailPf.validity_days));
    setEditPaymentInstr(detailPf.payment_instructions || "");
    const pfItems: ProformaItem[] = typeof detailPf.items === "string" ? JSON.parse(detailPf.items) : detailPf.items;
    setEditItems(pfItems.map(i => ({ ...i })));
    setEditMode(true);
  };

  const updateEditItem = (idx: number, field: string, value: any) => {
    const u = [...editItems];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = settings?.gst_enabled ? Number(p.gst_rate) : 0; }
    }
    const line = Number(u[idx].quantity) * Number(u[idx].rate);
    u[idx].amount = line + (settings?.gst_enabled ? (line * Number(u[idx].gst_rate) / 100) : 0);
    setEditItems(u);
  };

  const handleEditSave = async () => {
    if (!detailPf) return;
    const { subtotal, gst, total } = calcEditTotals();
    await supabase.from("proforma_invoices").update({
      customer_id: editCustomerId || null, date: editDate, validity_days: Number(editValidity),
      payment_instructions: editPaymentInstr || null, items: JSON.stringify(editItems),
      subtotal, gst, total,
    }).eq("id", detailPf.id);
    toast.success("Proforma updated");
    setDetailOpen(false); setEditMode(false); load();
  };

  const getPfItems = (pf: Proforma | null): ProformaItem[] => {
    if (!pf) return [];
    return typeof pf.items === "string" ? JSON.parse(pf.items) : pf.items;
  };

  const statusColor = (s: string) => {
    if (s === "invoiced") return "bg-teal-50 text-teal-700";
    if (s === "converted") return "bg-emerald-50 text-emerald-700";
    if (s === "approved") return "bg-primary/10 text-primary";
    if (s === "payment_received") return "bg-primary/10 text-primary";
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
              <h1 className="text-xl font-bold text-foreground font-heading">Sales Proforma</h1>
              <p className="text-sm text-muted-foreground">Quotations with payment instructions, convert to invoice with batch selection</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Proforma</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Sales Proforma</DialogTitle></DialogHeader>
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
                <div className="mt-3">
                  <Label>Payment Instructions</Label>
                  <Textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} placeholder="Bank details, payment terms, etc." rows={2} />
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
                      {settings?.gst_enabled && <div className="col-span-1"><Input type="number" value={item.gst_rate} onChange={e => updateItem(idx, "gst_rate", e.target.value)} className="text-xs" /></div>}
                      <div className="col-span-2 text-right text-sm font-mono pt-2">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  {settings?.gst_enabled && <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">{gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                  <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">Create Proforma</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            {/* Flow indicator */}
            <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border">
              <span className="font-semibold text-primary">① Sales Proforma</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-muted-foreground">② Sales Invoice</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-muted-foreground">③ Delivery Note</span>
              <span className="ml-auto italic">Approve a proforma to auto-create an invoice</span>
            </div>

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
                      <TableHead>Proforma #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead>
                      <TableHead>Validity</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <FilePlus className="h-8 w-8 mx-auto mb-2 opacity-40" />No proformas yet.
                      </TableCell></TableRow>
                    ) : filtered.map(pf => (
                      <TableRow key={pf.id} className="cursor-pointer" data-state={selected.has(pf.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(pf.id)} onCheckedChange={() => toggleSelect(pf.id)} /></TableCell>
                        <TableCell className="font-medium font-mono" onClick={() => openDetail(pf)}>{pf.proforma_number}</TableCell>
                        <TableCell onClick={() => openDetail(pf)}>{(pf.customers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground" onClick={() => openDetail(pf)}>{pf.date}</TableCell>
                        <TableCell onClick={() => openDetail(pf)}>{pf.validity_days}d</TableCell>
                        <TableCell onClick={() => openDetail(pf)}><span className={`status-pill ${statusColor(pf.status)}`}>{pf.status}</span></TableCell>
                        <TableCell className="text-right font-mono" onClick={() => openDetail(pf)}>{Number(pf.total).toLocaleString()}</TableCell>
                        <TableCell className="space-x-1">
                          {pf.status === "draft" && (
                            <Button variant="outline" size="sm" onClick={() => handleApprove(pf.id)} className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" /> Approve & Convert
                            </Button>
                          )}
                          {pf.status === "approved" && (
                            <Button variant="outline" size="sm" onClick={() => openConvertDialog(pf)} className="text-xs">
                              <ArrowRight className="h-3 w-3 mr-1" /> Convert
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkDelete([pf.id])}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            const pfItems = typeof pf.items === "string" ? JSON.parse(pf.items) : pf.items;
                            generatePdf({
                              title: "SALES PROFORMA", documentNumber: pf.proforma_number, date: pf.date,
                              partyLabel: "Customer", partyName: (pf.customers as any)?.name || "—",
                              meta: [{ label: "Validity", value: `${pf.validity_days} days` }],
                              columns: [
                                { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
                                { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
                                { header: "Amount", key: "amount", align: "right" },
                              ],
                              rows: pfItems.map((i: any, idx: number) => ({ ...i, idx: idx + 1, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString() })),
                              totals: [
                                { label: "Subtotal", value: `PKR ${Number(pf.subtotal).toLocaleString()}` },
                                { label: "GST", value: `PKR ${Number(pf.gst).toLocaleString()}` },
                                { label: "Total", value: `PKR ${Number(pf.total).toLocaleString()}` },
                              ],
                              notes: pf.payment_instructions || undefined, settings,
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

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Are you sure you want to delete {deleteIds.length} proforma(s)? This cannot be undone.</p>
              <div className="flex gap-2 mt-4">
                <Button variant="destructive" onClick={confirmDelete} className="flex-1">Delete</Button>
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Detail/Edit Dialog */}
          <Dialog open={detailOpen} onOpenChange={o => { if (!o) { setDetailOpen(false); setEditMode(false); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{detailPf?.proforma_number} — Detail</span>
                  {!editMode && (detailPf?.status === "draft" || detailPf?.status === "approved") && (
                    <Button variant="outline" size="sm" onClick={enterEditMode}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  )}
                </DialogTitle>
              </DialogHeader>

              {!editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Customer:</span> <strong>{(detailPf?.customers as any)?.name || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Date:</span> {detailPf?.date}</div>
                    <div><span className="text-muted-foreground">Validity:</span> {detailPf?.validity_days} days</div>
                    <div><span className="text-muted-foreground">Status:</span> <span className={`status-pill ${statusColor(detailPf?.status || "")}`}>{detailPf?.status}</span></div>
                  </div>
                  {detailPf?.payment_instructions && <p className="text-sm text-muted-foreground mt-2">Payment Instructions: {detailPf.payment_instructions}</p>}
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>#</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">GST%</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {getPfItems(detailPf).map((i, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{i.product_name || "Item"}</TableCell>
                          <TableCell className="text-right">{i.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.rate).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{i.gst_rate}%</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t border-border pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">PKR {Number(detailPf?.subtotal || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">PKR {Number(detailPf?.gst || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {Number(detailPf?.total || 0).toLocaleString()}</span></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Customer</Label>
                      <Select value={editCustomerId} onValueChange={setEditCustomerId}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
                    <div><Label>Validity (days)</Label><Input type="number" value={editValidity} onChange={e => setEditValidity(e.target.value)} /></div>
                  </div>
                  <div className="mt-3">
                    <Label>Payment Instructions</Label>
                    <Textarea value={editPaymentInstr} onChange={e => setEditPaymentInstr(e.target.value)} rows={2} />
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Items</Label>
                      <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: 17, amount: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    {editItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-4">
                          <Select value={item.product_id} onValueChange={v => updateEditItem(idx, "product_id", v)}>
                            <SelectTrigger className="text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => updateEditItem(idx, "quantity", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-1"><Input type="number" value={item.gst_rate} onChange={e => updateEditItem(idx, "gst_rate", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-2 text-right text-sm font-mono pt-2">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                      </div>
                    ))}
                  </div>
                  {(() => { const t = calcEditTotals(); return (
                    <div className="border-t border-border pt-3 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{t.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">{t.gst.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  ); })()}
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleEditSave} className="flex-1">Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Convert dialog with batch selection */}
          <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Convert to Sales Invoice</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground mb-3">Select batch numbers and quantities for each item.</p>
              {convertItems.map((item, idx) => (
                <div key={idx} className="border border-border rounded-lg p-3 mb-2">
                  <div className="font-medium text-sm mb-2">{item.product_name || "Item"} — Qty: {item.quantity}</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Batch</Label>
                      <Select value={item.batch_number} onValueChange={v => {
                        const u = [...convertItems]; u[idx].batch_number = v; setConvertItems(u);
                      }}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Select batch..." /></SelectTrigger>
                        <SelectContent>
                          {(batchOptions[item.product_id] || []).map(b => (
                            <SelectItem key={b.batch_number} value={b.batch_number}>
                              {b.batch_number} (avail: {b.available})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" className="text-xs" value={item.convert_quantity}
                        onChange={e => { const u = [...convertItems]; u[idx].convert_quantity = e.target.value; setConvertItems(u); }} />
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={handleConvert} className="w-full mt-3">Convert to Invoice</Button>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
