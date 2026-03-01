import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Receipt, Briefcase, User, Wallet, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";

const BUSINESS_CATEGORIES = [
  "salaries", "rent", "utilities", "transport", "travel",
  "maintenance", "marketing", "regulatory", "license_renewal",
  "insurance", "office_supplies", "communication",
  "professional_fees", "depreciation", "other",
];
const PERSONAL_CATEGORIES = ["food", "transport", "travel", "personal", "other"];
const ALL_CATEGORIES = [...new Set([...BUSINESS_CATEGORIES, ...PERSONAL_CATEGORIES])];
const METHODS = ["cash", "cheque", "bank_transfer", "online"];

interface BankAccount { id: string; name: string; bank_name: string; }
interface Expense {
  id: string; expense_number: string; category: string; description: string | null;
  amount: number; gst_amount: number; payment_method: string; bank_account_id: string | null;
  date: string; notes: string | null; expense_type: string;
}

export default function Expenses() {
  const navigate = useNavigate();
  const { settings } = useCompanySettings();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("business");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [expenseType, setExpenseType] = useState("business");
  const [category, setCategory] = useState("other");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [gstAmount, setGstAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [exp, banks] = await Promise.all([
      supabase.from("expenses").select("*").order("created_at", { ascending: false }),
      supabase.from("bank_accounts").select("id, name, bank_name"),
    ]);
    if (exp.data) setExpenses(exp.data as Expense[]);
    if (banks.data) setBankAccounts(banks.data);
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Amount is required"); return; }

    if (editingId) {
      // Delete-then-insert to let triggers fire
      const { error: delErr } = await supabase.from("expenses").delete().eq("id", editingId);
      if (delErr) { toast.error("Failed to update expense"); return; }
      const { error: insErr } = await supabase.from("expenses").insert({
        expense_number: editingNumber, category, description: description || null,
        amount: Number(amount), gst_amount: Number(gstAmount) || 0,
        payment_method: paymentMethod, bank_account_id: bankAccountId || null,
        date, notes: notes || null, expense_type: expenseType,
      });
      if (insErr) { toast.error("Failed to save expense"); return; }
      toast.success(`Expense ${editingNumber} updated`);
    } else {
      const { data: expNumber } = await supabase.rpc("generate_document_number", { p_document_type: "expense" });
      if (!expNumber) { toast.error("Failed to generate expense number"); return; }
      await supabase.from("expenses").insert({
        expense_number: expNumber, category, description: description || null,
        amount: Number(amount), gst_amount: Number(gstAmount) || 0,
        payment_method: paymentMethod, bank_account_id: bankAccountId || null,
        date, notes: notes || null, expense_type: expenseType,
      });
      toast.success(`Expense ${expNumber} recorded`);
    }
    resetForm(); load();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("expenses").delete().eq("id", deleteId);
    if (error) { toast.error("Failed to delete expense"); } else { toast.success("Expense deleted"); }
    setDeleteId(null);
    load();
  };

  const handleEdit = (e: Expense) => {
    setEditingId(e.id);
    setEditingNumber(e.expense_number);
    setExpenseType(e.expense_type);
    setCategory(e.category);
    setDescription(e.description || "");
    setAmount(String(e.amount));
    setGstAmount(String(e.gst_amount));
    setPaymentMethod(e.payment_method);
    setBankAccountId(e.bank_account_id || "");
    setDate(e.date);
    setNotes(e.notes || "");
    setOpen(true);
  };

  const resetForm = () => {
    setOpen(false); setEditingId(null); setEditingNumber("");
    setCategory(activeTab === "personal" ? "personal" : "other");
    setExpenseType(activeTab === "personal" ? "personal" : "business");
    setDescription(""); setAmount(""); setGstAmount("");
    setPaymentMethod("cash"); setBankAccountId(""); setNotes("");
  };

  const handleOpenDialog = () => {
    setExpenseType(activeTab === "personal" ? "personal" : "business");
    setCategory(activeTab === "personal" ? "personal" : "other");
    setOpen(true);
  };

  const currentCategories = expenseType === "personal" ? PERSONAL_CATEGORIES : BUSINESS_CATEGORIES;
  const filterCategories = activeTab === "all" ? ALL_CATEGORIES : activeTab === "personal" ? PERSONAL_CATEGORIES : BUSINESS_CATEGORIES;

  const filtered = expenses.filter(e => {
    const matchSearch = e.expense_number.toLowerCase().includes(search.toLowerCase()) ||
      (e.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || e.category === catFilter;
    const matchTab = activeTab === "all" || e.expense_type === activeTab;
    return matchSearch && matchCat && matchTab;
  });

  const totalBusiness = expenses.filter(e => e.expense_type === "business").reduce((s, e) => s + Number(e.amount), 0);
  const totalPersonal = expenses.filter(e => e.expense_type === "personal").reduce((s, e) => s + Number(e.amount), 0);
  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount), 0);

  const formatCategory = (c: string) => c.replace(/_/g, " ");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Expenses</h1>
            </div>
            <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); else handleOpenDialog(); }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Expense</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{editingId ? "Edit Expense" : "Record Expense"}</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label className="mb-2 block">Expense Type</Label>
                    <RadioGroup value={expenseType} onValueChange={(v) => {
                      setExpenseType(v);
                      setCategory(v === "personal" ? "personal" : "other");
                    }} className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="business" id="type-business" />
                        <Label htmlFor="type-business" className="flex items-center gap-1 cursor-pointer">
                          <Briefcase className="h-3.5 w-3.5" /> Business
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="personal" id="type-personal" />
                        <Label htmlFor="type-personal" className="flex items-center gap-1 cursor-pointer">
                          <User className="h-3.5 w-3.5" /> Personal
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Category</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{currentCategories.map(c => <SelectItem key={c} value={c} className="capitalize">{formatCategory(c)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                    <div className="col-span-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                    <div><Label>Amount (PKR) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                    {settings?.gst_enabled && <div><Label>GST Amount</Label><Input type="number" value={gstAmount} onChange={e => setGstAmount(e.target.value)} /></div>}
                    <div>
                      <Label>Payment Method</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {(paymentMethod === "bank_transfer" || paymentMethod === "cheque") && bankAccounts.length > 0 && (
                      <div>
                        <Label>Bank Account</Label>
                        <Select value={bankAccountId} onValueChange={setBankAccountId}>
                          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                          <SelectContent>{bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name} — {b.bank_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="col-span-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">{editingId ? "Update Expense" : "Save Expense"}</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6 space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Business</p>
                    <p className="text-lg font-bold font-mono text-foreground">PKR {totalBusiness.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-secondary/50 flex items-center justify-center">
                    <User className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Personal</p>
                    <p className="text-lg font-bold font-mono text-foreground">PKR {totalPersonal.toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                    <Wallet className="h-5 w-5 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Grand Total</p>
                    <p className="text-lg font-bold font-mono text-foreground">PKR {(totalBusiness + totalPersonal).toLocaleString()}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setCatFilter("all"); }}>
              <TabsList>
                <TabsTrigger value="business">Business</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {filterCategories.map(c => <SelectItem key={c} value={c} className="capitalize">{formatCategory(c)}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground whitespace-nowrap">
                Showing: PKR {totalFiltered.toLocaleString()} ({filtered.length})
              </p>
            </div>

            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense #</TableHead>
                      {activeTab === "all" && <TableHead>Type</TableHead>}
                      <TableHead>Category</TableHead><TableHead>Description</TableHead>
                      <TableHead>Method</TableHead><TableHead>Date</TableHead>
                      {settings?.gst_enabled && <TableHead className="text-right">GST</TableHead>}
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={activeTab === "all" ? (settings?.gst_enabled ? 9 : 8) : (settings?.gst_enabled ? 8 : 7)} className="text-center py-12 text-muted-foreground">
                        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />No expenses recorded.
                      </TableCell></TableRow>
                    ) : filtered.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium font-mono">{e.expense_number}</TableCell>
                        {activeTab === "all" && (
                          <TableCell>
                            <Badge variant={e.expense_type === "business" ? "default" : "secondary"} className="capitalize">
                              {e.expense_type}
                            </Badge>
                          </TableCell>
                        )}
                        <TableCell className="capitalize">{formatCategory(e.category)}</TableCell>
                        <TableCell className="text-muted-foreground">{e.description || "—"}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{e.payment_method.replace("_", " ")}</TableCell>
                        <TableCell className="text-muted-foreground">{e.date}</TableCell>
                        {settings?.gst_enabled && <TableCell className="text-right text-muted-foreground font-mono">{Number(e.gst_amount).toLocaleString()}</TableCell>}
                        <TableCell className="text-right font-mono font-medium text-destructive">{Number(e.amount).toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}>
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
        </main>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this expense and reverse any associated bank balance changes. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
