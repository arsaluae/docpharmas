import { useEffect, useState } from "react";
import { logAudit } from "@/lib/audit";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2, RotateCcw, Search, Loader2, Calendar, Download } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { escIlike, searchCustomerIds } from "@/lib/search-helpers";
import { BulkActionBar, useBulkSelection, RowCheckbox } from "@/components/BulkActionBar";
import { Checkbox } from "@/components/ui/checkbox";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";
import { generateDocumentViews } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";

interface ReturnItem { product_id: string; product_name: string; batch_number: string; quantity: string; rate: string; gst_rate: string; }

const DATE_RANGES = [
  { label: "All", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

export default function SalesReturns() {
  const [returns, setReturns] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [reason, setReason] = useState("");
  const [items, setItems] = useState<ReturnItem[]>([{ product_id: "", product_name: "", batch_number: "", quantity: "1", rate: "0", gst_rate: "0" }]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const pagination = usePagination();
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfViews, setPdfViews] = useState<any>(undefined);

  const bulk = useBulkSelection();

  const debouncedSearch = useDebouncedValue(search, 300);
  useEffect(() => { pagination.setPage(0); }, [debouncedSearch, dateRange]);
  useEffect(() => { loadData(); }, [pagination.page, debouncedSearch]);

  const printReturn = async (r: any) => {
    const { data: its } = await supabase.from("sales_return_items")
      .select("*, products(name)").eq("return_id", r.id);
    const { data: cust } = r.customer_id
      ? await supabase.from("customers").select("name, phone, sms_mobile, city, area, address, customer_code, old_erp_account_code").eq("id", r.customer_id).single()
      : { data: null } as any;
    const rows = (its || []).map((i: any, idx: number) => ({
      idx: idx + 1,
      product_name: i.products?.name || "Item",
      batch_number: i.batch_number || "—",
      quantity: i.quantity,
      rate: Number(i.rate).toLocaleString(),
      amount: Number(i.amount).toLocaleString(),
    }));
    const opts: any = {
      title: "SALES RETURN", documentNumber: r.return_number, date: r.date, statusTheme: "draft" as const,
      partyLabel: "Customer",
      partyName: cust?.name || r.customers?.name || "—",
      partyCode: cust?.customer_code || undefined,
      partyMobile: cust?.sms_mobile || undefined,
      partyPhone: cust?.phone || undefined,
      partyCity: cust?.city || undefined,
      partyArea: cust?.area || undefined,
      partyAddress: cust?.address || undefined,
      partyAccountCode: cust?.old_erp_account_code || undefined,
      columns: [
        { header: "#", key: "idx" },
        { header: "Product", key: "product_name" },
        { header: "Batch #", key: "batch_number" },
        { header: "Qty", key: "quantity", align: "right" as const },
        { header: "Rate", key: "rate", align: "right" as const },
        { header: "Amount", key: "amount", align: "right" as const },
      ],
      rows,
      totals: [{ label: "Total", value: `PKR ${Number(r.total).toLocaleString()}` }],
      notes: r.reason || undefined,
      settings, template: getTemplate("sales_invoice"),
    };
    setPdfViews(generateDocumentViews(opts));
    setPdfTitle(`Sales Return — ${r.return_number}`);
    setPdfOpen(true);
  };

  const deleteOne = async (id: string) => {
    // Delete child stock movements first so balance trigger reverses cleanly
    await supabase.from("stock_movements").delete().eq("reference_type", "sales_return").eq("reference_id", id);
    await supabase.from("sales_return_items").delete().eq("return_id", id);
    const { error } = await supabase.from("sales_returns").delete().eq("id", id);
    if (error) throw error;
  };

  const loadData = async () => {
    setLoading(true);
    let retQuery = supabase.from("sales_returns").select("*, customers(name)", { count: "exact" }).order("created_at", { ascending: false });
    const term = debouncedSearch.trim();
    if (term) {
      const safe = escIlike(term);
      const custIds = await searchCustomerIds(term);
      const idClause = custIds.length > 0 ? `,customer_id.in.(${custIds.join(",")})` : "";
      retQuery = retQuery.or(`return_number.ilike.%${safe}%,reason.ilike.%${safe}%${idClause}`);
    }
    const [{ data: r, count }, { data: c }, { data: inv }, { data: p }] = await Promise.all([
      retQuery.range(pagination.from, pagination.to),
      supabase.from("customers").select("id, name").eq("is_active", true),
      supabase.from("sales_invoices").select("id, invoice_number, customer_id"),
      supabase.from("products").select("id, name, selling_price").eq("is_active", true),
    ]);
    if (r) setReturns(r);
    if (count !== null) pagination.setTotalCount(count);
    if (c) setCustomers(c);
    if (inv) setInvoices(inv);
    if (p) setProducts(p);
    setLoading(false);
  };

  // When an invoice is selected, prefill line items from the ORIGINAL invoice snapshot
  // (rate, gst_rate, batch_number, product_name) so the credit note reflects what was
  // actually billed — not a stale live products.selling_price.
  useEffect(() => {
    if (!invoiceId) return;
    (async () => {
      const { data: invItems } = await supabase
        .from("sales_invoice_items")
        .select("product_id, product_name, quantity, rate, gst_rate, batch_number")
        .eq("invoice_id", invoiceId);
      if (!invItems || invItems.length === 0) return;
      setItems(invItems.map((it: any) => ({
        product_id: it.product_id || "",
        product_name: it.product_name || (products.find(p => p.id === it.product_id)?.name ?? ""),
        batch_number: it.batch_number || "",
        quantity: String(it.quantity),
        rate: String(it.rate),
        gst_rate: String(it.gst_rate ?? 0),
      })));
      const inv = invoices.find(i => i.id === invoiceId);
      if (inv && inv.customer_id) setCustomerId(inv.customer_id);
    })();
  }, [invoiceId]);

  const handleSave = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    const validItems = items.filter(i => i.product_id && Number(i.quantity) > 0);
    if (validItems.length === 0) { toast.error("Add at least one item"); return; }

    setSaving(true);
    // Return line `amount` is ex-tax (matches sales_invoice_items contract).
    // Credit-note `total` is INC-TAX so the customer balance reversal matches the
    // inc-tax amount originally added by the sales invoice trigger.
    const netTotal = validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.rate), 0);
    const taxTotal = validItems.reduce((s, i) => s + Number(i.quantity) * Number(i.rate) * (Number(i.gst_rate || 0) / 100), 0);
    const total = Math.round((netTotal + taxTotal) * 100) / 100;
    const { data: num } = await supabase.rpc("generate_document_number", { p_document_type: "sales_return" });
    if (!num) { toast.error("Failed to generate number"); setSaving(false); return; }

    const { data: sr, error } = await supabase.from("sales_returns").insert({
      return_number: num, customer_id: customerId, invoice_id: invoiceId || null, reason: reason || null, total, status: "confirmed",
    }).select().single();
    if (error || !sr) { toast.error("Failed to create return"); setSaving(false); return; }

    await supabase.from("sales_return_items").insert(validItems.map(i => ({
      return_id: sr.id, product_id: i.product_id, batch_number: i.batch_number || null,
      quantity: Number(i.quantity), rate: Number(i.rate),
      amount: Math.round(Number(i.quantity) * Number(i.rate) * 100) / 100,
    })));

    // Create return_in stock movements to restore inventory (with reference_id for audit trail)
    await supabase.from("stock_movements").insert(validItems.map(i => ({
      product_id: i.product_id, movement_type: "return_in", quantity: Number(i.quantity),
      batch_number: i.batch_number || null, reference_type: "sales_return", reference_id: sr.id,
      date: new Date().toISOString().split("T")[0], notes: `Sales Return ${num}`,
    })));

    // Auto-create Credit Note (replaces the old direct customer balance trigger)
    const { data: cnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "credit_note" });
    if (cnNumber) {
      await supabase.from("credit_notes").insert({
        credit_note_number: cnNumber, party_type: "customer", party_id: customerId,
        amount: total, reason: reason || `Sales Return ${num}`, reference: num,
        date: new Date().toISOString().split("T")[0],
      });
      logAudit({ action: "credit_note_issued", entity_type: "credit_note", entity_number: cnNumber, changes: { from_return: num, amount: total, party: "customer" } });
    }

    logAudit({ action: "return_raised", entity_type: "sales_return", entity_id: sr.id, entity_number: num, changes: { reason, total, invoice_id: invoiceId || null } });
    toast.success(`Sales Return ${num} created — Credit Note auto-issued`);
    setOpen(false); setCustomerId(""); setInvoiceId(""); setReason("");
    setItems([{ product_id: "", product_name: "", batch_number: "", quantity: "1", rate: "0", gst_rate: "0" }]);
    setSaving(false);
    loadData();
  };

  const addItem = () => setItems([...items, { product_id: "", product_name: "", batch_number: "", quantity: "1", rate: "0", gst_rate: "0" }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, value: string) => {
    const next = [...items];
    (next[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      // Free-form (no invoice) returns still fall back to live selling_price — but the
      // invoice-link useEffect above prefills from the snapshot whenever an invoice is chosen.
      if (p) { next[idx].product_name = p.name; next[idx].rate = String(p.selling_price); }
    }
    setItems(next);
  };

  const filteredInvoices = invoices.filter(inv => !customerId || inv.customer_id === customerId);
  const customerOptions = customers.map(c => ({ value: c.id, label: c.name }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));
  const invoiceOptions = [{ value: "", label: "None" }, ...filteredInvoices.map(i => ({ value: i.id, label: i.invoice_number }))];

  const getDateFilter = () => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (dateRange === "today") return todayStr;
    if (dateRange === "week") {
      const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.toISOString().split("T")[0];
    }
    if (dateRange === "month") return todayStr.slice(0, 7) + "-01";
    return null;
  };

  // Server-side search already filters. Keep client date-range narrowing.
  const filtered = returns.filter(r => {
    const dateStart = getDateFilter();
    return !dateStart || r.date >= dateStart;
  });

  const totalValue = filtered.reduce((s, r) => s + Number(r.total), 0);

  const headerActions = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Return</Button></DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Sales Return</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div><Label>Customer *</Label><SearchableSelect options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Search customer..." /></div>
          <div><Label>Invoice (optional)</Label><SearchableSelect options={invoiceOptions} value={invoiceId} onChange={setInvoiceId} placeholder="Link invoice..." /></div>
          <div className="col-span-2"><Label>Reason</Label><Input value={reason} onChange={e => setReason(e.target.value)} /></div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between"><Label className="text-sm font-semibold">Return Items</Label><Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add</Button></div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-4"><SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Product" triggerClassName="h-8 text-xs" /></div>
              <div className="col-span-2"><Input placeholder="Batch" className="text-xs h-8" value={item.batch_number} onChange={e => updateItem(idx, "batch_number", e.target.value)} /></div>
              <div className="col-span-2"><Input type="number" className="text-xs h-8" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} /></div>
              <div className="col-span-2"><Input type="number" className="text-xs h-8" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} /></div>
              <div className="col-span-1 text-right text-xs font-mono pt-2">{(Number(item.quantity) * Number(item.rate)).toLocaleString()}</div>
              <div className="col-span-1"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItem(idx)}><Trash2 className="h-3 w-3" /></Button></div>
            </div>
          ))}
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Create Sales Return
        </Button>
      </DialogContent>
    </Dialog>
  );

  return (
    <AppLayout title="Sales Returns" subtitle="Credit notes with item-level returns" headerActions={headerActions}>
          <div className="p-6">
            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search returns..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                {DATE_RANGES.map(d => (
                  <button key={d.value} onClick={() => setDateRange(d.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${dateRange === d.value ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground ml-auto">
                {filtered.length} returns · PKR {totalValue.toLocaleString()}
              </p>
            </div>
            <Card className="glass-card"><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && bulk.selected.length === filtered.length} onCheckedChange={() => bulk.toggleAll(filtered.map(r => r.id))} /></TableHead>
                  <TableHead>Return #</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Reason</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead className="w-20">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-12 text-muted-foreground"><RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-40" />No sales returns found.</TableCell></TableRow>
                  ) : filtered.map(r => (
                    <TableRow key={r.id} data-state={bulk.isSelected(r.id) ? "selected" : undefined}>
                      <TableCell><RowCheckbox checked={bulk.isSelected(r.id)} onCheckedChange={() => bulk.toggle(r.id)} /></TableCell>
                      <TableCell className="font-medium font-mono">{r.return_number}</TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.customers?.name || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.reason || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{Number(r.total).toLocaleString()}</TableCell>
                      <TableCell><span className="status-pill bg-warning/10 text-warning">{r.status}</span></TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => printReturn(r)}>
                          <Download className="h-3 w-3" /> PDF
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationControls page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount} hasNext={pagination.hasNext} hasPrev={pagination.hasPrev} onNext={pagination.nextPage} onPrev={pagination.prevPage} pageSize={pagination.pageSize} />
            </CardContent></Card>
          </div>
          <BulkActionBar selectedIds={bulk.selected} onClear={bulk.clear} onDeleteOne={deleteOne} entityLabel="sales return" onDone={loadData} />
          <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} views={pdfViews} title={pdfTitle} />
    </AppLayout>
  );
}