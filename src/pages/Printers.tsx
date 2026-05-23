import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Printer, BookOpen, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { SearchableSelect } from "@/components/SearchableSelect";
import { CITY_OPTIONS } from "@/lib/pakistan-cities";

interface PrinterEntity {
 id: string; name: string; company: string | null; ntn: string | null;
 phone: string | null; email: string | null; address: string | null; city: string | null;
 payment_terms_days: number; opening_balance: number; balance: number; created_at: string;
 is_active?: boolean;
}

const emptyForm = {
 name: "", company: "", ntn: "", phone: "", email: "", address: "", city: "",
 payment_terms_days: "30", opening_balance: "0",
};

export default function Printers() {
 const navigate = useNavigate();
 const [printers, setPrinters] = useState<PrinterEntity[]>([]);
 const [search, setSearch] = useState("");
 const [form, setForm] = useState(emptyForm);
 const [open, setOpen] = useState(false);
 const [editId, setEditId] = useState<string | null>(null);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
 const [showInactive, setShowInactive] = useState(false);

 useEffect(() => { loadPrinters(); }, [showInactive]);

 const loadPrinters = async () => {
 let q = supabase.from("printers").select("*").order("created_at", { ascending: false });
 if (!showInactive) q = q.eq("is_active", true);
 const { data } = await q;
 if (data) setPrinters(data);
 };

 const toggleActive = async (p: PrinterEntity, e: React.MouseEvent) => {
 e.stopPropagation();
 const { error } = await supabase.from("printers").update({ is_active: !p.is_active } as any).eq("id", p.id);
 if (error) { toast.error("Failed: " + error.message); return; }
 toast.success(p.is_active ? "Printer deactivated" : "Printer reactivated");
 loadPrinters();
 };

 const handleSave = async () => {
 if (!form.name.trim()) { toast.error("Name is required"); return; }
 const payload = {
 name: form.name, company: form.company || null, ntn: form.ntn || null,
 phone: form.phone || null, email: form.email || null, address: form.address || null, city: form.city || null,
 payment_terms_days: Number(form.payment_terms_days), opening_balance: Number(form.opening_balance),
 };
 if (editId) { await supabase.from("printers").update(payload).eq("id", editId); toast.success("Printer updated"); }
 else { await supabase.from("printers").insert({ ...payload, balance: Number(form.opening_balance) }); toast.success("Printer created"); }
 setOpen(false); setForm(emptyForm); setEditId(null); loadPrinters();
 };

 const handleEdit = (p: PrinterEntity) => {
 setEditId(p.id);
 setForm({
 name: p.name, company: p.company || "", ntn: p.ntn || "",
 phone: p.phone || "", email: p.email || "", address: p.address || "", city: p.city || "",
 payment_terms_days: String(p.payment_terms_days), opening_balance: String(p.opening_balance),
 });
 setOpen(true);
 };

 const handleDelete = async (id: string, e: React.MouseEvent) => {
 e.stopPropagation();
 const { error } = await supabase.from("printers").delete().eq("id", id);
 if (error) { toast.error("Cannot delete — may have linked records"); return; }
 toast.success("Printer deleted"); loadPrinters();
 };

 const handleBulkDelete = async () => {
 const ids = Array.from(selectedIds);
 let failed = 0;
 for (let i = 0; i < ids.length; i += 200) {
 const chunk = ids.slice(i, i + 200);
 const { error } = await supabase.from("printers").delete().in("id", chunk);
 if (error) failed += chunk.length;
 }
 const deleted = ids.length - failed;
 setSelectedIds(new Set()); setBulkDeleteOpen(false);
 if (deleted > 0) toast.success(`${deleted} printer(s) deleted`);
 if (failed > 0) toast.error(`${failed} printer(s) could not be deleted`);
 loadPrinters();
 };

 const toggleSelect = (id: string) => { const next = new Set(selectedIds); if (next.has(id)) next.delete(id); else next.add(id); setSelectedIds(next); };
 const toggleAll = () => { if (selectedIds.size === filtered.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filtered.map(p => p.id))); };

 const filtered = printers.filter(p =>
 p.name.toLowerCase().includes(search.toLowerCase()) || (p.company || "").toLowerCase().includes(search.toLowerCase())
 );

 const headerActions = (
 <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
 <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Printer</Button></DialogTrigger>
 <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
 <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Printer</DialogTitle></DialogHeader>
 <div className="grid grid-cols-2 gap-3 mt-2">
 <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
 <div><Label>Company</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} /></div>
 <div><Label>City</Label><SearchableSelect options={CITY_OPTIONS} value={form.city} onChange={(v) => setForm({...form, city: v})} placeholder="Select city" /></div>
 <div><Label>NTN</Label><Input value={form.ntn} onChange={e => setForm({...form, ntn: e.target.value})} /></div>
 <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
 <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
 <div className="col-span-2"><Label>Address</Label><Input value={form.address} onChange={e => setForm({...form, address: e.target.value})} /></div>
 <div><Label>Payment Terms (days)</Label><Input type="number" value={form.payment_terms_days} onChange={e => setForm({...form, payment_terms_days: e.target.value})} /></div>
 <div><Label>Opening Balance (PKR)</Label><Input type="number" value={form.opening_balance} onChange={e => setForm({...form, opening_balance: e.target.value})} /></div>
 </div>
 <Button onClick={handleSave} className="w-full mt-4">{editId ? "Update" : "Create"} Printer</Button>
 </DialogContent>
 </Dialog>
 );

 return (
 <AppLayout title="Printers" subtitle="Manage packaging printers — separate from suppliers" headerActions={headerActions}>
 <div className="p-6">
 <div className="mb-4 flex items-center gap-3">
 <div className="relative max-w-sm flex-1">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
 <Input placeholder="Search printers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
 </div>
 <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap">
 <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Show inactive
 </label>
 </div>

 {selectedIds.size > 0 && (
 <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
 <span className="text-sm font-medium">{selectedIds.size} selected</span>
 <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
 <AlertDialogTrigger asChild><Button variant="destructive" size="sm"><Trash2 className="h-3.5 w-3.5 mr-1" /> Delete Selected</Button></AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader><AlertDialogTitle>Delete {selectedIds.size} printer(s)?</AlertDialogTitle><AlertDialogDescription>Printers with linked records cannot be deleted.</AlertDialogDescription></AlertDialogHeader>
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
 <TableHead>Name</TableHead><TableHead>Company</TableHead><TableHead>City</TableHead>
 <TableHead className="text-right">Balance</TableHead><TableHead>Terms</TableHead>
 <TableHead className="text-center">Actions</TableHead>
 </TableRow>
 </TableHeader>
 <TableBody>
 {filtered.length === 0 ? (
 <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground"><Printer className="h-8 w-8 mx-auto mb-2 opacity-40" />No printers yet.</TableCell></TableRow>
 ) : filtered.map(p => (
 <TableRow key={p.id} className={`cursor-pointer hover:bg-accent/50 ${p.is_active === false ? "opacity-50" : ""}`} onClick={() => handleEdit(p)}>
 <TableCell onClick={e => e.stopPropagation()}><Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelect(p.id)} /></TableCell>
 <TableCell className="font-medium">{p.name}</TableCell>
 <TableCell>{p.company || "—"}</TableCell>
 <TableCell>{p.city || "—"}</TableCell>
 <TableCell className="text-right font-mono">{Number(p.balance).toLocaleString()}</TableCell>
 <TableCell className="text-muted-foreground">{p.payment_terms_days}d</TableCell>
 <TableCell className="text-center">
 <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
 <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/printers/${p.id}/ledger`)} title="View Ledger"><BookOpen className="h-3.5 w-3.5" /></Button>
 <Button variant="ghost" size="icon" className={`h-7 w-7 ${p.is_active === false ? "text-success" : "text-warning"}`} onClick={(e) => toggleActive(p, e)} title={p.is_active === false ? "Reactivate" : "Deactivate"}><Power className="h-3.5 w-3.5" /></Button>
 <AlertDialog>
 <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
 <AlertDialogContent>
 <AlertDialogHeader><AlertDialogTitle>Delete {p.name}?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this printer.</AlertDialogDescription></AlertDialogHeader>
 <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(e) => handleDelete(p.id, e)}>Delete</AlertDialogAction></AlertDialogFooter>
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
 </AppLayout>
 );
}
