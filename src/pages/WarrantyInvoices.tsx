import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { escIlike, searchCustomerIds } from "@/lib/search-helpers";

import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ShieldCheck, Trash2, X, Download, ArrowRight, ChevronLeft, MessageCircle, FilePlus2, Eye, Printer } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { AddDistributorDialog } from "@/components/AddDistributorDialog";
import { getActiveBatches, type ActiveBatch } from "@/lib/batches";
import { NotesEditor } from "@/components/warranty/NotesEditor";
import { DEFAULT_WARRANTY_NOTES_HTML } from "@/lib/warranty-variables";
import { useNavigate } from "react-router-dom";


interface Customer { id: string; name: string; company: string | null; }
interface Product { id: string; name: string; selling_price: number; mrp: number; }
interface SalesInvoice { id: string; invoice_number: string; date: string; total: number; status: string; }
interface SalesInvoiceItem { id: string; product_id: string | null; quantity: number; rate: number; amount: number; batch_number: string | null; gst_rate: number; discount_percent: number; }
interface Distributor { id: string; customer_id: string; name: string; address: string | null; license_number: string | null; license_expiry: string | null; phone: string | null; }
interface SalesAgent {
 id: string; name: string;
 father_name: string | null; cnic: string | null; gender: string | null;
 license_number: string | null; license_expiry: string | null;
 signature_url: string | null; stamp_url: string | null;
}



interface LineItem {
 product_id: string; product_name: string; batch_number: string;
 expiry_date: string; quantity: number; mrp: number; tp_rate: number; discount: number; amount: number;
}

interface WarrantyInvoice {
 id: string; warranty_number: string; date: string; customer_id: string | null;
 pharmacy_name: string; pharmacy_address: string | null; pharmacy_license_no: string | null;
 items: LineItem[]; subtotal: number; gst_amount: number; total: number;
 notes: string | null; status: string; created_at: string;
 source_invoice_id: string | null; discount_percent: number; discount_amount: number;
 distributor_id: string | null;
 sales_agent_id: string | null;
 // Snapshot fields (filled on save) — keep historical notes immutable
 sales_rep_name?: string | null; sales_rep_father_name?: string | null;
 sales_rep_cnic?: string | null; sales_rep_gender?: string | null;
 agent_license_number?: string | null; agent_license_expiry?: string | null;
 rep_signature_url?: string | null; rep_stamp_url?: string | null;
 company_stamp_url?: string | null; company_signature_url?: string | null;
 customer_warranty_address?: string | null; customer_license_number?: string | null;
 customer_license_expiry?: string | null; customer_ntn?: string | null;
 customer_cnic?: string | null; customer_mobile?: string | null;
 created_by_name?: string | null;
 customers?: { name: string } | null;
}


type CreateStep = "select_customer" | "select_invoice" | "edit_items";

export default function WarrantyInvoices() {
 const [invoices, setInvoices] = useState<WarrantyInvoice[]>([]);
 const [customers, setCustomers] = useState<Customer[]>([]);
 const [products, setProducts] = useState<Product[]>([]);
 const [search, setSearch] = useState("");
 const [statusFilter, setStatusFilter] = useState("all");
 const [customerFilter, setCustomerFilter] = useState("");
 const [open, setOpen] = useState(false);
 const [editId, setEditId] = useState<string | null>(null);
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();
  const navigate = useNavigate();

  const fmtDate = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  // Open the new bare-page print preview / print / pdf route. All three
  // entrypoints share one renderer (WarrantyInvoiceTemplate) so preview ≡
  // print ≡ PDF.
  const openPreview = (inv: WarrantyInvoice, action?: "print" | "pdf") => {
    const q = action ? `?action=${action}` : "";
    window.open(`/print-preview/warranty-invoice/${inv.id}${q}`, "_blank", "noopener,noreferrer");
  };



 // Creation flow state
 const [step, setStep] = useState<CreateStep>("select_customer");
 const [selectedCustomerId, setSelectedCustomerId] = useState("");
 const [customerInvoices, setCustomerInvoices] = useState<SalesInvoice[]>([]);
 const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
 const [distributors, setDistributors] = useState<Distributor[]>([]);
 const [selectedDistributorId, setSelectedDistributorId] = useState("");
 const [salesAgents, setSalesAgents] = useState<SalesAgent[]>([]);
 const [selectedRepId, setSelectedRepId] = useState("");
 
 const [items, setItems] = useState<LineItem[]>([]);
 const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
 const [discountValue, setDiscountValue] = useState(0);
 const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
 const [formNotes, setFormNotes] = useState("");
 const [addDistOpen, setAddDistOpen] = useState(false);

 // Cache of active batches per product id (FEFO ordered).
 const [batchCache, setBatchCache] = useState<Record<string, ActiveBatch[]>>({});

 const loadBatchesFor = async (productId: string) => {
   if (!productId || batchCache[productId]) return;
   const list = await getActiveBatches(productId);
   setBatchCache(prev => ({ ...prev, [productId]: list }));
 };



 const pagination = usePagination();
 const [searchParams, setSearchParams] = useSearchParams();
 const [autoSourceHandled, setAutoSourceHandled] = useState(false);

 const debouncedSearch = useDebouncedValue(search, 300);
 useEffect(() => { pagination.setPage(0); }, [debouncedSearch]);
 useEffect(() => { load(); }, [pagination.page, debouncedSearch]);

 // Auto-open dialog and load from sales invoice if ?source_invoice=<id> is present
 useEffect(() => {
 const src = searchParams.get("source_invoice");
 if (!src || autoSourceHandled || products.length === 0) return;
 setAutoSourceHandled(true);
 (async () => {
 const { data: si } = await supabase.from("sales_invoices")
 .select("id, customer_id").eq("id", src).single();
 if (!si) { toast.error("Sales invoice not found"); return; }
 if (si.customer_id) {
 setSelectedCustomerId(si.customer_id);
 // Load distributors
 const { data: dists } = await supabase.from("customer_distributors")
 .select("*").eq("customer_id", si.customer_id).order("name") as { data: Distributor[] | null };
 setDistributors(dists || []);
 }
 await handleSelectInvoice(src);
 setOpen(true);
 // Strip the query param so refresh doesn't re-trigger
 const next = new URLSearchParams(searchParams);
 next.delete("source_invoice");
 setSearchParams(next, { replace: true });
 })();
 }, [searchParams, products, autoSourceHandled]);


 const load = async () => {
 let invQuery = supabase.from("warranty_invoices").select("*, customers(name)", { count: "exact" }).order("created_at", { ascending: false });
 const term = debouncedSearch.trim();
 if (term) {
   const safe = escIlike(term);
   const custIds = await searchCustomerIds(term);
   const idClause = custIds.length > 0 ? `,customer_id.in.(${custIds.join(",")})` : "";
   invQuery = invQuery.or(`warranty_number.ilike.%${safe}%,pharmacy_name.ilike.%${safe}%${idClause}`);
 }
 const [inv, cust, prod, agents] = await Promise.all([
 invQuery.range(pagination.from, pagination.to),
 supabase.from("customers").select("id, name, company").eq("is_active", true).order("name"),
 supabase.from("products").select("id, name, selling_price, mrp").eq("is_active", true).order("name"),
 supabase.from("sales_agents").select("id, name, father_name, cnic, gender, license_number, license_expiry, signature_url, stamp_url").eq("status", "active").order("name"),
 ]);
 if (inv.data) setInvoices(inv.data as any);
 if (inv.count !== null && inv.count !== undefined) pagination.setTotalCount(inv.count);
 if (cust.data) setCustomers(cust.data);
 if (prod.data) setProducts(prod.data as any);
 if (agents.data) {
   setSalesAgents(agents.data as any);
   // Default selected rep = current user's agent (if any)
   if (!selectedRepId && !editId) {
     const { data: userRes } = await supabase.auth.getUser();
     const uid = userRes.user?.id;
     if (uid) {
       const { data: myAgent } = await supabase.from("sales_agents").select("id").eq("user_id", uid).maybeSingle();
       if (myAgent?.id) setSelectedRepId(myAgent.id);
     }
   }
 }
 };



 const handleSelectCustomer = async (customerId: string) => {
 setSelectedCustomerId(customerId);
 // Load customer's sales invoices
 const { data } = await supabase.from("sales_invoices")
 .select("id, invoice_number, date, total, status")
 .eq("customer_id", customerId)
 .order("date", { ascending: false });
 setCustomerInvoices(data || []);
 // Load customer's distributors
 const { data: dists } = await supabase.from("customer_distributors")
 .select("*")
 .eq("customer_id", customerId)
 .order("name") as { data: Distributor[] | null };
 setDistributors(dists || []);
 setStep("select_invoice");
 };

 const handleSelectInvoice = async (invoiceId: string) => {
 setSelectedInvoiceId(invoiceId);
 // Load invoice items
 const { data: invoiceItems } = await supabase.from("sales_invoice_items")
 .select("*")
 .eq("invoice_id", invoiceId) as { data: SalesInvoiceItem[] | null };

 if (invoiceItems) {
 // Fetch expiry dates from grn_items for these product+batch combinations
 const productIds = Array.from(new Set(invoiceItems.map(i => i.product_id).filter(Boolean))) as string[];
 const expiryMap: Record<string, string> = {};
 if (productIds.length > 0) {
 const { data: grn } = await supabase.from("grn_items")
 .select("product_id, batch_number, expiry_date")
 .in("product_id", productIds);
 (grn || []).forEach((g: any) => {
 if (g.product_id && g.batch_number && g.expiry_date) {
 expiryMap[`${g.product_id}__${g.batch_number}`] = g.expiry_date;
 }
 });
 }

 const lineItems: LineItem[] = invoiceItems.map(item => {
 const product = products.find(p => p.id === item.product_id);
 const mrp = product?.mrp || product?.selling_price || item.rate;
 const tp = Math.round(mrp * 0.85 * 100) / 100;
 const expiry = item.product_id && item.batch_number
 ? expiryMap[`${item.product_id}__${item.batch_number}`] || ""
 : "";
 return {
 product_id: item.product_id || "",
 product_name: product?.name || "Unknown Product",
 batch_number: item.batch_number || "",
 expiry_date: expiry,
 quantity: item.quantity,
 mrp,
 tp_rate: tp,
 discount: 0,
 amount: Math.round(item.quantity * tp * 100) / 100,
 };
 });
 setItems(lineItems);
 // Prefetch batches for every product on the invoice.
 const uniq = Array.from(new Set(lineItems.map(l => l.product_id).filter(Boolean)));
 uniq.forEach(pid => { loadBatchesFor(pid); });
 }
 setStep("edit_items");
 };


 const updateItem = (idx: number, field: keyof LineItem, value: any) => {
 const updated = [...items];
 (updated[idx] as any)[field] = value;
 if (field === "mrp") {
 updated[idx].tp_rate = Math.round(Number(value) * 0.85 * 100) / 100;
 }
 if (field === "quantity" || field === "mrp" || field === "tp_rate" || field === "discount") {
 const lineSubtotal = updated[idx].quantity * updated[idx].tp_rate;
 const lineDiscount = updated[idx].discount;
 updated[idx].amount = Math.round((lineSubtotal - lineDiscount) * 100) / 100;
 }
 setItems(updated);
 };

 const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

 const subtotal = items.reduce((s, i) => s + i.amount, 0);
 const discountCalc = discountType === "percent" ? Math.round(subtotal * discountValue / 100) : discountValue;
 const total = subtotal - discountCalc;

 const resetForm = () => {
 setStep("select_customer");
 setSelectedCustomerId("");
 setSelectedInvoiceId("");
 setSelectedDistributorId("");
 setSelectedRepId("");
 
 setItems([]);
 setDiscountType("percent");
 setDiscountValue(0);
 setFormDate(new Date().toISOString().split("T")[0]);
 setFormNotes("");
 setEditId(null);
 };

 const handleSave = async () => {
 if (items.length === 0) { toast.error("Add at least one item"); return; }

 const dist = distributors.find(d => d.id === selectedDistributorId);
 const pharmacyName = dist?.name || "N/A";
 const rep = salesAgents.find(a => a.id === selectedRepId) || null;

 // Pull customer warranty fields for the snapshot
 let cust: any = null;
 if (selectedCustomerId) {
   const { data } = await supabase.from("customers")
     .select("warranty_address, license_number, license_expiry, ntn, cnic, phone")
     .eq("id", selectedCustomerId).maybeSingle();
   cust = data;
 }

 // Created by name (current user / agent name)
 let createdByName: string | null = rep?.name || null;
 if (!createdByName) {
   const { data: ur } = await supabase.auth.getUser();
   createdByName = (ur.user?.user_metadata as any)?.full_name || ur.user?.email || null;
 }

 let warrantyNumber: string | undefined;
 if (!editId) {
 const { data: num } = await supabase.rpc("generate_document_number", { p_document_type: "warranty_invoice" });
 if (!num) { toast.error("Failed to generate number"); return; }
 warrantyNumber = num;
 }

 const payload = {
 warranty_number: editId ? undefined : warrantyNumber,
 date: formDate,
 customer_id: selectedCustomerId || null,
 source_invoice_id: selectedInvoiceId || null,
 pharmacy_name: pharmacyName,
 pharmacy_address: dist?.address || null,
 pharmacy_license_no: dist?.license_number || null,
 distributor_id: selectedDistributorId || null,
 sales_agent_id: rep?.id || null,

 items: items as any,
 subtotal,
 discount_percent: discountType === "percent" ? discountValue : 0,
 discount_amount: discountCalc,
 gst_amount: 0,
 total,
 notes: formNotes || null,
 status: "issued",

 // ── Sales rep snapshot ────────────────────────────────────────────
 sales_rep_name: rep?.name || null,
 sales_rep_father_name: rep?.father_name || null,
 sales_rep_cnic: rep?.cnic || null,
 sales_rep_gender: rep?.gender || null,
 agent_license_number: rep?.license_number || null,
 agent_license_expiry: rep?.license_expiry || null,
 rep_signature_url: rep?.signature_url || null,
 rep_stamp_url: rep?.stamp_url || null,

 // ── Company stamp/signature snapshot ──────────────────────────────
 company_stamp_url: (settings as any)?.warranty_stamp_url || null,
 company_signature_url: (settings as any)?.warranty_signature_url || null,

 // ── Customer warranty snapshot ────────────────────────────────────
 customer_warranty_address: cust?.warranty_address || null,
 customer_license_number: cust?.license_number || null,
 customer_license_expiry: cust?.license_expiry || null,
 customer_ntn: cust?.ntn || null,
 customer_cnic: cust?.cnic || null,
 customer_mobile: cust?.phone || null,

 declaration_text_snapshot: (settings as any)?.warranty_note_text || null,
 created_by_name: createdByName,
 };

 if (editId) {
 const { warranty_number, ...updatePayload } = payload;
 await supabase.from("warranty_invoices").update(updatePayload as any).eq("id", editId);
 toast.success("Warranty note updated");
 } else {
 await supabase.from("warranty_invoices").insert(payload as any);
 toast.success("Warranty note created");
 }
 setOpen(false); resetForm(); load();
 };

 const handleEdit = (inv: WarrantyInvoice) => {
 setEditId(inv.id);
 setSelectedCustomerId(inv.customer_id || "");
 setSelectedInvoiceId(inv.source_invoice_id || "");
 setSelectedDistributorId(inv.distributor_id || "");
 setSelectedRepId(inv.sales_agent_id || "");
 
 const invItems = Array.isArray(inv.items) ? inv.items as any : [];
 setItems(invItems);
 // Load distributors for the customer (so the edit form shows the picker)
 if (inv.customer_id) {
   supabase.from("customer_distributors").select("*").eq("customer_id", inv.customer_id).order("name")
     .then(({ data }) => setDistributors((data || []) as any));
 }
 // Prefetch batches for every product on the invoice.
 const uniq = Array.from(new Set(invItems.map((l: any) => l.product_id).filter(Boolean))) as string[];
 uniq.forEach(pid => { loadBatchesFor(pid); });
 setDiscountType(inv.discount_percent > 0 ? "percent" : "amount");
 setDiscountValue(inv.discount_percent > 0 ? inv.discount_percent : inv.discount_amount);
 setFormDate(inv.date);
 setFormNotes(inv.notes || "");
 setStep("edit_items");
 setOpen(true);
 };



 const handleDelete = async (id: string, e: React.MouseEvent) => {
 e.stopPropagation();
 await supabase.from("warranty_invoices").delete().eq("id", id);
 toast.success("Deleted"); load();
 };

 const customerOptions = customers.map(c => ({ value: c.id, label: c.name + (c.company ? ` — ${c.company}` : "") }));

 // Server-side search already filtered. Keep status + customer client narrowing.
 const filtered = invoices.filter(i => {
 const matchStatus = statusFilter === "all" || i.status === statusFilter;
 const matchCustomer = !customerFilter || i.customer_id === customerFilter;
 return matchStatus && matchCustomer;
 });

 const issuedCount = invoices.filter(i => i.status === "issued").length;
 const totalValue = invoices.reduce((s, i) => s + Number(i.total), 0);

  const startBlank = () => {
    setSelectedInvoiceId("");
    setItems([]);
    setStep("edit_items");
  };

  const addProductRow = async (productId: string) => {
    if (!productId) return;
    const p = products.find(x => x.id === productId);
    if (!p) return;
    const mrp = Number(p.mrp || p.selling_price || 0);
    const tp = Math.round(mrp * 0.85 * 100) / 100;
    // Auto-pick FEFO batch when available so expiry is filled out of the box.
    let batches = batchCache[p.id];
    if (!batches) {
      batches = await getActiveBatches(p.id);
      setBatchCache(prev => ({ ...prev, [p.id]: batches! }));
    }
    const first = batches[0];
    setItems(prev => [...prev, {
      product_id: p.id,
      product_name: p.name,
      batch_number: first?.batch_number || "",
      expiry_date: first?.expiry_date || "",
      quantity: 1,
      mrp,
      tp_rate: tp,
      discount: 0,
      amount: tp,
    }]);
  };

  /** Pick a tracked batch — auto-fills expiry from grn_items. */
  const pickBatch = (idx: number, batchNumber: string) => {
    const item = items[idx];
    if (!item) return;
    const list = batchCache[item.product_id] || [];
    const found = list.find(b => b.batch_number === batchNumber);
    const updated = [...items];
    updated[idx] = {
      ...item,
      batch_number: batchNumber,
      expiry_date: found?.expiry_date || item.expiry_date || "",
    };
    setItems(updated);
  };

  const selectedDist = distributors.find(d => d.id === selectedDistributorId) || null;

  const StepHeader = () => (
    <div className="flex items-center gap-2 text-xs font-medium mb-2">
      {(["select_customer", "select_invoice", "edit_items"] as CreateStep[]).map((s, i) => {
        const labels = ["Customer", "Sales Invoice", "Items & Review"];
        const active = step === s;
        const done = (["select_customer", "select_invoice", "edit_items"] as CreateStep[]).indexOf(step) > i;
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${active ? "bg-primary text-primary-foreground" : done ? "bg-success text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
            <span className={active ? "text-foreground" : "text-muted-foreground"}>{labels[i]}</span>
            {i < 2 && <ChevronLeft className="h-3 w-3 text-muted-foreground rotate-180" />}
          </div>
        );
      })}
    </div>
  );

  const renderCreateStep = () => {
    if (step === "select_customer") {
      return (
        <div className="space-y-4">
          <StepHeader />
          <p className="text-sm text-muted-foreground">Select the customer the warranty note is being issued for. The printed Warranty Address comes from the customer's distributor — not the customer's own address.</p>
          <SearchableSelect options={customerOptions} value={selectedCustomerId} onChange={handleSelectCustomer} placeholder="Search customer..." />
        </div>
      );
    }

    if (step === "select_invoice") {
      return (
        <div className="space-y-4">
          <StepHeader />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("select_customer")}><ChevronLeft className="h-4 w-4" /></Button>
            <p className="text-sm text-muted-foreground">Pick a sales invoice to copy items from, or start from scratch.</p>
          </div>

          <Button variant="outline" className="w-full justify-start gap-2 h-12" onClick={startBlank}>
            <FilePlus2 className="h-4 w-4" />
            <span className="font-medium">Start blank — no sales invoice</span>
            <span className="ml-auto text-xs text-muted-foreground">Add products manually</span>
          </Button>

          {customerInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">No prior sales invoices for this customer.</p>
          ) : (
            <div className="space-y-2 max-h-[45vh] overflow-y-auto">
              {customerInvoices.map(inv => (
                <div key={inv.id} onClick={() => handleSelectInvoice(inv.id)}
                  className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors">
                  <div>
                    <p className="font-mono font-medium text-sm">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.date}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="capitalize">{inv.status}</Badge>
                    <span className="font-mono font-medium">PKR {Number(inv.total).toLocaleString()}</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Step 3: edit_items
    return (
      <div className="space-y-5">
        <StepHeader />
        {!editId && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("select_invoice")}><ChevronLeft className="h-4 w-4" /></Button>
            <p className="text-sm text-muted-foreground">Review & edit items. Distributor block prints as Warranty Address.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div><Label>Date</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Distributor / Warranty Address</Label>
              {selectedCustomerId && (
                <Button type="button" variant="ghost" size="sm" className="h-6 text-xs gap-1 -mr-2" onClick={() => setAddDistOpen(true)}>
                  <Plus className="h-3 w-3" /> Add Distributor
                </Button>
              )}
            </div>
            <Select value={selectedDistributorId} onValueChange={setSelectedDistributorId}>
              <SelectTrigger><SelectValue placeholder={distributors.length === 0 ? "No distributors — add one" : "Select distributor..."} /></SelectTrigger>
              <SelectContent>
                {distributors.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name} {d.license_number ? `(${d.license_number})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sales Rep selector — signs the declaration */}
        <div>
          <Label>Sales Representative (signs the warranty declaration)</Label>
          <Select value={selectedRepId || "__none"} onValueChange={v => setSelectedRepId(v === "__none" ? "" : v)}>
            <SelectTrigger>
              <SelectValue placeholder={salesAgents.length === 0 ? "No sales agents — add one in Sales Agents" : "Select sales rep..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— No rep (declaration tokens will show blanks) —</SelectItem>
              {salesAgents.map(a => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}{a.license_number ? ` · ${a.license_number}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRepId && (() => {
            const r = salesAgents.find(a => a.id === selectedRepId);
            if (!r) return null;
            const missing: string[] = [];
            if (!r.father_name) missing.push("Father name");
            if (!r.cnic) missing.push("CNIC");
            if (!r.license_number) missing.push("License #");
            if (!r.license_expiry) missing.push("License expiry");
            if (!r.signature_url) missing.push("Signature");
            return missing.length > 0 ? (
              <p className="text-[11px] text-amber-600 mt-1">Missing on rep profile: {missing.join(", ")} — fill in Sales Agents to populate the declaration.</p>
            ) : (
              <p className="text-[11px] text-success mt-1">✓ All declaration fields available.</p>
            );
          })()}
        </div>







        {/* Distributor preview (Warranty Address) */}
        {selectedDist && (
          <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
            <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-1">Warranty Address (prints on document)</div>
            <div className="font-semibold text-[15px]">{selectedDist.name}</div>
            {selectedDist.address && <div className="text-sm text-muted-foreground mt-0.5">{selectedDist.address}</div>}
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              {selectedDist.phone && <span>Mobile: <span className="text-foreground">{selectedDist.phone}</span></span>}
              {selectedDist.license_number && <span>Licence: <span className="text-foreground">{selectedDist.license_number}</span></span>}
              {selectedDist.license_expiry && <span>Valid up to: <span className="text-foreground">{selectedDist.license_expiry}</span></span>}
            </div>
          </div>
        )}

        {/* Add product picker */}
        <div>
          <Label>Add Product</Label>
          <SearchableSelect
            options={products.map(p => ({ value: p.id, label: `${p.name} — MRP ${Number(p.mrp || p.selling_price || 0).toLocaleString()}` }))}
            value=""
            onChange={addProductRow}
            placeholder="Search and add a product..."
          />
        </div>

        {/* Items table */}
        {items.length > 0 && (
          <div className="border rounded overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="w-16">Qty</TableHead>
                  <TableHead className="w-24">MRP</TableHead>
                  <TableHead className="w-24">TP Rate</TableHead>
                  <TableHead className="w-20">Disc.</TableHead>
                  <TableHead className="w-28 text-right">Amount</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const batches = batchCache[item.product_id] || [];
                  const hasTracked = batches.length > 0;
                  const pickedTracked = hasTracked && batches.some(b => b.batch_number === item.batch_number);
                  const pickedBatch = batches.find(b => b.batch_number === item.batch_number);
                  return (
                  <TableRow key={idx}>
                    <TableCell className="text-sm font-medium align-top pt-3">{item.product_name}</TableCell>
                    <TableCell className="align-top">
                      {hasTracked ? (
                        <div className="space-y-1 min-w-[180px]">
                          <Select value={item.batch_number || ""} onValueChange={(v) => pickBatch(idx, v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pick batch..." /></SelectTrigger>
                            <SelectContent>
                              {batches.map(b => (
                                <SelectItem key={b.batch_number} value={b.batch_number}>
                                  <span className="font-mono text-xs">{b.batch_number}</span>
                                  <span className="text-muted-foreground"> · on-hand {b.on_hand}</span>
                                  {b.expiry_date ? <span className="text-muted-foreground"> · exp {b.expiry_date.slice(2,7).replace("-","/")}</span> : null}
                                  {b.status === "expired" ? <span className="text-destructive"> · EXPIRED</span> : b.status === "expiring" ? <span className="text-amber-600"> · expiring</span> : null}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {pickedBatch?.status === "expired" && <p className="text-[10px] text-destructive">⚠ Batch expired</p>}
                          {pickedBatch?.status === "expiring" && <p className="text-[10px] text-amber-600">⚠ Batch expiring within 90 days</p>}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Input className="h-8 text-sm w-24" value={item.batch_number} onChange={e => updateItem(idx, "batch_number", e.target.value)} placeholder="Batch #" />
                          <p className="text-[10px] text-muted-foreground">No tracked batches</p>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="align-top">
                      <Input className="h-8 text-sm w-32" type="date" value={item.expiry_date} onChange={e => updateItem(idx, "expiry_date", e.target.value)} readOnly={pickedTracked} />
                    </TableCell>
                    <TableCell className="align-top"><Input className="h-8 text-sm w-16" type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} /></TableCell>
                    <TableCell className="align-top"><Input className="h-8 text-sm w-20" type="number" value={item.mrp} onChange={e => updateItem(idx, "mrp", Number(e.target.value))} /></TableCell>
                    <TableCell className="font-mono text-sm tabular-nums align-top pt-3">{item.tp_rate.toLocaleString()}</TableCell>
                    <TableCell className="align-top"><Input className="h-8 text-sm w-16" type="number" value={item.discount} onChange={e => updateItem(idx, "discount", Number(e.target.value))} /></TableCell>
                    <TableCell className="text-right font-mono text-sm tabular-nums align-top pt-3">{item.amount.toLocaleString()}</TableCell>
                    <TableCell className="align-top"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeItem(idx)}><X className="h-3.5 w-3.5" /></Button></TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Discount & totals */}
        <div className="flex flex-col items-end gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-mono font-medium tabular-nums">PKR {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={discountType} onValueChange={v => setDiscountType(v as any)}>
              <SelectTrigger className="h-9 w-32 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Discount %</SelectItem>
                <SelectItem value="amount">Discount Amt</SelectItem>
              </SelectContent>
            </Select>
            <Input className="h-9 w-24 text-sm" type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} />
            <span className="font-mono text-xs text-muted-foreground tabular-nums">= PKR {discountCalc.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-3 text-2xl font-bold pt-1 border-t border-border min-w-[260px] justify-end">
            <span>Total:</span>
            <span className="font-mono tabular-nums">PKR {total.toLocaleString()}</span>
          </div>
        </div>

        <div><Label>Notes</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} /></div>
        <Button onClick={handleSave} className="w-full" size="lg">{editId ? "Update" : "Create"} Warranty Invoice</Button>
      </div>
    );
  };


 const headerActions = (
 <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
 <DialogTrigger asChild>
 <Button className="gap-2 shadow-violet-500/25 transition-all">
 <Plus className="h-4 w-4" /> New Warranty Invoice
 </Button>
 </DialogTrigger>
 <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
 <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Warranty Invoice</DialogTitle></DialogHeader>
 {renderCreateStep()}
 </DialogContent>
 </Dialog>
 );

 return (
 <AppLayout title="Warranty Invoices" subtitle="Issue warranty invoices at MRP for pharmacies & distributors" headerActions={headerActions}>
 <div className="space-y-4">
 {/* NON-FINANCIAL COMPLIANCE banner */}
 <div
 className="rounded-[4px] px-4 py-3 flex items-center justify-between gap-3"
 style={{ background: "hsl(var(--medical-cyan))", color: "hsl(var(--medical-cyan-foreground))" }}
 >
 <div>
 <p className="text-[11px] font-bold tracking-[0.18em] uppercase">Non-Financial Compliance Document</p>
 <p className="text-xs opacity-90">Pricing uses MRP. Zero impact on ledgers, receivables, or inventory.</p>
 </div>
 <ShieldCheck className="h-6 w-6 opacity-90" />
 </div>
 {/* Stats — non-financial only */}
 <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 <div className="p-4 rounded-xl border border-border bg-card">
 <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Issued</p>
 <p className="text-2xl font-bold font-heading text-primary mt-1">{issuedCount}</p>
 </div>
 <div className="p-4 rounded-xl border border-border bg-card">
 <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total Notes</p>
 <p className="text-2xl font-bold font-heading text-primary mt-1">{invoices.length}</p>
 </div>
 <div className="p-4 rounded-xl border border-border bg-card">
 <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Draft</p>
 <p className="text-2xl font-bold font-heading text-amber-600 mt-1">{invoices.filter(i => i.status === "draft").length}</p>
 </div>
 </div>

 <div className="flex flex-wrap items-center gap-3">
 <div className="relative max-w-sm flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Search warranty invoices..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
 {["all", "issued", "draft"].map(s => (
 <button key={s} onClick={() => setStatusFilter(s)}
 className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
 {s}
 </button>
 ))}
 </div>
 <div className="w-48">
 <SearchableSelect options={[{ value: "", label: "All Customers" }, ...customerOptions]} value={customerFilter} onChange={setCustomerFilter} placeholder="Filter customer..." />
 </div>
 </div>

 <Card className="glass-card">
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Warranty Note #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead>
 <TableHead>Warranty Address</TableHead><TableHead className="text-center">Products</TableHead>
 <TableHead className="text-center">Status</TableHead>
 <TableHead className="text-center">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.length === 0 ? (
 <TableRow>
 <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
 <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />No warranty notes yet.
 </TableCell>
 </TableRow>
 ) : filtered.map(inv => (
 <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleEdit(inv)}>
 <TableCell className="font-medium font-mono">{inv.warranty_number}</TableCell>
 <TableCell>{inv.date}</TableCell>
 <TableCell>{inv.customers?.name || "—"}</TableCell>
 <TableCell>{inv.pharmacy_name}</TableCell>
 <TableCell className="text-center font-mono tabular-nums">{Array.isArray(inv.items) ? inv.items.length : 0}</TableCell>
 <TableCell className="text-center"><Badge variant="outline" className="capitalize">{inv.status}</Badge></TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openPreview(inv)} title="Preview">
                                <Eye className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openPreview(inv, "print")} title="Print">
                                <Printer className="h-3 w-3" />
                              </Button>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => openPreview(inv, "pdf")} title="Download PDF">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                                e.stopPropagation();
                                const { sendWhatsAppDoc } = await import("@/lib/whatsapp-templates");
                                let phone = "";
                                if (inv.customer_id) {
                                  const { data } = await supabase.from("customers").select("phone").eq("id", inv.customer_id).single();
                                  phone = data?.phone || "";
                                }
                                const pdfLink = `${window.location.origin}/print-preview/warranty-invoice/${inv.id}`;
                                await sendWhatsAppDoc({
                                  documentType: "sales_invoice",
                                  phone,
                                  vars: {
                                    company_name: settings?.company_name || "DocPharmas",
                                    company_phone: (settings as any)?.phone || "",
                                    company_email: (settings as any)?.email || "",
                                    company_address: (settings as any)?.address || "",
                                    customer_name: inv.pharmacy_name,
                                    customer_phone: phone,
                                    document_type: "Warranty Invoice",
                                    document_number: inv.warranty_number,
                                    document_date: inv.date,
                                    document_total: Number(inv.total).toLocaleString(),
                                    document_link: pdfLink,
                                  },
                                });
                              }} title="Share via WhatsApp">
                                <MessageCircle className="h-3.5 w-3.5 text-success" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {inv.warranty_number}?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete this warranty invoice.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={(e) => handleDelete(inv.id, e)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
 </TableRow>
 ))}
 </TableBody>
 </Table>
 <PaginationControls page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount} hasNext={pagination.hasNext} hasPrev={pagination.hasPrev} onNext={pagination.nextPage} onPrev={pagination.prevPage} pageSize={pagination.pageSize} />
 </CardContent>
 </Card>
 </div>
 {/* Legacy PdfPreviewDialog removed — preview/print/PDF now go through /print-preview/warranty-invoice/:id */}
 <AddDistributorDialog
 open={addDistOpen}
 onOpenChange={setAddDistOpen}
 customerId={selectedCustomerId}
 onCreated={async (newId) => {
 const { data: dists } = await supabase.from("customer_distributors")
 .select("*").eq("customer_id", selectedCustomerId).order("name") as { data: Distributor[] | null };
 setDistributors(dists || []);
 setSelectedDistributorId(newId);
 }}
 />
 </AppLayout>
 );
}

