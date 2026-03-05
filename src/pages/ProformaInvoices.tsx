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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FilePlus, Trash2, Download, CheckCircle, Pencil, FileText } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { SearchableSelect } from "@/components/SearchableSelect";

interface Customer { id: string; name: string; }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; }
interface ProformaItem { product_id: string; product_name: string; quantity: number; rate: number; gst_rate: number; amount: number; }

interface SalesDoc {
  id: string; doc_number: string; customer_id: string | null; date: string;
  items: any; subtotal: number; gst: number; total: number; status: string;
  payment_instructions: string | null; validity_days: number;
  source: "proforma" | "invoice";
  converted_invoice_id?: string | null;
  customers?: { name: string } | null;
  created_at: string;
  // invoice-specific
  discount?: number; gst_amount?: number; amount_paid?: number;
  invoice_number?: string; proforma_number?: string;
  notes?: string | null; due_date?: string | null;
  fbr_qr_data?: string | null;
}

interface BatchOption { batch_number: string; available: number; }

export default function ProformaInvoices() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<SalesDoc[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [customerId, setCustomerId] = useState("");
  const [pfDate, setPfDate] = useState(new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState("30");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [items, setItems] = useState<ProformaItem[]>([]);

  // Convert dialog
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertPf, setConvertPf] = useState<SalesDoc | null>(null);
  const [convertItems, setConvertItems] = useState<any[]>([]);
  const [batchOptions, setBatchOptions] = useState<Record<string, BatchOption[]>>({});
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  // Detail/Edit dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPf, setDetailPf] = useState<SalesDoc | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
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
    const [pf, inv, cust, prod] = await Promise.all([
      supabase.from("proforma_invoices").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("sales_invoices").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name"),
      supabase.from("products").select("id, name, selling_price, gst_rate"),
    ]);

    const combined: SalesDoc[] = [];

    if (pf.data) {
      pf.data.forEach((p: any) => {
        combined.push({
          id: p.id, doc_number: p.proforma_number, customer_id: p.customer_id, date: p.date,
          items: p.items, subtotal: p.subtotal, gst: p.gst, total: p.total,
          status: p.status === "approved" ? "draft" : p.status, // treat approved as still draft
          payment_instructions: p.payment_instructions, validity_days: p.validity_days,
          source: "proforma", converted_invoice_id: p.converted_invoice_id,
          customers: p.customers, created_at: p.created_at, proforma_number: p.proforma_number,
        });
      });
    }

    if (inv.data) {
      inv.data.forEach((i: any) => {
        // Skip invoices that were already counted as "invoiced" proformas
        const alreadyLinked = pf.data?.some((p: any) => p.converted_invoice_id === i.id);
        if (!alreadyLinked) {
          combined.push({
            id: i.id, doc_number: i.invoice_number, customer_id: i.customer_id, date: i.date,
            items: null, subtotal: i.subtotal, gst: i.gst_amount, total: i.total,
            status: i.status === "draft" ? "invoiced" : i.status,
            payment_instructions: null, validity_days: 0, source: "invoice",
            customers: i.customers, created_at: i.created_at, invoice_number: i.invoice_number,
            discount: i.discount, gst_amount: i.gst_amount, amount_paid: i.amount_paid,
            notes: i.notes, due_date: i.due_date, fbr_qr_data: i.fbr_qr_data,
          });
        }
      });
    }

    // For "invoiced" proformas, merge invoice data
    if (pf.data && inv.data) {
      combined.forEach(doc => {
        if (doc.source === "proforma" && doc.converted_invoice_id) {
          doc.status = "invoiced";
          const linkedInv = inv.data.find((i: any) => i.id === doc.converted_invoice_id);
          if (linkedInv) {
            doc.invoice_number = linkedInv.invoice_number;
            if (linkedInv.status === "dispatched") doc.status = "dispatched";
            if (linkedInv.status === "paid") doc.status = "paid";
          }
        }
      });
    }

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setDocs(combined);
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
    toast.success(`Draft ${pfNumber} created`);
    setOpen(false); setCustomerId(""); setItems([]); setPaymentInstructions(""); load();
  };

  const openConvertDialog = async (doc: SalesDoc) => {
    setConvertPf(doc);
    const pfItems: ProformaItem[] = typeof doc.items === "string" ? JSON.parse(doc.items) : doc.items;
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
      subtotal: convertPf.subtotal, gst_amount: convertPf.gst, total: convertPf.total, status: "dispatched",
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

      // Auto-create Delivery Note
      const { data: dnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "delivery_note" });
      if (dnNumber) {
        const dnItems = convertItems.map((i: any) => ({
          product_name: i.product_name || "Item",
          batch_number: i.batch_number || null,
          quantity: Number(i.convert_quantity),
        }));
        await supabase.from("delivery_notes").insert({
          dn_number: dnNumber, reference_type: "sales_invoice", reference_id: inv.id,
          customer_id: convertPf.customer_id, items: dnItems,
        });
      }

      await supabase.from("proforma_invoices").update({ status: "invoiced", converted_invoice_id: inv.id }).eq("id", convertPf.id);
      toast.success(`✓ Invoice ${invNumber} created + Delivery Note auto-generated`);

      // Auto-download invoice PDF
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
    }
  };

  const { subtotal, gst, total } = calcTotals();
  const filtered = docs.filter(p => {
    const matchSearch = p.doc_number.toLowerCase().includes(search.toLowerCase()) ||
      ((p.customers as any)?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.invoice_number || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchCustomer = !customerFilter || p.customer_id === customerFilter;
    return matchSearch && matchStatus && matchCustomer;
  });

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

  const handleConfirmInvoice = async (doc: SalesDoc) => {
    if (doc.source !== "proforma") return;
    await openConvertDialog(doc);
  };

  // Detail/Edit
  const openDetail = async (doc: SalesDoc) => {
    setDetailPf(doc);
    if (doc.source === "invoice" && doc.id) {
      const { data: lineItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", doc.id);
      setDetailItems(lineItems || []);
    } else {
      setDetailItems([]);
    }
    setEditMode(false);
    setDetailOpen(true);
  };

  const enterEditMode = () => {
    if (!detailPf || detailPf.source !== "proforma") return;
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
    toast.success("Draft updated");
    setDetailOpen(false); setEditMode(false); load();
  };

  const getPfItems = (doc: SalesDoc | null): ProformaItem[] => {
    if (!doc || !doc.items) return [];
    return typeof doc.items === "string" ? JSON.parse(doc.items) : doc.items;
  };

  const statusColor = (s: string) => {
    if (s === "invoiced" || s === "dispatched") return "bg-primary/20 text-primary font-semibold";
    if (s === "paid") return "bg-chart-2/20 text-chart-2 font-semibold";
    if (s === "draft") return "bg-warning/10 text-warning";
    return "bg-muted text-muted-foreground";
  };

  const statusLabel = (s: string) => {
    if (s === "draft") return "Draft";
    if (s === "invoiced") return "Invoiced";
    if (s === "dispatched") return "Dispatched";
    if (s === "paid") return "Paid";
    return s;
  };

  const STATUS_OPTIONS = ["all", "draft", "invoiced", "dispatched", "paid"];
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

  const printDoc = async (doc: SalesDoc) => {
    if (doc.source === "proforma" && !doc.converted_invoice_id) {
      // Print as proforma
      const pfItems = getPfItems(doc);
      generatePdf({
        title: "SALES PROFORMA", documentNumber: doc.doc_number, date: doc.date,
        partyLabel: "Customer", partyName: (doc.customers as any)?.name || "—",
        meta: [{ label: "Validity", value: `${doc.validity_days} days` }],
        columns: [
          { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
          { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
          { header: "Amount", key: "amount", align: "right" },
        ],
        rows: pfItems.map((i: any, idx: number) => ({ ...i, idx: idx + 1, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString() })),
        totals: [
          { label: "Subtotal", value: `PKR ${Number(doc.subtotal).toLocaleString()}` },
          { label: "GST", value: `PKR ${Number(doc.gst).toLocaleString()}` },
          { label: "Total", value: `PKR ${Number(doc.total).toLocaleString()}` },
        ],
        notes: doc.payment_instructions || undefined, settings,
      });
    } else {
      // Print as invoice
      const invId = doc.converted_invoice_id || doc.id;
      const { data: inv } = await supabase.from("sales_invoices").select("*, customers(name)").eq("id", invId).single();
      const { data: invItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", invId);
      if (inv) {
        generatePdf({
          title: "SALES INVOICE", documentNumber: inv.invoice_number, date: inv.date,
          partyLabel: "Customer", partyName: (inv.customers as any)?.name || "—",
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
          settings, template: getTemplate("sales_invoice"),
        });
      }
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Sales</h1>
              <p className="text-sm text-muted-foreground">Create drafts, confirm to invoice + auto delivery note — all in one place</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Draft</Button></DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Sales Draft</DialogTitle></DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <Label>Customer *</Label>
                    <SearchableSelect options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Search customer..." searchPlaceholder="Type to search..." />
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
                        <SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Product" searchPlaceholder="Search product..." triggerClassName="text-xs h-9" />
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
                <Button onClick={handleSave} className="w-full mt-4">Create Draft</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            {/* Status flow indicator */}
            <div className="mb-6 flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-3 border border-border">
              <span className="px-2 py-1 rounded bg-warning/10 text-warning font-semibold">Draft</span>
              <span>→</span>
              <span className="px-2 py-1 rounded bg-primary/20 text-primary font-semibold">Invoiced + DN</span>
              <span>→</span>
              <span className="px-2 py-1 rounded bg-chart-2/20 text-chart-2 font-semibold">Paid</span>
              <span className="ml-auto italic">One click confirms → creates Invoice + Delivery Note automatically</span>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by number, customer..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="w-48">
                <SearchableSelect options={[{ value: "", label: "All Customers" }, ...customerOptions]} value={customerFilter} onChange={setCustomerFilter} placeholder="Filter customer..." searchPlaceholder="Search..." />
              </div>
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>Doc #</TableHead><TableHead>Invoice #</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead>
                      <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                        <FilePlus className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No sales documents yet.</p>
                        <p className="text-xs mt-1">Click "New Draft" to create your first sales document.</p>
                      </TableCell></TableRow>
                    ) : filtered.map(doc => (
                      <TableRow key={`${doc.source}-${doc.id}`} className="cursor-pointer" data-state={selected.has(doc.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(doc.id)} onCheckedChange={() => toggleSelect(doc.id)} /></TableCell>
                        <TableCell className="font-medium font-mono" onClick={() => openDetail(doc)}>{doc.doc_number}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground" onClick={() => openDetail(doc)}>{doc.invoice_number || "—"}</TableCell>
                        <TableCell onClick={() => openDetail(doc)}>{(doc.customers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground" onClick={() => openDetail(doc)}>{doc.date}</TableCell>
                        <TableCell onClick={() => openDetail(doc)}>
                          <span className={`status-pill ${statusColor(doc.status)}`}>{statusLabel(doc.status)}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium" onClick={() => openDetail(doc)}>{Number(doc.total).toLocaleString()}</TableCell>
                        <TableCell className="space-x-1">
                          {doc.status === "draft" && doc.source === "proforma" && (
                            <Button variant="outline" size="sm" onClick={() => handleConfirmInvoice(doc)} className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" /> Confirm
                            </Button>
                          )}
                          <Button variant="outline" size="sm" onClick={() => printDoc(doc)} className="text-xs">
                            <Download className="h-3 w-3 mr-1" />{doc.status === "draft" ? "Proforma" : "Invoice"}
                          </Button>
                          {doc.source === "proforma" && doc.status === "draft" && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleBulkDelete([doc.id])}>
                              <Trash2 className="h-3 w-3 text-destructive" />
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
              <p className="text-sm text-muted-foreground">Are you sure you want to delete {deleteIds.length} item(s)? This cannot be undone.</p>
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
                  <span>{detailPf?.doc_number} — {detailPf?.source === "proforma" ? (detailPf.status === "draft" ? "Draft" : "Invoiced") : "Invoice"}</span>
                  {!editMode && detailPf?.source === "proforma" && detailPf?.status === "draft" && (
                    <Button variant="outline" size="sm" onClick={enterEditMode}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  )}
                </DialogTitle>
              </DialogHeader>

              {!editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Customer:</span> <strong>{(detailPf?.customers as any)?.name || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Date:</span> {detailPf?.date}</div>
                    {detailPf?.source === "proforma" && <div><span className="text-muted-foreground">Validity:</span> {detailPf?.validity_days} days</div>}
                    <div><span className="text-muted-foreground">Status:</span> <span className={`status-pill ${statusColor(detailPf?.status || "")}`}>{statusLabel(detailPf?.status || "")}</span></div>
                    {detailPf?.invoice_number && <div><span className="text-muted-foreground">Invoice #:</span> <strong className="font-mono">{detailPf.invoice_number}</strong></div>}
                  </div>
                  {detailPf?.payment_instructions && <p className="text-sm text-muted-foreground mt-2">Payment Instructions: {detailPf.payment_instructions}</p>}
                  
                  {detailPf?.source === "proforma" && detailPf.items ? (
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
                  ) : detailItems.length > 0 ? (
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
                            <TableCell className="text-right">{i.quantity}</TableCell>
                            <TableCell className="text-right font-mono">{Number(i.rate).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{Number(i.amount).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : null}

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
                     <SearchableSelect options={customerOptions} value={editCustomerId} onChange={setEditCustomerId} placeholder="Search customer..." />
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
                          <SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateEditItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" />
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Confirm Invoice — Select Batches</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground mb-3">Select batch numbers for each item. This will create an Invoice + Delivery Note automatically.</p>
              {convertItems.map((item, idx) => (
                <div key={idx} className="space-y-2 mb-4 p-3 border border-border rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.product_name || "Item"}</span>
                    <span className="text-xs text-muted-foreground">Qty: {item.quantity}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Batch</Label>
                      {batchOptions[item.product_id]?.length > 0 ? (
                        <SearchableSelect
                          options={batchOptions[item.product_id].map(b => ({ value: b.batch_number, label: `${b.batch_number} (${b.available} avail)` }))}
                          value={item.batch_number}
                          onChange={v => { const u = [...convertItems]; u[idx].batch_number = v; setConvertItems(u); }}
                          placeholder="Select batch..."
                          triggerClassName="text-xs h-9"
                        />
                      ) : (
                        <Input className="text-xs" placeholder="No batches — enter manually" value={item.batch_number}
                          onChange={e => { const u = [...convertItems]; u[idx].batch_number = e.target.value; setConvertItems(u); }} />
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Quantity</Label>
                      <Input type="number" className="text-xs" value={item.convert_quantity}
                        onChange={e => { const u = [...convertItems]; u[idx].convert_quantity = e.target.value; setConvertItems(u); }} />
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={handleConvert} className="w-full">Confirm & Create Invoice + DN</Button>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
