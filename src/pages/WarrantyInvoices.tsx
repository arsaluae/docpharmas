import { useEffect, useState } from "react";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ShieldCheck, Trash2, X, Download, ArrowRight, ChevronLeft, MessageCircle } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdfHtml } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

interface Customer { id: string; name: string; company: string | null; }
interface Product { id: string; name: string; selling_price: number; mrp: number; }
interface SalesInvoice { id: string; invoice_number: string; date: string; total: number; status: string; }
interface SalesInvoiceItem { id: string; product_id: string | null; quantity: number; rate: number; amount: number; batch_number: string | null; gst_rate: number; discount_percent: number; }
interface Distributor { id: string; customer_id: string; name: string; address: string | null; license_number: string | null; license_expiry: string | null; phone: string | null; }

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
  const [pdfHtml, setPdfHtml] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  // Creation flow state
  const [step, setStep] = useState<CreateStep>("select_customer");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerInvoices, setCustomerInvoices] = useState<SalesInvoice[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [selectedDistributorId, setSelectedDistributorId] = useState("");
  const [items, setItems] = useState<LineItem[]>([]);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState(0);
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formNotes, setFormNotes] = useState("");

  const pagination = usePagination();

  useEffect(() => { load(); }, [pagination.page]);

  const load = async () => {
    const [inv, cust, prod] = await Promise.all([
      supabase.from("warranty_invoices").select("*, customers(name)", { count: "exact" }).order("created_at", { ascending: false }).range(pagination.from, pagination.to),
      supabase.from("customers").select("id, name, company").order("name"),
      supabase.from("products").select("id, name, selling_price, mrp").order("name"),
    ]);
    if (inv.data) setInvoices(inv.data as any);
    if (inv.count !== null && inv.count !== undefined) pagination.setTotalCount(inv.count);
    if (cust.data) setCustomers(cust.data);
    if (prod.data) setProducts(prod.data as any);
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
    // Load invoice items with product details
    const { data: invoiceItems } = await supabase.from("sales_invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId) as { data: SalesInvoiceItem[] | null };
    
    if (invoiceItems) {
      const lineItems: LineItem[] = invoiceItems.map(item => {
        const product = products.find(p => p.id === item.product_id);
        const mrp = product?.mrp || product?.selling_price || item.rate;
        const tp = Math.round(mrp * 0.85 * 100) / 100;
        return {
          product_id: item.product_id || "",
          product_name: product?.name || "Unknown Product",
          batch_number: item.batch_number || "",
          expiry_date: "",
          quantity: item.quantity,
          mrp,
          tp_rate: tp,
          discount: 0,
          amount: item.quantity * tp,
        };
      });
      setItems(lineItems);
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
      items: items as any,
      subtotal,
      discount_percent: discountType === "percent" ? discountValue : 0,
      discount_amount: discountCalc,
      gst_amount: 0,
      total,
      notes: formNotes || null,
      status: "issued",
    };

    if (editId) {
      const { warranty_number, ...updatePayload } = payload;
      await supabase.from("warranty_invoices").update(updatePayload).eq("id", editId);
      toast.success("Warranty invoice updated");
    } else {
      await supabase.from("warranty_invoices").insert(payload as any);
      toast.success("Warranty invoice created");
    }
    setOpen(false); resetForm(); load();
  };

  const handleEdit = (inv: WarrantyInvoice) => {
    setEditId(inv.id);
    setSelectedCustomerId(inv.customer_id || "");
    setSelectedInvoiceId(inv.source_invoice_id || "");
    setSelectedDistributorId(inv.distributor_id || "");
    setItems(Array.isArray(inv.items) ? inv.items as any : []);
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

  const filtered = invoices.filter(i => {
    const matchSearch = i.warranty_number.toLowerCase().includes(search.toLowerCase()) ||
      i.pharmacy_name.toLowerCase().includes(search.toLowerCase()) ||
      (i.customers?.name || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    const matchCustomer = !customerFilter || i.customer_id === customerFilter;
    return matchSearch && matchStatus && matchCustomer;
  });

  const issuedCount = invoices.filter(i => i.status === "issued").length;
  const totalValue = invoices.reduce((s, i) => s + Number(i.total), 0);

  const renderCreateStep = () => {
    if (step === "select_customer") {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Step 1: Select the customer who requested the warranty invoice</p>
          <SearchableSelect options={customerOptions} value={selectedCustomerId} onChange={handleSelectCustomer} placeholder="Search customer..." />
        </div>
      );
    }

    if (step === "select_invoice") {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("select_customer")}><ChevronLeft className="h-4 w-4" /></Button>
            <p className="text-sm text-muted-foreground">Step 2: Select a sales invoice</p>
          </div>
          {customerInvoices.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No sales invoices found for this customer.</p>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
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
      <div className="space-y-4">
        {!editId && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setStep("select_invoice")}><ChevronLeft className="h-4 w-4" /></Button>
            <p className="text-sm text-muted-foreground">Step 3: Review & edit items</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} /></div>
          <div>
            <Label>Distributor / Pharmacy</Label>
            <Select value={selectedDistributorId} onValueChange={setSelectedDistributorId}>
              <SelectTrigger><SelectValue placeholder="Select distributor..." /></SelectTrigger>
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

        {/* Items table */}
        {items.length > 0 && (
          <div className="border rounded overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[150px]">Product</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="w-16">Qty</TableHead>
                  <TableHead className="w-20">MRP</TableHead>
                  <TableHead className="w-20">TP Rate</TableHead>
                  <TableHead className="w-20">Disc.</TableHead>
                  <TableHead className="w-24 text-right">Amount</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="text-xs font-medium">{item.product_name}</TableCell>
                    <TableCell><Input className="h-7 text-xs w-20" value={item.batch_number} onChange={e => updateItem(idx, "batch_number", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-7 text-xs w-28" type="date" value={item.expiry_date} onChange={e => updateItem(idx, "expiry_date", e.target.value)} /></TableCell>
                    <TableCell><Input className="h-7 text-xs w-14" type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} /></TableCell>
                    <TableCell><Input className="h-7 text-xs w-18" type="number" value={item.mrp} onChange={e => updateItem(idx, "mrp", Number(e.target.value))} /></TableCell>
                    <TableCell className="font-mono text-xs">{item.tp_rate.toLocaleString()}</TableCell>
                    <TableCell><Input className="h-7 text-xs w-16" type="number" value={item.discount} onChange={e => updateItem(idx, "discount", Number(e.target.value))} /></TableCell>
                    <TableCell className="text-right font-mono text-xs">{item.amount.toLocaleString()}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(idx)}><X className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Discount & totals */}
        <div className="flex flex-col items-end gap-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Subtotal:</span>
            <span className="font-mono font-medium">PKR {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Select value={discountType} onValueChange={v => setDiscountType(v as any)}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Discount %</SelectItem>
                <SelectItem value="amount">Discount Amt</SelectItem>
              </SelectContent>
            </Select>
            <Input className="h-8 w-20 text-xs" type="number" value={discountValue} onChange={e => setDiscountValue(Number(e.target.value))} />
            <span className="font-mono text-xs text-muted-foreground">= PKR {discountCalc.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2 text-base font-bold">
            <span>Total:</span>
            <span className="font-mono">PKR {total.toLocaleString()}</span>
          </div>
        </div>

        <div><Label>Notes</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} /></div>
        <Button onClick={handleSave} className="w-full">{editId ? "Update" : "Create"} Warranty Invoice</Button>
      </div>
    );
  };

  const headerActions = (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:scale-[1.02] transition-all">
          <Plus className="h-4 w-4" /> New Warranty Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Warranty Invoice</DialogTitle></DialogHeader>
        {renderCreateStep()}
      </DialogContent>
    </Dialog>
  );

  return (
    <AppLayout title="Warranty Invoices" subtitle="Issue warranty invoices at MRP for pharmacies & distributors" headerActions={headerActions}>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-violet-500/10 to-purple-600/5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Issued</p>
            <p className="text-2xl font-bold font-heading text-violet-600 mt-1">{issuedCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-primary/10 to-primary/5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total Invoices</p>
            <p className="text-2xl font-bold font-heading text-primary mt-1">{invoices.length}</p>
          </div>
          <div className="p-4 rounded-xl border border-border bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Total Value</p>
            <p className="text-2xl font-bold font-heading text-emerald-600 mt-1">PKR {totalValue.toLocaleString()}</p>
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
                  <TableHead>WI #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead>
                  <TableHead>Pharmacy</TableHead><TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />No warranty invoices yet.
                    </TableCell>
                  </TableRow>
                ) : filtered.map(inv => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleEdit(inv)}>
                    <TableCell className="font-medium font-mono">{inv.warranty_number}</TableCell>
                    <TableCell>{inv.date}</TableCell>
                    <TableCell>{inv.customers?.name || "—"}</TableCell>
                    <TableCell>{inv.pharmacy_name}</TableCell>
                    <TableCell className="text-right font-mono">{Number(inv.total).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => {
                          const wiItems = Array.isArray(inv.items) ? inv.items : [];
                          const template = getTemplate("warranty_invoice");
                          const cols = template?.columns_config?.length ? template.columns_config : [
                            { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
                            { header: "Batch", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
                            { header: "Qty", key: "quantity", align: "right" as const },
                            { header: "MRP", key: "mrp", align: "right" as const },
                            { header: "TP Rate", key: "tp_rate", align: "right" as const },
                            { header: "Amount", key: "amount", align: "right" as const },
                          ];
                          const wiHtml = generatePdfHtml({
                            title: "WARRANTY INVOICE", documentNumber: inv.warranty_number, date: inv.date,
                            partyLabel: "Pharmacy / Distributor", partyName: inv.pharmacy_name,
                            partyAddress: inv.pharmacy_address || undefined,
                            partyLicense: inv.pharmacy_license_no || undefined,
                            meta: inv.pharmacy_license_no ? [{ label: "License #", value: inv.pharmacy_license_no }] : [],
                            columns: cols as any,
                            rows: wiItems.map((i: any, idx: number) => ({
                              ...i, idx: idx + 1,
                              mrp: Number(i.mrp || i.mrp_rate || 0).toLocaleString(),
                              tp_rate: Number(i.tp_rate || 0).toLocaleString(),
                              amount: Number(i.amount).toLocaleString(),
                            })),
                            totals: [
                              { label: "Subtotal", value: `PKR ${Number(inv.subtotal).toLocaleString()}` },
                              ...(Number(inv.discount_amount) > 0 ? [{ label: `Discount${Number(inv.discount_percent) > 0 ? ` (${inv.discount_percent}%)` : ''}`, value: `- PKR ${Number(inv.discount_amount).toLocaleString()}` }] : []),
                              { label: "Total", value: `PKR ${Number(inv.total).toLocaleString()}` },
                            ],
                            notes: inv.notes || undefined, settings, template,
                          });
                          setPdfHtml(wiHtml); setPdfTitle(`Warranty Invoice — ${inv.warranty_number}`); setPdfOpen(true);
                        }}>
                          <Download className="h-3 w-3" /> PDF
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async (e) => {
                          e.stopPropagation();
                          const { buildWarrantyInvoiceMessage, openWhatsApp, uploadSharedDocument } = await import("@/lib/whatsapp-share");
                          const wiItems = Array.isArray(inv.items) ? inv.items as any[] : [];
                          // Get customer phone
                          let phone = "";
                          if (inv.customer_id) {
                            const { data } = await supabase.from("customers").select("phone").eq("id", inv.customer_id).single();
                            phone = data?.phone || "";
                          }
                          // Generate PDF link
                          let pdfLink: string | undefined;
                          try {
                            const template = getTemplate("warranty_invoice");
                            const cols = template?.columns_config?.length ? template.columns_config : [
                              { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
                              { header: "Batch", key: "batch_number" }, { header: "Qty", key: "quantity", align: "right" as const },
                              { header: "MRP", key: "mrp", align: "right" as const },
                              { header: "TP Rate", key: "tp_rate", align: "right" as const },
                              { header: "Amount", key: "amount", align: "right" as const },
                            ];
                            const html = generatePdfHtml({
                              title: "WARRANTY INVOICE", documentNumber: inv.warranty_number, date: inv.date,
                              partyLabel: "Pharmacy / Distributor", partyName: inv.pharmacy_name,
                              columns: cols as any,
                              rows: wiItems.map((i: any, idx: number) => ({
                                ...i, idx: idx + 1,
                                mrp: Number(i.mrp || 0).toLocaleString(),
                                tp_rate: Number(i.tp_rate || 0).toLocaleString(),
                                amount: Number(i.amount).toLocaleString(),
                              })),
                              totals: [{ label: "Total", value: `PKR ${Number(inv.total).toLocaleString()}` }],
                              settings, template,
                            });
                            pdfLink = await uploadSharedDocument(html, inv.warranty_number) || undefined;
                          } catch (e) { console.error("PDF link error:", e); }
                          const message = buildWarrantyInvoiceMessage({
                            warrantyNumber: inv.warranty_number,
                            companyName: settings?.company_name || "DocPharmas",
                            pharmacyName: inv.pharmacy_name, customerPhone: phone, date: inv.date,
                            items: wiItems.map((i: any) => ({ product_name: i.product_name, batch_number: i.batch_number, mrp: i.mrp, tp_rate: i.tp_rate, quantity: i.quantity })),
                            total: inv.total, pdfLink,
                          });
                          openWhatsApp(phone, message);
                        }} title="Share via WhatsApp">
                          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
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
          </CardContent>
        </Card>
      </div>
      <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} html={pdfHtml} title={pdfTitle} />
    </AppLayout>
  );
}
