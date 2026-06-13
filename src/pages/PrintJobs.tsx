import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { escIlike, searchSupplierIds, searchProductIds } from "@/lib/search-helpers";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Search, ClipboardCheck, Package, Truck, CheckCircle2, Trash2, Eye, Send, Factory, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdfHtml, generateDocumentViews } from "@/lib/pdf-generator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";

interface PrinterEntity { id: string; name: string; }
interface SupplierEntity { id: string; name: string; }
interface Product { id: string; name: string; }
interface PrintJob {
 id: string; job_number: string; printer_id: string | null; product_id: string | null;
 date: string; quantity_ordered: number; quantity_delivered: number; quantity_rejected: number;
 rejection_reason: string | null; status: string; cost_per_unit: number; total_cost: number;
 printer_share_percent: number; printer_share_amount: number; our_share_amount: number;
 notes: string | null; created_at: string;
 allotted_supplier_id: string | null; quantity_dispatched_to_supplier: number; quantity_at_factory: number;
}


interface DispatchRow { id: string; print_job_id: string; supplier_id: string; qty_dispatched: number; date: string; notes: string | null; }

export default function PrintJobs() {
 const navigate = useNavigate();
 const [jobs, setJobs] = useState<PrintJob[]>([]);
 const [printers, setPrinters] = useState<PrinterEntity[]>([]);
 const [suppliers, setSuppliers] = useState<SupplierEntity[]>([]);
 const [products, setProducts] = useState<Product[]>([]);
 const [dispatchesByJob, setDispatchesByJob] = useState<Record<string, DispatchRow[]>>({});
 const [search, setSearch] = useState("");
 const [tab, setTab] = useState("all");
 const [filterSupplier, setFilterSupplier] = useState("all");
 const [filterProduct, setFilterProduct] = useState("all");
 const [filterPrinter, setFilterPrinter] = useState("all");
 const [groupBy, setGroupBy] = useState<"none" | "supplier" | "product" | "printer">("none");
 const pagination = usePagination();

 // Create form
 const [createOpen, setCreateOpen] = useState(false);
 const [printerId, setPrinterId] = useState("");
 const [productId, setProductId] = useState("");
 const [allottedSupplierId, setAllottedSupplierId] = useState("");
 const [qtyOrdered, setQtyOrdered] = useState("");
 const [costPerUnit, setCostPerUnit] = useState("");
 const [jobDate, setJobDate] = useState(new Date().toISOString().split("T")[0]);
 const [jobNotes, setJobNotes] = useState("");

 // Dispatch to supplier dialog
 const [dispatchJob, setDispatchJob] = useState<PrintJob | null>(null);
 const [dispatchQty, setDispatchQty] = useState("");
 const [dispatchSupplierId, setDispatchSupplierId] = useState("");
 const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().split("T")[0]);
 const [dispatchNote, setDispatchNote] = useState("");


 // Deliver dialog
 const [deliverJob, setDeliverJob] = useState<PrintJob | null>(null);
 const [qtyDelivered, setQtyDelivered] = useState("");
 const [qtyRejected, setQtyRejected] = useState("");
 const [rejectionReason, setRejectionReason] = useState("");

 // Settle dialog
 const [settleJob, setSettleJob] = useState<PrintJob | null>(null);
 const [printerSharePct, setPrinterSharePct] = useState("60");

 // Delete
 const [deleteId, setDeleteId] = useState<string | null>(null);

 // Rejection
 const [rejectJob, setRejectJob] = useState<PrintJob | null>(null);
 const [rejQty, setRejQty] = useState("");
 const [rejReason, setRejReason] = useState("");
 const [rejOurPct, setRejOurPct] = useState("50");
 const [rejEvidence, setRejEvidence] = useState("");
 const [rejBusy, setRejBusy] = useState(false);

 // Names lookup
 const [printerNames, setPrinterNames] = useState<Record<string, string>>({});
 const [productNames, setProductNames] = useState<Record<string, string>>({});
 const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});


 // PDF preview
 const [pdfHtml, setPdfHtml] = useState("");
 const [pdfOpen, setPdfOpen] = useState(false);
 const [pdfTitle, setPdfTitle] = useState("");
 const [pdfOpts, setPdfOpts] = useState<any | null>(null);
 const { settings } = useCompanySettings();

 const [searchParams, setSearchParams] = useSearchParams();
 useEffect(() => { load(); }, [pagination.page, tab, filterPrinter, filterProduct]);

 // Prefill create dialog from URL params (?product_id=…&supplier_id=…&qty=…)
 useEffect(() => {
 const pid = searchParams.get("product_id");
 const sid = searchParams.get("supplier_id");
 const qty = searchParams.get("qty");
 if (pid || sid || qty) {
 if (pid) setProductId(pid);
 if (sid) setAllottedSupplierId(sid);
 if (qty) setQtyOrdered(qty);
 setCreateOpen(true);
 // Clean URL so reload won't re-trigger
 const next = new URLSearchParams(searchParams);
 next.delete("product_id"); next.delete("supplier_id"); next.delete("qty");
 setSearchParams(next, { replace: true });
 }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [searchParams]);


 const load = async () => {
 let jobQuery = supabase.from("print_jobs").select("*", { count: "exact" }).order("created_at", { ascending: false });
 if (tab !== "all") jobQuery = jobQuery.eq("status", tab);
 if (filterPrinter !== "all") jobQuery = jobQuery.eq("printer_id", filterPrinter);
 if (filterProduct !== "all") jobQuery = jobQuery.eq("product_id", filterProduct);
 jobQuery = jobQuery.range(pagination.from, pagination.to);
 const [j, pr, prod, sup] = await Promise.all([
 jobQuery,
 supabase.from("printers").select("id, name").eq("is_active", true),
 supabase.from("products").select("id, name").eq("is_active", true),
 supabase.from("suppliers").select("id, name").eq("is_active", true).order("name"),
 ]);
 if (j.data) setJobs(j.data as any);
 if (j.count !== null && j.count !== undefined) pagination.setTotalCount(j.count);
 if (pr.data) { setPrinters(pr.data); const n: Record<string, string> = {}; pr.data.forEach(p => n[p.id] = p.name); setPrinterNames(n); }
 if (prod.data) { setProducts(prod.data); const n: Record<string, string> = {}; prod.data.forEach(p => n[p.id] = p.name); setProductNames(n); }
 if (sup.data) { setSuppliers(sup.data); const n: Record<string, string> = {}; sup.data.forEach(s => n[s.id] = s.name); setSupplierNames(n); }
 // Load dispatches for visible jobs
 const ids = (j.data || []).map((x: any) => x.id);
 if (ids.length) {
   const { data: disp } = await supabase.from("print_dispatches" as any).select("*").in("print_job_id", ids);
   const grouped: Record<string, DispatchRow[]> = {};
   (disp as any[] || []).forEach(d => { (grouped[d.print_job_id] = grouped[d.print_job_id] || []).push(d); });
   setDispatchesByJob(grouped);
 } else { setDispatchesByJob({}); }
 };


 const handleCreate = async () => {
 if (!printerId || !productId || !qtyOrdered || Number(qtyOrdered) <= 0 || !costPerUnit) {
 toast.error("Printer, product, quantity & cost are required"); return;
 }
 const { data: jobNum } = await supabase.rpc("generate_document_number", { p_document_type: "print_job" });
 if (!jobNum) { toast.error("Failed to generate job number"); return; }
 const totalCost = Number(qtyOrdered) * Number(costPerUnit);
 const { error } = await supabase.from("print_jobs").insert({
 job_number: jobNum, printer_id: printerId, product_id: productId, date: jobDate,
 quantity_ordered: Number(qtyOrdered), cost_per_unit: Number(costPerUnit), total_cost: totalCost,
 notes: jobNotes || null, status: "draft",
 allotted_supplier_id: allottedSupplierId || null,
 } as any);
 if (error) { toast.error("Failed to create job"); return; }
 toast.success(`Print Job ${jobNum} created`);
 setCreateOpen(false); setPrinterId(""); setProductId(""); setAllottedSupplierId(""); setQtyOrdered(""); setCostPerUnit(""); setJobNotes(""); load();
 };

 const handleDispatch = async () => {
 if (!dispatchJob) return;
 const qty = Number(dispatchQty);
 const supId = dispatchSupplierId || dispatchJob.allotted_supplier_id;
 if (!qty || qty <= 0) { toast.error("Quantity required"); return; }
 if (!supId) { toast.error("Select a supplier"); return; }
 if (qty > Number(dispatchJob.quantity_at_factory)) { toast.error(`Only ${dispatchJob.quantity_at_factory} pcs available at factory`); return; }

 // Insert dispatch row (trigger updates print_jobs.quantity_dispatched_to_supplier)
 const { error } = await supabase.from("print_dispatches" as any).insert({
   print_job_id: dispatchJob.id,
   supplier_id: supId,
   qty_dispatched: qty,
   date: dispatchDate,
   notes: dispatchNote || null,
 } as any);
 if (error) { toast.error("Failed to dispatch: " + error.message); return; }

 // Optional stock movement record (logical move)
 if (dispatchJob.product_id) {
 await supabase.from("stock_movements").insert({
 product_id: dispatchJob.product_id,
 movement_type: "adjustment_out",
 quantity: qty,
 date: dispatchDate,
 reference_type: "print_job_dispatch",
 reference_id: dispatchJob.id,
 notes: `Dispatched to ${supplierNames[supId] || "supplier"} — ${dispatchJob.job_number}${dispatchNote ? `: ${dispatchNote}` : ""}`,
 } as any);
 }

 // Auto-promote draft → dispatched
 if (dispatchJob.status === "draft") {
   await supabase.from("print_jobs").update({ status: "dispatched" } as any).eq("id", dispatchJob.id);
 }

 toast.success(`${qty.toLocaleString()} pcs dispatched to ${supplierNames[supId] || "supplier"}`);
 setDispatchQty(""); setDispatchNote("");
 // Keep dialog open so user can add another supplier split
 await load();
 const refreshed = await supabase.from("print_jobs").select("*").eq("id", dispatchJob.id).single();
 if (refreshed.data) setDispatchJob(refreshed.data as any);
 };


 const handleDeliver = async () => {
 if (!deliverJob) return;
 const delivered = Number(qtyDelivered);
 const rejected = Number(qtyRejected);
 if (delivered <= 0) { toast.error("Delivered quantity required"); return; }
 // Note: over-delivery (delivered > ordered) IS allowed — printer may send more
 const overByPct = ((delivered + rejected) - deliverJob.quantity_ordered) / Math.max(deliverJob.quantity_ordered, 1) * 100;
 if (overByPct > 20) {
   if (!confirm(`Delivery (${(delivered + rejected).toLocaleString()}) exceeds order (${deliverJob.quantity_ordered.toLocaleString()}) by ${overByPct.toFixed(1)}%. Record anyway?`)) return;
 }
 const { error } = await supabase.from("print_jobs").update({
 quantity_delivered: delivered, quantity_rejected: rejected,
 rejection_reason: rejectionReason || null, status: "dispatched",
 }).eq("id", deliverJob.id);
 if (error) { toast.error("Failed to update job"); return; }
 // Add delivered goods to inventory as stock movement
 if (deliverJob.product_id && delivered > 0) {
 await supabase.from("stock_movements").insert({
 product_id: deliverJob.product_id,
 movement_type: "purchase_in",
 quantity: delivered,
 date: new Date().toISOString().split("T")[0],
 reference_type: "print_job",
 notes: `Print job ${deliverJob.job_number} delivery`,
 });
 }
 toast.success("Delivery recorded");
 setDeliverJob(null); setQtyDelivered(""); setQtyRejected(""); setRejectionReason(""); load();
 };

 const handleSettle = async () => {
 if (!settleJob) return;
 const pct = Number(printerSharePct);
 if (pct < 0 || pct > 100) { toast.error("Share must be 0-100%"); return; }
 const rejectionCost = settleJob.quantity_rejected * settleJob.cost_per_unit;
 const printerShare = rejectionCost * (pct / 100);
 const ourShare = rejectionCost - printerShare;
 const finalTotal = settleJob.total_cost - printerShare;

 const { error } = await supabase.from("print_jobs").update({
 printer_share_percent: pct, printer_share_amount: printerShare,
 our_share_amount: ourShare, total_cost: finalTotal, status: "settled",
 }).eq("id", settleJob.id);
 if (error) { toast.error("Failed to settle"); return; }

 // Auto-sync: create landed cost record for this print job
 if (settleJob.product_id) {
 await supabase.from("additional_costs").insert({
 reference_type: "print_job", reference_id: settleJob.id,
 cost_type: "printing", description: `Print Job ${settleJob.job_number} — packaging cost`,
 amount: finalTotal, vendor_id: settleJob.printer_id || null,
 date: new Date().toISOString().split("T")[0],
 });
 }

 toast.success(`Job settled — Printer bears PKR ${printerShare.toLocaleString()}, You bear PKR ${ourShare.toLocaleString()}`);
 setSettleJob(null); setPrinterSharePct("60"); load();
 };

 const previewJob = (job: PrintJob) => {
 const printerName = printerNames[job.printer_id || ""] || "—";
 const productName = productNames[job.product_id || ""] || "—";
 const __opts_html = ({
 title: "PRINT JOB ORDER", documentNumber: job.job_number, date: job.date,
 partyLabel: "Printer", partyName: printerName,
 statusTheme: job.status === "settled" ? "paid" : job.status === "delivered" ? "dispatched" : "draft",
 columns: [
 { header: "Product", key: "product" },
 { header: "Qty Ordered", key: "qty_ordered", align: "right" },
 { header: "Qty Delivered", key: "qty_delivered", align: "right" },
 { header: "Qty Rejected", key: "qty_rejected", align: "right" },
 { header: "Cost/Unit", key: "cost_unit", align: "right" },
 { header: "Total Cost", key: "total_cost", align: "right" },
 ],
 rows: [{
 product: productName,
 qty_ordered: Number(job.quantity_ordered).toLocaleString(),
 qty_delivered: Number(job.quantity_delivered).toLocaleString(),
 qty_rejected: Number(job.quantity_rejected).toLocaleString(),
 cost_unit: `PKR ${Number(job.cost_per_unit).toLocaleString()}`,
 total_cost: `PKR ${Number(job.total_cost).toLocaleString()}`,
 }],
 totals: [
 { label: "Total Cost", value: `PKR ${Number(job.total_cost).toLocaleString()}` },
 ...(job.status === "settled" ? [
 { label: "Printer Share", value: `PKR ${Number(job.printer_share_amount).toLocaleString()} (${job.printer_share_percent}%)` },
 { label: "Our Share", value: `PKR ${Number(job.our_share_amount).toLocaleString()}` },
 ] : []),
 ],
 notes: [job.notes, job.rejection_reason ? `Rejection: ${job.rejection_reason}` : null].filter(Boolean).join("\n") || undefined,
 settings,
 } as any);
 const html = generatePdfHtml(__opts_html);
 setPdfOpts(__opts_html);
 setPdfHtml(html); setPdfTitle(`Print Job — ${job.job_number}`); setPdfOpen(true);
 };

 const handleDelete = async () => {
 if (!deleteId) return;
 const { error } = await supabase.from("print_jobs").delete().eq("id", deleteId);
 if (error) toast.error("Failed to delete"); else toast.success("Job deleted");
 setDeleteId(null); load();
 };

 const filtered = jobs.filter(j => {
 const matchSearch = j.job_number.toLowerCase().includes(search.toLowerCase()) ||
 (printerNames[j.printer_id || ""] || "").toLowerCase().includes(search.toLowerCase()) ||
 (productNames[j.product_id || ""] || "").toLowerCase().includes(search.toLowerCase());
 if (!matchSearch) return false;
 if (filterSupplier !== "all") {
   const disp = dispatchesByJob[j.id] || [];
   const hasSupplier = j.allotted_supplier_id === filterSupplier || disp.some(d => d.supplier_id === filterSupplier);
   if (!hasSupplier) return false;
 }
 return true;
 });

 // Group rows for display
 const grouped: { key: string; label: string; rows: PrintJob[] }[] = (() => {
   if (groupBy === "none") return [{ key: "all", label: "", rows: filtered }];
   const acc: Record<string, PrintJob[]> = {};
   filtered.forEach(j => {
     let k = "—";
     if (groupBy === "printer") k = printerNames[j.printer_id || ""] || "—";
     else if (groupBy === "product") k = productNames[j.product_id || ""] || "—";
     else if (groupBy === "supplier") k = supplierNames[j.allotted_supplier_id || ""] || "Unallotted";
     (acc[k] = acc[k] || []).push(j);
   });
   return Object.entries(acc).sort((a, b) => a[0].localeCompare(b[0])).map(([label, rows]) => ({ key: label, label, rows }));
 })();

 const totalJobsValue = jobs.reduce((s, j) => s + Number(j.total_cost), 0);
 const pendingSettlement = jobs.filter(j => j.status === "delivered").length;
 const totalRejected = jobs.reduce((s, j) => s + Number(j.quantity_rejected), 0);
 const totalAtFactory = jobs.reduce((s, j) => s + Number(j.quantity_at_factory || 0), 0);

 // Per-printer factory stock breakdown
 const factoryByPrinter: { name: string; qty: number }[] = (() => {
 const acc: Record<string, number> = {};
 jobs.forEach(j => {
 const q = Number(j.quantity_at_factory || 0);
 if (q <= 0) return;
 const name = printerNames[j.printer_id || ""] || "Unknown";
 acc[name] = (acc[name] || 0) + q;
 });
 return Object.entries(acc).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty);
 })();


 const statusBadge = (status: string) => {
 if (status === "draft") return <Badge variant="secondary" className="bg-muted text-muted-foreground">Draft</Badge>;
 if (status === "settled") return <Badge className="bg-primary/15 text-primary border-primary/30">Settled</Badge>;
 return <Badge className="bg-success/15 text-success border-success/30">Dispatched</Badge>;
 };

 const headerActions = (
 <Dialog open={createOpen} onOpenChange={setCreateOpen}>
 <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Print Job</Button></DialogTrigger>
 <DialogContent className="max-w-lg">
 <DialogHeader><DialogTitle>Create Print Job</DialogTitle></DialogHeader>
 <div className="grid grid-cols-2 gap-3 mt-2">
 <div><Label>Printer *</Label><SearchableSelect options={printers.map(p => ({ value: p.id, label: p.name }))} value={printerId} onChange={setPrinterId} placeholder="Select printer..." /></div>
 <div><Label>Product *</Label><SearchableSelect options={products.map(p => ({ value: p.id, label: p.name }))} value={productId} onChange={setProductId} placeholder="Select product..." /></div>
 <div className="col-span-2"><Label>Allotted Supplier</Label><SearchableSelect options={suppliers.map(s => ({ value: s.id, label: s.name }))} value={allottedSupplierId} onChange={setAllottedSupplierId} placeholder="Who will receive the finished packaging?" /></div>
 <div><Label>Quantity Ordered *</Label><Input type="number" value={qtyOrdered} onChange={e => setQtyOrdered(e.target.value)} /></div>
 <div><Label>Cost per Unit (PKR) *</Label><Input type="number" step="0.01" value={costPerUnit} onChange={e => setCostPerUnit(e.target.value)} /></div>
 <div><Label>Date</Label><Input type="date" value={jobDate} onChange={e => setJobDate(e.target.value)} /></div>
 <div><Label>Total Cost</Label><Input disabled value={qtyOrdered && costPerUnit ? (Number(qtyOrdered) * Number(costPerUnit)).toLocaleString() : "0"} /></div>
 <div className="col-span-2"><Label>Notes</Label><Textarea value={jobNotes} onChange={e => setJobNotes(e.target.value)} rows={2} /></div>
 </div>
 <Button onClick={handleCreate} className="w-full mt-4">Create Print Job</Button>
 </DialogContent>
 </Dialog>
 );


 return (
 <AppLayout title="Print Jobs" subtitle="Track printing orders, delivery, rejections & cost splitting" headerActions={headerActions}>
 <div className="space-y-4">
 {/* Stats strip */}
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <Card className="glass-card bg-primary border-primary/20">
 <CardContent className="p-4 flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
 <div><p className="text-xs text-muted-foreground">Total Value</p><p className="text-lg font-bold font-mono text-foreground">PKR {totalJobsValue.toLocaleString()}</p></div>
 </CardContent>
 </Card>
 <Card className="glass-card from-warning/5 to-warning/10 border-warning/20">
 <CardContent className="p-4 flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl bg-warning/15 flex items-center justify-center"><Truck className="h-5 w-5 text-warning" /></div>
 <div><p className="text-xs text-muted-foreground">Pending Settlement</p><p className="text-lg font-bold font-mono text-foreground">{pendingSettlement}</p></div>
 </CardContent>
 </Card>
 <Card className="glass-card from-destructive/5 to-destructive/10 border-destructive/20">
 <CardContent className="p-4 flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl bg-destructive/15 flex items-center justify-center"><ClipboardCheck className="h-5 w-5 text-destructive" /></div>
 <div><p className="text-xs text-muted-foreground">Total Rejected</p><p className="text-lg font-bold font-mono text-foreground">{totalRejected.toLocaleString()}</p></div>
 </CardContent>
 </Card>
 <Card className="glass-card bg-card border-border">
 <CardContent className="p-4 flex items-center gap-3">
 <div className="h-10 w-10 rounded-xl bg-success/15 flex items-center justify-center"><Factory className="h-5 w-5 text-success" /></div>
 <div className="min-w-0">
 <p className="text-xs text-muted-foreground">At Factory (undispatched)</p>
 <p className="text-lg font-bold font-mono text-foreground">{totalAtFactory.toLocaleString()} pcs</p>
 </div>
 </CardContent>
 </Card>
 </div>

 {factoryByPrinter.length > 0 && (
 <div className="flex flex-wrap gap-2 text-xs">
 <span className="text-muted-foreground">By printer:</span>
 {factoryByPrinter.map(f => (
 <span key={f.name} className="px-2 py-1 rounded-md bg-success/10 border border-border text-success dark:text-success font-mono">
 {f.name}: {f.qty.toLocaleString()}
 </span>
 ))}
 </div>
 )}


 <div className="flex flex-wrap items-center gap-3">
 <div className="relative max-w-sm flex-1 min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Search jobs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <Tabs value={tab} onValueChange={setTab}>
 <TabsList>
 <TabsTrigger value="all">All</TabsTrigger>
 <TabsTrigger value="draft">Draft</TabsTrigger>
 <TabsTrigger value="dispatched">Dispatched</TabsTrigger>
 <TabsTrigger value="settled">Settled</TabsTrigger>
 </TabsList>
 </Tabs>
 </div>
 <div className="flex flex-wrap items-center gap-2 text-xs">
   <span className="text-muted-foreground">Filter:</span>
   <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2">
     <option value="all">All Suppliers</option>
     {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
   </select>
   <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2">
     <option value="all">All Products</option>
     {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
   </select>
   <select value={filterPrinter} onChange={e => setFilterPrinter(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2">
     <option value="all">All Printers</option>
     {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
   </select>
   <span className="text-muted-foreground ml-2">Group by:</span>
   <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="h-8 rounded-md border border-border bg-background px-2">
     <option value="none">None</option>
     <option value="supplier">Supplier</option>
     <option value="product">Product</option>
     <option value="printer">Printer</option>
   </select>
 </div>

 <Card className="glass-card">
 <CardContent className="p-0">
 <Table>
 <TableHeader>
 <TableRow>
 <TableHead>Job #</TableHead><TableHead>Printer</TableHead><TableHead>Product</TableHead>
 <TableHead>Allotted Supplier</TableHead>
 <TableHead className="text-right">Ordered</TableHead><TableHead className="text-right">Delivered</TableHead>
 <TableHead className="text-right">At Factory</TableHead>
 <TableHead className="text-right">Rejected</TableHead><TableHead>Status</TableHead>
 <TableHead className="text-right">Total Cost</TableHead><TableHead className="text-center w-40">Actions</TableHead>
 </TableRow>
 </TableHeader>
  <TableBody>
  {filtered.length === 0 ? (
  <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground"><ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />No print jobs yet.</TableCell></TableRow>
  ) : grouped.map(g => (
    <React.Fragment key={`grp-${g.key}`}>
      {groupBy !== "none" && (
        <TableRow key={`grp-${g.key}`} className="bg-muted/30">
          <TableCell colSpan={11} className="font-semibold text-sm">
            {g.label} <span className="ml-2 text-xs text-muted-foreground font-normal">
              · {g.rows.length} job{g.rows.length === 1 ? "" : "s"}
              · Ordered {g.rows.reduce((s,r)=>s+Number(r.quantity_ordered),0).toLocaleString()}
              · Delivered {g.rows.reduce((s,r)=>s+Number(r.quantity_delivered),0).toLocaleString()}
              · At Factory {g.rows.reduce((s,r)=>s+Number(r.quantity_at_factory||0),0).toLocaleString()}
              · Rejected {g.rows.reduce((s,r)=>s+Number(r.quantity_rejected),0).toLocaleString()}
            </span>
          </TableCell>
        </TableRow>
      )}
      {g.rows.map(j => {
        const isOverDelivered = Number(j.quantity_delivered) + Number(j.quantity_rejected) > Number(j.quantity_ordered);
        const dispatched = dispatchesByJob[j.id] || [];
        return (
        <TableRow key={j.id}>
        <TableCell className="font-medium font-mono">
          {j.job_number}
          {isOverDelivered && <Badge variant="secondary" className="ml-2 bg-warning/15 text-warning border-warning/30 text-[10px]">Over</Badge>}
        </TableCell>
        <TableCell>{printerNames[j.printer_id || ""] || "—"}</TableCell>
        <TableCell>{productNames[j.product_id || ""] || "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground">
          {dispatched.length > 0 ? (
            <div className="space-y-0.5">
              {dispatched.map(d => (
                <div key={d.id}>{supplierNames[d.supplier_id] || "—"}: <span className="font-mono text-foreground">{Number(d.qty_dispatched).toLocaleString()}</span></div>
              ))}
            </div>
          ) : (supplierNames[j.allotted_supplier_id || ""] || "—")}
        </TableCell>
        <TableCell className="text-right font-mono">{Number(j.quantity_ordered).toLocaleString()}</TableCell>
        <TableCell className="text-right font-mono">{Number(j.quantity_delivered).toLocaleString()}</TableCell>
        <TableCell className={`text-right font-mono ${Number(j.quantity_at_factory) > 0 ? "text-success font-semibold" : ""}`}>{Number(j.quantity_at_factory || 0).toLocaleString()}</TableCell>
        <TableCell className={`text-right font-mono ${Number(j.quantity_rejected) > 0 ? "text-destructive font-semibold" : ""}`}>{Number(j.quantity_rejected).toLocaleString()}</TableCell>
        <TableCell>{statusBadge(j.status)}</TableCell>
        <TableCell className="text-right font-mono font-medium">PKR {Number(j.total_cost).toLocaleString()}</TableCell>
        <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1 flex-wrap">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => previewJob(j)} title="Preview PDF">
        <Eye className="h-3.5 w-3.5" />
        </Button>
        {j.status !== "settled" && (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
        setDeliverJob(j);
        setQtyDelivered(String(j.quantity_ordered));
        setQtyRejected("0");
        }}>
        <Truck className="h-3 w-3 mr-1" /> Receive
        </Button>
        )}
        {Number(j.quantity_at_factory) > 0 && (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
            setDispatchJob(j);
            setDispatchQty(String(j.quantity_at_factory));
            setDispatchSupplierId(j.allotted_supplier_id || "");
          }} title="Dispatch to Supplier">
            <Send className="h-3 w-3 mr-1" /> Dispatch
          </Button>
        )}
        {Number(j.quantity_delivered) > 0 && (
          <Button variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/5" onClick={() => { setRejectJob(j); setRejQty(""); setRejReason(""); setRejOurPct("50"); setRejEvidence(""); }} title="Record rejection (any status)">
            <AlertTriangle className="h-3 w-3 mr-1" /> Reject
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(j.id)}>
        <Trash2 className="h-3.5 w-3.5" />
        </Button>
        </div>
        </TableCell>
        </TableRow>
        );
      })}
    </React.Fragment>
  ))}
  </TableBody>
  </Table>
 <PaginationControls
 page={pagination.page} totalPages={pagination.totalPages} totalCount={pagination.totalCount}
 hasNext={pagination.hasNext} hasPrev={pagination.hasPrev}
 onNext={pagination.nextPage} onPrev={pagination.prevPage} pageSize={pagination.pageSize}
 />
 </CardContent>
 </Card>
 </div>

 {/* Deliver Dialog */}
 <Dialog open={!!deliverJob} onOpenChange={o => { if (!o) setDeliverJob(null); }}>
 <DialogContent className="max-w-md">
 <DialogHeader><DialogTitle>Record Delivery — {deliverJob?.job_number}</DialogTitle></DialogHeader>
 <p className="text-sm text-muted-foreground">
 Ordered: <span className="font-mono font-semibold text-foreground">{Number(deliverJob?.quantity_ordered || 0).toLocaleString()}</span> units
 </p>
 <div className="grid grid-cols-2 gap-3 mt-2">
 <div><Label>Qty Delivered *</Label><Input type="number" value={qtyDelivered} onChange={e => setQtyDelivered(e.target.value)} /></div>
 <div><Label>Qty Rejected</Label><Input type="number" value={qtyRejected} onChange={e => setQtyRejected(e.target.value)} /></div>
 <div className="col-span-2"><Label>Rejection Reason</Label><Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} rows={2} placeholder="e.g. Misprint, color mismatch..." /></div>
 </div>
 <Button onClick={handleDeliver} className="w-full mt-4">Record Delivery</Button>
 </DialogContent>
 </Dialog>

 {/* Settle Dialog */}
 <Dialog open={!!settleJob} onOpenChange={o => { if (!o) setSettleJob(null); }}>
 <DialogContent className="max-w-md">
 <DialogHeader><DialogTitle>Settle Rejection — {settleJob?.job_number}</DialogTitle></DialogHeader>
 {settleJob && (() => {
 const rejCost = settleJob.quantity_rejected * settleJob.cost_per_unit;
 const pct = Number(printerSharePct) || 0;
 const printerAmt = rejCost * (pct / 100);
 const ourAmt = rejCost - printerAmt;
 return (
 <div className="space-y-4 mt-2">
 <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-1">
 <p className="text-sm text-muted-foreground">Rejected: <span className="font-mono font-semibold text-destructive">{Number(settleJob.quantity_rejected).toLocaleString()}</span> units</p>
 <p className="text-sm text-muted-foreground">Cost/unit: <span className="font-mono font-semibold text-foreground">PKR {Number(settleJob.cost_per_unit).toLocaleString()}</span></p>
 <p className="text-sm font-semibold text-foreground">Total Rejection Cost: <span className="font-mono text-destructive">PKR {rejCost.toLocaleString()}</span></p>
 {settleJob.rejection_reason && <p className="text-xs text-muted-foreground mt-1">Reason: {settleJob.rejection_reason}</p>}
 </div>
 <div>
 <Label>Printer's Share (%)</Label>
 <Input type="number" min="0" max="100" value={printerSharePct} onChange={e => setPrinterSharePct(e.target.value)} />
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-center">
 <p className="text-xs text-muted-foreground">Printer Bears</p>
 <p className="text-lg font-bold font-mono text-warning">PKR {printerAmt.toLocaleString()}</p>
 </div>
 <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
 <p className="text-xs text-muted-foreground">You Bear</p>
 <p className="text-lg font-bold font-mono text-primary">PKR {ourAmt.toLocaleString()}</p>
 </div>
 </div>
 <Button onClick={handleSettle} className="w-full">Confirm Settlement</Button>
 </div>
 );
 })()}
 </DialogContent>
 </Dialog>

 {/* Delete Confirm */}
 <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
 <AlertDialogContent>
 <AlertDialogHeader>
 <AlertDialogTitle>Delete Print Job?</AlertDialogTitle>
 <AlertDialogDescription>This will permanently delete this print job and reverse any balance changes.</AlertDialogDescription>
 </AlertDialogHeader>
 <AlertDialogFooter>
 <AlertDialogCancel>Cancel</AlertDialogCancel>
 <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
 </AlertDialogFooter>
 </AlertDialogContent>
 </AlertDialog>

 {/* Dispatch to Supplier Dialog */}
 <Dialog open={!!dispatchJob} onOpenChange={o => { if (!o) { setDispatchJob(null); setDispatchQty(""); setDispatchSupplierId(""); setDispatchNote(""); } }}>
 <DialogContent className="max-w-md">
 <DialogHeader><DialogTitle>Dispatch to Supplier — {dispatchJob?.job_number}</DialogTitle></DialogHeader>
 {dispatchJob && (
 <div className="space-y-3 mt-2">
 <div className="p-3 rounded-xl bg-success/5 border border-border text-sm space-y-1">
 <p className="text-muted-foreground">Product: <span className="font-medium text-foreground">{productNames[dispatchJob.product_id || ""] || "—"}</span></p>
 <p className="text-muted-foreground">Printer: <span className="font-medium text-foreground">{printerNames[dispatchJob.printer_id || ""] || "—"}</span></p>
 <p className="text-muted-foreground">At Factory: <span className="font-mono font-semibold text-success">{Number(dispatchJob.quantity_at_factory || 0).toLocaleString()} pcs</span></p>
 <p className="text-muted-foreground">Already Dispatched: <span className="font-mono text-foreground">{Number(dispatchJob.quantity_dispatched_to_supplier || 0).toLocaleString()} pcs</span></p>
 </div>
 {(dispatchesByJob[dispatchJob.id] || []).length > 0 && (
   <div className="rounded-lg border border-border p-2 text-xs space-y-1">
     <p className="font-medium text-foreground">Existing dispatches:</p>
     {(dispatchesByJob[dispatchJob.id] || []).map(d => (
       <div key={d.id} className="flex items-center justify-between text-muted-foreground">
         <span>{supplierNames[d.supplier_id] || "—"} <span className="text-[10px]">· {d.date}</span></span>
         <div className="flex items-center gap-2">
           <span className="font-mono text-foreground">{Number(d.qty_dispatched).toLocaleString()}</span>
           <button className="text-destructive hover:underline" onClick={async () => {
             const { error } = await supabase.from("print_dispatches" as any).delete().eq("id", d.id);
             if (error) { toast.error(error.message); return; }
             toast.success("Dispatch reversed");
             await load();
             const r = await supabase.from("print_jobs").select("*").eq("id", dispatchJob.id).single();
             if (r.data) setDispatchJob(r.data as any);
           }}>remove</button>
         </div>
       </div>
     ))}
   </div>
 )}
 <div>
 <Label>Supplier *</Label>
 <SearchableSelect
 options={suppliers.map(s => ({ value: s.id, label: s.name }))}
 value={dispatchSupplierId}
 onChange={setDispatchSupplierId}
 placeholder="Receiving supplier..."
 />
 {dispatchJob.allotted_supplier_id && (
 <p className="text-[10px] text-muted-foreground mt-1">Allotted: {supplierNames[dispatchJob.allotted_supplier_id] || "—"}</p>
 )}
 </div>
 <div className="grid grid-cols-2 gap-3">
 <div><Label>Quantity *</Label><Input type="number" value={dispatchQty} onChange={e => setDispatchQty(e.target.value)} /></div>
 <div><Label>Date</Label><Input type="date" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} /></div>
 </div>
 <div><Label>Note</Label><Textarea rows={2} value={dispatchNote} onChange={e => setDispatchNote(e.target.value)} placeholder="Delivery challan #, vehicle, etc." /></div>
 <Button onClick={handleDispatch} className="w-full">Confirm Dispatch</Button>
 </div>
 )}
 </DialogContent>
 </Dialog>

  <PdfPreviewDialog open={pdfOpen} onOpenChange={setPdfOpen} html={pdfHtml} views={pdfOpts ? generateDocumentViews(pdfOpts) : undefined} title={pdfTitle} />

  {/* Record Rejection Dialog */}
  <Dialog open={!!rejectJob} onOpenChange={o => { if (!o) setRejectJob(null); }}>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Record Rejection — {rejectJob?.job_number}</DialogTitle></DialogHeader>
      {rejectJob && (() => {
        const qty = Number(rejQty) || 0;
        const cpu = Number(rejectJob.cost_per_unit) || 0;
        const total = qty * cpu;
        const ourPct = Number(rejOurPct) || 0;
        const ourAmt = total * ourPct / 100;
        const vendorAmt = total - ourAmt;
        const maxRej = Math.max(Number(rejectJob.quantity_delivered) - Number(rejectJob.quantity_rejected), 0);
        return (
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">Delivered so far: <span className="font-mono text-foreground">{Number(rejectJob.quantity_delivered).toLocaleString()}</span> · Already rejected: <span className="font-mono text-foreground">{Number(rejectJob.quantity_rejected).toLocaleString()}</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Qty Rejected *</Label><Input type="number" max={maxRej} value={rejQty} onChange={e => setRejQty(e.target.value)} /></div>
              <div><Label>Our Share % *</Label><Input type="number" min={0} max={100} value={rejOurPct} onChange={e => setRejOurPct(e.target.value)} /></div>
            </div>
            <div><Label>Reason</Label><Input value={rejReason} onChange={e => setRejReason(e.target.value)} placeholder="Misprint, color mismatch, damaged packaging..." /></div>
            <div><Label>Evidence / Notes</Label><Textarea rows={2} value={rejEvidence} onChange={e => setRejEvidence(e.target.value)} placeholder="Photo refs, batch #, who inspected..." /></div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-warning/10 border border-warning/20 text-center">
                <p className="text-muted-foreground">Vendor (Debit Note)</p>
                <p className="font-mono font-bold text-warning">PKR {vendorAmt.toLocaleString()}</p>
              </div>
              <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                <p className="text-muted-foreground">Our Expense</p>
                <p className="font-mono font-bold text-destructive">PKR {ourAmt.toLocaleString()}</p>
              </div>
            </div>
            <Button className="w-full" disabled={rejBusy || !qty || qty <= 0 || qty > maxRej} onClick={async () => {
              setRejBusy(true);
              const { error } = await supabase.from("print_rejections" as any).insert({
                print_job_id: rejectJob.id,
                qty_rejected: qty,
                cost_per_unit: cpu,
                our_share_percent: ourPct,
                reason: rejReason || null,
                evidence_notes: rejEvidence || null,
              } as any);
              setRejBusy(false);
              if (error) { toast.error(error.message); return; }
              toast.success(`Rejection recorded. Debit Note (PKR ${vendorAmt.toLocaleString()}) and Expense (PKR ${ourAmt.toLocaleString()}) posted.`);
              setRejectJob(null); load();
            }}>{rejBusy ? "Posting..." : "Post Rejection"}</Button>
          </div>
        );
      })()}
    </DialogContent>
  </Dialog>
 </AppLayout>
 );
}
