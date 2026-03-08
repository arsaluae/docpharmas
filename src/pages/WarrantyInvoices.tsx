import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ShieldCheck, Trash2, X, Download } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdfHtml } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

interface Customer { id: string; name: string; company: string | null; }
interface Product { id: string; name: string; selling_price: number; }

interface LineItem {
  product_id: string; product_name: string; batch_number: string;
  expiry_date: string; quantity: number; mrp_rate: number; amount: number;
}

interface WarrantyInvoice {
  id: string; warranty_number: string; date: string; customer_id: string | null;
  pharmacy_name: string; pharmacy_address: string | null; pharmacy_license_no: string | null;
  items: LineItem[]; subtotal: number; gst_amount: number; total: number;
  notes: string | null; status: string; created_at: string;
  customers?: { name: string } | null;
}

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  customer_id: "", pharmacy_name: "", pharmacy_address: "", pharmacy_license_no: "", notes: "",
};

export default function WarrantyInvoices() {
  const [invoices, setInvoices] = useState<WarrantyInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [items, setItems] = useState<LineItem[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [pdfHtml, setPdfHtml] = useState("");
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("");
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [inv, cust, prod] = await Promise.all([
      supabase.from("warranty_invoices").select("*, customers(name)").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name, company").order("name"),
      supabase.from("products").select("id, name, selling_price").order("name"),
    ]);
    if (inv.data) setInvoices(inv.data as any);
    if (cust.data) setCustomers(cust.data);
    if (prod.data) setProducts(prod.data);
  };

  const addItem = () => {
    setItems([...items, { product_id: "", product_name: "", batch_number: "", expiry_date: "", quantity: 1, mrp_rate: 0, amount: 0 }]);
  };

  const updateItem = (idx: number, field: keyof LineItem, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { updated[idx].product_name = p.name; updated[idx].mrp_rate = p.selling_price; }
    }
    if (field === "quantity" || field === "mrp_rate") {
      updated[idx].amount = updated[idx].quantity * updated[idx].mrp_rate;
    }
    setItems(updated);
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.amount, 0);
  const gstAmount = settings?.gst_enabled ? Math.round(subtotal * (Number(settings.default_gst_rate) / 100)) : 0;
  const total = subtotal + gstAmount;

  const handleSave = async () => {
    if (!form.pharmacy_name.trim()) { toast.error("Pharmacy name is required"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }

    let warrantyNumber: string | undefined;
    if (!editId) {
      const { data: num } = await supabase.rpc("generate_document_number", { p_document_type: "warranty_invoice" });
      if (!num) { toast.error("Failed to generate number"); return; }
      warrantyNumber = num;
    }

    const payload = {
      warranty_number: editId ? undefined : warrantyNumber,
      date: form.date, customer_id: form.customer_id || null,
      pharmacy_name: form.pharmacy_name, pharmacy_address: form.pharmacy_address || null,
      pharmacy_license_no: form.pharmacy_license_no || null, items: items as any,
      subtotal, gst_amount: gstAmount, total, notes: form.notes || null, status: "issued",
    };

    if (editId) {
      const { warranty_number, ...updatePayload } = payload;
      await supabase.from("warranty_invoices").update(updatePayload).eq("id", editId);
      toast.success("Warranty invoice updated");
    } else {
      await supabase.from("warranty_invoices").insert(payload as any);
      toast.success("Warranty invoice created");
    }
    setOpen(false); setForm(emptyForm); setItems([]); setEditId(null); load();
  };

  const handleEdit = (inv: WarrantyInvoice) => {
    setEditId(inv.id);
    setForm({ date: inv.date, customer_id: inv.customer_id || "", pharmacy_name: inv.pharmacy_name, pharmacy_address: inv.pharmacy_address || "", pharmacy_license_no: inv.pharmacy_license_no || "", notes: inv.notes || "" });
    setItems(Array.isArray(inv.items) ? inv.items : []);
    setOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("warranty_invoices").delete().eq("id", id);
    toast.success("Deleted"); load();
  };

  const customerOptions = customers.map(c => ({ value: c.id, label: c.name + (c.company ? ` — ${c.company}` : "") }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

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

  const headerActions = (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); setItems([]); } }}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:scale-[1.02] transition-all">
          <Plus className="h-4 w-4" /> New Warranty Invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Warranty Invoice</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} /></div>
          <div>
            <Label>Customer (who requested)</Label>
            <SearchableSelect options={customerOptions} value={form.customer_id} onChange={v => setForm({...form, customer_id: v})} placeholder="Search customer..." />
          </div>
          <div className="col-span-2 border-t pt-3 mt-1">
            <p className="text-sm font-medium text-muted-foreground mb-2">Pharmacy / Distributor Details</p>
          </div>
          <div><Label>Pharmacy Name *</Label><Input value={form.pharmacy_name} onChange={e => setForm({...form, pharmacy_name: e.target.value})} /></div>
          <div><Label>License No.</Label><Input value={form.pharmacy_license_no} onChange={e => setForm({...form, pharmacy_license_no: e.target.value})} /></div>
          <div className="col-span-2"><Label>Pharmacy Address</Label><Input value={form.pharmacy_address} onChange={e => setForm({...form, pharmacy_address: e.target.value})} /></div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <Label className="text-sm font-medium">Line Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
          </div>
          {items.length > 0 && (
            <div className="border rounded overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Product</TableHead>
                    <TableHead>Batch</TableHead><TableHead>Expiry</TableHead>
                    <TableHead className="w-20">Qty</TableHead><TableHead className="w-24">MRP Rate</TableHead>
                    <TableHead className="w-24 text-right">Amount</TableHead><TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell><SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Select" triggerClassName="h-8 text-xs" /></TableCell>
                      <TableCell><Input className="h-8 text-xs" value={item.batch_number} onChange={e => updateItem(idx, "batch_number", e.target.value)} /></TableCell>
                      <TableCell><Input className="h-8 text-xs" type="date" value={item.expiry_date} onChange={e => updateItem(idx, "expiry_date", e.target.value)} /></TableCell>
                      <TableCell><Input className="h-8 text-xs" type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", Number(e.target.value))} /></TableCell>
                      <TableCell><Input className="h-8 text-xs" type="number" value={item.mrp_rate} onChange={e => updateItem(idx, "mrp_rate", Number(e.target.value))} /></TableCell>
                      <TableCell className="text-right font-mono text-xs">{item.amount.toLocaleString()}</TableCell>
                      <TableCell><Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(idx)}><X className="h-3 w-3" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {items.length > 0 && (
            <div className="text-right mt-2 space-y-1 text-sm">
              <div>Subtotal: <span className="font-mono">{subtotal.toLocaleString()}</span></div>
              {settings?.gst_enabled && <div>GST ({settings.default_gst_rate}%): <span className="font-mono">{gstAmount.toLocaleString()}</span></div>}
              <div className="font-bold">Total: <span className="font-mono">{total.toLocaleString()}</span></div>
            </div>
          )}
        </div>

        <div className="mt-3"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} /></div>
        <Button onClick={handleSave} className="w-full mt-4">{editId ? "Update" : "Create"} Warranty Invoice</Button>
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
                          const wiHtml = generatePdfHtml({
                            title: "WARRANTY INVOICE", documentNumber: inv.warranty_number, date: inv.date,
                            partyLabel: "Pharmacy", partyName: inv.pharmacy_name,
                            partyAddress: inv.pharmacy_address || undefined,
                            meta: inv.pharmacy_license_no ? [{ label: "License #", value: inv.pharmacy_license_no }] : [],
                            columns: [
                              { header: "#", key: "idx" }, { header: "Product", key: "product_name" },
                              { header: "Batch", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
                              { header: "Qty", key: "quantity", align: "right" }, { header: "MRP Rate", key: "mrp_rate", align: "right" },
                              { header: "Amount", key: "amount", align: "right" },
                            ],
                            rows: wiItems.map((i: any, idx: number) => ({
                              ...i, idx: idx + 1, mrp_rate: Number(i.mrp_rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
                            })),
                            totals: [
                              { label: "Subtotal", value: `PKR ${Number(inv.subtotal).toLocaleString()}` },
                              ...(settings?.gst_enabled ? [{ label: `GST (${settings.default_gst_rate}%)`, value: `PKR ${Number(inv.gst_amount).toLocaleString()}` }] : []),
                              { label: "Total", value: `PKR ${Number(inv.total).toLocaleString()}` },
                            ],
                            notes: inv.notes || undefined, settings, template: getTemplate("warranty_invoice"),
                          });
                          setPdfHtml(wiHtml); setPdfTitle(`Warranty Invoice — ${inv.warranty_number}`); setPdfOpen(true);
                        }}>
                          <Download className="h-3 w-3" /> PDF
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
