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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Search, ClipboardCheck, Package, Truck, CheckCircle2, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface PrinterEntity { id: string; name: string; }
interface Product { id: string; name: string; }
interface PrintJob {
  id: string; job_number: string; printer_id: string | null; product_id: string | null;
  date: string; quantity_ordered: number; quantity_delivered: number; quantity_rejected: number;
  rejection_reason: string | null; status: string; cost_per_unit: number; total_cost: number;
  printer_share_percent: number; printer_share_amount: number; our_share_amount: number;
  notes: string | null; created_at: string;
}

export default function PrintJobs() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printers, setPrinters] = useState<PrinterEntity[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("all");

  // Create form
  const [createOpen, setCreateOpen] = useState(false);
  const [printerId, setPrinterId] = useState("");
  const [productId, setProductId] = useState("");
  const [qtyOrdered, setQtyOrdered] = useState("");
  const [costPerUnit, setCostPerUnit] = useState("");
  const [jobDate, setJobDate] = useState(new Date().toISOString().split("T")[0]);
  const [jobNotes, setJobNotes] = useState("");

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

  // Names lookup
  const [printerNames, setPrinterNames] = useState<Record<string, string>>({});
  const [productNames, setProductNames] = useState<Record<string, string>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    const [j, pr, prod] = await Promise.all([
      supabase.from("print_jobs").select("*").order("created_at", { ascending: false }),
      supabase.from("printers").select("id, name"),
      supabase.from("products").select("id, name"),
    ]);
    if (j.data) setJobs(j.data);
    if (pr.data) { setPrinters(pr.data); const n: Record<string, string> = {}; pr.data.forEach(p => n[p.id] = p.name); setPrinterNames(n); }
    if (prod.data) { setProducts(prod.data); const n: Record<string, string> = {}; prod.data.forEach(p => n[p.id] = p.name); setProductNames(n); }
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
    });
    if (error) { toast.error("Failed to create job"); return; }
    toast.success(`Print Job ${jobNum} created`);
    setCreateOpen(false); setPrinterId(""); setProductId(""); setQtyOrdered(""); setCostPerUnit(""); setJobNotes(""); load();
  };

  const handleDeliver = async () => {
    if (!deliverJob) return;
    const delivered = Number(qtyDelivered);
    const rejected = Number(qtyRejected);
    if (delivered <= 0 || delivered + rejected > deliverJob.quantity_ordered) {
      toast.error("Invalid delivery quantities"); return;
    }
    const { error } = await supabase.from("print_jobs").update({
      quantity_delivered: delivered, quantity_rejected: rejected,
      rejection_reason: rejectionReason || null, status: "delivered",
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
    toast.success(`Job settled — Printer bears PKR ${printerShare.toLocaleString()}, You bear PKR ${ourShare.toLocaleString()}`);
    setSettleJob(null); setPrinterSharePct("60"); load();
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
    if (tab === "draft") return matchSearch && j.status === "draft";
    if (tab === "delivered") return matchSearch && j.status === "delivered";
    if (tab === "settled") return matchSearch && j.status === "settled";
    return matchSearch;
  });

  const totalJobsValue = jobs.reduce((s, j) => s + Number(j.total_cost), 0);
  const pendingSettlement = jobs.filter(j => j.status === "delivered").length;
  const totalRejected = jobs.reduce((s, j) => s + Number(j.quantity_rejected), 0);

  const statusBadge = (status: string) => {
    if (status === "draft") return <Badge variant="secondary" className="bg-muted text-muted-foreground">Draft</Badge>;
    if (status === "delivered") return <Badge className="bg-warning/15 text-warning border-warning/30">Delivered</Badge>;
    return <Badge className="bg-primary/15 text-primary border-primary/30">Settled</Badge>;
  };

  const headerActions = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Print Job</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create Print Job</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div><Label>Printer *</Label><SearchableSelect options={printers.map(p => ({ value: p.id, label: p.name }))} value={printerId} onChange={setPrinterId} placeholder="Select printer..." /></div>
          <div><Label>Product *</Label><SearchableSelect options={products.map(p => ({ value: p.id, label: p.name }))} value={productId} onChange={setProductId} placeholder="Select product..." /></div>
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
            <div className="grid grid-cols-3 gap-4">
              <Card className="glass-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center"><Package className="h-5 w-5 text-primary" /></div>
                  <div><p className="text-xs text-muted-foreground">Total Value</p><p className="text-lg font-bold font-mono text-foreground">PKR {totalJobsValue.toLocaleString()}</p></div>
                </CardContent>
              </Card>
              <Card className="glass-card bg-gradient-to-br from-warning/5 to-warning/10 border-warning/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-warning/15 flex items-center justify-center"><Truck className="h-5 w-5 text-warning" /></div>
                  <div><p className="text-xs text-muted-foreground">Pending Settlement</p><p className="text-lg font-bold font-mono text-foreground">{pendingSettlement}</p></div>
                </CardContent>
              </Card>
              <Card className="glass-card bg-gradient-to-br from-destructive/5 to-destructive/10 border-destructive/20">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-destructive/15 flex items-center justify-center"><ClipboardCheck className="h-5 w-5 text-destructive" /></div>
                  <div><p className="text-xs text-muted-foreground">Total Rejected</p><p className="text-lg font-bold font-mono text-foreground">{totalRejected.toLocaleString()}</p></div>
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search jobs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="draft">Draft</TabsTrigger>
                  <TabsTrigger value="delivered">Delivered</TabsTrigger>
                  <TabsTrigger value="settled">Settled</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job #</TableHead><TableHead>Printer</TableHead><TableHead>Product</TableHead>
                      <TableHead className="text-right">Ordered</TableHead><TableHead className="text-right">Delivered</TableHead>
                      <TableHead className="text-right">Rejected</TableHead><TableHead>Status</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead><TableHead className="text-center w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground"><ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />No print jobs yet.</TableCell></TableRow>
                    ) : filtered.map(j => (
                      <TableRow key={j.id}>
                        <TableCell className="font-medium font-mono">{j.job_number}</TableCell>
                        <TableCell>{printerNames[j.printer_id || ""] || "—"}</TableCell>
                        <TableCell>{productNames[j.product_id || ""] || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{Number(j.quantity_ordered).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono">{Number(j.quantity_delivered).toLocaleString()}</TableCell>
                        <TableCell className={`text-right font-mono ${Number(j.quantity_rejected) > 0 ? "text-destructive font-semibold" : ""}`}>{Number(j.quantity_rejected).toLocaleString()}</TableCell>
                        <TableCell>{statusBadge(j.status)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">PKR {Number(j.total_cost).toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {j.status === "draft" && (
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => {
                                setDeliverJob(j);
                                setQtyDelivered(String(j.quantity_ordered));
                                setQtyRejected("0");
                              }}>
                                <Truck className="h-3 w-3 mr-1" /> Deliver
                              </Button>
                            )}
                            {j.status === "delivered" && Number(j.quantity_rejected) > 0 && (
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSettleJob(j)}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Settle
                              </Button>
                            )}
                            {j.status === "delivered" && Number(j.quantity_rejected) === 0 && (
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={async () => {
                                await supabase.from("print_jobs").update({ status: "settled", printer_share_percent: 0, printer_share_amount: 0, our_share_amount: 0 }).eq("id", j.id);
                                toast.success("Job settled (no rejections)"); load();
                              }}>
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Settle
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(j.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
    </AppLayout>
  );
}
