import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Truck, BookOpen, Trash2, Upload, Store } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { SupplierProfileDialog } from "@/components/SupplierProfileDialog";

interface Supplier {
  id: string; name: string; company: string | null; ntn: string | null; strn: string | null;
  phone: string | null; email: string | null; address: string | null; city: string | null;
  payment_terms_days: number; wht_rate: number; opening_balance: number; balance: number; created_at: string;
  supplier_code: string | null; license_number: string | null;
}

const emptyForm = {
  name: "", company: "", ntn: "", strn: "", phone: "", email: "", address: "", city: "",
  payment_terms_days: "30", wht_rate: "4.5", opening_balance: "0", license_number: "",
};

export default function Suppliers() {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const pagination = usePagination();
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  useEffect(() => { loadSuppliers(); }, [pagination.page]);

  const loadSuppliers = async () => {
    const { data, count } = await supabase.from("suppliers").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(pagination.from, pagination.to);
    if (data) setSuppliers(data as any);
    if (count !== null) pagination.setTotalCount(count);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Company Name is required"); return; }
    const basePayload: any = {
      name: form.name, company: form.company || null, ntn: form.ntn || null, strn: form.strn || null,
      phone: form.phone || null, email: form.email || null, address: form.address || null, city: form.city || null,
      payment_terms_days: Number(form.payment_terms_days), wht_rate: Number(form.wht_rate),
      opening_balance: Number(form.opening_balance), license_number: form.license_number || null,
    };
    if (editId) {
      const { error } = await supabase.from("suppliers").update(basePayload).eq("id", editId);
      if (error) { toast.error("Failed to update: " + error.message); return; }
      toast.success("Supplier updated");
    } else {
      // Generate auto-code for new suppliers
      const { data: code } = await supabase.rpc("generate_document_number", { p_document_type: "supplier" });
      const { error } = await supabase.from("suppliers").insert({ ...basePayload, balance: Number(form.opening_balance), supplier_code: code || null } as any);
      if (error) { toast.error("Failed to create: " + error.message); return; }
      toast.success("Supplier created");
    }
    setOpen(false); setForm(emptyForm); setEditId(null); loadSuppliers();
  };

  const handleEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({
      name: s.name, company: s.company || "", ntn: s.ntn || "", strn: s.strn || "",
      phone: s.phone || "", email: s.email || "", address: s.address || "", city: s.city || "",
      payment_terms_days: String(s.payment_terms_days), wht_rate: String(s.wht_rate), opening_balance: String(s.opening_balance),
      license_number: s.license_number || "",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) { toast.error("Cannot delete — may have linked records"); return; }
    toast.success("Supplier deleted"); loadSuppliers();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const CHUNK = 200;
    let failed = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { error } = await supabase.from("suppliers").delete().in("id", chunk);
      if (error) failed += chunk.length;
    }
    const deleted = ids.length - failed;
    setSelectedIds(new Set()); setBulkDeleteOpen(false);
    if (deleted > 0) toast.success(`${deleted} supplier(s) deleted`);
    if (failed > 0) toast.error(`${failed} supplier(s) could not be deleted (linked records)`);
    loadSuppliers();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(s => s.id)));
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) || (s.company || "").toLowerCase().includes(search.toLowerCase()) || (s.supplier_code || "").toLowerCase().includes(search.toLowerCase())
  );

  const headerActions = (
    <>
      <Button variant="outline" size="sm" onClick={() => navigate("/import?tab=suppliers")}><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Supplier</Button></DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Supplier</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2"><Label>Company Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Company / Business name" /></div>
            <div><Label>Contact Person</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Contact name (optional)" /></div>
            <div><Label>License Number</Label><Input value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} placeholder="Drug license #" /></div>
            <div><Label>City</Label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
            <div><Label>NTN</Label><Input value={form.ntn} onChange={e => setForm({...form, ntn: e.target.value})} /></div>
            <div><Label>STRN</Label><Input value={form.strn} onChange={e => setForm({...form, strn: e.target.value})} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label>Payment Terms (days)</Label><Input type="number" value={form.payment_terms_days} onChange={e => setForm({...form, payment_terms_days: e.target.value})} /></div>
            {settings?.wht_enabled && <div><Label>WHT Rate (%)</Label><Input type="number" step="0.1" value={form.wht_rate} onChange={e => setForm({...form, wht_rate: e.target.value})} /></div>}
            <div><Label>Opening Balance (PKR)</Label><Input type="number" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: e.target.value})} /></div>
          </div>
          <Button onClick={handleSave} className="w-full mt-4">{editId ? "Update" : "Create"} Supplier</Button>
        </DialogContent>
      </Dialog>
    </>
  );

  return (
    <AppLayout title="Suppliers" subtitle="RM & packing material suppliers with WHT tracking" headerActions={headerActions}>
      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete {selectedIds.size} supplier(s)?</AlertDialogTitle><AlertDialogDescription>Suppliers with linked records cannot be deleted.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleBulkDelete}>Delete All</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                <TableHead>Code</TableHead><TableHead>Company Name</TableHead><TableHead>Contact</TableHead><TableHead>City</TableHead>
                <TableHead>License #</TableHead>
                {settings?.wht_enabled && <TableHead>WHT %</TableHead>}<TableHead className="text-right">Balance</TableHead>
                <TableHead>Terms</TableHead><TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={settings?.wht_enabled ? 10 : 9} className="text-center py-12 text-muted-foreground"><Truck className="h-8 w-8 mx-auto mb-2 opacity-40" />No suppliers yet.</TableCell></TableRow>
              ) : filtered.map(s => (
                <TableRow key={s.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleEdit(s)}>
                  <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSelect(s.id)} /></TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{s.supplier_code || "—"}</TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.company || "—"}</TableCell>
                  <TableCell>{s.city || "—"}</TableCell>
                  <TableCell className="text-xs">{s.license_number || "—"}</TableCell>
                  {settings?.wht_enabled && <TableCell><span className="status-pill bg-warning/10 text-warning">{s.wht_rate}%</span></TableCell>}
                  <TableCell className="text-right font-mono">{Number(s.balance).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{s.payment_terms_days}d</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/suppliers/${s.id}/ledger`)} title="View Ledger"><BookOpen className="h-3.5 w-3.5" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete {s.name}?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this supplier.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => handleDelete(s.id, e)}>Delete</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
    </AppLayout>
  );
}
