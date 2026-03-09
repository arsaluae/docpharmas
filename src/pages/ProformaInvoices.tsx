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

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, FilePlus, Trash2, Download, CheckCircle, Pencil, MessageCircle, FileText, Loader2, X, Share2, Eye, FileEdit, Send, Truck, RotateCcw, DollarSign } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdfHtml } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Customer { id: string; name: string; company: string | null; phone: string | null; address: string | null; area: string | null; }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; }
interface ProformaItem { product_id: string; product_name: string; quantity: number; rate: number; gst_rate: number; amount: number; last_price?: number | null; }
interface DeliveryNoteRow { id: string; dn_number: string; date: string; customer_id: string | null; items: any; status: string; reference_id: string; created_at: string; customer_name?: string; invoice_number?: string; }

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
  const [pdfHtml, setPdfHtml] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteRow[]>([]);
  const [dnLoading, setDnLoading] = useState(false);

  // Post-submit document choice
  const [postSubmitOpen, setPostSubmitOpen] = useState(false);
  const [postSubmitOrder, setPostSubmitOrder] = useState<SalesOrder | null>(null);
  const [postSubmitInvoiceId, setPostSubmitInvoiceId] = useState<string | null>(null);

  // Create form
  const [customerId, setCustomerId] = useState("");
  const [pfDate, setPfDate] = useState(new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState("30");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [items, setItems] = useState<ProformaItem[]>([]);

  // Edit Dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState<SalesOrder | null>(null);
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

  // Void
  const [voidConfirmOpen, setVoidConfirmOpen] = useState(false);
  const [voidOrder, setVoidOrder] = useState<SalesOrder | null>(null);
  const [voiding, setVoiding] = useState(false);

  // Receive Payment
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<SalesOrder | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentBankId, setPaymentBankId] = useState("");
  const [bankAccounts, setBankAccounts] = useState<{ id: string; name: string; bank_name: string }[]>([]);
  const [paymentSaving, setPaymentSaving] = useState(false);

  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load(); loadDeliveryNotes(); loadBankAccounts();
  }, [navigate]);

  const loadBankAccounts = async () => {
    const { data } = await supabase.from("bank_accounts").select("id, name, bank_name").order("is_default", { ascending: false });
    if (data) {
      setBankAccounts(data);
      const meezan = data.find(b => b.bank_name.toLowerCase().includes("meezan"));
      setPaymentBankId(meezan?.id || data[0]?.id || "");
    }
  };

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
              if (invStatus === "paid") p.status = "paid";
              else if (invStatus === "partial") p.status = "dispatched"; // partial payment still shows as dispatched
              else if (invStatus === "dispatched") p.status = "dispatched";
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

  const lookupLastPrice = async (productId: string, custId: string): Promise<number | null> => {
    if (!productId || !custId) return null;
    const { data } = await supabase.from("proforma_invoices")
      .select("items")
      .eq("customer_id", custId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) {
      for (const row of data) {
        const rowItems: any[] = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
        const match = rowItems?.find((i: any) => i.product_id === productId);
        if (match) return Number(match.rate);
      }
    }
    return null;
  };

  const updateItem = async (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = settings?.gst_enabled ? Number(p.gst_rate) : 0; }
      // Look up last price for this customer+product
      if (customerId && value) {
        const lastRate = await lookupLastPrice(value, customerId);
        u[idx].last_price = lastRate;
        if (lastRate !== null) u[idx].rate = lastRate;
      }
    }
    const line = Number(u[idx].quantity) * Number(u[idx].rate);
    u[idx].amount = line + (settings?.gst_enabled ? (line * Number(u[idx].gst_rate) / 100) : 0);
    setItems([...u]);
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
    toast.success(`Sales Invoice ${pfNumber} created`);
    setCreateOpen(false); setCustomerId(""); setItems([]); setPaymentInstructions(""); setSaving(false); load();
  };

  // ── PREVIEW (opens PDF popup directly) ──
  const openPreview = (order: SalesOrder) => {
    if (order.converted_invoice_id) {
      printInvoice(order);
    } else {
      printOrder(order);
    }
  };

  const openEditSheet = (order: SalesOrder) => {
    setEditOrder(order);
    setEditCustomerId(order.customer_id || "");
    setEditDate(order.date);
    setEditValidity(String(order.validity_days));
    setEditPaymentInstr(order.payment_instructions || "");
    const pfItems = getPfItems(order);
    setEditItems(pfItems.map(i => ({ ...i })));
    setEditOpen(true);
  };

  const getPfItems = (order: SalesOrder | null): ProformaItem[] => {
    if (!order || !order.items) return [];
    return typeof order.items === "string" ? JSON.parse(order.items) : order.items;
  };

  const updateEditItem = async (idx: number, field: string, value: any) => {
    const u = [...editItems];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = settings?.gst_enabled ? Number(p.gst_rate) : 0; }
      if (editCustomerId && value) {
        const lastRate = await lookupLastPrice(value, editCustomerId);
        u[idx].last_price = lastRate;
        if (lastRate !== null) u[idx].rate = lastRate;
      }
    }
    const line = Number(u[idx].quantity) * Number(u[idx].rate);
    u[idx].amount = line + (settings?.gst_enabled ? (line * Number(u[idx].gst_rate) / 100) : 0);
    setEditItems([...u]);
  };

  const handleEditSave = async () => {
    if (!editOrder) return;
    setSaving(true);
    const { subtotal, gst, total } = calcTotals(editItems);
    const { error } = await supabase.from("proforma_invoices").update({
      customer_id: editCustomerId || null, date: editDate, validity_days: Number(editValidity),
      payment_instructions: editPaymentInstr || null, items: JSON.stringify(editItems), subtotal, gst, total,
    }).eq("id", editOrder.id);
    if (error) { toast.error("Failed to update: " + error.message); setSaving(false); return; }
    toast.success("Order updated");
    setEditOpen(false); setSaving(false); load();
  };

  // ── WHATSAPP ──
  const shareWhatsApp = (order: SalesOrder) => {
    const cust = order.customers as any;
    const custName = cust?.name || "Customer";
    const custPhone = cust?.phone || "";
    const companyName = settings?.company_name || "PharmBooks";
    const pfItems = getPfItems(order);
    const text = `*Sales Invoice ${order.proforma_number}*\n${companyName}\n\nCustomer: ${custName}\nDate: ${order.date}\n\n${pfItems.map(i => `• ${i.product_name} × ${i.quantity} @ ${Number(i.rate).toLocaleString()}`).join("\n")}\n\n*Total: PKR ${Number(order.total).toLocaleString()}*${order.payment_instructions ? `\n\n${order.payment_instructions}` : ""}`;
    const waNumber = custPhone ? custPhone.replace(/[^0-9]/g, "") : "";
    window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(text)}`, "_blank");
  };

  // ── PDF ──
  const printOrder = (order: SalesOrder) => {
    const pfItems = getPfItems(order);
    const custName = (order.customers as any)?.name || "—";
    const custAddress = (order.customers as any)?.address || undefined;
    const custPhone = (order.customers as any)?.phone || undefined;
    const custArea = (order.customers as any)?.area || undefined;
    const html = generatePdfHtml({
      title: "SALES INVOICE", documentNumber: order.proforma_number, date: order.date, statusTheme: "draft" as const,
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
    });
    setPdfHtml(html); setPdfTitle(`Sales Invoice — ${order.proforma_number}`); setPdfOpen(true);
  };
  
  // ── RECEIVE PAYMENT ──
  const openPaymentDialog = (order: SalesOrder) => {
    setPaymentOrder(order);
    setPaymentAmount(String(order.total));
    setPaymentMethod("bank_transfer");
    const meezan = bankAccounts.find(b => b.bank_name.toLowerCase().includes("meezan"));
    setPaymentBankId(meezan?.id || bankAccounts[0]?.id || "");
    setPaymentOpen(true);
  };

  const handleReceivePayment = async () => {
    if (!paymentOrder) return;
    setPaymentSaving(true);
    const { data: payNum } = await supabase.rpc("generate_document_number", { p_document_type: "payment" });
    if (!payNum) { toast.error("Failed to generate payment number"); setPaymentSaving(false); return; }
    const { error } = await supabase.from("payments").insert({
      payment_number: payNum,
      party_type: "customer",
      party_id: paymentOrder.customer_id!,
      type: "received",
      amount: Number(paymentAmount),
      payment_method: paymentMethod,
      bank_account_id: paymentMethod === "cash" ? null : paymentBankId || null,
      date: new Date().toISOString().split("T")[0],
      reference: paymentOrder.invoice_number || paymentOrder.proforma_number,
    });
    if (error) { toast.error("Payment failed: " + error.message); setPaymentSaving(false); return; }
    toast.success(`Payment PKR ${Number(paymentAmount).toLocaleString()} received`);
    setPaymentOpen(false); setPaymentSaving(false); load();
  };

  const printInvoice = async (order: SalesOrder) => {
    if (!order.converted_invoice_id) return;
    const { data: inv } = await supabase.from("sales_invoices").select("*, customers(name)").eq("id", order.converted_invoice_id).single();
    const { data: invItems } = await supabase.from("sales_invoice_items").select("*, products(name)").eq("invoice_id", order.converted_invoice_id);
    if (inv) {
      const html = generatePdfHtml({
        title: "SALES INVOICE", documentNumber: inv.invoice_number, date: inv.date, statusTheme: "invoiced" as const,
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
      setPdfHtml(html); setPdfTitle(`Sales Invoice — ${inv.invoice_number}`); setPdfOpen(true);
    }
  };

  // ── DELIVERY NOTE PDF ──
  const printDeliveryNote = async (order: SalesOrder) => {
    const invoiceId = order.converted_invoice_id;
    if (!invoiceId) return;
    const { data: dn } = await supabase.from("delivery_notes").select("*").eq("reference_id", invoiceId).single();
    if (!dn) { toast.error("Delivery note not found"); return; }
    const dnItems = typeof dn.items === "string" ? JSON.parse(dn.items) : (dn.items as any[]);
    const custName = (order.customers as any)?.name || "—";
    const custAddress = (order.customers as any)?.address || undefined;
    const custPhone = (order.customers as any)?.phone || undefined;
    const custArea = (order.customers as any)?.area || undefined;
    const html = generatePdfHtml({
      title: "DELIVERY NOTE", documentNumber: dn.dn_number, date: dn.date, statusTheme: "dispatched" as const,
      partyLabel: "Customer", partyName: custName, partyAddress: custAddress, partyPhone: custPhone, partyArea: custArea,
      columns: [
        { header: "#", key: "idx" },
        { header: "Product", key: "product_name" },
        { header: "Batch #", key: "batch_number" },
        { header: "Expiry", key: "expiry_date" },
        { header: "Qty", key: "quantity", align: "right" },
      ],
      rows: dnItems.map((i: any, idx: number) => ({
        idx: idx + 1,
        product_name: i.product_name || "Item",
        batch_number: i.batch_number || "—",
        expiry_date: i.expiry_date || "—",
        quantity: i.quantity,
      })),
      totals: [],
      settings, template: getTemplate("delivery_note"),
    });
    setPdfHtml(html); setPdfTitle(`Delivery Note — ${dn.dn_number}`); setPdfOpen(true);
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

    const { data: inv, error: invErr } = await supabase.from("sales_invoices").insert({
      invoice_number: invNumber, customer_id: submitOrder.customer_id,
      date: new Date().toISOString().split("T")[0],
      subtotal: submitOrder.subtotal, gst_amount: submitOrder.gst, total: submitOrder.total, status: "dispatched",
    }).select("*, customers(name)").single();

    if (invErr || !inv) { toast.error("Failed to create invoice: " + (invErr?.message || "Unknown error")); setSubmitting(false); return; }
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
            movement_type: "sale_out", batch_number: item.batch_number || null,
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

      // Show post-submit document choice dialog
      setPostSubmitOrder({ ...submitOrder, converted_invoice_id: inv.id, invoice_number: invNumber });
      setPostSubmitInvoiceId(inv.id);

      setSubmitOpen(false); setSubmitting(false); setPostSubmitOpen(true); load(); loadDeliveryNotes();
  };

  // ── VOID (Rollback) ──
  const promptVoid = (order: SalesOrder) => { setVoidOrder(order); setVoidConfirmOpen(true); };
  const confirmVoid = async () => {
    if (!voidOrder || !voidOrder.converted_invoice_id) return;
    setVoiding(true);
    const invoiceId = voidOrder.converted_invoice_id;
    // 1. Delete stock movements (trigger restores inventory)
    await supabase.from("stock_movements").delete().eq("reference_id", invoiceId);
    // 2. Delete invoice items
    await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoiceId);
    // 3. Delete invoice (trigger reverses customer balance)
    await supabase.from("sales_invoices").delete().eq("id", invoiceId);
    // 4. Delete delivery note
    await supabase.from("delivery_notes").delete().eq("reference_id", invoiceId);
    // 5. Reset proforma to draft
    await supabase.from("proforma_invoices").update({ status: "draft", converted_invoice_id: null }).eq("id", voidOrder.id);
    toast.success(`Order ${voidOrder.proforma_number} voided — invoice, delivery note & stock reversed`);
    setVoidConfirmOpen(false); setVoidOrder(null); setVoiding(false); load();
  };

  // ── DELETE ──
  const promptDelete = (ids: string[]) => { setDeleteIds(ids); setDeleteConfirmOpen(true); };
  const confirmDelete = async () => {
    for (let i = 0; i < deleteIds.length; i += 200) {
      await supabase.from("proforma_invoices").delete().in("id", deleteIds.slice(i, i + 200));
    }
    toast.success(`${deleteIds.length} deleted`);
    setSelected(new Set()); setDeleteConfirmOpen(false); setDeleteIds([]);
    if (editOpen && editOrder && deleteIds.includes(editOrder.id)) setEditOpen(false);
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

  // ── DELIVERY NOTES (tab) ──
  const loadDeliveryNotes = async () => {
    setDnLoading(true);
    const { data } = await supabase.from("delivery_notes").select("*").eq("reference_type", "sales_invoice").order("created_at", { ascending: false });
    if (data) {
      // Fetch linked invoice numbers
      const refIds = [...new Set(data.map(d => d.reference_id))];
      let invMap: Record<string, string> = {};
      if (refIds.length > 0) {
        const { data: invs } = await supabase.from("sales_invoices").select("id, invoice_number").in("id", refIds);
        if (invs) invs.forEach((inv: any) => { invMap[inv.id] = inv.invoice_number; });
      }
      // Filter to only DNs with valid invoices
      const validDns = data.filter(d => invMap[d.reference_id]);

      const custIds = [...new Set(validDns.filter(d => d.customer_id).map(d => d.customer_id!))];
      let custMap: Record<string, string> = {};
      if (custIds.length > 0) {
        const { data: custs } = await supabase.from("customers").select("id, name").in("id", custIds);
        if (custs) custs.forEach(c => { custMap[c.id] = c.name; });
      }
      setDeliveryNotes(validDns.map((d: any) => ({
        ...d,
        customer_name: d.customer_id ? custMap[d.customer_id] || "—" : "—",
        invoice_number: invMap[d.reference_id] || "—",
      })));
    }
    setDnLoading(false);
  };

  const viewDnPdf = (dn: DeliveryNoteRow) => {
    const dnItems = typeof dn.items === "string" ? JSON.parse(dn.items) : (dn.items as any[]) || [];
    const html = generatePdfHtml({
      title: "DELIVERY NOTE", documentNumber: dn.dn_number, date: dn.date, statusTheme: "dispatched" as const,
      partyLabel: "Customer", partyName: dn.customer_name || "—",
      columns: [
        { header: "#", key: "idx" },
        { header: "Product", key: "product_name" },
        { header: "Batch #", key: "batch_number" },
        { header: "Expiry", key: "expiry_date" },
        { header: "Qty", key: "quantity", align: "right" },
      ],
      rows: dnItems.map((i: any, idx: number) => ({
        idx: idx + 1, product_name: i.product_name || "Item",
        batch_number: i.batch_number || "—", expiry_date: i.expiry_date || "—", quantity: i.quantity,
      })),
      totals: [], settings, template: getTemplate("delivery_note"),
    });
    setPdfHtml(html); setPdfTitle(`Delivery Note — ${dn.dn_number}`); setPdfOpen(true);
  };

  // Cascade delete: DN → also delete linked invoice, items, stock movements, reset proforma
  const voidFromDn = async (dn: DeliveryNoteRow) => {
    const invoiceId = dn.reference_id;
    // Find linked proforma
    const { data: proforma } = await supabase.from("proforma_invoices")
      .select("id").eq("converted_invoice_id", invoiceId).single();
    // 1. Delete stock movements
    await supabase.from("stock_movements").delete().eq("reference_id", invoiceId);
    // 2. Delete invoice items
    await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoiceId);
    // 3. Delete invoice (trigger reverses customer balance)
    await supabase.from("sales_invoices").delete().eq("id", invoiceId);
    // 4. Delete delivery note
    await supabase.from("delivery_notes").delete().eq("id", dn.id);
    // 5. Reset proforma to draft
    if (proforma) {
      await supabase.from("proforma_invoices").update({ status: "draft", converted_invoice_id: null }).eq("id", proforma.id);
    }
    toast.success(`Voided — invoice ${dn.invoice_number || ""}, delivery note & stock reversed`);
    loadDeliveryNotes(); load();
  };
  const filtered = orders.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.proforma_number.toLowerCase().includes(q) ||
      ((p.customers as any)?.name || "").toLowerCase().includes(q) ||
      (p.invoice_number || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.status === statusFilter ||
      (statusFilter === "invoiced" && (p.status === "invoiced" || p.status === "dispatched"));
    const dateStart = getDateFilter();
    const matchDate = !dateStart || p.date >= dateStart;
    return matchSearch && matchStatus && matchDate;
  });

  const statsByStatus = (status: string) => {
    const list = orders.filter(d => d.status === status);
    return { count: list.length, value: list.reduce((s, d) => s + Number(d.total), 0) };
  };
  const draftStats = statsByStatus("draft");
  const invoicedAndDispatchedStats = { 
    count: orders.filter(d => d.status === "invoiced" || d.status === "dispatched").length, 
    value: orders.filter(d => d.status === "invoiced" || d.status === "dispatched").reduce((s, d) => s + Number(d.total), 0) 
  };

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

  const allStats = { count: orders.length, value: orders.reduce((s, d) => s + Number(d.total), 0) };
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

  return (
    <AppLayout title="Sales Invoices" subtitle="Create invoices → confirm with batch → auto invoice + delivery note"
      headerActions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-[1.02] transition-all">
              <Plus className="h-4 w-4" /> New Order
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Create Sales Invoice</DialogTitle></DialogHeader>
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
                <div className="col-span-2 relative">
                  <Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" />
                  {item.last_price !== undefined && item.last_price !== null && (
                    <span className="absolute -bottom-4 left-0 text-[10px] text-emerald-600 font-medium">Last: PKR {Number(item.last_price).toLocaleString()}</span>
                  )}
                </div>
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
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create Sales Invoice
            </Button>
          </DialogContent>
        </Dialog>
      }
    >

      <div className="space-y-4">
            {/* PREMIUM STATUS BUTTONS */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: "All", ...allStats, icon: FileText, gradient: "from-slate-500/8 to-slate-600/15", iconBg: "from-slate-500 to-slate-600", accent: "from-slate-400 to-slate-600", textColor: "text-foreground", statusKey: "all" },
                { label: "Draft", ...draftStats, icon: FileEdit, gradient: "from-amber-500/8 to-amber-600/15", iconBg: "from-amber-500 to-amber-600", accent: "from-amber-400 to-amber-600", textColor: "text-amber-600", statusKey: "draft" },
                { label: "Invoice", ...invoicedAndDispatchedStats, icon: Send, gradient: "from-blue-500/8 to-blue-600/15", iconBg: "from-blue-500 to-blue-600", accent: "from-blue-400 to-blue-600", textColor: "text-blue-600", statusKey: "invoiced" },
                { label: "Delivery Notes", count: deliveryNotes.length, value: 0, icon: Truck, gradient: "from-violet-500/8 to-violet-600/15", iconBg: "from-violet-500 to-violet-600", accent: "from-violet-400 to-violet-600", textColor: "text-violet-600", statusKey: "delivery_notes" },
              ].map(s => (
                <button key={s.label} onClick={() => { setStatusFilter(s.statusKey); if (s.statusKey === "delivery_notes") loadDeliveryNotes(); }}
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
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search orders & customers..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-muted/40 backdrop-blur-sm p-1 border border-border/30">
                {[{ label: "All", value: "all" }, { label: "Today", value: "today" }, { label: "Week", value: "week" }, { label: "Month", value: "month" }].map(d => (
                  <button key={d.value} onClick={() => setDateRange(d.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === d.value ? "bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* TABLE or DELIVERY NOTES */}
            {statusFilter === "delivery_notes" ? (
              <Card className="glass-card overflow-hidden">
                <CardContent className="p-0">
                  {dnLoading ? (
                    <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}</div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="font-semibold">DN #</TableHead>
                          <TableHead className="font-semibold">Invoice #</TableHead>
                          <TableHead className="font-semibold">Customer</TableHead>
                          <TableHead className="font-semibold">Date</TableHead>
                          <TableHead className="font-semibold">Status</TableHead>
                          <TableHead className="text-right font-semibold">Items</TableHead>
                          <TableHead className="font-semibold">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryNotes.length === 0 ? (
                          <TableRow><TableCell colSpan={7} className="text-center py-16">
                            <Truck className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                            <p className="text-muted-foreground font-medium">No delivery notes yet</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">Submit a Sales Order to auto-generate delivery notes</p>
                          </TableCell></TableRow>
                        ) : deliveryNotes.map(dn => {
                          const dnItems = typeof dn.items === "string" ? JSON.parse(dn.items) : (dn.items as any[]) || [];
                          return (
                            <TableRow key={dn.id} className="hover:bg-muted/30 transition-colors group">
                              <TableCell className="font-mono font-semibold text-sm cursor-pointer" onClick={() => viewDnPdf(dn)}>{dn.dn_number}</TableCell>
                              <TableCell className="font-mono text-sm text-primary cursor-pointer" onClick={() => {
                                const linkedOrder = orders.find(o => o.converted_invoice_id === dn.reference_id);
                                if (linkedOrder) printInvoice(linkedOrder);
                              }}>{dn.invoice_number || "—"}</TableCell>
                              <TableCell className="text-sm">{dn.customer_name || "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{dn.date}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-[10px] font-semibold ${dn.status === "delivered" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/20" : "bg-amber-500/15 text-amber-600 border-amber-500/20"}`}>
                                  {dn.status === "delivered" ? "Delivered" : "Issued"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right text-sm font-medium">{dnItems.length}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => viewDnPdf(dn)} title="View DN PDF">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  {dn.status === "issued" ? (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                                      await supabase.from("delivery_notes").update({ status: "delivered" }).eq("id", dn.id);
                                      toast.success("Marked as delivered"); loadDeliveryNotes();
                                    }} title="Mark Delivered">
                                      <Truck className="h-3.5 w-3.5 text-emerald-600" />
                                    </Button>
                                  ) : dn.status === "delivered" ? (
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                                      await supabase.from("delivery_notes").update({ status: "issued" }).eq("id", dn.id);
                                      toast.success("Reverted to issued"); loadDeliveryNotes();
                                    }} title="Undo Delivered">
                                      <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                                    </Button>
                                  ) : null}
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => voidFromDn(dn)} title="Void (delete invoice + DN)">
                                    <RotateCcw className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ) : (
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
                        <TableHead className="font-semibold">Items</TableHead>
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
                            <p className="text-muted-foreground font-medium">No sales invoices yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Click "New Order" to create your first sales invoice</p>
                          </TableCell>
                        </TableRow>
                      ) : filtered.map(order => {
                        const pfItems = getPfItems(order);
                        const itemNames = pfItems.map(i => i.product_name).filter(Boolean);
                        const itemsDisplay = itemNames.length <= 2 ? itemNames.join(", ") : `${itemNames.slice(0, 2).join(", ")} +${itemNames.length - 2} more`;
                        return (
                        <TableRow key={order.id} className="group cursor-pointer hover:bg-muted/30 transition-colors" data-state={selected.has(order.id) ? "selected" : undefined}>
                          <TableCell><Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} /></TableCell>
                          <TableCell className="font-mono font-semibold text-sm" onClick={() => openPreview(order)}>{order.proforma_number}</TableCell>
                          <TableCell className="text-sm" onClick={() => openPreview(order)}>{(order.customers as any)?.name || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" onClick={() => openPreview(order)} title={itemNames.join(", ")}>{itemsDisplay || "—"}</TableCell>
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
                              {(order.status === "invoiced" || order.status === "dispatched") && order.customer_id && (
                                <Button size="sm" onClick={() => openPaymentDialog(order)} className="h-7 text-xs gap-1 bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-sm" title="Receive Payment">
                                  <DollarSign className="h-3 w-3" /> Payment
                                </Button>
                              )}
                              {(order.status === "invoiced" || order.status === "dispatched") && (
                                <Button size="sm" variant="outline" onClick={() => promptVoid(order)} className="h-7 text-xs gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
                                  <RotateCcw className="h-3 w-3" /> Void
                                </Button>
                              )}
                              {order.status === "draft" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSheet(order)} title="Edit">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shareWhatsApp(order)} title="WhatsApp to Customer">
                                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => printOrder(order)} title="Download PDF">
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              {order.converted_invoice_id && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => printInvoice(order)} title="Invoice PDF">
                                  <FileText className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {order.converted_invoice_id && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => printDeliveryNote(order)} title="Delivery Note">
                                  <Truck className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {order.status === "draft" && (
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => promptDelete([order.id])}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
            )}
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

          {/* ═══ EDIT ORDER DIALOG ═══ */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-heading">Edit Order {editOrder?.proforma_number}</DialogTitle></DialogHeader>
              {editOrder && (
                <div className="space-y-4">
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
                      <div className="col-span-2 relative">
                        <Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" />
                        {item.last_price !== undefined && item.last_price !== null && (
                          <span className="absolute -bottom-4 left-0 text-[10px] text-emerald-600 font-medium">Last: PKR {Number(item.last_price).toLocaleString()}</span>
                        )}
                      </div>
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
                    <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

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

          {/* VOID CONFIRM */}
          <AlertDialog open={voidConfirmOpen} onOpenChange={setVoidConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Void Order {voidOrder?.proforma_number}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the associated invoice, delivery note, and reverse all stock movements. The order will return to Draft status. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={voiding}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={confirmVoid} disabled={voiding} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  {voiding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Void & Rollback
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

      <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} html={pdfHtml} title={pdfTitle} />

      {/* ═══ POST-SUBMIT DOCUMENT CHOICE ═══ */}
      <Dialog open={postSubmitOpen} onOpenChange={setPostSubmitOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-center">Documents Ready</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground text-center">Invoice and Delivery Note have been created. Which document would you like to view?</p>
          <div className="flex flex-col gap-3 mt-2">
            <Button
              className="h-12 gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white"
              onClick={() => { setPostSubmitOpen(false); if (postSubmitOrder) printInvoice(postSubmitOrder); }}
            >
              <FileText className="h-4 w-4" /> View Invoice
              <span className="text-xs opacity-75 ml-1">(for customer)</span>
            </Button>
            <Button
              variant="outline"
              className="h-12 gap-2"
              onClick={() => { setPostSubmitOpen(false); if (postSubmitOrder) printDeliveryNote(postSubmitOrder); }}
            >
              <Truck className="h-4 w-4" /> View Delivery Note
              <span className="text-xs text-muted-foreground ml-1">(for staff)</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
