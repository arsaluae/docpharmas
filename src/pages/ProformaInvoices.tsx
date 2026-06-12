import { useEffect, useState, useCallback } from "react";
import { logAudit } from "@/lib/audit";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { Plus, Search, FilePlus, Trash2, Download, CheckCircle, Pencil, MessageCircle, FileText, Loader2, X, Share2, Eye, FileEdit, Send, Truck, RotateCcw, Banknote, MoreHorizontal, ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { GraceDeleteButton } from "@/components/GraceDeleteButton";
import { generatePdfHtml, generateDocumentViews } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { checkTerritoryLock } from "@/lib/territory";
import { useFreightProviders } from "@/hooks/useFreightProviders";
import { SalesReturnDialog } from "@/components/sales/SalesReturnDialog";
import { useDraftAutosave } from "@/hooks/useDraftAutosave";
import { useTenant } from "@/hooks/useTenant";
import { useIsSalesAgent } from "@/hooks/useIsSalesAgent";

interface Customer { id: string; name: string; company: string | null; phone: string | null; address: string | null; area: string | null; }
interface Product { id: string; name: string; selling_price: number; gst_rate: number; mrp?: number | null; }
interface ProformaItem { product_id: string; product_name: string; quantity: number; rate: number; gst_rate: number; amount: number; last_price?: number | null; discount_pct?: number; mrp?: number; }
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
  invoice_approved_at?: string | null;
}

interface BatchOption { batch_number: string; available: number; expiry_date?: string | null; }

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtExpiry = (iso?: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
};
const daysUntil = (iso?: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

export default function ProformaInvoices() {
 const navigate = useNavigate();
 const isSalesAgent = useIsSalesAgent();
 const [searchParams] = useSearchParams();
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
 const [pdfOpts, setPdfOpts] = useState<any | null>(null);
 const [pdfViews, setPdfViews] = useState<{ key: string; label: string; color: string; html: string; disabled?: boolean }[] | undefined>(undefined);
 const [pdfDefaultView, setPdfDefaultView] = useState<string | undefined>(undefined);



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

  // Draft autosave for the Create Sales Order form
  const { tenantId } = useTenant();
  const draftKey = `sales-order:${tenantId ?? "anon"}`;
  const { existingDraft, save: saveDraft, clear: clearDraft } = useDraftAutosave<{
    customerId: string; pfDate: string; validityDays: string;
    paymentInstructions: string; agentId: string; items: ProformaItem[];
  }>({ key: draftKey, enabled: createOpen });
  const [draftDismissed, setDraftDismissed] = useState(false);

  // Extended customer details fetched on selection (for the composer summary panel)
  const [customerDetail, setCustomerDetail] = useState<{
    name: string; company: string | null; city: string | null; address: string | null;
    phone: string | null; ntn: string | null; balance: number; credit_limit: number;
  } | null>(null);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [createAndPrint, setCreateAndPrint] = useState(false);

  useEffect(() => {
    if (!customerId) { setCustomerDetail(null); return; }
    (async () => {
      const { data } = await supabase
        .from("customers")
        .select("name, company, city, address, phone, ntn, balance, credit_limit")
        .eq("id", customerId)
        .single();
      if (data) setCustomerDetail({
        name: data.name, company: data.company, city: data.city, address: data.address,
        phone: data.phone, ntn: data.ntn,
        balance: Number(data.balance || 0), credit_limit: Number(data.credit_limit || 0),
      });
    })();
  }, [customerId]);

  const composerDirty = !!customerId || items.some(i => !!i.product_id || Number(i.quantity) > 0 || Number(i.rate) > 0) || !!paymentInstructions;
  const requestCloseComposer = () => {
    if (composerDirty) setCloseConfirmOpen(true);
    else setCreateOpen(false);
  };
  const confirmDiscardAndClose = () => {
    clearDraft();
    setCustomerId(""); setItems([]); setPaymentInstructions(""); setAgentId("");
    setCloseConfirmOpen(false); setCreateOpen(false);
  };

  // Alt+N inside composer to add a new line
  useEffect(() => {
    if (!createOpen) return;
    const h = (e: KeyboardEvent) => { if (e.altKey && (e.key === "n" || e.key === "N")) { e.preventDefault(); addItem(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [createOpen]);

  // Persist on field change (debounced inside the hook)
  useEffect(() => {
    if (!createOpen) return;
    const hasContent = !!customerId || items.length > 0 || !!paymentInstructions;
    if (!hasContent) return;
    saveDraft({ customerId, pfDate, validityDays, paymentInstructions, agentId, items });
  }, [createOpen, customerId, pfDate, validityDays, paymentInstructions, agentId, items, saveDraft]);

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

 // Freight + Return
 const { providers: freightProviders } = useFreightProviders(false);
 const [freightProviderId, setFreightProviderId] = useState<string>("");
 const [returnOpen, setReturnOpen] = useState(false);
 const [returnOrder, setReturnOrder] = useState<SalesOrder | null>(null);

 const { settings } = useCompanySettings();
 const { getTemplate } = useDocumentTemplates();

 useEffect(() => {
 const check = async () => {
 const { data: { session } } = await supabase.auth.getSession();
 if (!session) navigate("/dashboard");
 };
 check(); load(); loadBankAccounts();
 }, [navigate]);

 // Auto-fill search from ?open=<invoice_number>
 useEffect(() => {
 const open = searchParams.get("open");
 if (open) setSearch(open);
 }, [searchParams]);


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
 let pfQuery = supabase.from("proforma_invoices").select("*, customers(customer_code, name, company, phone, sms_mobile, address, city, area, old_erp_account_code)", { count: "exact" }).order("created_at", { ascending: false });
 if (statusFilter !== "all") {
 if (statusFilter === "draft") pfQuery = pfQuery.eq("status", "draft");
 else pfQuery = pfQuery.neq("status", "draft"); // simplified for server-side
 }
 pfQuery = pfQuery.range(pagination.from, pagination.to);
 // Sales agents cannot read the products base table (cost columns hidden by RLS).
 // Use the cost-free agent_stock_availability view instead — same live data, no cost exposure.
 const prodQuery = isSalesAgent
   ? supabase.from("agent_stock_availability").select("product_id, name, selling_price, gst_rate, mrp")
   : supabase.from("products").select("id, name, selling_price, gst_rate, mrp").eq("is_active", true);
 const [pf, cust, prod, agentsRes] = await Promise.all([
 pfQuery,
 supabase.from("customers").select("id, name, company, phone, address, area").eq("is_active", true),
 prodQuery,
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
      const { data: invs } = await supabase.from("sales_invoices").select("id, invoice_number, status, amount_paid, approved_at").in("id", invoicedIds);
      if (invs) {
        const approvedAtMap: Record<string, string | null> = {};
        invs.forEach((inv: any) => { 
          invoiceMap[inv.id] = inv.invoice_number;
          amountPaidMap[inv.id] = Number(inv.amount_paid || 0);
          approvedAtMap[inv.id] = inv.approved_at || null;
        });
        const statusMap: Record<string, string> = {};
        invs.forEach((inv: any) => { statusMap[inv.id] = inv.status; });
        pf.data.forEach((p: any) => {
          if (p.converted_invoice_id) {
            p.invoice_approved_at = approvedAtMap[p.converted_invoice_id] ?? null;
          }
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
 if (prod.data) setProducts((prod.data as any[]).map((p: any) => ({ id: p.id ?? p.product_id, name: p.name, selling_price: p.selling_price, gst_rate: p.gst_rate, mrp: p.mrp })));
 setLoading(false);
 };

 const [showAllProducts, setShowAllProducts] = useState(false);
 // Load relevant products (allocations + past sales history) + auto-select agent when customer changes
 useEffect(() => {
 if (!customerId) { setAllocatedProductIds(null); setAgentId(""); setShowAllProducts(false); return; }
 (async () => {
 const { getCustomerProductIds } = await import("@/lib/party-products");
 const [historyIds, agentRes] = await Promise.all([
 getCustomerProductIds(customerId),
 supabase.from("agent_customers").select("agent_id").eq("customer_id", customerId).limit(1),
 ]);
 setAllocatedProductIds(historyIds.size > 0 ? Array.from(historyIds) : null);
 if (agentRes.data && agentRes.data.length > 0) setAgentId(agentRes.data[0].agent_id);
 else setAgentId("");
 })();
 }, [customerId]);

 // ── ITEMS HELPERS ──
 const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: settings?.gst_enabled ? Number(settings.default_gst_rate) : 0, amount: 0, discount_pct: 0, mrp: 0 }]);
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
 if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = settings?.gst_enabled ? Number(p.gst_rate) : 0; u[idx].mrp = Number(p.mrp || 0); }
 // ── Territory exclusivity hard-block ──
 if (value && customerId) {
 const conflict = await checkTerritoryLock(value, customerId);
 if (conflict) {
 toast.error(
 `🚫 Territory locked: "${p?.name || "This product"}" is exclusively allocated to ${conflict.locked_to_customer_name} in ${conflict.city}.`,
 { duration: 7000 }
 );
 u[idx].product_id = "";
 u[idx].product_name = "";
 u[idx].rate = 0;
 setItems([...u]);
 return;
 }
 }
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
 const { data: custData } = await supabase.from("customers").select("balance, credit_limit").eq("id", customerId).single();
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
 toast.success(`Sales Order ${pfNumber} created`);
 clearDraft(); setCreateOpen(false); setCustomerId(""); setItems([]); setPaymentInstructions(""); setAgentId(""); load();
 } catch (err: any) {
 console.error("Unexpected error creating sales order:", err);
 toast.error("Unexpected error: " + (err?.message || "Please try again"));
 } finally {
 setSaving(false);
 }
 };

 // ── PREVIEW with template switcher (Sales Order / Invoice / Delivery Note × A4/WhatsApp) ──
 const openPreview = async (order: SalesOrder, preferredView?: "sales_order" | "sales_invoice" | "delivery_note") => {
   const orderBuilt = buildSalesOrderHtml(order);
   const invoiceBuilt = order.converted_invoice_id ? await buildSalesInvoiceHtml(order) : "";
   const dnBuilt = order.converted_invoice_id ? await buildDeliveryNoteHtml(order) : "";
   const hasInvoice = !!invoiceBuilt;
   const hasDn = !!dnBuilt;
   const views = [
     { key: "sales_order",      label: "Sales Order",     color: "bg-amber-500 text-white border-amber-500",   html: orderBuilt.html },
     { key: "sales_invoice",    label: "Sales Invoice",   color: "bg-blue-600 text-white border-blue-600",     html: hasInvoice ? (invoiceBuilt as any).html : "", disabled: !hasInvoice },
     { key: "delivery_note",    label: "Delivery Note",   color: "bg-violet-600 text-white border-violet-600", html: hasDn ? (dnBuilt as any).html : "", disabled: !hasDn },
   ];
   const def = preferredView && views.find(v => v.key === preferredView && !v.disabled)
     ? preferredView
     : (hasInvoice ? "sales_invoice" : "sales_order");
   setPdfViews(views);
   setPdfDefaultView(def);
   setPdfTitle(`${order.invoice_number || order.proforma_number} — ${(order.customers as any)?.name || ""}`);
   setPdfHtml("");
   setPdfOpen(true);
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
 if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.selling_price); u[idx].gst_rate = settings?.gst_enabled ? Number(p.gst_rate) : 0; u[idx].mrp = Number(p.mrp || 0); }
 if (editCustomerId && value) {
 const lastRate = await lookupLastPrice(value, editCustomerId);
 u[idx].last_price = lastRate;
 if (lastRate !== null) u[idx].rate = lastRate;
 }
 }
 const lineGross = Number(u[idx].quantity) * Number(u[idx].rate);
 const discPct = Number(u[idx].discount_pct || 0);
 const lineAfterDisc = lineGross - (lineGross * discPct / 100);
 u[idx].amount = lineAfterDisc + (settings?.gst_enabled ? (lineAfterDisc * Number(u[idx].gst_rate) / 100) : 0);
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
 const { uploadSharedDocument } = await import("@/lib/whatsapp-share");
 const __opts_html = ({
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
 } as any);
 const html = generatePdfHtml(__opts_html);
 setPdfOpts(__opts_html);
 pdfLink = await uploadSharedDocument(html, order.invoice_number || order.proforma_number) || undefined;
 } catch (e) { console.error("PDF link error:", e); }

  const { sendWhatsAppDoc } = await import("@/lib/whatsapp-templates");
  await sendWhatsAppDoc({
    documentType: order.invoice_number ? "sales_invoice" : "sales_order",
    phone: custPhone,
    vars: {
      company_name: companyName,
      company_phone: settings?.phone || "",
      company_email: settings?.email || "",
      company_address: settings?.address || "",
      customer_name: custName,
      customer_code: cust?.customer_code || "",
      customer_phone: custPhone,
      customer_city: cust?.city || "",
      customer_address: cust?.address || "",
      document_type: order.invoice_number ? "Sales Invoice" : "Sales Order",
      document_number: order.invoice_number || order.proforma_number,
      document_date: order.date,
      validity_days: (order as any).validity_days ?? "",
      document_total: Number(order.total).toLocaleString(),
      document_status: order.status || "",
      document_link: pdfLink || "",
    },
  });
 };

 // ── HTML BUILDERS (return string; preview wires them through PdfPreviewDialog views) ──
 const buildSalesOrderHtml = (order: SalesOrder): { html: string; opts: any } => {
   const pfItems = getPfItems(order);
   const c = (order.customers as any) || {};
   { const __o = ({
     title: "SALES ORDER", documentNumber: order.proforma_number, date: order.date, statusTheme: "draft" as const,
     partyLabel: "Customer",
     partyName: c.name || "—",
     partyCode: c.customer_code || undefined,
     partyMobile: c.sms_mobile || undefined,
     partyPhone: c.phone || undefined,
     partyCity: c.city || undefined,
     partyArea: c.area || undefined,
     partyAddress: c.address || undefined,
     partyAccountCode: c.old_erp_account_code || undefined,
     validity: `Valid for ${order.validity_days} days`,
     paymentTerms: order.payment_instructions || undefined,
      columns: [
        { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
        { header: "MRP", key: "mrp", align: "right" },
        { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
        { header: "Disc%", key: "discount_pct", align: "right" },
        ...(settings?.gst_enabled ? [{ header: "GST%", key: "gst_rate", align: "right" as const }] : []),
        { header: "Amount", key: "amount", align: "right" },
      ],
      rows: pfItems.map((i: any, idx: number) => {
        const catalogMrp = Number(products.find(p => p.id === i.product_id)?.mrp || 0);
        const mrpVal = Number(i.mrp || catalogMrp || 0);
        return { ...i, idx: idx + 1, mrp: mrpVal > 0 ? mrpVal.toLocaleString() : "—", rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(), discount_pct: Number(i.discount_pct || 0) };
      }),
     totals: [
       { label: "Subtotal", value: `PKR ${Number(order.subtotal).toLocaleString()}` },
       ...(settings?.gst_enabled ? [{ label: "GST", value: `PKR ${Number(order.gst).toLocaleString()}` }] : []),
       { label: "Total", value: `PKR ${Number(order.total).toLocaleString()}` },
     ],
     notes: order.payment_instructions || undefined, settings,
     template: { ...(getTemplate("sales_invoice") as any), title: "Sales Order" } as any,
   } as any); return { html: generatePdfHtml(__o), opts: __o }; }
 };
 const printOrder = (order: SalesOrder) => { openPreview(order, "sales_order"); };
 
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

  const buildSalesInvoiceHtml = async (order: SalesOrder): Promise<{ html: string; opts: any } | ""> => {
    if (!order.converted_invoice_id) return "";
    const { data: inv } = await supabase.from("sales_invoices").select("*, customers(customer_code, name, address, phone, sms_mobile, city, area, old_erp_account_code)").eq("id", order.converted_invoice_id).single();
     const { data: invItems } = await supabase.from("sales_invoice_items").select("*, products(name, mrp, selling_price)").eq("invoice_id", order.converted_invoice_id);
     if (!inv) return "";
    // Fallback: backfill missing expiry_date from GRN in one batched query (older rows).
    const items = invItems || [];
    const missing = items.filter((i: any) => !i.expiry_date && i.product_id && i.batch_number);
    const expiryMap: Record<string, string> = {};
    if (missing.length > 0) {
      const { data: grnRows } = await supabase
        .from("grn_items")
        .select("product_id, batch_number, expiry_date")
        .in("product_id", Array.from(new Set(missing.map((m: any) => m.product_id))))
        .in("batch_number", Array.from(new Set(missing.map((m: any) => m.batch_number))));
      (grnRows || []).forEach((g: any) => {
        if (g.expiry_date) expiryMap[`${g.product_id}__${g.batch_number}`] = g.expiry_date;
      });
    }
    { const __c = (inv.customers as any) || {};
      const __o = ({
      title: "SALES INVOICE", documentNumber: inv.invoice_number, date: inv.date, statusTheme: "invoiced" as const,
      partyLabel: "Customer",
      partyName: __c.name || "—",
      partyCode: __c.customer_code || undefined,
      partyMobile: __c.sms_mobile || undefined,
      partyPhone: __c.phone || undefined,
      partyCity: __c.city || undefined,
      partyArea: __c.area || undefined,
      partyAddress: __c.address || undefined,
      partyAccountCode: __c.old_erp_account_code || undefined,
      paymentTerms: (inv as any).payment_terms || undefined,
      columns: [
        { header: "#", key: "idx" },
        { header: "Product", key: "name" },
        { header: "Batch #", key: "batch_number" },
        { header: "Expiry", key: "expiry_date" },
        { header: "MRP", key: "mrp", align: "right" },
        { header: "Qty", key: "quantity", align: "right" },
        { header: "Rate", key: "rate", align: "right" },
        { header: "Amount", key: "amount", align: "right" },
      ],
      rows: items.map((i: any, idx: number) => {
        const exp = i.expiry_date || expiryMap[`${i.product_id}__${i.batch_number}`] || null;
        const mrp = Number(i.products?.mrp || 0);
        return {
          idx: idx + 1, name: i.products?.name || "Item",
          batch_number: i.batch_number || "—",
          expiry_date: fmtExpiry(exp),
          mrp: mrp > 0 ? mrp.toLocaleString() : "—",
          quantity: i.quantity, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
        };
      }),
      totals: [
        { label: "Subtotal", value: `PKR ${Number(inv.subtotal).toLocaleString()}` },
        { label: "GST", value: `PKR ${Number(inv.gst_amount).toLocaleString()}` },
        { label: "Total", value: `PKR ${Number(inv.total).toLocaleString()}` },
      ],
      settings, template: getTemplate("sales_invoice"),
    } as any); return { html: generatePdfHtml(__o), opts: __o }; }
  };
 const printInvoice = async (order: SalesOrder) => { await openPreview(order, "sales_invoice"); };

 // ── DELIVERY NOTE PDF ──
  const buildDeliveryNoteHtml = async (order: SalesOrder): Promise<{ html: string; opts: any } | ""> => {
    const invoiceId = order.converted_invoice_id;
    if (!invoiceId) return "";
    const { data: dn } = await supabase.from("delivery_notes").select("*").eq("reference_id", invoiceId).maybeSingle();
    if (!dn) return "";
    const dnItems: any[] = typeof dn.items === "string" ? JSON.parse(dn.items) : (dn.items as any[]);
    const c = (order.customers as any) || {};

    // Batch fetch MRP for each product, and expiry fallback for items missing it.
    const productIds = Array.from(new Set(dnItems.map((i: any) => i.product_id).filter(Boolean)));
    const mrpMap: Record<string, number> = {};
    if (productIds.length > 0) {
       const { data: pr } = await supabase.from("products").select("id, mrp, selling_price").in("id", productIds);
       (pr || []).forEach((p: any) => { mrpMap[p.id] = Number(p.mrp || 0); });
    }
    const missing = dnItems.filter((i: any) => !i.expiry_date && i.product_id && i.batch_number);
    const expiryMap: Record<string, string> = {};
    if (missing.length > 0) {
      const { data: grnRows } = await supabase
        .from("grn_items")
        .select("product_id, batch_number, expiry_date")
        .in("product_id", Array.from(new Set(missing.map((m: any) => m.product_id))))
        .in("batch_number", Array.from(new Set(missing.map((m: any) => m.batch_number))));
      (grnRows || []).forEach((g: any) => {
        if (g.expiry_date) expiryMap[`${g.product_id}__${g.batch_number}`] = g.expiry_date;
      });
    }

    { const __o = ({
      title: "DELIVERY NOTE", documentNumber: dn.dn_number, date: dn.date, statusTheme: "dispatched" as const,
      partyLabel: "Customer",
      partyName: c.name || "—",
      partyCode: c.customer_code || undefined,
      partyMobile: c.sms_mobile || undefined,
      partyPhone: c.phone || undefined,
      partyCity: c.city || undefined,
      partyArea: c.area || undefined,
      partyAddress: c.address || undefined,
      partyAccountCode: c.old_erp_account_code || undefined,
      deliveryStatus: dn.status,
      columns: [
        { header: "#", key: "idx" },
        { header: "Product", key: "product_name" },
        { header: "Batch #", key: "batch_number" },
        { header: "Expiry", key: "expiry_date" },
        { header: "MRP", key: "mrp", align: "right" },
        { header: "Qty", key: "quantity", align: "right" },
      ],
      rows: dnItems.map((i: any, idx: number) => {
        const exp = i.expiry_date || expiryMap[`${i.product_id}__${i.batch_number}`] || null;
        const mrp = mrpMap[i.product_id] || 0;
        return {
          idx: idx + 1,
          product_name: i.product_name || "Item",
          batch_number: i.batch_number || "—",
          expiry_date: fmtExpiry(exp),
          mrp: mrp > 0 ? mrp.toLocaleString() : "—",
          quantity: i.quantity,
        };
      }),
      totals: [],
      settings, template: getTemplate("delivery_note"),
    } as any); return { html: generatePdfHtml(__o), opts: __o }; }
  };
 const printDeliveryNote = async (order: SalesOrder) => { await openPreview(order, "delivery_note"); };

 // ── SUBMIT (Convert to Invoice) ──
 const openSubmitDialog = async (order: SalesOrder) => {
 setSubmitOrder(order);
 setFreightProviderId(""); // reset courier selection each time
 const pfItems: ProformaItem[] = typeof order.items === "string" ? JSON.parse(order.items) : order.items;
 const productIds = pfItems.filter(i => i.product_id).map(i => i.product_id);
 const batches: Record<string, BatchOption[]> = {};

 if (productIds.length > 0) {
 // Pull stock movements
 const { data: movements } = await supabase.from("stock_movements").select("product_id, batch_number, quantity, movement_type, date").in("product_id", productIds);
 // Pull expiry dates from GRN items in one shot
 const { data: grnRows } = await supabase.from("grn_items").select("product_id, batch_number, expiry_date").in("product_id", productIds);
 const expiryMap: Record<string, string> = {};
 (grnRows || []).forEach((g: any) => {
 if (g.batch_number && g.expiry_date) expiryMap[`${g.product_id}__${g.batch_number}`] = g.expiry_date;
 });

 if (movements) {
 const batchMap: Record<string, { qty: number }> = {};
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
 if (info.qty > 0 && batch !== "no-batch") {
 batches[pid].push({ batch_number: batch, available: info.qty, expiry_date: expiryMap[`${pid}__${batch}`] || null });
 }
 }
 // Sort FEFO (earliest expiry first)
 for (const pid of Object.keys(batches)) {
 batches[pid].sort((a, b) => {
 if (!a.expiry_date) return 1;
 if (!b.expiry_date) return -1;
 return a.expiry_date.localeCompare(b.expiry_date);
 });
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
 // Validate all items have batch + a resolvable expiry
 const expiryFor = (productId: string, batchNo: string) =>
   batchOptions[productId]?.find(b => b.batch_number === batchNo)?.expiry_date || null;
 if (submitItems.some(i => i.product_id && !i.batch_number)) {
 toast.error("Every item must have a batch number selected"); return;
 }
 if (submitItems.some(i => i.product_id && i.batch_number && !expiryFor(i.product_id, i.batch_number))) {
 toast.error("Selected batch has no expiry date on record. Open the batch in Products and add one before invoicing."); return;
 }
 setSubmitting(true);

 // Idempotency key — prevents duplicate invoice if user double-clicks (DB-level guard).
 const idempotencyKey = (crypto as any)?.randomUUID?.() || `${submitOrder.id}-${Date.now()}`;

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
 idempotency_key: idempotencyKey,
 } as any).select("*, customers(name)").single();

  if (invErr || !inv) { toast.error("Failed to create invoice: " + (invErr?.message || "Unknown error")); setSubmitting(false); return; }
  logAudit({ action: "invoice_generated", entity_type: "sales_invoice", entity_id: inv.id, entity_number: invNumber, changes: { from_order: submitOrder.proforma_number, total: submitOrder.total } });
 const lineItems = submitItems.map((i: any) => ({
 invoice_id: inv.id, product_id: i.product_id || null,
 quantity: Number(i.convert_quantity), rate: Number(i.rate), gst_rate: Number(i.gst_rate),
 amount: i.amount,
 batch_number: i.batch_number || null,
 expiry_date: i.product_id && i.batch_number ? expiryFor(i.product_id, i.batch_number) : null,
 }));
 const { error: itemsErr } = await supabase.from("sales_invoice_items").insert(lineItems);
 if (itemsErr) {
 // Rollback: remove the orphan invoice header so no data is left in an inconsistent state
 await supabase.from("sales_invoices").delete().eq("id", inv.id);
 toast.error("Failed to save invoice items — rolled back: " + itemsErr.message);
 setSubmitting(false); return;
 }


 // Stock movements (single source of truth for inventory — no duplicate trigger)
 for (const item of submitItems) {
 if (item.product_id && Number(item.convert_quantity) > 0) {
 const { error: smErr } = await supabase.from("stock_movements").insert({
 product_id: item.product_id, quantity: Number(item.convert_quantity),
 movement_type: "sale_out", batch_number: item.batch_number || null,
 reference_type: "sales_invoice", reference_id: inv.id, notes: `Invoice ${invNumber}`,
 });
 if (smErr) {
 const friendly = smErr.message?.includes("Insufficient stock")
 ? `Insufficient stock for ${item.product_name || "item"} (requested ${item.convert_quantity}). Adjust quantity or pick a different batch.`
 : "Stock movement failed: " + smErr.message;
 toast.error(friendly);
 }
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
 freight_provider_id: freightProviderId || null,
 delivery_type_label: freightProviders.find(p => p.id === freightProviderId)?.name || null,
 } as any);
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
  logAudit({ action: "voided", entity_type: "sales_invoice", entity_id: invoiceId, entity_number: voidOrder.proforma_number, changes: { reason: "void from order page" } });
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
 if (s === "invoiced") return "bg-primary/15 text-primary border-border";
 if (s === "dispatched") return "bg-primary/15 text-primary border-border";
 if (s === "partial") return "bg-warning/15 text-warning border-border";
 if (s === "paid") return "bg-success/15 text-success border-border";
 if (s === "draft") return "bg-warning/15 text-warning border-border";
 return "bg-muted text-muted-foreground";
 };
 const statusLabel = (s: string) => ({ draft: "Draft", invoiced: "Invoiced", dispatched: "Dispatched", partial: "Partial", paid: "Paid" }[s] || s);

 const allStats = { count: monthOrders.length, value: monthOrders.reduce((s, d) => s + Number(d.total), 0) };
 const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
 const productOptions = (!showAllProducts && allocatedProductIds && allocatedProductIds.length > 0
 ? products.filter(p => allocatedProductIds.includes(p.id))
 : products
 ).map(p => ({ value: p.id, label: p.name }));
 const productFilterActive = !showAllProducts && allocatedProductIds && allocatedProductIds.length > 0;

 return (
 <AppLayout title="Sales Orders" subtitle="Create order → assign batches → auto-generate Invoice + Delivery Note"
  headerActions={
  <>
   <Dialog open={createOpen} onOpenChange={(o) => { if (!o) requestCloseComposer(); else setCreateOpen(true); }}>
  <DialogTrigger asChild>
  <Button className="gap-2 shadow-blue-500/25 transition-all">
  <Plus className="h-4 w-4" /> Create Sales Order
  </Button>
  </DialogTrigger>
  <DialogContent
    className="w-[95vw] max-w-[1400px] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden sm:rounded-lg"
  >
    {/* STICKY HEADER */}
    <DialogHeader className="px-6 py-4 border-b border-border bg-card flex-row items-center justify-between space-y-0 shrink-0">
      <div>
        <DialogTitle className="font-heading text-[24px] leading-tight">Create Sales Order</DialogTitle>
        <p className="text-[13px] text-muted-foreground mt-0.5">Pharma distribution · Number auto-assigned on save · <kbd className="px-1.5 py-0.5 rounded border border-border text-[11px] font-mono">Alt + N</kbd> add line</p>
      </div>
      <div className="flex items-center gap-2 pr-8">
        {customerDetail && customerDetail.credit_limit > 0 && (customerDetail.balance + total) > customerDetail.credit_limit && (
          <Badge variant="destructive" className="text-[11px]">Credit limit exceeded</Badge>
        )}
      </div>
    </DialogHeader>

    {/* BODY: scrollable; two columns on lg+ */}
    <div className="flex-1 overflow-y-auto px-6 py-5">
      {existingDraft && !draftDismissed && items.length === 0 && !customerId && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded border border-border bg-foreground/[0.03] px-3 py-2 text-[12px]">
          <span className="text-muted-foreground">
            Unsaved draft · saved {new Date(existingDraft.savedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]"
              onClick={() => {
                const d = existingDraft.data;
                setCustomerId(d.customerId || "");
                setPfDate(d.pfDate || new Date().toISOString().split("T")[0]);
                setValidityDays(d.validityDays || "30");
                setPaymentInstructions(d.paymentInstructions || "");
                setAgentId(d.agentId || "");
                setItems(d.items || []);
                setDraftDismissed(true);
              }}>Restore</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]"
              onClick={() => { clearDraft(); setDraftDismissed(true); }}>Discard</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6 min-w-0">
          {/* CUSTOMER SECTION */}
          <section>
            <h3 className="text-[18px] font-semibold mb-3 text-foreground">Customer & Order Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="xl:col-span-2">
                <Label className="text-[14px] font-medium text-foreground">Customer <span className="text-destructive">*</span></Label>
                <div className="mt-1.5">
                  <SearchableSelect options={customerOptions} value={customerId} onChange={setCustomerId} placeholder={loading ? "Loading customers…" : (customers.length === 0 ? "No customers available" : "Search by name, company, city…")} searchPlaceholder="Search customers…" emptyMessage={loading ? "Loading…" : "No customers assigned to you. Ask your admin to assign customers in Settings → Sales Agent Scope."} triggerClassName="h-11 text-[15px]" />
                </div>
                {!loading && customers.length === 0 && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">No customers visible. If you're a sales agent, ask your admin to assign customers (Settings → Sales Agent Scope).</p>
                )}
              </div>
              <div>
                <Label className="text-[14px] font-medium text-foreground">Sales Agent</Label>
                <div className="mt-1.5">
                  <SearchableSelect
                    options={agentsList.map(a => ({ value: a.id, label: a.name }))}
                    value={agentId} onChange={setAgentId} placeholder="Auto / Select…"
                    triggerClassName="h-11 text-[15px]"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[14px] font-medium text-foreground">Order Date</Label>
                <Input type="date" value={pfDate} onChange={e => setPfDate(e.target.value)} className="mt-1.5 h-11 text-[15px]" />
              </div>
              <div>
                <Label className="text-[14px] font-medium text-foreground">Validity (days)</Label>
                <Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} className="mt-1.5 h-11 text-[15px]" />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <Label className="text-[14px] font-medium text-foreground">Payment Instructions</Label>
                <Textarea value={paymentInstructions} onChange={e => setPaymentInstructions(e.target.value)} placeholder="Bank details, payment terms, special notes…" rows={2} className="mt-1.5 text-[15px]" />
              </div>
            </div>

            {/* Customer Summary Card — visible on selection */}
            {customerDetail && (
              <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-foreground">{customerDetail.company || customerDetail.name}</div>
                    {customerDetail.company && <div className="text-[13px] text-muted-foreground">{customerDetail.name}</div>}
                    <div className="text-[13px] text-muted-foreground mt-1">
                      {[customerDetail.city, customerDetail.address].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="text-[13px] text-muted-foreground">
                      {customerDetail.phone ? `Tel: ${customerDetail.phone}` : ""}
                      {customerDetail.ntn ? `   ·   NTN: ${customerDetail.ntn}` : ""}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-right shrink-0">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Previous Balance</div>
                      <div className="text-[15px] font-mono font-semibold tabular-nums">PKR {customerDetail.balance.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Credit Limit</div>
                      <div className="text-[15px] font-mono font-semibold tabular-nums">{customerDetail.credit_limit > 0 ? `PKR ${customerDetail.credit_limit.toLocaleString()}` : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Available</div>
                      <div className={`text-[15px] font-mono font-semibold tabular-nums ${customerDetail.credit_limit > 0 && (customerDetail.balance + total) > customerDetail.credit_limit ? "text-destructive" : "text-success"}`}>
                        {customerDetail.credit_limit > 0 ? `PKR ${Math.max(0, customerDetail.credit_limit - customerDetail.balance - total).toLocaleString()}` : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ITEMS SECTION */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[18px] font-semibold text-foreground">
                Items
                {productFilterActive && <span className="text-[12px] text-muted-foreground font-normal ml-2">(showing products this customer buys)</span>}
              </h3>
              <div className="flex items-center gap-2">
                {allocatedProductIds && allocatedProductIds.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" className="text-[12px] h-8" onClick={() => setShowAllProducts(s => !s)}>
                    {showAllProducts ? "Filter to customer" : "Show all products"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-[13px] h-8"><Plus className="h-3.5 w-3.5" /> Add Item</Button>
              </div>
            </div>

            {/* DESKTOP TABLE */}
            <div className="hidden md:block rounded-lg border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <div className="min-w-[1000px]">
                  <div className="grid grid-cols-[32px_minmax(260px,1fr)_100px_80px_100px_80px_80px_140px_40px] gap-2 px-3 py-2 bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border">
                    <div>#</div>
                    <div>Product</div>
                    <div className="text-right">MRP</div>
                    <div className="text-right">Qty</div>
                    <div className="text-right">Rate</div>
                    <div className="text-right">Disc %</div>
                    {settings?.gst_enabled ? <div className="text-right">GST %</div> : <div />}
                    <div className="text-right">Line Total</div>
                    <div />
                  </div>
                  {items.length === 0 ? (
                    <div className="px-3 py-10 text-center text-[14px] text-muted-foreground">No items yet — click "Add Item" or press <kbd className="px-1.5 py-0.5 rounded border border-border text-[11px] font-mono">Alt + N</kbd></div>
                  ) : items.map((item, idx) => {
                    const catalogMrp = Number(products.find(p => p.id === item.product_id)?.mrp || 0);
                    const effectiveMrp = Number(item.mrp || catalogMrp || 0);
                    const aboveMrp = effectiveMrp > 0 && Number(item.rate) > effectiveMrp;
                    return (
                    <div key={idx} className="grid grid-cols-[32px_minmax(260px,1fr)_100px_80px_100px_80px_80px_140px_40px] gap-2 px-3 py-2 items-center border-t border-border/60 hover:bg-muted/20">
                      <div className="text-[12px] font-mono text-muted-foreground">{idx + 1}</div>
                      <div className="min-w-0">
                        <SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Search by name, code, supplier…" triggerClassName="h-9 text-[14px]" />
                        {item.last_price !== undefined && item.last_price !== null && (
                          <div className="text-[11px] text-success mt-0.5 ml-1">Last: PKR {Number(item.last_price).toLocaleString()}</div>
                        )}
                      </div>
                      <div>
                        <Input type="number" value={item.mrp ?? ""} onChange={e => updateItem(idx, "mrp", e.target.value)} className="h-9 text-right text-[14px] font-mono tabular-nums" placeholder={catalogMrp ? String(catalogMrp) : "0"} />
                      </div>
                      <div>
                        <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="h-9 text-right text-[14px] font-mono tabular-nums" placeholder="0" />
                      </div>
                      <div>
                        <Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className={`h-9 text-right text-[14px] font-mono tabular-nums ${aboveMrp ? "border-warning text-warning" : ""}`} placeholder="0.00" />
                        {aboveMrp && <div className="text-[10px] text-warning mt-0.5 text-right">Above MRP</div>}
                      </div>
                      <div>
                        <Input type="number" value={item.discount_pct || 0} onChange={e => updateItem(idx, "discount_pct", e.target.value)} className="h-9 text-right text-[14px] font-mono tabular-nums" placeholder="0" />
                      </div>
                      {settings?.gst_enabled ? (
                        <div>
                          <Input type="number" value={item.gst_rate} onChange={e => updateItem(idx, "gst_rate", e.target.value)} className="h-9 text-right text-[14px] font-mono tabular-nums" placeholder="17" />
                        </div>
                      ) : <div />}
                      <div className="text-right text-[15px] font-mono font-semibold text-foreground tabular-nums">
                        {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                      </div>
                      <div className="flex justify-end">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label="Remove">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );})}
                </div>
              </div>
            </div>


            {/* MOBILE CARDS */}
            <div className="md:hidden space-y-3">
              {items.length === 0 ? (
                <div className="rounded-lg border border-border px-3 py-8 text-center text-[14px] text-muted-foreground">No items yet</div>
              ) : items.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-mono text-muted-foreground">Line #{idx + 1}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label="Remove">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Product…" triggerClassName="h-10 text-[14px]" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">MRP</Label>
                      <Input type="number" value={item.mrp ?? ""} onChange={e => updateItem(idx, "mrp", e.target.value)} className="h-10 text-right text-[15px] font-mono" placeholder="MRP" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Qty</Label>
                      <Input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="h-10 text-right text-[15px] font-mono" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Rate</Label>
                      <Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="h-10 text-right text-[15px] font-mono" />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Disc %</Label>
                      <Input type="number" value={item.discount_pct || 0} onChange={e => updateItem(idx, "discount_pct", e.target.value)} className="h-10 text-right text-[15px] font-mono" />
                    </div>
                    {settings?.gst_enabled && (
                      <div>
                        <Label className="text-[11px] text-muted-foreground">GST %</Label>
                        <Input type="number" value={item.gst_rate} onChange={e => updateItem(idx, "gst_rate", e.target.value)} className="h-10 text-right text-[15px] font-mono" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="text-[12px] uppercase tracking-wider text-muted-foreground">Line Total</span>
                    <span className="text-[18px] font-mono font-semibold tabular-nums">PKR {Number(item.amount || 0).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Totals card (sticky on lg+) */}
        <aside className="lg:sticky lg:top-0 self-start">
          <div className="rounded-lg border border-border bg-card p-5 space-y-3">
            <div className="text-[12px] uppercase tracking-widest text-muted-foreground font-semibold">Order Summary</div>
            <div className="space-y-2 text-[14px]">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span className="font-mono tabular-nums text-foreground">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {settings?.gst_enabled && (
                <div className="flex justify-between text-muted-foreground">
                  <span>GST</span>
                  <span className="font-mono tabular-nums text-foreground">{gst.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
              {customerDetail && customerDetail.balance > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Previous Balance</span>
                  <span className="font-mono tabular-nums text-foreground">{customerDetail.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}
            </div>
            <Separator />
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Grand Total</div>
              <div className="text-[32px] font-mono font-bold tabular-nums leading-none">PKR {total.toLocaleString(undefined, { minimumFractionDigits: 0 })}</div>
              {customerDetail && (
                <div className="text-[12px] text-muted-foreground mt-2">
                  Payable after order: <span className="font-mono tabular-nums text-foreground font-semibold">PKR {(customerDetail.balance + total).toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-muted-foreground">{items.filter(i => i.product_id).length} items</span>
              <span className="text-[11px] text-muted-foreground">{items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)} units</span>
            </div>
          </div>
        </aside>
      </div>
    </div>

    {/* STICKY FOOTER */}
    <div className="border-t border-border bg-card px-6 py-3 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
      <div className="text-[12px] text-muted-foreground">
        {composerDirty ? "Draft auto-saved" : "No unsaved changes"}
      </div>
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <Button variant="ghost" onClick={requestCloseComposer} className="h-10 text-[14px]">Cancel</Button>
        <Button variant="outline" disabled={saving} onClick={() => { saveDraft({ customerId, pfDate, validityDays, paymentInstructions, agentId, items }); toast.success("Draft saved"); }} className="h-10 text-[14px]">
          Save Draft
        </Button>
        <Button variant="outline" disabled={saving} onClick={() => { setCreateAndPrint(true); handleSave(); }} className="h-10 text-[14px] gap-2">
          {saving && createAndPrint && <Loader2 className="h-4 w-4 animate-spin" />}
          Create & Print
        </Button>
        <Button onClick={() => { setCreateAndPrint(false); handleSave(); }} disabled={saving} className="h-10 text-[14px] font-semibold gap-2">
          {saving && !createAndPrint && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Sales Order
        </Button>
      </div>
    </div>
  </DialogContent>
  </Dialog>

  <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
        <AlertDialogDescription>This sales order has unsaved changes. Your draft is auto-saved and can be restored next time.</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep Editing</AlertDialogCancel>
        <AlertDialogAction onClick={confirmDiscardAndClose}>Discard & Close</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
   </AlertDialog>
   </>
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
 { label: "All", ...allStats, secondLine: `PKR ${allStats.value.toLocaleString()}`, icon: FileText, gradient: "bg-card", iconBg: "bg-surface-2", accent: "bg-primary/40", textColor: "text-foreground", statusKey: "all" },
 { label: "Draft", ...draftStats, secondLine: `PKR ${draftStats.value.toLocaleString()}`, icon: FileEdit, gradient: "bg-card", iconBg: "bg-surface-2", accent: "bg-primary/40", textColor: "text-warning", statusKey: "draft" },
 { label: "Invoice", ...invoiceStats, secondLine: `PKR ${invoiceStats.value.toLocaleString()}`, icon: Send, gradient: "bg-card", iconBg: "bg-surface-2", accent: "bg-primary/40", textColor: "text-primary", statusKey: "invoiced" },
 ].map(s => (
 <button key={s.label} onClick={() => setStatusFilter(s.statusKey)}
 className={`group relative flex flex-col items-center justify-center h-[90px] sm:h-[120px] rounded-md ${s.gradient} border border-border/50 transition-all duration-300 overflow-hidden ${statusFilter === s.statusKey ? "border-primary" : ""}`}>
 <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-lg rounded-md ${s.iconBg} flex items-center justify-center mb-1 sm:mb-1.5 transition-transform duration-300`}>
 <s.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
 </div>
 <span className={`text-base sm:text-lg font-bold font-heading ${s.textColor}`}>{s.count}</span>
 <span className="text-[8px] sm:text-[9px] font-mono text-muted-foreground">{s.secondLine}</span>
 <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.1em] sm:tracking-[0.12em] text-muted-foreground">{s.label}</span>
 <div className={`absolute bottom-0 left-0 right-0 h-[3px] ${s.accent} opacity-50 group-hover:opacity-100 transition-opacity`} />
 </button>
 ))}
 </div>

 {/* FILTERS */}
 <div className="flex flex-wrap items-center gap-3">
 <div className="relative flex-1 min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Search orders & customers..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <div className="flex items-center gap-1 rounded-xl bg-muted/40 p-1 border border-border/30">
 {[{ label: "All", value: "all" }, { label: "Today", value: "today" }, { label: "Week", value: "week" }, { label: "Month", value: "month" }].map(d => (
 <button key={d.value} onClick={() => setDateRange(d.value)}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${dateRange === d.value ? "bg-primary text-primary shadow-sm border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}>
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
 <p className="text-muted-foreground font-medium">No sales orders yet</p>
 <p className="text-xs text-muted-foreground mt-1">Click "Create Sales Order" to get started</p>
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
 <TableRow key={order.id} className={`group cursor-pointer hover:bg-muted/30 transition-colors ${isPaid ? "bg-success/5" : ""}`} data-state={selected.has(order.id) ? "selected" : undefined}>
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
 <TableCell className={`text-right font-mono text-sm ${balance === 0 ? "text-success font-semibold" : balance !== null ? "text-warning font-semibold" : "text-muted-foreground"}`}>
 {balance !== null ? (balance === 0 ? "✓ Paid" : Number(balance).toLocaleString()) : "—"}
 </TableCell>
 <TableCell>
 <div className="flex items-center gap-1">
 {/* Primary actions: Submit & Payment */}
 {order.status === "draft" && (
 <Button size="sm" onClick={() => openSubmitDialog(order)} className="h-7 text-xs gap-1 shadow-sm">
 <CheckCircle className="h-3 w-3" /> <span className="hidden sm:inline">Submit</span>
 </Button>
 )}
 {(order.status === "invoiced" || order.status === "dispatched" || order.status === "partial") && order.customer_id && (
 <Button size="sm" onClick={() => openPaymentDialog(order)} className="h-7 text-xs gap-1 shadow-sm" title="Receive Payment">
 <Banknote className="h-3 w-3" /> <span className="hidden sm:inline">Payment</span>
 </Button>
 )}
 {/* Quick WhatsApp */}
 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shareWhatsApp(order)} title="Share via WhatsApp">
 <MessageCircle className="h-3.5 w-3.5 text-success" />
 </Button>
 {/* Grace-window delete for approved invoices */}
 {order.converted_invoice_id && (order.status === "invoiced" || order.status === "dispatched" || order.status === "partial") && (
   <GraceDeleteButton
     table="sales_invoices"
     invoiceId={order.converted_invoice_id}
     invoiceNumber={order.invoice_number}
     approvedAt={order.invoice_approved_at ?? order.created_at}
     graceHours={settings?.invoice_delete_grace_hours ?? 48}
     onDeleted={() => load()}
     onRaiseReturn={() => { setReturnOrder(order); setReturnOpen(true); }}
   />
 )}
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
 <MessageCircle className="h-3.5 w-3.5 mr-2 text-success" /> WhatsApp
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
 {order.converted_invoice_id && (
 <DropdownMenuItem onClick={() => { setReturnOrder(order); setReturnOpen(true); }}>
 <RotateCcw className="h-3.5 w-3.5 mr-2 text-warning" /> Return Items
 </DropdownMenuItem>
 )}
 {order.converted_invoice_id && (
 <DropdownMenuItem onClick={() => navigate(`/warranty-invoices?source_invoice=${order.converted_invoice_id}`)}>
 <ShieldCheck className="h-3.5 w-3.5 mr-2 text-primary" /> Create Warranty Invoice
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
 <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-foreground text-background px-6 py-3 rounded-md flex items-center gap-4 z-50">
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
 <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", product_name: "", quantity: 1, rate: 0, gst_rate: 17, amount: 0, discount_pct: 0, mrp: 0 }])} className="gap-1 text-xs"><Plus className="h-3 w-3" /> Add</Button>
 </div>
  {editItems.map((item, idx) => {
  const catalogMrp = Number(products.find(p => p.id === item.product_id)?.mrp || 0);
  return (
  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
  <div className="col-span-3">
    <SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateEditItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" />
    {catalogMrp ? <span className="block text-[10px] text-muted-foreground mt-1 tabular-nums">Catalog MRP PKR {catalogMrp.toLocaleString()}</span> : null}
  </div>
  <div className="col-span-2"><Input type="number" value={item.mrp ?? ""} onChange={e => updateEditItem(idx, "mrp", e.target.value)} className="text-xs tabular-nums" placeholder="MRP" /></div>
  <div className="col-span-1"><Input type="number" value={item.quantity} onChange={e => updateEditItem(idx, "quantity", e.target.value)} className="text-xs tabular-nums" placeholder="Qty" /></div>
  <div className="col-span-2 relative">
  <Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs tabular-nums" placeholder="Rate" />
  {item.last_price !== undefined && item.last_price !== null && (
  <span className="absolute -bottom-4 left-0 text-[10px] text-success font-medium">Last: PKR {Number(item.last_price).toLocaleString()}</span>
  )}
  </div>
  <div className="col-span-1"><Input type="number" value={item.discount_pct || 0} onChange={e => updateEditItem(idx, "discount_pct", e.target.value)} className="text-xs tabular-nums" placeholder="Disc%" /></div>
  <div className="col-span-2 text-right text-xs font-mono pt-2 tabular-nums">{item.amount.toLocaleString()}</div>
  <div className="col-span-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
  </div>
  );})}
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

 {/* ═══ SUBMIT DIALOG (Batch + Dispatch) ═══ */}
 <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
  <DialogHeader>
  <DialogTitle className="font-heading">Dispatch Order — Assign Batches & Courier</DialogTitle>
  {submitOrder && (
    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
      <span className="font-mono text-foreground">{submitOrder.proforma_number}</span>
      <span>·</span>
      <span>{(submitOrder.customers as any)?.name || "—"}</span>
    </div>
  )}
  </DialogHeader>
  <p className="text-sm text-muted-foreground">
  Pick the batch (FEFO – earliest expiry first) for each item, then choose the courier. This creates the Sales Invoice, Delivery Note and updates stock.
  </p>
  <Separator />

  {/* Courier */}
  <div className="rounded-xl border border-border bg-primary/5 p-3">
  <Label className="text-xs font-semibold text-primary dark:text-primary flex items-center gap-1.5">
  <Truck className="h-3.5 w-3.5" /> Dispatched through? {!freightProviderId && freightProviders.length > 0 && <span className="text-[10px] font-normal text-destructive ml-1">— required</span>}
  </Label>
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
  {freightProviders.map(p => (
  <button
  key={p.id}
  type="button"
  onClick={() => setFreightProviderId(p.id)}
  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-150 ${
  freightProviderId === p.id
  ? "border-primary bg-primary/15 text-primary dark:text-primary ring-1 ring-primary/40"
  : "border-border bg-card hover:bg-muted/50 text-foreground"
  }`}
  >
  <div className="font-mono text-[10px] text-muted-foreground">{p.code}</div>
  {p.name}
  </button>
  ))}
  {freightProviders.length === 0 && (
  <p className="col-span-full text-xs text-muted-foreground">
  No couriers configured. Add them under Settings → Couriers.
  </p>
  )}
  </div>
  </div>

  {submitItems.map((item, idx) => {
  const selectedBatch = batchOptions[item.product_id]?.find(b => b.batch_number === item.batch_number);
  const mrp = products.find(p => p.id === item.product_id)?.selling_price;
  const exp = selectedBatch?.expiry_date;
  const days = daysUntil(exp);
  const expTone = days != null && days < 60 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
  return (
  <div key={idx} className="relative p-4 pl-5 rounded-xl border border-border bg-muted/20 space-y-3 overflow-hidden">
  <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary/70" aria-hidden />
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="text-sm font-semibold text-foreground truncate">{item.product_name || "Item"}</div>
      {mrp ? <div className="text-[11px] text-muted-foreground tabular-nums mt-0.5">MRP <span className="text-foreground font-mono">PKR {Number(mrp).toLocaleString()}</span></div> : null}
    </div>
    <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap shrink-0">Ordered: <span className="text-foreground">{item.quantity}</span></span>
  </div>
  <div className="grid grid-cols-2 gap-3">
  <div>
  <Label className="text-xs font-medium text-muted-foreground">Batch * (FEFO)</Label>
  {batchOptions[item.product_id]?.length > 0 ? (
  <>
  <SearchableSelect
  options={batchOptions[item.product_id].map(b => ({
  value: b.batch_number,
  label: `${b.batch_number} · ${b.available} avail${b.expiry_date ? ` · exp ${fmtExpiry(b.expiry_date)}` : ""}`,
  }))}
  value={item.batch_number}
  onChange={v => { const u = [...submitItems]; u[idx].batch_number = v; setSubmitItems(u); }}
  placeholder="Select batch..."
  triggerClassName="text-xs h-9"
  />
  {exp && (
    <span className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full border text-[10px] font-medium tabular-nums ${expTone}`}>
      Expires {fmtExpiry(exp)}{days != null && days < 60 ? ` · ${days}d` : ""}
    </span>
  )}
  </>
  ) : (
  <p className="text-xs text-destructive mt-1">No batches available</p>
  )}
  </div>
  <div>
  <Label className="text-xs font-medium text-muted-foreground">Dispatch Quantity</Label>
  <div className="relative">
    <Input type="number" className="text-xs h-9 tabular-nums pr-16" value={item.convert_quantity}
    onChange={e => { const u = [...submitItems]; u[idx].convert_quantity = e.target.value; setSubmitItems(u); }} />
    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums">/ {item.quantity}</span>
  </div>
  </div>
  </div>
  </div>
  );})}

 <Button
 onClick={handleSubmit}
 disabled={submitting || (freightProviders.length > 0 && !freightProviderId)}
 className="w-full h-11 gap-2 text-sm font-semibold mt-2"
 >
 {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
 Confirm Dispatch — Create Invoice + Delivery Note
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

 <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} html={pdfHtml} title={pdfTitle} views={pdfViews} defaultView={pdfDefaultView} />

 {/* ═══ POST-SUBMIT DOCUMENT CHOICE ═══ */}
 <Dialog open={postSubmitOpen} onOpenChange={setPostSubmitOpen}>
 <DialogContent className="max-w-sm">
 <DialogHeader>
 <DialogTitle className="font-heading text-center">Documents Ready</DialogTitle>
 </DialogHeader>
 <p className="text-sm text-muted-foreground text-center">Invoice and Delivery Note have been created. Which document would you like to view?</p>
 <div className="flex flex-col gap-3 mt-2">
 <Button
 className="h-12 gap-2"
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
 <Button onClick={handleReceivePayment} disabled={paymentSaving || !paymentAmount} className="w-full h-11 gap-2">
 {paymentSaving && <Loader2 className="h-4 w-4 animate-spin" />}
 <Banknote className="h-4 w-4" /> Receive PKR {Number(paymentAmount || 0).toLocaleString()}
 </Button>
 </div>
 )}
 </DialogContent>
 </Dialog>

 {/* ═══ SALES RETURN DIALOG ═══ */}
 <SalesReturnDialog
 open={returnOpen}
 onOpenChange={setReturnOpen}
 invoiceId={returnOrder?.converted_invoice_id || null}
 invoiceNumber={returnOrder?.invoice_number}
 customerId={returnOrder?.customer_id || null}
 onSaved={() => { setReturnOpen(false); load(); }}
 />
 </AppLayout>
 );
}
