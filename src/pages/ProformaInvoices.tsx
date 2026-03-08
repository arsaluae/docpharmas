import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, FilePlus, Trash2, Download, CheckCircle, Pencil, MessageCircle, FileText, Loader2, X, Share2, Eye, FileEdit, Send, Truck, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { SearchableSelect } from "@/components/SearchableSelect";

interface Customer { id: string; name: string; company: string | null; phone: string | null; address: string | null; area: string | null; }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; }
interface ProformaItem { product_id: string; product_name: string; quantity: number; rate: number; gst_rate: number; amount: number; }

interface SalesOrder {
  id: string; proforma_number: string; customer_id: string | null; date: string;
  items: any; subtotal: number; gst: number; total: number; status: string;
  payment_instructions: string | null; validity_days: number;
  converted_invoice_id: string | null;
  customers: { name: string; company?: string | null; phone?: string | null; address?: string | null; area?: string | null } | null;
  created_at: string;
  invoice_number?: string;
}

interface BatchOption { batch_number: string; available: number; expiry_date?: string; }

export default function ProformaInvoices() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Create form
  const [customerId, setCustomerId] = useState("");
  const [pfDate, setPfDate] = useState(new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState("30");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [items, setItems] = useState<ProformaItem[]>([]);

  // Preview Sheet
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<SalesOrder | null>(null);

  // Edit mode inside preview
  const [editMode, setEditMode] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editValidity, setEditValidity] = useState("30");
  const [editPaymentInstr, setEditPaymentInstr] = useState("");
  const [editItems, setEditItems] = useState<ProformaItem[]>([]);

  // Submit (convert) dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitOrder, setSubmitOrder] = useState<SalesOrder | null>(null);
  const [submitItems, setSubmitItems] = useState<any[]>([]);
  const [batchOptions, setBatchOptions] = useState<Record<string, BatchOption[]>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);

  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  // ── SIMPLIFIED LOAD: proforma_invoices only ──
  const load = async () => {
    setLoading(true);
    const [pf, cust, prod] = await Promise.all([
      supabase.from("proforma_invoices").select("*, customers(name, company, phone, address, area)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, company, phone, address, area"),
      supabase.from("products").select("id, name, selling_price, gst_rate"),
    ]);

    const allOrders: SalesOrder[] = [];
    if (pf.data) {
      // For invoiced orders, batch-fetch invoice numbers
      const invoicedIds = pf.data.filter((p: any) => p.converted_invoice_id).map((p: any) => p.converted_invoice_id);
      let invoiceMap: Record<string, string> = {};
      if (invoicedIds.length > 0) {
        const { data: invs } = await supabase.from("sales_invoices").select("id, invoice_number, status").in("id", invoicedIds);
        if (invs) {
          invs.forEach((inv: any) => { invoiceMap[inv.id] = inv.invoice_number; });
          // Also update status from invoice
          const statusMap: Record<string, string> = {};
          invs.forEach((inv: any) => { statusMap[inv.id] = inv.status; });
          pf.data.forEach((p: any) => {
            if (p.converted_invoice_id && statusMap[p.converted_invoice_id]) {
              const invStatus = statusMap[p.converted_invoice_id];
              if (invStatus === "dispatched") p.status = "dispatched";
              else if (invStatus === "paid") p.status = "paid";
              else if (p.status === "draft" && p.converted_invoice_id) p.status = "invoiced";
            }
          });
        }
      }

      pf.data.forEach((p: any) => {
        let status = p.status;
        if (status === "approved") status = "draft";
        if (p.converted_invoice_id && status === "draft") status = "invoiced";

        allOrders.push({
          id: p.id, proforma_number: p.proforma_number, customer_id: p.customer_id, date: p.date,
          items: p.items, subtotal: p.subtotal, gst: p.gst, total: p.total, status,
          payment_instructions: p.payment_instructions, validity_days: p.validity_days,
          converted_invoice_id: p.converted_invoice_id, customers: p.customers as any,
          created_at: p.created_at,
          invoice_number: p.converted_invoice_id ? invoiceMap[p.converted_invoice_id] : undefined,
        });
      });
    }
    setOrders(allOrders);
    if (cust.data) setCustomers(cust.data as any);
    if (prod.data) setProducts(prod.data);
    setLoading(false);
  };

  // ── ITEMS HELPERS ──
  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: settings?.gst_enabled ? Number(settings.default_gst_rate) : 0, amount: 0 }]);
  useEffect(() => { if (createOpen && items.length === 0) addItem(); }, [createOpen]);

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

  const calcTotals = (list: ProformaItem[]) => {
    const subtotal = list.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const gst = settings?.gst_enabled ? list.reduce((s, i) => s + (Number(i.quantity) * Number(i.rate) * Number(i.gst_rate) / 100), 0) : 0;
    return { subtotal, gst, total: subtotal + gst };
  };

  // ── CREATE ──
  const handleSave = async () => {
    if (!customerId || items.length === 0 || items.every(i => !i.product_id)) { toast.error("Customer and at least one product required"); return; }
    setSaving(true);
    const { subtotal, gst, total } = calcTotals(items);
    const { data: pfNumber } = await supabase.rpc("generate_document_number", { p_document_type: "proforma_invoice" });
    if (!pfNumber) { toast.error("Failed to generate number"); setSaving(false); return; }
    const { error } = await supabase.from("proforma_invoices").insert({
      proforma_number: pfNumber, customer_id: customerId, date: pfDate,
      validity_days: Number(validityDays), items: JSON.stringify(items), subtotal, gst, total,
      status: "draft", payment_instructions: paymentInstructions || null,
    });
    if (error) { toast.error("Failed to create order: " + error.message); setSaving(false); return; }
    toast.success(`Sales Order ${pfNumber} created`);
    setCreateOpen(false); setCustomerId(""); setItems([]); setPaymentInstructions(""); setSaving(false); load();
  };

  // ── PREVIEW ──
  const openPreview = (order: SalesOrder) => {
    setPreviewOrder(order);
    setEditMode(false);
    setPreviewOpen(true);
  };

  const getPfItems = (order: SalesOrder | null): ProformaItem[] => {
    if (!order || !order.items) return [];
    return typeof order.items === "string" ? JSON.parse(order.items) : order.items;
  };

  // ── EDIT ──
  const enterEditMode = () => {
    if (!previewOrder) return;
    setEditCustomerId(previewOrder.customer_id || "");
    setEditDate(previewOrder.date);
    setEditValidity(String(previewOrder.validity_days));
    setEditPaymentInstr(previewOrder.payment_instructions || "");
    const pfItems = getPfItems(previewOrder);
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
    if (!previewOrder) return;
    setSaving(true);
    const { subtotal, gst, total } = calcTotals(editItems);
    const { error } = await supabase.from("proforma_invoices").update({
      customer_id: editCustomerId || null, date: editDate, validity_days: Number(editValidity),
      payment_instructions: editPaymentInstr || null, items: JSON.stringify(editItems), subtotal, gst, total,
    }).eq("id", previewOrder.id);
    if (error) { toast.error("Failed to update: " + error.message); setSaving(false); return; }
    toast.success("Order updated");
    setPreviewOpen(false); setEditMode(false); setSaving(false); load();
  };

  // ── WHATSAPP ──
  const shareWhatsApp = (order: SalesOrder) => {
    const custName = (order.customers as any)?.name || "Customer";
    const companyName = settings?.company_name || "PharmBooks";
    const pfItems = getPfItems(order);
    const text = `*Sales Order ${order.proforma_number}*\n${companyName}\n\nCustomer: ${custName}\nDate: ${order.date}\n\n${pfItems.map(i => `• ${i.product_name} × ${i.quantity} @ ${Number(i.rate).toLocaleString()}`).join("\n")}\n\n*Total: PKR ${Number(order.total).toLocaleString()}*${order.payment_instructions ? `\n\n${order.payment_instructions}` : ""}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // ── PDF ──
  const printOrder = (order: SalesOrder) => {
    const pfItems = getPfItems(order);
    const custName = (order.customers as any)?.name || "—";
    const custAddress = (order.customers as any)?.address || undefined;
    const custPhone = (order.customers as any)?.phone || undefined;
    const custArea = (order.customers as any)?.area || undefined;
    generatePdf({
      title: "SALES ORDER", documentNumber: order.proforma_number, date: order.date,
      partyLabel: "Customer", partyName: custName, partyAddress: custAddress, partyPhone: custPhone, partyArea: custArea,
      meta: [{ label: "Validity", value: `${order.validity_days} days` }],
      columns: [
        { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
        { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
        ...(settings?.gst_enabled ? [{ header: "GST%", key: "gst_rate", align: "right" as const }] : []),
        { header: "Amount", key: "amount", align: "right" },
      ],
      rows: pfItems.map((i: any, idx: number) => ({ ...i, idx: idx + 1, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString() })),
      totals: [
        { label: "Subtotal", value: `PKR ${Number(order.subtotal).toLocaleString()}` },
        ...(settings?.gst_enabled ? [{ label: "GST", value: `PKR ${Number(order.gst).toLocaleString()}` }] : []),
        { label: "Total", value: `PKR ${Number(order.total).toLocaleString()}` },
      ],
      notes: order.payment_instructions || undefined, settings,
      template: getTemplate("proforma"),
    });
  };

  const printInvoice = async (order: SalesOrder) => {
    if (!order.converted_invoice_id) return;
    const { data: inv } = await supabase.from("sales_invoices").select("*, customers(name)").eq("id", order.converted_invoice_id).single();
    const { data: invItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", order.converted_invoice_id);
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
  };

  // ── SUBMIT (Convert to Invoice) ──
  const openSubmitDialog = async (order: SalesOrder) => {
    setSubmitOrder(order);
    const pfItems: ProformaItem[] = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
    const productIds = pfItems.filter(i => i.product_id).map(i => i.product_id);
    const batches: Record<string, BatchOption[]> = {};

    if (productIds.length > 0) {
      const { data: movements } = await supabase.from("stock_movements").select("product_id, batch_number, quantity, movement_type, date").in("product_id", productIds);
      if (movements) {
        const batchMap: Record<string, { qty: number; expiry?: string }> = {};
        movements.forEach((m: any) => {
          const key = `${m.product_id}__${m.batch_number || "no-batch"}`;
          if (!batchMap[key]) batchMap[key] = { qty: 0 };
          const inTypes = ["purchase", "purchase_in", "return_in", "adjustment_in", "opening"];
          const outTypes = ["sale", "sale_out", "return_out", "adjustment_out", "damage", "expired"];
          if (inTypes.includes(m.movement_type)) batchMap[key].qty += Number(m.quantity);
          else if (outTypes.includes(m.movement_type)) batchMap[key].qty -= Number(m.quantity);
        });
        for (const [key, info] of Object.entries(batchMap)) {
          const [pid, batch] = key.split("__");
          if (!batches[pid]) batches[pid] = [];
          if (info.qty > 0 && batch !== "no-batch") batches[pid].push({ batch_number: batch, available: info.qty });
        }
      }
    }

    // Check if all products have batches
    const missingBatch = pfItems.filter(i => i.product_id && (!batches[i.product_id] || batches[i.product_id].length === 0));
    if (missingBatch.length > 0) {
      toast.error(`No stock batches available for: ${missingBatch.map(i => i.product_name).join(", ")}. Cannot create invoice without batch allocation.`);
      return;
    }

    setBatchOptions(batches);
    setSubmitItems(pfItems.map(i => ({
      ...i,
      batch_number: batches[i.product_id]?.length === 1 ? batches[i.product_id][0].batch_number : "",
      convert_quantity: i.quantity,
    })));
    setSubmitOpen(true);
  };

  const handleSubmit = async () => {
    if (!submitOrder) return;
    // Validate all items have batch
    if (submitItems.some(i => i.product_id && !i.batch_number)) {
      toast.error("Every item must have a batch number selected"); return;
    }
    setSubmitting(true);

    const { data: invNumber } = await supabase.rpc("generate_document_number", { p_document_type: "sales_invoice" });
    if (!invNumber) { toast.error("Failed to generate invoice number"); setSubmitting(false); return; }

    const { data: inv } = await supabase.from("sales_invoices").insert({
      invoice_number: invNumber, customer_id: submitOrder.customer_id,
      date: new Date().toISOString().split("T")[0],
      subtotal: submitOrder.subtotal, gst_amount: submitOrder.gst, total: submitOrder.total, status: "dispatched",
    }).select("*, customers(name)").single();

    if (inv) {
      const lineItems = submitItems.map((i: any) => ({
        invoice_id: inv.id, product_id: i.product_id || null,
        quantity: Number(i.convert_quantity), rate: Number(i.rate), gst_rate: Number(i.gst_rate),
        amount: i.amount, batch_number: i.batch_number || null,
      }));
      const { error: itemsErr } = await supabase.from("sales_invoice_items").insert(lineItems);
      if (itemsErr) { toast.error("Failed to save invoice items: " + itemsErr.message); setSubmitting(false); return; }

      // Stock movements (single source of truth for inventory — no duplicate trigger)
      for (const item of submitItems) {
        if (item.product_id && Number(item.convert_quantity) > 0) {
          const { error: smErr } = await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: Number(item.convert_quantity),
            movement_type: "sale", batch_number: item.batch_number || null,
            reference_type: "sales_invoice", reference_id: inv.id, notes: `Invoice ${invNumber}`,
          });
          if (smErr) { toast.error("Stock movement failed: " + smErr.message); }
        }
      }

      // Delivery Note
      const { data: dnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "delivery_note" });
      if (dnNumber) {
        // Fetch expiry dates from stock movements for each batch
        const batchExpiries: Record<string, string> = {};
        for (const item of submitItems) {
          if (item.batch_number && item.product_id) {
            const { data: mvt } = await supabase.from("stock_movements")
              .select("date")
              .eq("product_id", item.product_id)
              .eq("batch_number", item.batch_number)
              .eq("movement_type", "purchase_in")
              .limit(1).single();
            // Try GRN items for expiry
            const { data: grnItem } = await supabase.from("grn_items")
              .select("expiry_date")
              .eq("product_id", item.product_id)
              .eq("batch_number", item.batch_number)
              .limit(1).single();
            if (grnItem?.expiry_date) batchExpiries[`${item.product_id}__${item.batch_number}`] = grnItem.expiry_date;
          }
        }

        const dnItems = submitItems.map((i: any) => ({
          product_name: i.product_name || "Item",
          batch_number: i.batch_number || null,
          expiry_date: batchExpiries[`${i.product_id}__${i.batch_number}`] || null,
          quantity: Number(i.convert_quantity),
        }));
        await supabase.from("delivery_notes").insert({
          dn_number: dnNumber, reference_type: "sales_invoice", reference_id: inv.id,
          customer_id: submitOrder.customer_id, items: dnItems,
        });
      }

      await supabase.from("proforma_invoices").update({ status: "invoiced", converted_invoice_id: inv.id }).eq("id", submitOrder.id);
      toast.success(`Invoice ${invNumber} + Delivery Note created successfully`);

      // Auto-download invoice PDF
      const { data: invItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", inv.id);
      generatePdf({
        title: "SALES INVOICE", documentNumber: invNumber, date: inv.date,
        partyLabel: "Customer", partyName: (inv.customers as any)?.name || (submitOrder.customers as any)?.name || "—",
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

      setSubmitOpen(false); setPreviewOpen(false); setSubmitting(false); load();
    } else {
      setSubmitting(false);
    }
  };

  // ── DELETE ──
  const promptDelete = (ids: string[]) => { setDeleteIds(ids); setDeleteConfirmOpen(true); };
  const confirmDelete = async () => {
    for (let i = 0; i < deleteIds.length; i += 200) {
      await supabase.from("proforma_invoices").delete().in("id", deleteIds.slice(i, i + 200));
    }
    toast.success(`${deleteIds.length} deleted`);
    setSelected(new Set()); setDeleteConfirmOpen(false); setDeleteIds([]);
    if (previewOpen && previewOrder && deleteIds.includes(previewOrder.id)) setPreviewOpen(false);
    load();
  };

  // ── FILTERS ──
  const { subtotal, gst, total } = calcTotals(items);
  const getDateFilter = () => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (dateRange === "today") return todayStr;
    if (dateRange === "week") { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().split("T")[0]; }
    if (dateRange === "month") return todayStr.slice(0, 7) + "-01";
    return null;
  };

  const filtered = orders.filter(p => {
    const matchSearch = p.proforma_number.toLowerCase().includes(search.toLowerCase()) ||
      ((p.customers as any)?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.invoice_number || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchCustomer = !customerFilter || p.customer_id === customerFilter;
    const dateStart = getDateFilter();
    const matchDate = !dateStart || p.date >= dateStart;
    return matchSearch && matchStatus && matchCustomer && matchDate;
  });

  const statsByStatus = (status: string) => {
    const list = orders.filter(d => d.status === status);
    return { count: list.length, value: list.reduce((s, d) => s + Number(d.total), 0) };
  };
  const draftStats = statsByStatus("draft");
  const invoicedStats = statsByStatus("invoiced");
  const dispatchedStats = statsByStatus("dispatched");
  const paidStats = statsByStatus("paid");

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const statusColor = (s: string) => {
    if (s === "invoiced") return "bg-blue-500/15 text-blue-600 border-blue-500/20";
    if (s === "dispatched") return "bg-violet-500/15 text-violet-600 border-violet-500/20";
    if (s === "paid") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/20";
    if (s === "draft") return "bg-amber-500/15 text-amber-600 border-amber-500/20";
    return "bg-muted text-muted-foreground";
  };
  const statusLabel = (s: string) => ({ draft: "Draft", invoiced: "Invoiced", dispatched: "Dispatched", paid: "Paid" }[s] || s);

  const STATUS_OPTIONS = ["all", "draft", "invoiced", "dispatched", "paid"];
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

  return (
    <AppLayout title="Sales Orders" subtitle="Create orders → confirm with batch → auto invoice + delivery note"
      headerActions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-[1.02] transition-all">
              <Plus className="h-4 w-4" /> New Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Create Sales Order</DialogTitle></DialogHeader>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Customer *</Label>
                <SearchableSelect options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Select customer..." searchPlaceholder="Search..." />
              </div>
              <div><Label className="text-xs font-medium text-muted-foreground">Date</Label><Input type="date" value={pfDate} onChange={e => setPfDate(e.target.value)} /></div>
              <div><Label className="text-xs font-medium text-muted-foreground">Validity (days)</Label><Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} /></div>
            </div>
            <div className="mt-3">
              <Label className="text-xs font-medium text-muted-foreground">Payment Instructions</Label>
              <Textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} placeholder="Bank details, payment terms..." rows={2} className="mt-1" />
            </div>
            <Separator className="my-4" />
            <div className="flex items-center justify-between mb-3">
              <Label className="text-sm font-semibold">Items</Label>
              <Button variant="outline" size="sm" onClick={addItem} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add Item</Button>
            </div>
            {items.map((item, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                <div className="col-span-4">
                  <SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" />
                </div>
                <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="text-xs" placeholder="Qty" /></div>
                <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" /></div>
                {settings?.gst_enabled && <div className="col-span-1"><Input type="number" value={item.gst_rate} onChange={e => updateItem(idx, "gst_rate", e.target.value)} className="text-xs" placeholder="GST%" /></div>}
                <div className={`${settings?.gst_enabled ? "col-span-2" : "col-span-3"} text-right text-sm font-mono pt-2 text-foreground`}>{item.amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
                <div className="col-span-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button></div>
              </div>
            ))}
            <Separator className="my-3" />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{subtotal.toLocaleString()}</span></div>
              {settings?.gst_enabled && <div className="flex justify-between text-muted-foreground"><span>GST</span><span className="font-mono">{gst.toLocaleString()}</span></div>}
              <div className="flex justify-between font-bold text-foreground text-base"><span>Total</span><span className="font-mono">PKR {total.toLocaleString()}</span></div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full mt-4 h-11 text-sm font-semibold">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Sales Order
            </Button>
          </DialogContent>
        </Dialog>
      }
    >

      <div className="space-y-4">
            {/* PREMIUM STATUS BUTTONS */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Draft", ...draftStats, icon: FileEdit, gradient: "from-amber-500/8 to-amber-600/15", iconBg: "from-amber-500 to-amber-600", accent: "from-amber-400 to-amber-600", textColor: "text-amber-600", statusKey: "draft" },
                { label: "Invoiced", ...invoicedStats, icon: Send, gradient: "from-blue-500/8 to-blue-600/15", iconBg: "from-blue-500 to-blue-600", accent: "from-blue-400 to-blue-600", textColor: "text-blue-600", statusKey: "invoiced" },
                { label: "Dispatched", ...dispatchedStats, icon: Truck, gradient: "from-violet-500/8 to-violet-600/15", iconBg: "from-violet-500 to-violet-600", accent: "from-violet-400 to-violet-600", textColor: "text-violet-600", statusKey: "dispatched" },
                { label: "Paid", ...paidStats, icon: CreditCard, gradient: "from-emerald-500/8 to-emerald-600/15", iconBg: "from-emerald-500 to-emerald-600", accent: "from-emerald-400 to-emerald-600", textColor: "text-emerald-600", statusKey: "paid" },
              ].map(s => (
                <button key={s.label} onClick={() => setStatusFilter(s.statusKey)}
                  className={`group relative flex flex-col items-center justify-center h-[100px] rounded-2xl bg-gradient-to-br ${s.gradient} border border-border/50 backdrop-blur-sm hover:scale-[1.03] hover:shadow-lg transition-all duration-300 overflow-hidden ${statusFilter === s.statusKey ? "ring-2 ring-offset-2 ring-primary/40 shadow-lg" : ""}`}>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.iconBg} shadow-md flex items-center justify-center mb-2 group-hover:scale-110 transition-transform duration-300`}>
                    <s.icon className="h-5 w-5 text-white" />
                  </div>
                  <span className={`text-lg font-bold font-heading ${s.textColor}`}>{s.count}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{s.label}</span>
                  <div className={`absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r ${s.accent} opacity-50 group-hover:opacity-100 transition-opacity`} />
                </button>
              ))}
            </div>

            {/* FILTERS */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative max-w-xs flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="w-44">
                <SearchableSelect options={[{ value: "", label: "All Customers" }, ...customerOptions]} value={customerFilter} onChange={setCustomerFilter} placeholder="Customer..." />
              </div>
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                {[{ label: "All", value: "all" }, { label: "Today", value: "today" }, { label: "Week", value: "week" }, { label: "Month", value: "month" }].map(d => (
                  <button key={d.value} onClick={() => setDateRange(d.value)}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${dateRange === d.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TABLE */}
            <Card className="glass-card overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 space-y-3">
                    {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                        <TableHead className="font-semibold">Order #</TableHead>
                        <TableHead className="font-semibold">Customer</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-right font-semibold">Total</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-16">
                            <FilePlus className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                            <p className="text-muted-foreground font-medium">No sales orders yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Click "New Order" to create your first sales order</p>
                          </TableCell>
                        </TableRow>
                      ) : filtered.map(order => (
                        <TableRow key={order.id} className="group cursor-pointer hover:bg-muted/30 transition-colors" data-state={selected.has(order.id) ? "selected" : undefined}>
                          <TableCell><Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} /></TableCell>
                          <TableCell className="font-mono font-semibold text-sm" onClick={() => openPreview(order)}>{order.proforma_number}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground" onClick={() => openPreview(order)}>{order.invoice_number || "—"}</TableCell>
                          <TableCell className="text-sm" onClick={() => openPreview(order)}>{(order.customers as any)?.name || "—"}</TableCell>
                          <TableCell className="text-sm text-muted-foreground" onClick={() => openPreview(order)}>{order.date}</TableCell>
                          <TableCell onClick={() => openPreview(order)}>
                            <Badge variant="outline" className={`text-[10px] font-semibold ${statusColor(order.status)}`}>{statusLabel(order.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold text-sm" onClick={() => openPreview(order)}>
                            {Number(order.total).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {order.status === "draft" && (
                                <Button size="sm" onClick={() => openSubmitDialog(order)} className="h-7 text-xs gap-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-sm">
                                  <CheckCircle className="h-3 w-3" /> Submit
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPreview(order)}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {order.status === "draft" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => promptDelete([order.id])}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* BULK DELETE BAR */}
          {selected.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-4 z-50">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" variant="secondary" onClick={() => promptDelete(Array.from(selected))} className="gap-1">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          )}

          {/* DELETE CONFIRM */}
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Delete {deleteIds.length} order(s)?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">This action cannot be undone. Only draft orders will be removed.</p>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete} className="flex-1">Delete</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ═══ PREMIUM ORDER PREVIEW SHEET ═══ */}
          <Sheet open={previewOpen} onOpenChange={o => { if (!o) { setPreviewOpen(false); setEditMode(false); } }}>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
              {previewOrder && !editMode && (
                <div className="flex flex-col h-full">
                  {/* Branded header */}
                  <div className="bg-gradient-to-r from-foreground to-foreground/90 text-background px-6 py-5">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-background/60">Sales Order</p>
                        <p className="text-2xl font-bold font-heading tracking-tight mt-1">{previewOrder.proforma_number}</p>
                      </div>
                      {settings?.logo_url && (
                        <img src={settings.logo_url} alt="Logo" className="h-10 w-auto object-contain rounded opacity-90" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <Badge variant="outline" className={`text-[10px] border-background/20 ${previewOrder.status === "draft" ? "text-amber-300" : previewOrder.status === "paid" ? "text-emerald-300" : "text-background/80"}`}>
                        {statusLabel(previewOrder.status)}
                      </Badge>
                      <span className="text-xs text-background/50">{previewOrder.date}</span>
                      {previewOrder.invoice_number && <span className="text-xs text-background/50">Invoice: {previewOrder.invoice_number}</span>}
                    </div>
                  </div>

                  {/* Customer card */}
                  <div className="px-6 py-4 border-b border-border">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-2">Customer</p>
                    <p className="text-sm font-semibold text-foreground">{(previewOrder.customers as any)?.name || "—"}</p>
                    {(previewOrder.customers as any)?.company && <p className="text-xs text-muted-foreground">{(previewOrder.customers as any).company}</p>}
                    {(previewOrder.customers as any)?.phone && <p className="text-xs text-muted-foreground mt-0.5">{(previewOrder.customers as any).phone}</p>}
                    {(previewOrder.customers as any)?.address && <p className="text-xs text-muted-foreground mt-0.5">{(previewOrder.customers as any).address}</p>}
                  </div>

                  {/* Items */}
                  <div className="px-6 py-4 flex-1">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.15em] mb-3">Items</p>
                    <div className="space-y-2">
                      {getPfItems(previewOrder).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/30 border border-border/50">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground">{item.product_name || "Item"}</p>
                            <p className="text-xs text-muted-foreground">{item.quantity} × PKR {Number(item.rate).toLocaleString()}</p>
                          </div>
                          <p className="text-sm font-mono font-semibold text-foreground">PKR {Number(item.amount).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="mt-4 pt-3 border-t border-border space-y-1.5">
                      <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span className="font-mono">PKR {Number(previewOrder.subtotal).toLocaleString()}</span></div>
                      {settings?.gst_enabled && <div className="flex justify-between text-sm text-muted-foreground"><span>GST</span><span className="font-mono">PKR {Number(previewOrder.gst).toLocaleString()}</span></div>}
                      <div className="flex justify-between text-base font-bold text-foreground pt-1 border-t border-border"><span>Total</span><span className="font-mono">PKR {Number(previewOrder.total).toLocaleString()}</span></div>
                    </div>

                    {previewOrder.payment_instructions && (
                      <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Payment Instructions</p>
                        <p className="text-xs text-muted-foreground">{previewOrder.payment_instructions}</p>
                      </div>
                    )}
                  </div>

                  {/* ACTION BAR */}
                  <div className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur-sm px-6 py-4 space-y-2">
                    {previewOrder.status === "draft" && (
                      <Button onClick={() => openSubmitDialog(previewOrder)} className="w-full h-11 gap-2 text-sm font-semibold shadow-md">
                        <CheckCircle className="h-4 w-4" /> Submit — Create Invoice
                      </Button>
                    )}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => shareWhatsApp(previewOrder)} className="flex-1 gap-2 h-10">
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </Button>
                      <Button variant="outline" onClick={() => printOrder(previewOrder)} className="flex-1 gap-2 h-10">
                        <Download className="h-4 w-4" /> {previewOrder.status === "draft" ? "Order PDF" : "Order PDF"}
                      </Button>
                      {previewOrder.converted_invoice_id && (
                        <Button variant="outline" onClick={() => printInvoice(previewOrder)} className="flex-1 gap-2 h-10">
                          <FileText className="h-4 w-4" /> Invoice
                        </Button>
                      )}
                    </div>
                    {previewOrder.status === "draft" && (
                      <div className="flex gap-2">
                        <Button variant="ghost" onClick={enterEditMode} className="flex-1 gap-2 h-9 text-xs">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="ghost" onClick={() => promptDelete([previewOrder.id])} className="flex-1 gap-2 h-9 text-xs text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* EDIT MODE */}
              {previewOrder && editMode && (
                <div className="p-6 space-y-4">
                  <SheetHeader>
                    <SheetTitle className="font-heading">Edit Order {previewOrder.proforma_number}</SheetTitle>
                  </SheetHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Customer</Label>
                      <SearchableSelect options={customerOptions} value={editCustomerId} onChange={setEditCustomerId} placeholder="Customer..." />
                    </div>
                    <div><Label className="text-xs font-medium text-muted-foreground">Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
                  </div>
                  <div><Label className="text-xs font-medium text-muted-foreground">Validity (days)</Label><Input type="number" value={editValidity} onChange={e => setEditValidity(e.target.value)} /></div>
                  <div><Label className="text-xs font-medium text-muted-foreground">Payment Instructions</Label><Textarea value={editPaymentInstr} onChange={e => setEditPaymentInstr(e.target.value)} rows={2} /></div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Items</Label>
                    <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: 17, amount: 0 }])} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add</Button>
                  </div>
                  {editItems.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5"><SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateEditItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" /></div>
                      <div className="col-span-2"><Input type="number" value={item.quantity} onChange={e => updateEditItem(idx, "quantity", e.target.value)} className="text-xs" placeholder="Qty" /></div>
                      <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" /></div>
                      <div className="col-span-2 text-right text-xs font-mono pt-2">{item.amount.toLocaleString()}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                  {(() => { const t = calcTotals(editItems); return (
                    <div className="border-t border-border pt-3 space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="font-mono">{t.subtotal.toLocaleString()}</span></div>
                      <div className="flex justify-between font-bold text-foreground"><span>Total</span><span className="font-mono">PKR {t.total.toLocaleString()}</span></div>
                    </div>
                  ); })()}
                  <div className="flex gap-2">
                    <Button onClick={handleEditSave} disabled={saving} className="flex-1">{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save</Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>

          {/* ═══ SUBMIT DIALOG (Batch Selection) ═══ */}
          <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">Submit Order — Assign Batches</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">Select batch for each item. This creates Invoice + Delivery Note + updates stock.</p>
              <Separator />
              {submitItems.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{item.product_name || "Item"}</span>
                    <span className="text-xs font-mono text-muted-foreground">Qty: {item.quantity}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Batch *</Label>
                      {batchOptions[item.product_id]?.length > 0 ? (
                        <SearchableSelect
                          options={batchOptions[item.product_id].map(b => ({ value: b.batch_number, label: `${b.batch_number} (${b.available} avail)` }))}
                          value={item.batch_number}
                          onChange={v => { const u = [...submitItems]; u[idx].batch_number = v; setSubmitItems(u); }}
                          placeholder="Select batch..."
                          triggerClassName="text-xs h-9"
                        />
                      ) : (
                        <p className="text-xs text-destructive mt-1">No batches available</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Quantity</Label>
                      <Input type="number" className="text-xs" value={item.convert_quantity}
                        onChange={e => { const u = [...submitItems]; u[idx].convert_quantity = e.target.value; setSubmitItems(u); }} />
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={handleSubmit} disabled={submitting} className="w-full h-11 gap-2 text-sm font-semibold mt-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                Confirm & Create Invoice + Delivery Note
              </Button>
            </DialogContent>
          </Dialog>
    </AppLayout>
  );
}
