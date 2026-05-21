import { useState, useEffect } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Users, BookOpen, Trash2, Upload, Award, X, Store, Edit, Wallet, Shield, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { CustomerProfileDialog } from "@/components/CustomerProfileDialog";

interface Customer {
  id: string; name: string; company: string | null; ntn: string | null; strn: string | null;
  phone: string | null; email: string | null; address: string | null; city: string | null; area: string | null;
  credit_limit: number; opening_balance: number; balance: number; created_at: string;
}

interface License {
  id: string; customer_id: string; license_number: string; license_type: string;
  expiry_date: string | null; address: string | null; notes: string | null; created_at: string;
}

const emptyForm = {
  name: "", company: "", ntn: "", strn: "", phone: "", email: "", address: "", city: "", area: "",
  credit_limit: "0", opening_balance: "0",
};

interface CustomerWithCode extends Customer {
  customer_code: string | null;
}

const emptyLicenseForm = { license_number: "", license_type: "drug_license", expiry_date: "", address: "", notes: "" };

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerWithCode[]>([]);
  const [search, setSearch] = useState("");
  const pagination = usePagination();
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const [licenseOpen, setLicenseOpen] = useState(false);
  const [licenseCustomer, setLicenseCustomer] = useState<Customer | null>(null);
  const [licenses, setLicenses] = useState<License[]>([]);
  const [licenseForm, setLicenseForm] = useState(emptyLicenseForm);
  const [editLicenseId, setEditLicenseId] = useState<string | null>(null);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileCustomer, setProfileCustomer] = useState<Customer | null>(null);

  useEffect(() => { loadCustomers(); }, [pagination.page]);

  const loadCustomers = async () => {
    const { data, count } = await supabase.from("customers").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(pagination.from, pagination.to);
    if (data) setCustomers(data);
    if (count !== null) pagination.setTotalCount(count);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Company Name is required"); return; }
    const basePayload = {
      name: form.name, company: form.company || null, ntn: form.ntn || null, strn: form.strn || null,
      phone: form.phone || null, email: form.email || null, address: form.address || null, city: form.city || null,
      area: form.area || null, credit_limit: Number(form.credit_limit),
      opening_balance: Number(form.opening_balance),
    };
    if (editId) {
      const { error } = await supabase.from("customers").update(basePayload).eq("id", editId);
      if (error) { toast.error("Failed to update: " + error.message); return; }
      toast.success("Customer updated");
    } else {
      const { data: code } = await supabase.rpc("generate_document_number", { p_document_type: "customer" });
      const { error } = await supabase.from("customers").insert({ ...basePayload, balance: Number(form.opening_balance), customer_code: code || null } as any);
      if (error) { toast.error("Failed to create: " + error.message); return; }
      toast.success("Customer created");
    }
    setOpen(false); setForm(emptyForm); setEditId(null); loadCustomers();
  };

  const handleEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({
      name: c.name, company: c.company || "", ntn: c.ntn || "", strn: c.strn || "",
      phone: c.phone || "", email: c.email || "", address: c.address || "", city: c.city || "",
      area: c.area || "", credit_limit: String(c.credit_limit), opening_balance: String(c.opening_balance),
    });
    setOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from("customer_licenses").delete().eq("customer_id", id);
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { toast.error("Cannot delete — may have linked invoices"); return; }
    toast.success("Customer deleted"); loadCustomers();
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const CHUNK = 200;
    let failed = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await supabase.from("customer_licenses").delete().in("customer_id", chunk);
      const { error } = await supabase.from("customers").delete().in("id", chunk);
      if (error) failed += chunk.length;
    }
    const deleted = ids.length - failed;
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    if (deleted > 0) toast.success(`${deleted} customer(s) deleted`);
    if (failed > 0) toast.error(`${failed} customer(s) could not be deleted (linked invoices)`);
    loadCustomers();
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(c => c.id)));
  };

  const openLicenses = async (c: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setLicenseCustomer(c); setLicenseOpen(true); setShowLicenseForm(false); setEditLicenseId(null); setLicenseForm(emptyLicenseForm);
    const { data } = await supabase.from("customer_licenses").select("*").eq("customer_id", c.id).order("created_at", { ascending: false });
    setLicenses(data || []);
  };

  const handleSaveLicense = async () => {
    if (!licenseForm.license_number.trim()) { toast.error("License number is required"); return; }
    const payload = {
      customer_id: licenseCustomer!.id, license_number: licenseForm.license_number,
      license_type: licenseForm.license_type, expiry_date: licenseForm.expiry_date || null,
      address: licenseForm.address || null, notes: licenseForm.notes || null,
    };
    if (editLicenseId) { await supabase.from("customer_licenses").update(payload).eq("id", editLicenseId); toast.success("License updated"); }
    else { await supabase.from("customer_licenses").insert(payload); toast.success("License added"); }
    setShowLicenseForm(false); setEditLicenseId(null); setLicenseForm(emptyLicenseForm);
    const { data } = await supabase.from("customer_licenses").select("*").eq("customer_id", licenseCustomer!.id).order("created_at", { ascending: false });
    setLicenses(data || []);
  };

  const handleEditLicense = (l: License) => {
    setEditLicenseId(l.id);
    setLicenseForm({ license_number: l.license_number, license_type: l.license_type, expiry_date: l.expiry_date || "", address: l.address || "", notes: l.notes || "" });
    setShowLicenseForm(true);
  };

  const handleDeleteLicense = async (id: string) => {
    await supabase.from("customer_licenses").delete().eq("id", id);
    toast.success("License deleted");
    const { data } = await supabase.from("customer_licenses").select("*").eq("customer_id", licenseCustomer!.id).order("created_at", { ascending: false });
    setLicenses(data || []);
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase())
  );

  const headerActions = (
    <>
      <Button variant="outline" size="sm" onClick={() => navigate("/import?tab=customers")}><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Customer</Button></DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Customer</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2"><Label>Company Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Company / Business name" /></div>
            <div><Label>Contact Person</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="Contact name (optional)" /></div>
            <div><Label>City</Label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
            <div><Label>Area</Label><Input value={form.area} onChange={e => setForm({...form, area: e.target.value})} placeholder="Area / Zone" /></div>
            <div><Label>NTN</Label><Input value={form.ntn} onChange={e => setForm({...form, ntn: e.target.value})} placeholder="National Tax Number" /></div>
            <div><Label>STRN</Label><Input value={form.strn} onChange={e => setForm({...form, strn: e.target.value})} placeholder="Sales Tax Reg." /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
            <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
            <div><Label>Credit Limit (PKR)</Label><Input type="number" value={form.credit_limit} onChange={e => setForm({...form, credit_limit: e.target.value})} /></div>
            <div><Label>Credit Days</Label><Input type="number" value={form.credit_days} onChange={e => setForm({...form, credit_days: e.target.value})} /></div>
            <div><Label>Opening Balance (PKR)</Label><Input type="number" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: e.target.value})} /></div>
          </div>
          <Button onClick={handleSave} className="w-full mt-4">{editId ? "Update" : "Create"} Customer</Button>
        </DialogContent>
      </Dialog>
    </>
  );

  const totalBalance = customers.reduce((s, c) => s + Number(c.balance), 0);
  const totalCreditLimit = customers.reduce((s, c) => s + Number(c.credit_limit), 0);

  return (
    <AppLayout title="Customers" subtitle="Manage customer accounts, credit terms & ledgers" headerActions={headerActions}>
      {/* Summary Strip — Premium */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5 stagger-children">
        <div className="summary-card p-4 flex items-center gap-3">
          <div className="icon-ring h-10 w-10 rounded-2xl bg-primary/10 text-primary">
            <Users className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">Total</p>
            <p className="text-lg font-bold font-mono tabular-nums text-foreground">{customers.length}</p>
          </div>
        </div>
        <div className="summary-card p-4 flex items-center gap-3">
          <div className="icon-ring h-10 w-10 rounded-2xl bg-emerald-500/10 text-emerald-600">
            <Wallet className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">Receivables</p>
            <p className="text-lg font-bold font-mono tabular-nums text-foreground">PKR {totalBalance.toLocaleString()}</p>
          </div>
        </div>
        <div className="summary-card p-4 flex items-center gap-3">
          <div className="icon-ring h-10 w-10 rounded-2xl bg-warning/10 text-warning">
            <Shield className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">Credit Limit</p>
            <p className="text-lg font-bold font-mono tabular-nums text-foreground">PKR {totalCreditLimit.toLocaleString()}</p>
          </div>
        </div>
        <div className="summary-card p-4 flex items-center gap-3">
          <div className="icon-ring h-10 w-10 rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-4.5 w-4.5" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.15em] font-bold">Over Limit</p>
            <p className="text-lg font-bold font-mono tabular-nums text-foreground">{customers.filter(c => Number(c.balance) > Number(c.credit_limit) && Number(c.credit_limit) > 0).length}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 relative max-w-sm search-pill">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search customers..." className="pl-10 rounded-full border-0 shadow-none bg-transparent" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {selectedIds.size} customer(s)?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete the selected customers and their licenses. Customers with linked invoices cannot be deleted.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleBulkDelete}>Delete All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
        </div>
      )}

      <Card className="premium-table-card">
        <CardContent className="p-0 pt-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleAll} />
                </TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>City</TableHead>
                <TableHead>NTN</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Credit Limit</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />No customers yet.
                  </TableCell>
                </TableRow>
              ) : filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer table-row-hover" onClick={() => handleEdit(c)}>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selectedIds.has(c.id)} onCheckedChange={() => toggleSelect(c.id)} />
                  </TableCell>
                  <TableCell className="text-xs font-mono text-muted-foreground">{(c as any).customer_code || "—"}</TableCell>
                  <TableCell className="font-medium cursor-pointer hover:text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setProfileCustomer(c); setProfileOpen(true); }}>{c.name}</TableCell>
                  <TableCell>{c.company || "—"}</TableCell>
                  <TableCell>{c.city || "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.ntn || "—"}</TableCell>
                  <TableCell className={`text-right font-mono ${Number(c.balance) > Number(c.credit_limit) && Number(c.credit_limit) > 0 ? "text-destructive font-bold" : ""}`}>
                    {Number(c.balance).toLocaleString()}
                    {Number(c.balance) > Number(c.credit_limit) && Number(c.credit_limit) > 0 && (
                      <AlertTriangle className="inline h-3 w-3 ml-1 text-destructive" />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-mono text-muted-foreground">{Number(c.credit_limit).toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(c)} title="Edit Customer"><Edit className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/customers/${c.id}/ledger`)} title="View Ledger"><BookOpen className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setProfileCustomer(c); setProfileOpen(true); }} title="Profile & Distributors"><Store className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => openLicenses(c, e)} title="Medical Licenses"><Award className="h-3.5 w-3.5" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Delete {c.name}?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this customer and their licenses.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => handleDelete(c.id, e)}>Delete</AlertDialogAction></AlertDialogFooter>
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

      {/* Licenses Dialog */}
      <Dialog open={licenseOpen} onOpenChange={(o) => { setLicenseOpen(o); if (!o) { setLicenseCustomer(null); setLicenses([]); setShowLicenseForm(false); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Medical Licenses — {licenseCustomer?.name}</DialogTitle></DialogHeader>
          {!showLicenseForm && (
            <Button size="sm" variant="outline" onClick={() => { setShowLicenseForm(true); setEditLicenseId(null); setLicenseForm(emptyLicenseForm); }}><Plus className="h-3 w-3 mr-1" /> Add License</Button>
          )}
          {showLicenseForm && (
            <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">{editLicenseId ? "Edit" : "New"} License</p>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowLicenseForm(false); setEditLicenseId(null); }}><X className="h-3 w-3" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">License Number *</Label><Input className="text-xs" value={licenseForm.license_number} onChange={e => setLicenseForm({...licenseForm, license_number: e.target.value})} /></div>
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select value={licenseForm.license_type} onValueChange={v => setLicenseForm({...licenseForm, license_type: v})}>
                    <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="drug_license">Drug License</SelectItem>
                      <SelectItem value="pharmacy_license">Pharmacy License</SelectItem>
                      <SelectItem value="wholesale_license">Wholesale License</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Expiry Date</Label><Input type="date" className="text-xs" value={licenseForm.expiry_date} onChange={e => setLicenseForm({...licenseForm, expiry_date: e.target.value})} /></div>
                <div><Label className="text-xs">Address</Label><Input className="text-xs" value={licenseForm.address} onChange={e => setLicenseForm({...licenseForm, address: e.target.value})} /></div>
                <div className="col-span-2"><Label className="text-xs">Notes</Label><Input className="text-xs" value={licenseForm.notes} onChange={e => setLicenseForm({...licenseForm, notes: e.target.value})} /></div>
              </div>
              <Button size="sm" onClick={handleSaveLicense} className="w-full">{editLicenseId ? "Update" : "Add"} License</Button>
            </div>
          )}
          {licenses.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>License #</TableHead><TableHead>Type</TableHead><TableHead>Expiry</TableHead><TableHead className="w-16"></TableHead></TableRow></TableHeader>
              <TableBody>
                {licenses.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs font-mono">{l.license_number}</TableCell>
                    <TableCell className="text-xs capitalize">{l.license_type.replace("_", " ")}</TableCell>
                    <TableCell className="text-xs">{l.expiry_date || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditLicense(l)}><Award className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteLicense(l.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
      <CustomerProfileDialog 
        open={profileOpen} 
        onOpenChange={setProfileOpen} 
        customerId={profileCustomer?.id || null} 
        customerName={profileCustomer?.name || ""} 
      />
    </AppLayout>
  );
}

