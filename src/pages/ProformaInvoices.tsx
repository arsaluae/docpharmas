import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
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
import { Plus, Search, FilePlus, Trash2, Download, CheckCircle, Pencil, MessageCircle, FileText, Loader2, X, Share2, Eye, FileEdit, Send, Truck, RotateCcw, DollarSign, MoreHorizontal, BadgeDollarSign, ChevronLeft, ChevronRight } from "lucide-react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Customer { id: string; name: string; company: string | null; phone: string | null; address: string | null; area: string | null; }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; }
interface ProformaItem { product_id: string; product_name: string; quantity: number; rate: number; gst_rate: number; amount: number; last_price?: number | null; discount_pct?: number; }
interface DeliveryNoteRow { id: string; dn_number: string; date: string; customer_id: string | null; items: any; status: string; reference_id: string; created_at: string; customer_name?: string; invoice_number?: string; }
interface SalesAgentOption { id: string; name: string; }

interface SalesOrder {
  id: string; proforma_number: string; customer_id: string | null; date: string;
  items: any; subtotal: number; gst: number; total: number; status: string;
  payment_instructions: string | null; validity_days: number;
  converted_invoice_id: string | null;
  customers: { name: string; company?: string | null; phone?: string | null; address?: string | null; area?: string | null } | null;
  created_at: string;
  invoice_number?: string;
  amount_paid?: number;
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
  const pagination = usePagination();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pdfHtml, setPdfHtml] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");



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
  const [allocatedProductIds, setAllocatedProductIds] = useState<string[] | null>(null);
  const [agentId, setAgentId] = useState("");
  const [agentsList, setAgentsList] = useState<SalesAgentOption[]>([]);
  const [editAgentId, setEditAgentId] = useState("");
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
      if (!session) navigate("/dashboard");
    };
    check(); load(); loadBankAccounts();
  }, [navigate]);

  // Keyboard shortcut: Ctrl+N for new order
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setCreateOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
    let pfQuery = supabase.from("proforma_invoices").select("*, customers(name, company, phone, address, area)", { count: "exact" }).order("created_at", { ascending: false });
    if (statusFilter !== "all") {
      if (statusFilter === "draft") pfQuery = pfQuery.eq("status", "draft");
      else pfQuery = pfQuery.neq("status", "draft"); // simplified for server-side
    }
    pfQuery = pfQuery.range(pagination.from, pagination.to);
    const [pf, cust, prod, agentsRes] = await Promise.all([
      pfQuery,
      supabase.from("customers").select("id, name, company, phone, address, area"),
      supabase.from("products").select("id, name, selling_price, gst_rate"),
      supabase.from("sales_agents").select("id, name").eq("status", "active"),
    ]);
    if (agentsRes.data) setAgentsList(agentsRes.data as SalesAgentOption[]);

    const allOrders: SalesOrder[] = [];
    if (pf.data) {
      // For invoiced orders, batch-fetch invoice numbers
      const invoicedIds = pf.data.filter((p: any) => p.converted_invoice_id).map((p: any) => p.converted_invoice_id);
      let invoiceMap: Record<string, string> = {};
      let amountPaidMap: Record<string, number> = {};
      if (invoicedIds.length > 0) {
        const { data: invs } = await supabase.from("sales_invoices").select("id, invoice_number, status, amount_paid").in("id", invoicedIds);
        if (invs) {
          invs.forEach((inv: any) => { 
            invoiceMap[inv.id] = inv.invoice_number;
            amountPaidMap[inv.id] = Number(inv.amount_paid || 0);
          });
          const statusMap: Record<string, string> = {};
          invs.forEach((inv: any) => { statusMap[inv.id] = inv.status; });
          pf.data.forEach((p: any) => {
            if (p.converted_invoice_id && statusMap[p.converted_invoice_id]) {
              const invStatus = statusMap[p.converted_invoice_id];
              if (invStatus === "paid") p.status = "paid";
              else if (invStatus === "partial") p.status = "partial";
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

        const amountPaid = p.converted_invoice_id ? (amountPaidMap[p.converted_invoice_id] || 0) : 0;
        allOrders.push({
          id: p.id, proforma_number: p.proforma_number, customer_id: p.customer_id, date: p.date,
          items: p.items, subtotal: p.subtotal, gst: p.gst, total: p.total, status,
          payment_instructions: p.payment_instructions, validity_days: p.validity_days,
          converted_invoice_id: p.converted_invoice_id, customers: p.customers as any,
          created_at: p.created_at,
          invoice_number: p.converted_invoice_id ? invoiceMap[p.converted_invoice_id] : undefined,
          amount_paid: amountPaid,
        });
      });
    }
    setOrders(allOrders);
    if (pf.count !== null && pf.count !== undefined) pagination.setTotalCount(pf.count);
    if (cust.data) setCustomers(cust.data as any);
    if (prod.data) setProducts(prod.data);
    setLoading(false);
  };

  // Load allocated products + auto-select agent when customer changes
  useEffect(() => {
    if (!customerId) { setAllocatedProductIds(null); setAgentId(""); return; }
    (async () => {
      const [prodRes, agentRes] = await Promise.all([
        supabase.from("customer_products").select("product_id").eq("customer_id", customerId),
        supabase.from("agent_customers").select("agent_id").eq("customer_id", customerId).limit(1),
      ]);
      if (prodRes.data && prodRes.data.length > 0) setAllocatedProductIds(prodRes.data.map(d => d.product_id));
      else setAllocatedProductIds(null);
      if (agentRes.data && agentRes.data.length > 0) setAgentId(agentRes.data[0].agent_id);
      else setAgentId("");
    })();
  }, [customerId]);

  // ── ITEMS HELPERS ──
  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: settings?.gst_enabled ? Number(settings.default_gst_rate) : 0, amount: 0, discount_pct: 0 }]);
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
    const lineGross = Number(u[idx].quantity) * Number(u[idx].rate);
    const discPct = Number(u[idx].discount_pct || 0);
    const lineAfterDisc = lineGross - (lineGross * discPct / 100);
    u[idx].amount = lineAfterDisc + (settings?.gst_enabled ? (lineAfterDisc * Number(u[idx].gst_rate) / 100) : 0);
    setItems([...u]);
  };

  const calcTotals = (list: ProformaItem[]) => {
    const subtotal = list.reduce((s, i) => {
      const gross = Number(i.quantity) * Number(i.rate);
      const disc = gross * Number(i.discount_pct || 0) / 100;
      return s + (gross - disc);
    }, 0);
    const gst = settings?.gst_enabled ? list.reduce((s, i) => {
      const gross = Number(i.quantity) * Number(i.rate);
      const disc = gross * Number(i.discount_pct || 0) / 100;
      return s + ((gross - disc) * Number(i.gst_rate) / 100);
    }, 0) : 0;
    return { subtotal, gst, total: subtotal + gst };
  };

  // ── CREATE ──
  const handleSave = async () => {
    if (!customerId || items.length === 0 || items.every(i => !i.product_id)) { toast.error("Customer and at least one product required"); return; }
    setSaving(true);
    try {
      // Credit limit check
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        const { data: custData } = await supabase.from("customers").select("balance, credit_limit, credit_days").eq("id", customerId).single();
        if (custData && Number(custData.credit_limit) > 0) {
          const { subtotal: newSubtotal } = calcTotals(items);
          const newBalance = Number(custData.balance) + newSubtotal;
          if (newBalance > Number(custData.credit_limit)) {
            toast.warning(`⚠️ Credit limit exceeded! Balance will be PKR ${newBalance.toLocaleString()} vs limit PKR ${Number(custData.credit_limit).toLocaleString()}`, { duration: 6000 });
          }
        }
      }

      // Duplicate detection: check if same customer has order in last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const { data: recentOrders } = await supabase.from("proforma_invoices")
        .select("proforma_number, created_at")
        .eq("customer_id", customerId)
        .gte("created_at", oneDayAgo.toISOString())
        .limit(1);
      if (recentOrders && recentOrders.length > 0) {
        toast.warning(`⚠️ Duplicate alert: ${customer?.name || "Customer"} already has order ${recentOrders[0].proforma_number} in the last 24 hours`, { duration: 6000 });
      }

      const { subtotal, gst, total } = calcTotals(items);
      const { data: pfNumber, error: rpcErr } = await supabase.rpc("generate_document_number", { p_document_type: "proforma" });
      if (rpcErr) { console.error("RPC error:", rpcErr); toast.error("Failed to generate number: " + rpcErr.message); setSaving(false); return; }
      if (!pfNumber) { toast.error("Failed to generate document number"); setSaving(false); return; }
      const { error } = await supabase.from("proforma_invoices").insert({
        proforma_number: pfNumber, customer_id: customerId, date: pfDate,
        validity_days: Number(validityDays), items: JSON.stringify(items), subtotal, gst, total,
        status: "draft", payment_instructions: paymentInstructions || null,
        agent_id: agentId || null,
      } as any);
      if (error) { console.error("Insert error:", error); toast.error("Failed to create order: " + error.message); setSaving(false); return; }
      toast.success(`Sales Invoice ${pfNumber} created`);
      setCreateOpen(false); setCustomerId(""); setItems([]); setPaymentInstructions(""); setAgentId(""); load();
    } catch (err: any) {
      console.error("Unexpected error creating sales order:", err);
      toast.error("Unexpected error: " + (err?.message || "Please try again"));
    } finally {
      setSaving(false);
    }
  };

  // ── PREVIEW (opens PDF popup directly) ──
  const openPreview = (order: SalesOrder) => {
    if (order.converted_invoice_id) {
      printInvoice(order);
    } else {
      printOrder(order);
    }
  };

  const openEditSheet = async (order: SalesOrder) => {
    setEditOrder(order);
    setEditCustomerId(order.customer_id || "");
    setEditDate(order.date);
    setEditValidity(String(order.validity_days));
    setEditPaymentInstr(order.payment_instructions || "");
    const pfItems = getPfItems(order);
    setEditItems(pfItems.map(i => ({ ...i })));
    // Load existing agent for this order
    if (order.customer_id) {
      const { data } = await supabase.from("agent_customers").select("agent_id").eq("customer_id", order.customer_id).limit(1);
      setEditAgentId(data && data.length > 0 ? data[0].agent_id : "");
    } else {
      setEditAgentId("");
    }
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

  // Auto-lookup agent when editCustomerId changes
  useEffect(() => {
    if (!editCustomerId || !editOpen) return;
    (async () => {
      const { data } = await supabase.from("agent_customers").select("agent_id").eq("customer_id", editCustomerId).limit(1);
      setEditAgentId(data && data.length > 0 ? data[0].agent_id : "");
    })();
  }, [editCustomerId]);

  const handleEditSave = async () => {
    if (!editOrder) return;
    setSaving(true);
    const { subtotal, gst, total } = calcTotals(editItems);
    const { error } = await supabase.from("proforma_invoices").update({
      customer_id: editCustomerId || null, date: editDate, validity_days: Number(editValidity),
      payment_instructions: editPaymentInstr || null, items: JSON.stringify(editItems), subtotal, gst, total,
      agent_id: editAgentId || null,
    } as any).eq("id", editOrder.id);
    if (error) { toast.error("Failed to update: " + error.message); setSaving(false); return; }
    toast.success("Order updated");
    setEditOpen(false); setSaving(false); load();
  };

  // ── WHATSAPP ──
  const shareWhatsApp = async (order: SalesOrder) => {
    const cust = order.customers as any;
    const custName = cust?.name || "Customer";
    const custPhone = cust?.phone || "";
    const companyName = settings?.company_name || "DocPharmas";
    const pfItems = getPfItems(order);

    // Get bank details
    const { data: banks } = await supabase.from("bank_accounts").select("name, bank_name, account_number").eq("is_default", true).limit(1);
    const bank = banks?.[0];
    const bankDetails = bank ? `${bank.bank_name}: ${bank.account_number || "N/A"}\n(${bank.name})` : undefined;

    // Generate PDF link
    let pdfLink: string | undefined;
    try {
      const { buildSalesInvoiceMessage, openWhatsApp, uploadSharedDocument } = await import("@/lib/whatsapp-share");
      const html = generatePdfHtml({
        title: "SALES INVOICE",
        documentNumber: order.invoice_number || order.proforma_number,
        date: order.date, partyLabel: "Customer", partyName: custName,
        columns: [
          { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
          { header: "Qty", key: "quantity", align: "right" as const },
          { header: "Rate", key: "rate", align: "right" as const },
          { header: "Amount", key: "amount", align: "right" as const },
        ],
        rows: pfItems.map((i, idx) => ({ ...i, idx: idx + 1, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString() })),
        totals: [{ label: "Total", value: `PKR ${Number(order.total).toLocaleString()}` }],
        settings, template: getTemplate("sales_invoice"),
      });
      pdfLink = await uploadSharedDocument(html, order.invoice_number || order.proforma_number) || undefined;
    } catch (e) { console.error("PDF link error:", e); }

    const { buildSalesInvoiceMessage, openWhatsApp } = await import("@/lib/whatsapp-share");
    const message = buildSalesInvoiceMessage({
      documentNumber: order.invoice_number || order.proforma_number,
      companyName, customerName: custName, customerPhone: custPhone,
      date: order.date,
      items: pfItems.map(i => ({ product_name: i.product_name, quantity: i.quantity, rate: i.rate })),
      total: order.total,
      paymentInstructions: order.payment_instructions || undefined,
      bankDetails, pdfLink,
    });
    openWhatsApp(custPhone, message);
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
      template: getTemplate("sales_invoice"),
    });
    setPdfHtml(html); setPdfTitle(`Sales Invoice — ${order.proforma_number}`); setPdfOpen(true);
  };
  
  // ── RECEIVE PAYMENT ──
  const openPaymentDialog = async (order: SalesOrder) => {
    if (!order.converted_invoice_id) { toast.error("No invoice linked"); return; }
    // Get direct payments already linked to this specific invoice
    const { data: directPayments } = await supabase
      .from("payments")
      .select("amount")
      .eq("invoice_id", order.converted_invoice_id);
    const directPaid = directPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
    const remaining = Math.max(Number(order.total) - directPaid, 0);
    
    setPaymentOrder(order);
    setPaymentAmount(String(remaining));
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
      invoice_id: paymentOrder.converted_invoice_id || null,
    } as any);
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

    // Get agent_id from the proforma
    const { data: pfData } = await supabase.from("proforma_invoices").select("agent_id").eq("id", submitOrder.id).single();
    const orderAgentId = (pfData as any)?.agent_id || null;

    const { data: inv, error: invErr } = await supabase.from("sales_invoices").insert({
      invoice_number: invNumber, customer_id: submitOrder.customer_id,
      date: new Date().toISOString().split("T")[0],
      subtotal: submitOrder.subtotal, gst_amount: submitOrder.gst, total: submitOrder.total, status: "dispatched",
      agent_id: orderAgentId,
    } as any).select("*, customers(name)").single();

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

      setSubmitOpen(false); setSubmitting(false); setPostSubmitOpen(true); load();
  };

  // ── VOID (Rollback) ──
  const promptVoid = (order: SalesOrder) => { setVoidOrder(order); setVoidConfirmOpen(true); };
  const confirmVoid = async () => {
    if (!voidOrder || !voidOrder.converted_invoice_id) return;
    setVoiding(true);
    const invoiceId = voidOrder.converted_invoice_id;
    // 1. Delete stock movements (trigger restores inventory)
    await supabase.from("stock_movements").delete().eq("reference_id", invoiceId);
    // 2. Delete linked payments (trigger reverses customer & bank balances)
    await supabase.from("payments").delete().eq("invoice_id", invoiceId);
    // 3. Delete invoice items
    await supabase.from("sales_invoice_items").delete().eq("invoice_id", invoiceId);
    // 4. Delete invoice (trigger reverses customer balance)
    await supabase.from("sales_invoices").delete().eq("id", invoiceId);
    // 5. Delete delivery note
    await supabase.from("delivery_notes").delete().eq("reference_id", invoiceId);
    // 6. Reset proforma to draft
    await supabase.from("proforma_invoices").update({ status: "draft", converted_invoice_id: null }).eq("id", voidOrder.id);
    toast.success(`Order ${voidOrder.proforma_number} voided — invoice, payments, delivery note & stock reversed`);
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


  const filtered = orders.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.proforma_number.toLowerCase().includes(q) ||
      ((p.customers as any)?.name || "").toLowerCase().includes(q) ||
      (p.invoice_number || "").toLowerCase().includes(q);
     const matchStatus = statusFilter === "all" || p.status === statusFilter ||
      (statusFilter === "invoiced" && (p.status === "invoiced" || p.status === "dispatched" || p.status === "partial" || p.status === "paid"));
    const dateStart = getDateFilter();
    const matchDate = !dateStart || p.date >= dateStart;
    return matchSearch && matchStatus && matchDate;
  });

  // Month selector for stats
  const now = new Date();
  const [statsMonth, setStatsMonth] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const statsMonthLabel = (() => {
    const [y, m] = statsMonth.split("-");
    return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-PK", { month: "long", year: "numeric" });
  })();
  const prevMonth = () => {
    const [y, m] = statsMonth.split("-").map(Number);
    const d = new Date(y, m - 2);
    setStatsMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const nextMonth = () => {
    const [y, m] = statsMonth.split("-").map(Number);
    const d = new Date(y, m);
    setStatsMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const monthOrders = orders.filter(o => o.date.startsWith(statsMonth));
  const draftStats = { count: monthOrders.filter(d => d.status === "draft").length, value: monthOrders.filter(d => d.status === "draft").reduce((s, d) => s + Number(d.total), 0) };
  const invoiceStats = { 
    count: monthOrders.filter(d => d.status !== "draft").length, 
    value: monthOrders.filter(d => d.status !== "draft").reduce((s, d) => s + Number(d.total), 0) 
  };

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const statusColor = (s: string) => {
    if (s === "invoiced") return "bg-blue-500/15 text-blue-600 border-blue-500/20";
    if (s === "dispatched") return "bg-violet-500/15 text-violet-600 border-violet-500/20";
    if (s === "partial") return "bg-orange-500/15 text-orange-600 border-orange-500/20";
    if (s === "paid") return "bg-emerald-500/15 text-emerald-600 border-emerald-500/20";
    if (s === "draft") return "bg-amber-500/15 text-amber-600 border-amber-500/20";
    return "bg-muted text-muted-foreground";
  };
  const statusLabel = (s: string) => ({ draft: "Draft", invoiced: "Invoiced", dispatched: "Dispatched", partial: "Partial", paid: "Paid" }[s] || s);

  const allStats = { count: monthOrders.length, value: monthOrders.reduce((s, d) => s + Number(d.total), 0) };
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
  const productOptions = (allocatedProductIds && allocatedProductIds.length > 0
    ? products.filter(p => allocatedProductIds.includes(p.id))
    : products
  ).map(p => ({ value: p.id, label: p.name }));

  return (
    <AppLayout title="Sales Invoices" subtitle="Create invoices → confirm with batch → auto invoice + delivery note"
      headerActions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:scale-[1.02] transition-all">
              <Plus className="h-4 w-4" /> New Order
            </Button>
          </DialogTrigger>
           <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">Create Sales Invoice</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-3">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Customer *</Label>
                <SearchableSelect options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Select customer..." searchPlaceholder="Search..." />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Sales Agent</Label>
                <SearchableSelect
                  options={agentsList.map(a => ({ value: a.id, label: a.name }))}
                  value={agentId} onChange={setAgentId} placeholder="Auto / Select..."
                />
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
            {/* MONTH SELECTOR */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
                <span className="text-sm font-semibold min-w-[140px] text-center">{statsMonthLabel}</span>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* PREMIUM STATUS BUTTONS */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: "All", ...allStats, secondLine: `PKR ${allStats.value.toLocaleString()}`, icon: FileText, gradient: "from-slate-500/8 to-slate-600/15", iconBg: "from-slate-500 to-slate-600", accent: "from-slate-400 to-slate-600", textColor: "text-foreground", statusKey: "all" },
                { label: "Draft", ...draftStats, secondLine: `PKR ${draftStats.value.toLocaleString()}`, icon: FileEdit, gradient: "from-amber-500/8 to-amber-600/15", iconBg: "from-amber-500 to-amber-600", accent: "from-amber-400 to-amber-600", textColor: "text-amber-600", statusKey: "draft" },
                { label: "Invoice", ...invoiceStats, secondLine: `PKR ${invoiceStats.value.toLocaleString()}`, icon: Send, gradient: "from-blue-500/8 to-blue-600/15", iconBg: "from-blue-500 to-blue-600", accent: "from-blue-400 to-blue-600", textColor: "text-blue-600", statusKey: "invoiced" },
              ].map(s => (
                <button key={s.label} onClick={() => setStatusFilter(s.statusKey)}
                  className={`group relative flex flex-col items-center justify-center h-[90px] sm:h-[120px] rounded-xl sm:rounded-2xl bg-gradient-to-br ${s.gradient} border border-border/50 backdrop-blur-sm hover:scale-[1.03] hover:shadow-lg transition-all duration-300 overflow-hidden ${statusFilter === s.statusKey ? "ring-2 ring-offset-2 ring-primary/40 shadow-lg" : ""}`}>
                  <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br ${s.iconBg} shadow-md flex items-center justify-center mb-1 sm:mb-1.5 group-hover:scale-110 transition-transform duration-300`}>
                    <s.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
                  </div>
                  <span className={`text-base sm:text-lg font-bold font-heading ${s.textColor}`}>{s.count}</span>
                  <span className="text-[8px] sm:text-[9px] font-mono text-muted-foreground">{s.secondLine}</span>
                  <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-muted-foreground">{s.label}</span>
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
                        <TableHead className="font-semibold">Items</TableHead>
                        <TableHead className="font-semibold">Date</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="text-right font-semibold">Total</TableHead>
                        <TableHead className="text-right font-semibold">Balance</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-16">
                            <FilePlus className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                            <p className="text-muted-foreground font-medium">No sales invoices yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Click "New Order" to create your first sales invoice</p>
                          </TableCell>
                        </TableRow>
                      ) : filtered.map(order => {
                        const pfItems = getPfItems(order);
                        const itemNames = pfItems.map(i => i.product_name).filter(Boolean);
                        const itemsDisplay = itemNames.length <= 2 ? itemNames.join(", ") : `${itemNames.slice(0, 2).join(", ")} +${itemNames.length - 2} more`;
                        const isPaid = order.status === "paid";
                        const amtPaid = Number(order.amount_paid || 0);
                        const balance = order.status === "draft" ? null : (isPaid ? 0 : Math.max(Number(order.total) - amtPaid, 0));
                        return (
                        <TableRow key={order.id} className={`group cursor-pointer hover:bg-muted/30 transition-colors ${isPaid ? "bg-emerald-500/5" : ""}`} data-state={selected.has(order.id) ? "selected" : undefined}>
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
                          <TableCell className={`text-right font-mono text-sm ${balance === 0 ? "text-emerald-600 font-semibold" : balance !== null ? "text-orange-600 font-semibold" : "text-muted-foreground"}`}>
                            {balance !== null ? (balance === 0 ? "✓ Paid" : Number(balance).toLocaleString()) : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {/* Primary actions: Submit & Payment */}
                              {order.status === "draft" && (
                                <Button size="sm" onClick={() => openSubmitDialog(order)} className="h-7 text-xs gap-1 bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-sm">
                                  <CheckCircle className="h-3 w-3" /> <span className="hidden sm:inline">Submit</span>
                                </Button>
                              )}
                              {(order.status === "invoiced" || order.status === "dispatched" || order.status === "partial") && order.customer_id && (
                                <Button size="sm" onClick={() => openPaymentDialog(order)} className="h-7 text-xs gap-1 bg-gradient-to-r from-emerald-600 to-green-700 text-white shadow-sm" title="Receive Payment">
                                  <DollarSign className="h-3 w-3" /> <span className="hidden sm:inline">Payment</span>
                                </Button>
                              )}
                              {/* Quick WhatsApp */}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shareWhatsApp(order)} title="Share via WhatsApp">
                                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => openPreview(order)}>
                                    <Eye className="h-3.5 w-3.5 mr-2" /> View PDF
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => shareWhatsApp(order)}>
                                    <MessageCircle className="h-3.5 w-3.5 mr-2 text-emerald-600" /> WhatsApp
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => printOrder(order)}>
                                    <Download className="h-3.5 w-3.5 mr-2" /> Download PDF
                                  </DropdownMenuItem>
                                  {order.converted_invoice_id && (
                                    <DropdownMenuItem onClick={() => printInvoice(order)}>
                                      <FileText className="h-3.5 w-3.5 mr-2" /> Invoice PDF
                                    </DropdownMenuItem>
                                  )}
                                  {order.converted_invoice_id && (
                                    <DropdownMenuItem onClick={() => printDeliveryNote(order)}>
                                      <Truck className="h-3.5 w-3.5 mr-2" /> Delivery Note
                                    </DropdownMenuItem>
                                  )}
                                  {order.status === "draft" && (
                                    <DropdownMenuItem onClick={() => openEditSheet(order)}>
                                      <Pencil className="h-3.5 w-3.5 mr-2" /> Edit
                                    </DropdownMenuItem>
                                  )}
                                  {(order.status === "invoiced" || order.status === "dispatched") && (
                                    <DropdownMenuItem onClick={() => promptVoid(order)} className="text-destructive">
                                      <RotateCcw className="h-3.5 w-3.5 mr-2" /> Void
                                    </DropdownMenuItem>
                                  )}
                                  {order.status === "draft" && (
                                    <DropdownMenuItem onClick={() => promptDelete([order.id])} className="text-destructive">
                                      <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                    <div>
                      <Label className="text-xs font-medium text-muted-foreground">Sales Agent</Label>
                      <SearchableSelect
                        options={agentsList.map(a => ({ value: a.id, label: a.name }))}
                        value={editAgentId} onChange={setEditAgentId} placeholder="Auto / Select..."
                      />
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

      {/* ═══ RECEIVE PAYMENT DIALOG ═══ */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Receive Payment</DialogTitle></DialogHeader>
          {paymentOrder && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/30 border border-border">
                <p className="text-xs text-muted-foreground">Invoice</p>
                <p className="font-semibold text-sm">{paymentOrder.invoice_number || paymentOrder.proforma_number} — {(paymentOrder.customers as any)?.name || "Customer"}</p>
                <p className="text-xs text-muted-foreground mt-1">Total: PKR {Number(paymentOrder.total).toLocaleString()}</p>
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Amount (PKR)</Label>
                <Input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={v => { setPaymentMethod(v); if (v === "cash") setPaymentBankId(""); }}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentMethod !== "cash" && (
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">Receiving Account</Label>
                  <Select value={paymentBankId} onValueChange={setPaymentBankId}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select account..." /></SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.name} ({b.bank_name})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleReceivePayment} disabled={paymentSaving || !paymentAmount} className="w-full h-11 gap-2 bg-gradient-to-r from-emerald-600 to-green-700 text-white">
                {paymentSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                <DollarSign className="h-4 w-4" /> Receive PKR {Number(paymentAmount || 0).toLocaleString()}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
