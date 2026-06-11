import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Search, Receipt, Briefcase, User, Wallet, Pencil, Trash2, BookOpen, ArrowLeft, X } from "lucide-react";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { useFreightProviders } from "@/hooks/useFreightProviders";
import { BulkActionBar, useBulkSelection, RowCheckbox } from "@/components/BulkActionBar";
import { Checkbox } from "@/components/ui/checkbox";


const DEFAULT_BUSINESS_CATEGORIES = [
  "salaries", "rent", "utilities", "transport", "travel",
  "maintenance", "marketing", "regulatory", "license_renewal",
  "insurance", "office_supplies", "communication",
  "professional_fees", "depreciation", "other",
];
const DEFAULT_PERSONAL_CATEGORIES = ["food", "transport", "travel", "personal", "other"];
const METHODS = ["cash", "cheque", "bank_transfer", "online"];

interface BankAccount { id: string; name: string; bank_name: string; }
interface Expense {
  id: string; expense_number: string; category: string; description: string | null;
  amount: number; gst_amount: number; payment_method: string; bank_account_id: string | null;
  date: string; notes: string | null; expense_type: string; ledger_id: string | null;
  freight_provider_id: string | null;
}
interface ExpenseLedger {
  id: string; name: string; expense_type: string; description: string | null;
}

export default function Expenses() {
  const { settings } = useCompanySettings();
  const { providers: couriers, reload: reloadCouriers } = useFreightProviders(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [ledgers, setLedgers] = useState<ExpenseLedger[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("business");
  const [open, setOpen] = useState(false);
  const pagination = usePagination();
  const bulk = useBulkSelection();
  const deleteOne = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw error;
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Ledger drill-down
  const [selectedLedger, setSelectedLedger] = useState<ExpenseLedger | null>(null);

  // Ledger management dialog
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerName, setLedgerName] = useState("");
  const [ledgerType, setLedgerType] = useState("business");
  const [ledgerDesc, setLedgerDesc] = useState("");
  const [editLedgerId, setEditLedgerId] = useState<string | null>(null);

  const [expenseType, setExpenseType] = useState("business");
  const [category, setCategory] = useState("other");
  const [ledgerId, setLedgerId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [gstAmount, setGstAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [freightProviderId, setFreightProviderId] = useState("");
  const [newCourierName, setNewCourierName] = useState("");
  const [addCourierOpen, setAddCourierOpen] = useState(false);
  const [courierFilter, setCourierFilter] = useState("all");

  useEffect(() => { load(); }, [pagination.page, activeTab, selectedLedger]);

  const load = async () => {
    let expQuery = supabase.from("expenses").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (selectedLedger) {
      expQuery = expQuery.eq("ledger_id", selectedLedger.id);
    } else if (activeTab !== "all") {
      expQuery = expQuery.eq("expense_type", activeTab);
    }
    expQuery = expQuery.range(pagination.from, pagination.to);

    const [exp, banks, ledgerRes] = await Promise.all([
      expQuery,
      supabase.from("bank_accounts").select("id, name, bank_name"),
      supabase.from("expense_ledgers").select("*").order("name"),
    ]);
    if (exp.data) setExpenses(exp.data as Expense[]);
    if (exp.count !== null && exp.count !== undefined) pagination.setTotalCount(exp.count);
    if (banks.data) setBankAccounts(banks.data);
    if (ledgerRes.data) setLedgers(ledgerRes.data as ExpenseLedger[]);
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Amount is required"); return; }

    if (editingId) {
      const oldExpense = expenses.find(e => e.id === editingId);
      if (!oldExpense) { toast.error("Expense not found"); return; }
      const { error: delErr } = await supabase.from("expenses").delete().eq("id", editingId);
      if (delErr) { toast.error("Failed to update: " + delErr.message); return; }
      const { error: insErr } = await supabase.from("expenses").insert({
        expense_number: editingNumber, category, description: description || null,
        amount: Number(amount), gst_amount: Number(gstAmount) || 0,
        payment_method: paymentMethod, bank_account_id: bankAccountId || null,
        date, notes: notes || null, expense_type: expenseType, ledger_id: ledgerId || null,
        freight_provider_id: category === "transport" ? (freightProviderId || null) : null,
      } as any);
      if (insErr) {
        await supabase.from("expenses").insert({
          expense_number: oldExpense.expense_number, category: oldExpense.category,
          description: oldExpense.description, amount: oldExpense.amount,
          gst_amount: oldExpense.gst_amount, payment_method: oldExpense.payment_method,
          bank_account_id: oldExpense.bank_account_id, date: oldExpense.date,
          notes: oldExpense.notes, expense_type: oldExpense.expense_type,
          ledger_id: oldExpense.ledger_id,
        });
        toast.error("Failed to save — original restored"); return;
      }
      toast.success(`Expense ${editingNumber} updated`);
    } else {
      const { data: expNumber } = await supabase.rpc("generate_document_number", { p_document_type: "expense" });
      if (!expNumber) { toast.error("Failed to generate expense number"); return; }
      const { error } = await supabase.from("expenses").insert({
        expense_number: expNumber, category, description: description || null,
        amount: Number(amount), gst_amount: Number(gstAmount) || 0,
        payment_method: paymentMethod, bank_account_id: bankAccountId || null,
        date, notes: notes || null, expense_type: expenseType, ledger_id: ledgerId || null,
        freight_provider_id: category === "transport" ? (freightProviderId || null) : null,
      } as any);
      if (error) { toast.error("Failed to save: " + error.message); return; }
      toast.success(`Expense ${expNumber} recorded`);
    }
    resetForm(); load();
  };

  const addCourierInline = async () => {
    if (!newCourierName.trim()) { toast.error("Courier name required"); return; }
    const code = newCourierName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) || `C${Date.now().toString().slice(-4)}`;
    const { data, error } = await supabase.from("freight_providers" as any).insert({ name: newCourierName.trim(), code, is_active: true } as any).select("id").single();
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Courier added");
    setNewCourierName(""); setAddCourierOpen(false);
    await reloadCouriers();
    if (data?.id) setFreightProviderId((data as any).id);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("expenses").delete().eq("id", deleteId);
    if (error) { toast.error("Failed to delete expense"); } else { toast.success("Expense deleted"); }
    setDeleteId(null); load();
  };

  const handleEdit = (e: Expense) => {
    setEditingId(e.id); setEditingNumber(e.expense_number);
    setExpenseType(e.expense_type); setCategory(e.category);
    setDescription(e.description || ""); setAmount(String(e.amount));
    setGstAmount(String(e.gst_amount)); setPaymentMethod(e.payment_method);
    setBankAccountId(e.bank_account_id || ""); setDate(e.date);
    setNotes(e.notes || ""); setLedgerId(e.ledger_id || "");
    setFreightProviderId(e.freight_provider_id || "");
    setOpen(true);
  };

  const resetForm = () => {
    setOpen(false); setEditingId(null); setEditingNumber("");
    setCategory(activeTab === "personal" ? "personal" : "other");
    setExpenseType(activeTab === "personal" ? "personal" : "business");
    setDescription(""); setAmount(""); setGstAmount(""); setLedgerId("");
    setPaymentMethod("cash"); setBankAccountId(""); setNotes("");
    setFreightProviderId("");
  };

  const handleOpenDialog = () => {
    setExpenseType(activeTab === "personal" ? "personal" : "business");
    setCategory(activeTab === "personal" ? "personal" : "other");
    setOpen(true);
  };

  // Ledger CRUD
  const handleSaveLedger = async () => {
    if (!ledgerName.trim()) { toast.error("Name is required"); return; }
    if (editLedgerId) {
      const { error } = await supabase.from("expense_ledgers").update({ name: ledgerName, expense_type: ledgerType, description: ledgerDesc || null }).eq("id", editLedgerId);
      if (error) { toast.error(error.message); return; }
      toast.success("Ledger updated");
    } else {
      const { error } = await supabase.from("expense_ledgers").insert({ name: ledgerName, expense_type: ledgerType, description: ledgerDesc || null });
      if (error) { toast.error(error.message); return; }
      toast.success("Ledger created");
    }
    setLedgerName(""); setLedgerDesc(""); setEditLedgerId(null);
    load();
  };

  const handleDeleteLedger = async (id: string) => {
    const { error } = await supabase.from("expense_ledgers").delete().eq("id", id);
    if (error) { toast.error("Cannot delete: ledger has expenses linked"); } else { toast.success("Ledger deleted"); }
    load();
  };

  // Build category list from ledgers + defaults
  const typeLedgers = ledgers.filter(l => l.expense_type === expenseType || expenseType === "all");
  const defaultCats = expenseType === "personal" ? DEFAULT_PERSONAL_CATEGORIES : DEFAULT_BUSINESS_CATEGORIES;
  const allDefaultCats = [...new Set([...DEFAULT_BUSINESS_CATEGORIES, ...DEFAULT_PERSONAL_CATEGORIES])];
  const filterCats = activeTab === "all" ? allDefaultCats : activeTab === "personal" ? DEFAULT_PERSONAL_CATEGORIES : DEFAULT_BUSINESS_CATEGORIES;

  const filtered = expenses.filter(e => {
    const matchSearch = e.expense_number.toLowerCase().includes(search.toLowerCase()) ||
      (e.description || "").toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "all" || e.category === catFilter;
    return matchSearch && matchCat;
  });

  const totalBusiness = expenses.filter(e => e.expense_type === "business").reduce((s, e) => s + Number(e.amount), 0);
  const totalPersonal = expenses.filter(e => e.expense_type === "personal").reduce((s, e) => s + Number(e.amount), 0);
  const totalFiltered = filtered.reduce((s, e) => s + Number(e.amount), 0);
  const ledgerNameMap = new Map(ledgers.map(l => [l.id, l.name]));

  const formatCategory = (c: string) => c.replace(/_/g, " ");

  const headerActions = (
    <div className="flex gap-2">
      <Dialog open={ledgerOpen} onOpenChange={o => { setLedgerOpen(o); if (!o) { setLedgerName(""); setLedgerDesc(""); setEditLedgerId(null); } }}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline"><BookOpen className="h-4 w-4 mr-1" /> Ledgers</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Expense Ledgers</DialogTitle>
            <DialogDescription>Create custom expense categories for tracking</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Input placeholder="Ledger name..." value={ledgerName} onChange={e => setLedgerName(e.target.value)} /></div>
              <Select value={ledgerType} onValueChange={setLedgerType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Input placeholder="Description (optional)" value={ledgerDesc} onChange={e => setLedgerDesc(e.target.value)} className="flex-1" />
              <Button onClick={handleSaveLedger} size="sm">{editLedgerId ? "Update" : "Add"}</Button>
            </div>
            {ledgers.length > 0 && (
              <div className="border rounded-lg divide-y max-h-60 overflow-y-auto">
                {ledgers.map(l => (
                  <div key={l.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium cursor-pointer hover:text-primary" onClick={() => { setSelectedLedger(l); setLedgerOpen(false); }}>{l.name}</span>
                      <Badge variant="secondary" className="ml-2 text-[10px] capitalize">{l.expense_type}</Badge>
                      {l.description && <p className="text-xs text-muted-foreground truncate">{l.description}</p>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditLedgerId(l.id); setLedgerName(l.name); setLedgerType(l.expense_type); setLedgerDesc(l.description || ""); }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteLedger(l.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); else handleOpenDialog(); }}>
        <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Expense</Button></DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Edit Expense" : "Record Expense"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="mb-2 block">Expense Type</Label>
              <RadioGroup value={expenseType} onValueChange={(v) => { setExpenseType(v); setCategory(v === "personal" ? "personal" : "other"); setLedgerId(""); }} className="flex gap-4">
                <div className="flex items-center gap-2"><RadioGroupItem value="business" id="type-business" /><Label htmlFor="type-business" className="flex items-center gap-1 cursor-pointer"><Briefcase className="h-3.5 w-3.5" /> Business</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="personal" id="type-personal" /><Label htmlFor="type-personal" className="flex items-center gap-1 cursor-pointer"><User className="h-3.5 w-3.5" /> Personal</Label></div>
              </RadioGroup>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{defaultCats.map(c => <SelectItem key={c} value={c} className="capitalize">{formatCategory(c)}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
              {typeLedgers.length > 0 && (
                <div className="col-span-2">
                  <Label>Expense Ledger (optional)</Label>
                  <Select value={ledgerId} onValueChange={setLedgerId}>
                    <SelectTrigger><SelectValue placeholder="No ledger" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Ledger</SelectItem>
                      {typeLedgers.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="col-span-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div><Label>Amount (PKR) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              {settings?.gst_enabled && <div><Label>GST Amount</Label><Input type="number" value={gstAmount} onChange={e => setGstAmount(e.target.value)} /></div>}
              <div><Label>Payment Method</Label><Select value={paymentMethod} onValueChange={setPaymentMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{METHODS.map(m => <SelectItem key={m} value={m} className="capitalize">{m.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div>
              {(paymentMethod === "bank_transfer" || paymentMethod === "cheque") && bankAccounts.length > 0 && (
                <div><Label>Bank Account</Label><Select value={bankAccountId} onValueChange={setBankAccountId}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name} — {b.bank_name}</SelectItem>)}</SelectContent></Select></div>
              )}
              <div className="col-span-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
          </div>
          <Button onClick={handleSave} className="w-full mt-4">{editingId ? "Update Expense" : "Save Expense"}</Button>
        </DialogContent>
      </Dialog>
    </div>
  );

  return (
    <AppLayout title={selectedLedger ? `Ledger: ${selectedLedger.name}` : "Expenses"} headerActions={headerActions}>
      <div className="space-y-4">
        {selectedLedger && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedLedger(null)} className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to All Expenses
          </Button>
        )}

        {!selectedLedger && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 stagger-children">
              <div className="summary-card p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Briefcase className="h-5 w-5 text-primary" /></div>
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Business</p><p className="text-lg font-bold font-mono tabular-nums text-foreground">PKR {totalBusiness.toLocaleString()}</p></div>
              </div>
              <div className="summary-card p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-secondary/50 flex items-center justify-center"><User className="h-5 w-5 text-secondary-foreground" /></div>
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Personal</p><p className="text-lg font-bold font-mono tabular-nums text-foreground">PKR {totalPersonal.toLocaleString()}</p></div>
              </div>
              <div className="summary-card p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center"><Wallet className="h-5 w-5 text-accent-foreground" /></div>
                <div><p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Grand Total</p><p className="text-lg font-bold font-mono tabular-nums text-foreground">PKR {(totalBusiness + totalPersonal).toLocaleString()}</p></div>
              </div>
            </div>

            {/* Ledger quick-access cards */}
            {ledgers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ledgers.map(l => (
                  <button key={l.id} onClick={() => setSelectedLedger(l)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 text-xs font-medium hover:bg-primary/10 hover:border-primary/30 transition-all flex items-center gap-1.5">
                    <BookOpen className="h-3 w-3 text-muted-foreground" />
                    {l.name}
                  </button>
                ))}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setCatFilter("all"); }}>
              <TabsList>
                <TabsTrigger value="business">Business</TabsTrigger>
                <TabsTrigger value="personal">Personal</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        )}

        <div className="flex items-center gap-4">
          <div className="relative max-w-sm flex-1 search-pill">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search expenses..." className="pl-10 rounded-full border-0 shadow-none bg-transparent" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {!selectedLedger && (
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filterCats.map(c => <SelectItem key={c} value={c} className="capitalize">{formatCategory(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <p className="text-sm text-muted-foreground whitespace-nowrap">
            Showing: PKR {totalFiltered.toLocaleString()} ({filtered.length})
          </p>
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"><Checkbox checked={filtered.length > 0 && bulk.selected.length === filtered.length} onCheckedChange={() => bulk.toggleAll(filtered.map(f => f.id))} /></TableHead>
                  <TableHead>Expense #</TableHead>
                  {(activeTab === "all" || selectedLedger) && <TableHead>Type</TableHead>}
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Ledger</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Date</TableHead>
                  {settings?.gst_enabled && <TableHead className="text-right">GST</TableHead>}
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-center w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />No expenses recorded.
                  </TableCell></TableRow>
                ) : filtered.map(e => (
                  <TableRow key={e.id} data-state={bulk.isSelected(e.id) ? "selected" : undefined}>
                    <TableCell><RowCheckbox checked={bulk.isSelected(e.id)} onCheckedChange={() => bulk.toggle(e.id)} /></TableCell>
                    <TableCell className="font-medium font-mono">{e.expense_number}</TableCell>

                    {(activeTab === "all" || selectedLedger) && (
                      <TableCell><Badge variant={e.expense_type === "business" ? "default" : "secondary"} className="capitalize">{e.expense_type}</Badge></TableCell>
                    )}
                    <TableCell className="capitalize">{formatCategory(e.category)}</TableCell>
                    <TableCell className="text-muted-foreground">{e.description || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.ledger_id ? ledgerNameMap.get(e.ledger_id) || "—" : "—"}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{e.payment_method.replace("_", " ")}</TableCell>
                    <TableCell className="text-muted-foreground">{e.date}</TableCell>
                    {settings?.gst_enabled && <TableCell className="text-right text-muted-foreground font-mono">{Number(e.gst_amount).toLocaleString()}</TableCell>}
                    <TableCell className="text-right font-mono font-medium text-destructive">{Number(e.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(e.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={o => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this expense and reverse any associated bank balance changes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <BulkActionBar selectedIds={bulk.selected} onClear={bulk.clear} entityLabel="expense" onDeleteOne={deleteOne} onDone={load} />
    </AppLayout>

  );
}
