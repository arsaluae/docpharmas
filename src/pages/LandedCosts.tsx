import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Plus, Search, Trash2, DollarSign, Package, Truck, Printer, ShieldCheck, Thermometer, FlaskConical, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";

const COST_TYPES = [
  { value: "packaging", label: "Packaging", icon: Package },
  { value: "printing", label: "Printing", icon: Printer },
  { value: "freight", label: "Freight / Transport", icon: Truck },
  { value: "clearing", label: "Clearing / Customs", icon: ShieldCheck },
  { value: "insurance", label: "Insurance", icon: ShieldCheck },
  { value: "storage", label: "Storage / Cold-chain", icon: Thermometer },
  { value: "registration", label: "DRAP Registration", icon: ShieldCheck },
  { value: "testing", label: "QC / Lab Testing", icon: FlaskConical },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

interface CostRecord {
  id: string; reference_type: string; reference_id: string; cost_type: string;
  description: string | null; amount: number; vendor_id: string | null;
  date: string; notes: string | null; created_at: string;
}

interface Supplier { id: string; name: string; }

export default function LandedCosts() {
  const [costs, setCosts] = useState<CostRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const pagination = usePagination();

  // Create form
  const [costType, setCostType] = useState("packaging");
  const [costDesc, setCostDesc] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costVendorId, setCostVendorId] = useState("");
  const [costDate, setCostDate] = useState(new Date().toISOString().split("T")[0]);
  const [costNotes, setCostNotes] = useState("");

  useEffect(() => { load(); }, [pagination.page, typeFilter]);

  const load = async () => {
    let q = supabase.from("additional_costs").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (typeFilter !== "all") q = q.eq("cost_type", typeFilter);
    q = q.range(pagination.from, pagination.to);
    const [costsRes, suppRes] = await Promise.all([q, supabase.from("suppliers").select("id, name").eq("is_active", true)]);
    if (costsRes.data) setCosts(costsRes.data as any);
    if (costsRes.count != null) pagination.setTotalCount(costsRes.count);
    if (suppRes.data) {
      setSuppliers(suppRes.data);
      const n: Record<string, string> = {};
      suppRes.data.forEach(s => n[s.id] = s.name);
      // Also load printers for vendor display
      const { data: printers } = await supabase.from("printers").select("id, name");
      if (printers) printers.forEach(p => n[p.id] = p.name);
      setSupplierNames(n);
    }
  };

  const handleCreate = async () => {
    if (!costAmount || Number(costAmount) <= 0) { toast.error("Amount is required"); return; }
    const { error } = await supabase.from("additional_costs").insert({
      reference_type: "standalone", reference_id: crypto.randomUUID(),
      cost_type: costType, description: costDesc || null, amount: Number(costAmount),
      vendor_id: costVendorId || null, date: costDate, notes: costNotes || null,
    });
    if (error) { toast.error("Failed to add cost"); return; }
    toast.success("Landed cost added");
    setCreateOpen(false); setCostDesc(""); setCostAmount(""); setCostVendorId(""); setCostNotes(""); load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("additional_costs").delete().eq("id", deleteId);
    if (error) toast.error("Failed to delete"); else toast.success("Cost deleted");
    setDeleteId(null); load();
  };

  const filtered = costs.filter(c => {
    const matchSearch = (c.description || "").toLowerCase().includes(search.toLowerCase()) ||
      c.cost_type.toLowerCase().includes(search.toLowerCase()) ||
      (supplierNames[c.vendor_id || ""] || "").toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  // Summary by type
  const summaryByType = COST_TYPES.map(t => ({
    ...t,
    total: costs.filter(c => c.cost_type === t.value).reduce((s, c) => s + Number(c.amount), 0),
    count: costs.filter(c => c.cost_type === t.value).length,
  })).filter(t => t.count > 0);

  const grandTotal = costs.reduce((s, c) => s + Number(c.amount), 0);

  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));

  const costTypeBadge = (type: string) => {
    const ct = COST_TYPES.find(t => t.value === type);
    return <Badge variant="outline" className="capitalize text-[10px]">{ct?.label || type}</Badge>;
  };

  const refLabel = (type: string) => {
    if (type === "purchase_proforma") return "Purchase Proforma";
    if (type === "purchase_order") return "Purchase Order";
    if (type === "print_job") return "Print Job";
    if (type === "standalone") return "Standalone";
    return type;
  };

  const headerActions = (
    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Landed Cost</Button></DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Landed Cost</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs font-medium text-muted-foreground">Cost Type</Label>
            <Select value={costType} onValueChange={setCostType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs font-medium text-muted-foreground">Description</Label><Input value={costDesc} onChange={e => setCostDesc(e.target.value)} placeholder="e.g. Freight from Karachi port" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs font-medium text-muted-foreground">Amount (PKR) *</Label><Input type="number" value={costAmount} onChange={e => setCostAmount(e.target.value)} /></div>
            <div><Label className="text-xs font-medium text-muted-foreground">Date</Label><Input type="date" value={costDate} onChange={e => setCostDate(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs font-medium text-muted-foreground">Vendor</Label><SearchableSelect options={supplierOptions} value={costVendorId} onChange={setCostVendorId} placeholder="Select vendor..." /></div>
          <div><Label className="text-xs font-medium text-muted-foreground">Notes</Label><Textarea value={costNotes} onChange={e => setCostNotes(e.target.value)} rows={2} /></div>
          <Button onClick={handleCreate} className="w-full">Add Cost</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <AppLayout title="Landed Costs" subtitle="Track all additional costs: packaging, freight, printing, insurance, DRAP fees & more" headerActions={headerActions}>
      <div className="space-y-4">
        {/* Summary cards */}
        {summaryByType.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="glass-card bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Landed Costs</p>
                <p className="text-lg font-bold font-mono text-foreground">PKR {grandTotal.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">{costs.length} records</p>
              </CardContent>
            </Card>
            {summaryByType.slice(0, 3).map(s => (
              <Card key={s.value} className="glass-card">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground capitalize">{s.label}</p>
                  <p className="text-lg font-bold font-mono text-foreground">PKR {s.total.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{s.count} entries</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search costs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {COST_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead>
                  <TableHead>Source</TableHead><TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Amount</TableHead><TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-40" />No landed costs yet.
                  </TableCell></TableRow>
                ) : filtered.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm text-muted-foreground">{c.date}</TableCell>
                    <TableCell>{costTypeBadge(c.cost_type)}</TableCell>
                    <TableCell className="text-sm">{c.description || "—"}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{refLabel(c.reference_type)}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{supplierNames[c.vendor_id || ""] || "—"}</TableCell>
                    <TableCell className="text-right font-mono font-medium">PKR {Number(c.amount).toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this cost?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this landed cost record.</AlertDialogDescription>
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
