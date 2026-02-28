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
import { Plus, Search, FileText, Trash2, QrCode, Download, FileOutput, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";

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

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [inv, cust, prod] = await Promise.all([
      supabase.from("sales_invoices").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, company"),
      supabase.from("products").select("id, name, selling_price, gst_rate"),
    ]);
    if (inv.data) setInvoices(inv.data as any);
    if (cust.data) setCustomers(cust.data);
    if (prod.data) setProducts(prod.data);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", product_name: "", quantity: 1, rate: 0, discount_percent: 0, gst_rate: 17, amount: 0 }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { updated[idx].product_name = p.name; updated[idx].rate = Number(p.selling_price); updated[idx].gst_rate = Number(p.gst_rate); }
    }
    const qty = Number(updated[idx].quantity);
    const rate = Number(updated[idx].rate);
    const disc = Number(updated[idx].discount_percent);
    const lineTotal = qty * rate;
    const afterDisc = lineTotal - (lineTotal * disc / 100);
    const gst = afterDisc * Number(updated[idx].gst_rate) / 100;
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
    const gstAmount = items.reduce((s, i) => {
      const line = Number(i.quantity) * Number(i.rate);
      const afterDisc = line - (line * Number(i.discount_percent) / 100);
      return s + (afterDisc * Number(i.gst_rate) / 100);
    }, 0);
    const total = subtotal - discount + gstAmount;
    return { subtotal, discount, gstAmount, total };
  }, [items]);

  const calcEditTotals = () => {
    const subtotal = editItems.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate)), 0);
    const discount = editItems.reduce((s, i) => {
      const line = Number(i.quantity) * Number(i.rate);
      return s + (line * Number(i.discount_percent) / 100);
    }, 0);
    const gstAmount = editItems.reduce((s, i) => {
      const line = Number(i.quantity) * Number(i.rate);
      const afterDisc = line - (line * Number(i.discount_percent) / 100);
      return s + (afterDisc * Number(i.gst_rate) / 100);
    }, 0);
    return { subtotal, discount, gstAmount, total: subtotal - discount + gstAmount };
  };

  const generateInvoiceNumber = async () => {
    const { count } = await supabase.from("sales_invoices").select("id", { count: "exact", head: true });
    return `SI-${String((count || 0) + 1).padStart(4, "0")}`;
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

  const handleBulkDelete = async (ids: string[]) => {
    if (!window.confirm(`Delete ${ids.length} invoice(s)?`)) return;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await supabase.from("sales_invoice_items").delete().in("invoice_id", chunk);
      await supabase.from("sales_invoices").delete().in("id", chunk);
    }
    toast.success(`${ids.length} deleted`);
    setSelected(new Set());
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
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = Number(p.gst_rate); }
    }
    const qty = Number(u[idx].quantity); const rate = Number(u[idx].rate);
    const disc = Number(u[idx].discount_percent);
    const lineTotal = qty * rate; const afterDisc = lineTotal - (lineTotal * disc / 100);
    u[idx].amount = afterDisc + (afterDisc * Number(u[idx].gst_rate) / 100);
    setEditItems(u);
  };

  const handleEditSave = async () => {
    if (!detailInv) return;
    const { subtotal, discount, gstAmount, total } = calcEditTotals();
    await supabase.from("sales_invoices").update({
      customer_id: editCustomerId || null, date: editDate, due_date: editDueDate || null,
      notes: editNotes || null, subtotal, discount, gst_amount: gstAmount, total,
    }).eq("id", detailInv.id);
    // Replace line items
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
        { label: "GST", value: `PKR ${Number(inv.gst_amount).toLocaleString()}` },
        { label: "Total", value: `PKR ${Number(inv.total).toLocaleString()}` },
      ],
      notes: inv.notes || undefined, settings,
    });
  };

  const createDeliveryNote = async (inv: SalesInvoice) => {
    const { data: lineItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", inv.id);
    const { count } = await supabase.from("delivery_notes").select("id", { count: "exact", head: true });
    const dnNumber = `DN-${String((count || 0) + 1).padStart(4, "0")}`;
    const dnItems = (lineItems || []).map((i: any) => ({
      product_name: i.products?.name || "Item", batch_number: i.batch_number || "", expiry_date: "", quantity: i.quantity,
    }));
    await supabase.from("delivery_notes").insert({
      dn_number: dnNumber, reference_type: "sales_invoice", reference_id: inv.id,
      customer_id: inv.customer_id, items: dnItems,
    });
    toast.success(`Delivery Note ${dnNumber} created`);
  };

  const generateFBR = async (inv: SalesInvoice) => {
    const qr = JSON.stringify({ inv: inv.invoice_number, ntn: "COMPANY-NTN", total: inv.total, gst: inv.gst_amount, date: inv.date });
    await supabase.from("sales_invoices").update({ fbr_qr_data: qr, status: "sent" }).eq("id", inv.id);
    setQrData(qr); setQrOpen(true);
    toast.success("FBR QR generated"); load();
  };

  const { subtotal, discount, gstAmount, total } = calcTotals();

  const statusColor = (s: string) => {
    if (s === "paid") return "bg-emerald-50 text-emerald-700";
    if (s === "sent") return "bg-primary/10 text-primary";
    if (s === "overdue") return "bg-destructive/10 text-destructive";
    if (s === "partial") return "bg-amber-50 text-amber-700";
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
              <p className="text-sm text-muted-foreground">Create invoices with GST calculation & FBR QR</p>
            </div>
            <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); else setOpen(true); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Invoice</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Sales Invoice</DialogTitle></DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <Label>Customer *</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} /></div>
                  <div><Label>Due Date</Label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Line Items</Label>
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-3">
                        <Select value={item.product_id} onValueChange={v => updateItem(idx, "product_id", v)}>
                          <SelectTrigger className="text-xs"><SelectValue placeholder="Product" /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2"><Input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-2"><Input type="number" placeholder="Rate" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-1"><Input type="number" placeholder="Disc%" value={item.discount_percent} onChange={e => updateItem(idx, "discount_percent", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-1"><Input type="number" placeholder="GST%" value={item.gst_rate} onChange={e => updateItem(idx, "gst_rate", e.target.value)} className="text-xs" /></div>
                      <div className="col-span-2 text-right text-sm font-mono font-medium pt-2">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-mono text-destructive">-{discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">GST (17%)</span><span className="font-mono">{gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>Total</span><span className="font-mono">PKR {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                </div>

                <div className="mt-3"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." /></div>
                <Button onClick={handleSave} className="w-full mt-4">Create Invoice</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
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
                      <TableHead className="text-right">GST</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      {settings?.fbr_enabled && <TableHead>FBR</TableHead>}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={settings?.fbr_enabled ? 9 : 8} className="text-center py-12 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />No invoices yet.
                      </TableCell></TableRow>
                    ) : filtered.map(inv => (
                      <TableRow key={inv.id} className="cursor-pointer" data-state={selected.has(inv.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(inv.id)} onCheckedChange={() => toggleSelect(inv.id)} /></TableCell>
                        <TableCell className="font-medium font-mono" onClick={() => openDetail(inv)}>{inv.invoice_number}</TableCell>
                        <TableCell onClick={() => openDetail(inv)}>{(inv.customers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground" onClick={() => openDetail(inv)}>{inv.date}</TableCell>
                        <TableCell onClick={() => openDetail(inv)}><span className={`status-pill ${statusColor(inv.status)}`}>{inv.status}</span></TableCell>
                        <TableCell className="text-right font-mono" onClick={() => openDetail(inv)}>{Number(inv.gst_amount).toLocaleString()}</TableCell>
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
                          <Button variant="outline" size="sm" onClick={() => createDeliveryNote(inv)} className="text-xs"><FileOutput className="h-3 w-3 mr-1" />DN</Button>
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

          {/* FBR QR Dialog */}
          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>FBR QR Code Data</DialogTitle></DialogHeader>
              <div className="p-4 bg-muted rounded-lg text-center">
                <QrCode className="h-24 w-24 mx-auto text-primary mb-3" />
                <p className="text-xs font-mono break-all text-muted-foreground">{qrData}</p>
                <span className="status-pill bg-emerald-50 text-emerald-700 mt-3 inline-block">✓ FBR Verified</span>
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
                      <TableHead className="text-right">GST%</TableHead><TableHead className="text-right">Amount</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailItems.map((i: any, idx: number) => (
                        <TableRow key={i.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{i.products?.name || "Item"}</TableCell>
                          <TableCell className="text-right">{i.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.rate).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{i.discount_percent}%</TableCell>
                          <TableCell className="text-right">{i.gst_rate}%</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="border-t border-border pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">PKR {Number(detailInv?.subtotal || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-mono text-destructive">-PKR {Number(detailInv?.discount || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">PKR {Number(detailInv?.gst_amount || 0).toLocaleString()}</span></div>
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
                      <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", product_name: "", quantity: 1, rate: 0, discount_percent: 0, gst_rate: 17, amount: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
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
                        <div className="col-span-1"><Input type="number" value={item.gst_rate} onChange={e => updateEditItem(idx, "gst_rate", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-2 text-right text-sm font-mono pt-2">{item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                      </div>
                    ))}
                  </div>
                  {(() => { const t = calcEditTotals(); return (
                    <div className="border-t border-border pt-3 space-y-1 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{t.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-mono text-destructive">-{t.discount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">{t.gstAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span></div>
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
        </main>
      </div>
    </SidebarProvider>
  );
}
