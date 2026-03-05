import { useEffect, useState, useCallback } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, FileText, Trash2, QrCode, Download, FileOutput, Pencil, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

interface Customer { id: string; name: string; company: string | null; }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; }
interface InvoiceItem { product_id: string; product_name: string; quantity: number; rate: number; discount_percent: number; gst_rate: number; amount: number; }
interface SalesInvoice {
  id: string; invoice_number: string; customer_id: string | null; date: string; due_date: string | null;
  subtotal: number; gst_amount: number; discount: number; total: number; amount_paid: number;
  status: string; fbr_qr_data: string | null; notes: string | null; created_at: string;
  customers?: { name: string } | null;
}

export default function SalesInvoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  // Form state
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split("T")[0]);
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([]);

  // Detail/Edit dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailInv, setDetailInv] = useState<SalesInvoice | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<InvoiceItem[]>([]);

  // Delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  // DN cross-reference
  const [dnMap, setDnMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [inv, cust, prod, dns] = await Promise.all([
      supabase.from("sales_invoices").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, company"),
      supabase.from("products").select("id, name, selling_price, gst_rate"),
      supabase.from("delivery_notes").select("reference_id, dn_number").eq("reference_type", "sales_invoice"),
    ]);
    if (inv.data) setInvoices(inv.data as any);
    if (cust.data) setCustomers(cust.data);
    if (prod.data) setProducts(prod.data);
    if (dns.data) {
      const map: Record<string, string> = {};
      dns.data.forEach((d: any) => { if (d.reference_id) map[d.reference_id] = d.dn_number; });
      setDnMap(map);
    }
  };

  const addItem = () => {
    const defaultGst = settings?.gst_enabled ? Number(settings.default_gst_rate) : 0;
    setItems([...items, { product_id: "", product_name: "", quantity: 1, rate: 0, discount_percent: 0, gst_rate: defaultGst, amount: 0 }]);
  };

  useEffect(() => {
    if (open && items.length === 0) addItem();
  }, [open]);

  // Batch selection for DN
  interface BatchAllocation { batch_number: string; expiry_date: string; quantity: number; available: number; }
  interface DNItemBatch { product_id: string; product_name: string; required_quantity: number; batches: BatchAllocation[]; }
  const [dnOpen, setDnOpen] = useState(false);
  const [dnInvoice, setDnInvoice] = useState<SalesInvoice | null>(null);
  const [dnItems, setDnItems] = useState<DNItemBatch[]>([]);

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { updated[idx].product_name = p.name; updated[idx].rate = Number(p.selling_price); updated[idx].gst_rate = settings?.gst_enabled ? Number(p.gst_rate) : 0; }
    }
    const qty = Number(updated[idx].quantity);
    const rate = Number(updated[idx].rate);
    const disc = Number(updated[idx].discount_percent);
    const lineTotal = qty * rate;
    const afterDisc = lineTotal - (lineTotal * disc / 100);
    const gst = settings?.gst_enabled ? (afterDisc * Number(updated[idx].gst_rate) / 100) : 0;
    updated[idx].amount = afterDisc + gst;
    setItems(updated);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const calcTotals = useCallback(() => {
    const subtotal = items.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0);
    const discount = items.reduce((s, i) => {
      const line = Number(i.quantity) * Number(i.rate);
      return s + (line * Number(i.discount_percent) / 100);
    }, 0);
    const gstAmount = settings?.gst_enabled ? items.reduce((s, i) => {
      const line = Number(i.quantity) * Number(i.rate);
      const afterDisc = line - (line * Number(i.discount_percent) / 100);
      return s + (afterDisc * Number(i.gst_rate) / 100);
    }, 0) : 0;
    const total = subtotal - discount + gstAmount;
    return { subtotal, discount, gstAmount, total };
  }, [items, settings?.gst_enabled]);

  const calcEditTotals = () => {
    const subtotal = editItems.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0);
    const discount = editItems.reduce((s, i) => {
      const line = Number(i.quantity) * Number(i.rate);
      return s + (line * Number(i.discount_percent) / 100);
    }, 0);
    const gstAmount = settings?.gst_enabled ? editItems.reduce((s, i) => {
      const line = Number(i.quantity) * Number(i.rate);
      const afterDisc = line - (line * Number(i.discount_percent) / 100);
      return s + (afterDisc * Number(i.gst_rate) / 100);
    }, 0) : 0;
    return { subtotal, discount, gstAmount, total: subtotal - discount + gstAmount };
  };

  const generateInvoiceNumber = async () => {
    const { data } = await supabase.rpc("generate_document_number", { p_document_type: "sales_invoice" });
    return data || `SI-${Date.now()}`;
  };

  const handleSave = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    const { subtotal, discount, gstAmount, total } = calcTotals();
    const invoiceNumber = await generateInvoiceNumber();

    const { data: inv, error } = await supabase.from("sales_invoices").insert({
      invoice_number: invoiceNumber, customer_id: customerId, date: invoiceDate,
      due_date: dueDate || null, subtotal, gst_amount: gstAmount, discount, total,
      status: "draft", notes: notes || null,
    }).select().single();

    if (error || !inv) { toast.error("Failed to create invoice"); return; }

    const lineItems = items.map(i => ({
      invoice_id: inv.id, product_id: i.product_id || null,
      quantity: Number(i.quantity), rate: Number(i.rate),
      discount_percent: Number(i.discount_percent), gst_rate: Number(i.gst_rate), amount: i.amount,
    }));
    await supabase.from("sales_invoice_items").insert(lineItems);

    toast.success(`Invoice ${invoiceNumber} created`);
    resetForm(); load();
  };

  const resetForm = () => {
    setOpen(false); setCustomerId(""); setInvoiceDate(new Date().toISOString().split("T")[0]);
    setDueDate(""); setNotes(""); setItems([]);
  };

  // Bulk delete
  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const filtered = invoices.filter(i => i.invoice_number.toLowerCase().includes(search.toLowerCase()));
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(i => i.id)));

  const handleBulkDelete = (ids: string[]) => {
    setDeleteIds(ids);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    for (let i = 0; i < deleteIds.length; i += 200) {
      const chunk = deleteIds.slice(i, i + 200);
      await supabase.from("sales_invoice_items").delete().in("invoice_id", chunk);
      await supabase.from("sales_invoices").delete().in("id", chunk);
    }
    toast.success(`${deleteIds.length} deleted`);
    setSelected(new Set());
    setDeleteConfirmOpen(false);
    setDeleteIds([]);
    load();
  };

  // Detail dialog
  const openDetail = async (inv: SalesInvoice) => {
    setDetailInv(inv);
    const { data: lineItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", inv.id);
    setDetailItems(lineItems || []);
    setEditMode(false);
    setDetailOpen(true);
  };

  const enterEditMode = () => {
    if (!detailInv) return;
    setEditCustomerId(detailInv.customer_id || "");
    setEditDate(detailInv.date);
    setEditDueDate(detailInv.due_date || "");
    setEditNotes(detailInv.notes || "");
    setEditItems(detailItems.map((i: any) => ({
      product_id: i.product_id || "", product_name: i.products?.name || "Item",
      quantity: i.quantity, rate: Number(i.rate), discount_percent: i.discount_percent,
      gst_rate: i.gst_rate, amount: Number(i.amount),
    })));
    setEditMode(true);
  };

  const updateEditItem = (idx: number, field: string, value: any) => {
    const u = [...editItems];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = settings?.gst_enabled ? Number(p.gst_rate) : 0; }
    }
    const qty = Number(u[idx].quantity); const rate = Number(u[idx].rate);
    const disc = Number(u[idx].discount_percent);
    const lineTotal = qty * rate; const afterDisc = lineTotal - (lineTotal * disc / 100);
    u[idx].amount = afterDisc + (settings?.gst_enabled ? (afterDisc * Number(u[idx].gst_rate) / 100) : 0);
    setEditItems(u);
  };

  const handleEditSave = async () => {
    if (!detailInv) return;
    const { subtotal, discount, gstAmount, total } = calcEditTotals();
    await supabase.from("sales_invoices").update({
      customer_id: editCustomerId || null, date: editDate, due_date: editDueDate || null,
      notes: editNotes || null, subtotal, discount, gst_amount: gstAmount, total,
    }).eq("id", detailInv.id);
    await supabase.from("sales_invoice_items").delete().eq("invoice_id", detailInv.id);
    if (editItems.length > 0) {
      await supabase.from("sales_invoice_items").insert(editItems.map(i => ({
        invoice_id: detailInv.id, product_id: i.product_id || null,
        quantity: Number(i.quantity), rate: Number(i.rate),
        discount_percent: Number(i.discount_percent), gst_rate: Number(i.gst_rate), amount: i.amount,
      })));
    }
    toast.success("Invoice updated");
    setDetailOpen(false); setEditMode(false); load();
  };

  const printInvoice = async (inv: SalesInvoice) => {
    const { data: lineItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", inv.id);
    generatePdf({
      title: "SALES INVOICE", documentNumber: inv.invoice_number, date: inv.date,
      partyLabel: "Customer", partyName: (inv.customers as any)?.name || "—",
      columns: [
        { header: "#", key: "idx" }, { header: "Product", key: "name" }, { header: "Batch", key: "batch_number" },
        { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
        { header: "Disc%", key: "discount_percent", align: "right" }, { header: "Amount", key: "amount", align: "right" },
      ],
      rows: (lineItems || []).map((i: any, idx: number) => ({
        idx: idx + 1, name: i.products?.name || "Item", batch_number: i.batch_number || "—",
        quantity: i.quantity, rate: Number(i.rate).toLocaleString(), discount_percent: i.discount_percent,
        amount: Number(i.amount).toLocaleString(),
      })),
      totals: [
        { label: "Subtotal", value: `PKR ${Number(inv.subtotal).toLocaleString()}` },
        { label: "Discount", value: `-PKR ${Number(inv.discount).toLocaleString()}` },
        ...(settings?.gst_enabled ? [{ label: "GST", value: `PKR ${Number(inv.gst_amount).toLocaleString()}` }] : []),
        { label: "Total", value: `PKR ${Number(inv.total).toLocaleString()}` },
      ],
      notes: inv.notes || undefined, settings,
      template: getTemplate("sales_invoice"),
    });
  };

  const openDNDialog = async (inv: SalesInvoice) => {
    setDnInvoice(inv);
    const { data: lineItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", inv.id);
    if (!lineItems || lineItems.length === 0) { toast.error("No items in this invoice"); return; }
    
    const productIds = lineItems.filter((i: any) => i.product_id).map((i: any) => i.product_id);
    const [movementsRes, grnItemsRes] = await Promise.all([
      supabase.from("stock_movements").select("product_id, batch_number, quantity, movement_type").in("product_id", productIds),
      supabase.from("grn_items").select("product_id, batch_number, expiry_date").in("product_id", productIds),
    ]);
    
    const batchQty: Record<string, number> = {};
    (movementsRes.data || []).forEach((m: any) => {
      const key = `${m.product_id}__${m.batch_number || "no-batch"}`;
      if (!batchQty[key]) batchQty[key] = 0;
      if (["purchase_in", "return_in", "adjustment_in", "opening", "adjustment"].includes(m.movement_type)) batchQty[key] += Number(m.quantity);
      else if (["sale_out", "return_out", "adjustment_out", "damage", "expired"].includes(m.movement_type)) batchQty[key] -= Number(m.quantity);
    });
    
    const expiryMap: Record<string, string> = {};
    (grnItemsRes.data || []).forEach((g: any) => {
      const key = `${g.product_id}__${g.batch_number || "no-batch"}`;
      if (g.expiry_date && !expiryMap[key]) expiryMap[key] = g.expiry_date;
    });
    
    const items: DNItemBatch[] = lineItems.map((i: any) => {
      const availBatches: BatchAllocation[] = [];
      for (const [key, qty] of Object.entries(batchQty)) {
        const [pid, batch] = key.split("__");
        if (pid === i.product_id && qty > 0 && batch !== "no-batch") {
          availBatches.push({ batch_number: batch, expiry_date: expiryMap[key] || "", quantity: 0, available: qty });
        }
      }
      if (availBatches.length === 1) {
        availBatches[0].quantity = Math.min(Number(i.quantity), availBatches[0].available);
      }
      if (availBatches.length === 0) {
        availBatches.push({ batch_number: "", expiry_date: "", quantity: Number(i.quantity), available: 0 });
      }
      return { product_id: i.product_id, product_name: i.products?.name || "Item", required_quantity: Number(i.quantity), batches: availBatches };
    });
    setDnItems(items);
    setDnOpen(true);
  };

  const addBatchRow = (itemIdx: number) => {
    const updated = [...dnItems];
    updated[itemIdx].batches.push({ batch_number: "", expiry_date: "", quantity: 0, available: 0 });
    setDnItems(updated);
  };

  const updateBatchRow = (itemIdx: number, batchIdx: number, field: string, value: any) => {
    const updated = [...dnItems];
    (updated[itemIdx].batches[batchIdx] as any)[field] = value;
    setDnItems(updated);
  };

  const removeBatchRow = (itemIdx: number, batchIdx: number) => {
    const updated = [...dnItems];
    updated[itemIdx].batches = updated[itemIdx].batches.filter((_, i) => i !== batchIdx);
    setDnItems(updated);
  };

  const handleCreateDN = async () => {
    if (!dnInvoice) return;
    for (const item of dnItems) {
      const totalQty = item.batches.reduce((s, b) => s + Number(b.quantity), 0);
      if (totalQty !== item.required_quantity) {
        toast.error(`${item.product_name}: total batch qty (${totalQty}) must equal required qty (${item.required_quantity})`);
        return;
      }
      for (const batch of item.batches) {
        if (!batch.batch_number) { toast.error(`${item.product_name}: batch number is required`); return; }
        if (!batch.expiry_date) { toast.error(`${item.product_name}: expiry date is required for batch ${batch.batch_number}`); return; }
        if (batch.available > 0 && Number(batch.quantity) > batch.available) {
          toast.error(`${item.product_name}: batch ${batch.batch_number} only has ${batch.available} available`); return;
        }
      }
    }
    
    const { data: dnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "delivery_note" });
    if (!dnNumber) { toast.error("Failed to generate DN number"); return; }
    
    const allDnItems = dnItems.flatMap(item => 
      item.batches.map(b => ({
        product_name: item.product_name, batch_number: b.batch_number, expiry_date: b.expiry_date, quantity: Number(b.quantity),
      }))
    );
    
    await supabase.from("delivery_notes").insert({
      dn_number: dnNumber, reference_type: "sales_invoice", reference_id: dnInvoice.id,
      customer_id: dnInvoice.customer_id, items: allDnItems,
    });
    await supabase.from("sales_invoices").update({ status: "dispatched" }).eq("id", dnInvoice.id);
    toast.success(`Delivery Note ${dnNumber} created — Invoice marked as dispatched`);
    setDnOpen(false); load();
  };

  const generateFBR = async (inv: SalesInvoice) => {
    const qr = JSON.stringify({ inv: inv.invoice_number, ntn: "COMPANY-NTN", total: inv.total, gst: inv.gst_amount, date: inv.date });
    await supabase.from("sales_invoices").update({ fbr_qr_data: qr, status: "sent" }).eq("id", inv.id);
    setQrData(qr); setQrOpen(true);
    toast.success("FBR QR generated"); load();
  };

  const { subtotal, discount, gstAmount, total } = calcTotals();

  const statusColor = (s: string) => {
    if (s === "paid") return "bg-primary/10 text-primary";
    if (s === "dispatched") return "bg-primary/10 text-primary";
    if (s === "sent") return "bg-primary/10 text-primary";
    if (s === "overdue") return "bg-destructive/10 text-destructive";
    if (s === "partial") return "bg-warning/10 text-warning";
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
              <h1 className="text-xl font-bold text-foreground font-heading">Sales Invoices</h1>
              <p className="text-sm text-muted-foreground">Create invoices{settings?.gst_enabled ? ' with GST calculation' : ''}{settings?.fbr_enabled ? ' & FBR QR' : ''}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/proforma")}>
              <ArrowRight className="h-4 w-4 mr-1" /> Go to Proformas
            </Button>
          </header>

          <div className="p-6">
            {/* Flow indicator */}
            <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border">
              <span className="font-semibold text-muted-foreground">① Proforma</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-primary">② Sales Invoice</span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-semibold text-muted-foreground">③ Delivery Note</span>
              <span className="ml-auto italic">Invoices are created by approving a Sales Proforma</span>
            </div>

            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>DN #</TableHead>
                      {settings?.gst_enabled && <TableHead className="text-right">GST</TableHead>}
                      <TableHead className="text-right">Total</TableHead>
                      {settings?.fbr_enabled && <TableHead>FBR</TableHead>}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={settings?.fbr_enabled ? 10 : 9} className="text-center py-12 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No invoices yet.</p>
                        <p className="text-xs mt-1">Create a Sales Proforma first, then approve it to auto-generate an Invoice.</p>
                      </TableCell></TableRow>
                    ) : filtered.map(inv => (
                      <TableRow key={inv.id} className="cursor-pointer" data-state={selected.has(inv.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} /></TableCell>
                        <TableCell className="font-medium font-mono" onClick={() => openDetail(inv)}>{inv.invoice_number}</TableCell>
                        <TableCell onClick={() => openDetail(inv)}>{(inv.customers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground" onClick={() => openDetail(inv)}>{inv.date}</TableCell>
                        <TableCell onClick={() => openDetail(inv)}><span className={`status-pill ${statusColor(inv.status)}`}>{inv.status}</span></TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{dnMap[inv.id] || "—"}</TableCell>
                        {settings?.gst_enabled && <TableCell className="text-right font-mono" onClick={() => openDetail(inv)}>{Number(inv.gst_amount).toLocaleString()}</TableCell>}
                        <TableCell className="text-right font-mono font-medium" onClick={() => openDetail(inv)}>{Number(inv.total).toLocaleString()}</TableCell>
                        {settings?.fbr_enabled && (
                          <TableCell>
                            {inv.fbr_qr_data ? (
                              <Button variant="ghost" size="sm" onClick={() => { setQrData(inv.fbr_qr_data); setQrOpen(true); }}>
                                <QrCode className="h-4 w-4 text-primary" />
                              </Button>
                            ) : (
                              <Button variant="outline" size="sm" onClick={() => generateFBR(inv)} className="text-xs">Generate</Button>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="space-x-1">
                          <Button variant="outline" size="sm" onClick={() => printInvoice(inv)} className="text-xs"><Download className="h-3 w-3 mr-1" />PDF</Button>
                          <Button variant="outline" size="sm" onClick={() => openDNDialog(inv)} className="text-xs"><FileOutput className="h-3 w-3 mr-1" />DN</Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkDelete([inv.id])}>
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

          {/* Delete Confirmation Dialog */}
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Are you sure you want to delete {deleteIds.length} invoice(s)? This cannot be undone.</p>
              <div className="flex gap-2 mt-4">
                <Button variant="destructive" onClick={confirmDelete} className="flex-1">Delete</Button>
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* FBR QR Dialog */}
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>FBR QR Code Data</DialogTitle></DialogHeader>
              <div className="p-4 bg-muted rounded-lg text-center">
                <QrCode className="h-24 w-24 mx-auto text-primary mb-3" />
                <p className="text-xs font-mono break-all text-muted-foreground">{qrData}</p>
                <span className="status-pill bg-primary/10 text-primary mt-3 inline-block">✓ FBR Verified</span>
              </div>
            </DialogContent>
          </Dialog>

          {/* Detail/Edit Dialog */}
          <Dialog open={detailOpen} onOpenChange={o => { if (!o) { setDetailOpen(false); setEditMode(false); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{detailInv?.invoice_number} — Detail</span>
                  {!editMode && detailInv?.status !== "paid" && (
                    <Button variant="outline" size="sm" onClick={enterEditMode}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  )}
                </DialogTitle>
              </DialogHeader>

              {!editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Customer:</span> <strong>{(detailInv?.customers as any)?.name || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Date:</span> {detailInv?.date}</div>
                    <div><span className="text-muted-foreground">Due Date:</span> {detailInv?.due_date || "—"}</div>
                    <div><span className="text-muted-foreground">Status:</span> <span className={`status-pill ${statusColor(detailInv?.status || "")}`}>{detailInv?.status}</span></div>
                  </div>
                  {detailInv?.notes && <p className="text-sm text-muted-foreground mt-2">Notes: {detailInv.notes}</p>}
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>#</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Disc%</TableHead>
                      {settings?.gst_enabled && <TableHead className="text-right">GST%</TableHead>}<TableHead className="text-right">Amount</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailItems.map((i: any, idx: number) => (
                        <TableRow key={i.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{i.products?.name || "Item"}</TableCell>
                          <TableCell className="text-right">{i.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.rate).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{i.discount_percent}%</TableCell>
                          {settings?.gst_enabled && <TableCell className="text-right">{i.gst_rate}%</TableCell>}
                          <TableCell className="text-right font-mono">{Number(i.amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t border-border pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">PKR {Number(detailInv?.subtotal || 0).toLocaleString()}</span></div>
                     <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-mono text-destructive">-PKR {Number(detailInv?.discount || 0).toLocaleString()}</span></div>
                    {settings?.gst_enabled && <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">PKR {Number(detailInv?.gst_amount || 0).toLocaleString()}</span></div>}
                    <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {Number(detailInv?.total || 0).toLocaleString()}</span></div>
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
                    <div><Label>Due Date</Label><Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} /></div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Line Items</Label>
                      <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", product_name: "", quantity: 1, rate: 0, discount_percent: 0, gst_rate: settings?.gst_enabled ? Number(settings.default_gst_rate) : 0, amount: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    {editItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-3">
                          <Select value={item.product_id} onValueChange={v => updateEditItem(idx, "product_id", v)}>
                            <SelectTrigger className="text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
                            <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => updateEditItem(idx, "quantity", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs" /></div>
                         <div className="col-span-1"><Input type="number" value={item.discount_percent} onChange={e => updateEditItem(idx, "discount_percent", e.target.value)} className="text-xs" /></div>
                        {settings?.gst_enabled && <div className="col-span-1"><Input type="number" value={item.gst_rate} onChange={e => updateEditItem(idx, "gst_rate", e.target.value)} className="text-xs" /></div>}
                        <div className={`${settings?.gst_enabled ? 'col-span-2' : 'col-span-3'} text-right text-sm font-mono pt-2`}>{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                      </div>
                    ))}
                  </div>
                  {(() => { const t = calcEditTotals(); return (
                    <div className="border-t border-border pt-3 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{t.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                       <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-mono text-destructive">-{t.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      {settings?.gst_enabled && <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">{t.gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>}
                      <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                    </div>
                  ); })()}
                  <div className="mt-3"><Label>Notes</Label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} /></div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleEditSave} className="flex-1">Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </>
              )}
             </DialogContent>
          </Dialog>

          {/* Batch Selection Dialog for Delivery Note */}
          <Dialog open={dnOpen} onOpenChange={setDnOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Delivery Note — Batch Selection</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground mb-3">Select batch numbers and quantities for each item. Total must match invoice quantity.</p>
              {dnItems.map((item, itemIdx) => (
                <div key={itemIdx} className="border border-border rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{item.product_name} — Required: <strong>{item.required_quantity}</strong></span>
                    <Button variant="outline" size="sm" onClick={() => addBatchRow(itemIdx)} className="text-xs"><Plus className="h-3 w-3 mr-1" /> Add Batch</Button>
                  </div>
                  {item.batches.map((batch, batchIdx) => (
                    <div key={batchIdx} className="grid grid-cols-12 gap-2 mb-1 items-end">
                      <div className="col-span-4"><Input className="text-xs" placeholder="Batch #" value={batch.batch_number} onChange={e => updateBatchRow(itemIdx, batchIdx, "batch_number", e.target.value)} /></div>
                      <div className="col-span-3"><Input className="text-xs" type="date" value={batch.expiry_date} onChange={e => updateBatchRow(itemIdx, batchIdx, "expiry_date", e.target.value)} /></div>
                      <div className="col-span-2"><Input className="text-xs" type="number" value={batch.quantity} onChange={e => updateBatchRow(itemIdx, batchIdx, "quantity", Number(e.target.value))} /></div>
                      <div className="col-span-2 text-xs text-muted-foreground pt-2">{batch.available > 0 ? `Avail: ${batch.available}` : ""}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeBatchRow(itemIdx, batchIdx)}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                  <div className="text-xs mt-1 text-muted-foreground">
                    Allocated: {item.batches.reduce((s, b) => s + Number(b.quantity), 0)} / {item.required_quantity}
                  </div>
                </div>
              ))}
              <Button onClick={handleCreateDN} className="w-full mt-3">Create Delivery Note</Button>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
