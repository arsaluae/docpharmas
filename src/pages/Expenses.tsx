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
import { Plus, Search, Receipt } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = [
  "salaries", "rent", "utilities", "transport", "travel", "food",
  "maintenance", "marketing", "regulatory", "license_renewal",
  "personal", "insurance", "office_supplies", "communication",
  "professional_fees", "depreciation", "other",
];
const METHODS = ["cash", "cheque", "bank_transfer", "online"];

interface BankAccount { id: string; name: string; bank_name: string; }
interface Expense {
  id: string; expense_number: string; category: string; description: string | null;
  amount: number; gst_amount: number; payment_method: string; bank_account_id: string | null;
  date: string; notes: string | null;
}

export default function Expenses() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [open, setOpen] = useState(false);

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
    if (exp.data) setExpenses(exp.data);
    if (banks.data) setBankAccounts(banks.data);
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) { toast.error("Amount is required"); return; }
    const { count } = await supabase.from("expenses").select("id", { count: "exact", head: true });
    const expNumber = `EXP-${String((count || 0) + 1).padStart(4, "0")}`;

    await supabase.from("expenses").insert({
      expense_number: expNumber, category, description: description || null,
      amount: Number(amount), gst_amount: Number(gstAmount) || 0,
      payment_method: paymentMethod, bank_account_id: bankAccountId || null,
      date, notes: notes || null,
    });
    toast.success(`Expense ${expNumber} recorded`);
    resetForm(); load();
  };

  const resetForm = () => {
    setOpen(false); setCategory("other"); setDescription(""); setAmount("");
    setGstAmount(""); setPaymentMethod("cash"); setBankAccountId(""); setNotes("");
  };

  const filtered = expenses.filter(e => {
    const matchSearch = e.expense_number.toLowerCase().includes(search.toLowerCase()) ||
      (e.description || "").toLowerCase().includes(search.toLowerCase());
    if (catFilter !== "all") return matchSearch && e.category === catFilter;
    return matchSearch;
  });

  const totalExpenses = filtered.reduce((s, e) => s + Number(e.amount), 0);

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
              <p className="text-sm text-muted-foreground">Total: PKR {totalExpenses.toLocaleString()}</p>
            </div>
            <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); else setOpen(true); }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Expense</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Record Expense</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{formatCategory(c)}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                  <div className="col-span-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                  <div><Label>Amount (PKR) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                  <div><Label>GST Amount</Label><Input type="number" value={gstAmount} onChange={e => setGstAmount(e.target.value)} /></div>
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
                <Button onClick={handleSave} className="w-full mt-4">Save Expense</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search expenses..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{formatCategory(c)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense #</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead>
                      <TableHead>Method</TableHead><TableHead>Date</TableHead>
                      <TableHead className="text-right">GST</TableHead><TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-40" />No expenses recorded.
                      </TableCell></TableRow>
                    ) : filtered.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium font-mono">{e.expense_number}</TableCell>
                        <TableCell className="capitalize">{formatCategory(e.category)}</TableCell>
                        <TableCell className="text-muted-foreground">{e.description || "—"}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{e.payment_method.replace("_", " ")}</TableCell>
                        <TableCell className="text-muted-foreground">{e.date}</TableCell>
                        <TableCell className="text-right text-muted-foreground font-mono">{Number(e.gst_amount).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-mono font-medium text-destructive">{Number(e.amount).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
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
