import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Users, BookOpen, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

interface Customer {
  id: string; name: string; company: string | null; ntn: string | null; strn: string | null;
  phone: string | null; email: string | null; address: string | null; city: string | null;
  credit_limit: number; credit_days: number; opening_balance: number; balance: number; created_at: string;
}

const emptyForm = {
  name: "", company: "", ntn: "", strn: "", phone: "", email: "", address: "", city: "",
  credit_limit: "0", credit_days: "30", opening_balance: "0",
};

export default function Customers() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check(); loadCustomers();
  }, [navigate]);

  const loadCustomers = async () => {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (data) setCustomers(data);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const payload = {
      name: form.name, company: form.company || null, ntn: form.ntn || null, strn: form.strn || null,
      phone: form.phone || null, email: form.email || null, address: form.address || null, city: form.city || null,
      credit_limit: Number(form.credit_limit), credit_days: Number(form.credit_days),
      opening_balance: Number(form.opening_balance), balance: Number(form.opening_balance),
    };
    if (editId) {
      await supabase.from("customers").update(payload).eq("id", editId);
      toast.success("Customer updated");
    } else {
      await supabase.from("customers").insert(payload);
      toast.success("Customer created");
    }
    setOpen(false); setForm(emptyForm); setEditId(null); loadCustomers();
  };

  const handleEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({
      name: c.name, company: c.company || "", ntn: c.ntn || "", strn: c.strn || "",
      phone: c.phone || "", email: c.email || "", address: c.address || "", city: c.city || "",
      credit_limit: String(c.credit_limit), credit_days: String(c.credit_days), opening_balance: String(c.opening_balance),
    });
    setOpen(true);
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) { toast.error("Cannot delete — may have linked invoices"); return; }
    toast.success("Customer deleted");
    loadCustomers();
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Customers</h1>
              <p className="text-sm text-muted-foreground">Manage customer accounts, credit terms & ledgers</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/import?tab=customers")}><Upload className="h-4 w-4 mr-1" /> Import CSV</Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Customer</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Customer</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="col-span-2"><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
                  <div><Label>Company</Label><Input value={form.company} onChange={e => setForm({...form, company: e.target.value})} /></div>
                  <div><Label>City</Label><Input value={form.city} onChange={e => setForm({...form, city: e.target.value})} /></div>
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
          </header>

          <div className="p-6">
            <div className="mb-4 relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search customers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>

            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
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
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
                          No customers yet. Add your first customer to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(c => (
                        <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => handleEdit(c)}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.company || "—"}</TableCell>
                          <TableCell>{c.city || "—"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.ntn || "—"}</TableCell>
                          <TableCell className="text-right font-mono">{Number(c.balance).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono text-muted-foreground">{Number(c.credit_limit).toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1" onClick={e => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/customers/${c.id}/ledger`)} title="View Ledger">
                                <BookOpen className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete {c.name}?</AlertDialogTitle>
                                    <AlertDialogDescription>This will permanently delete this customer. This action cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={(e) => handleDelete(c.id, e)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
