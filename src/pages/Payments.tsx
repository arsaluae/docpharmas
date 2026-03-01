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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

interface Customer { id: string; name: string; }
interface Supplier { id: string; name: string; }
interface BankAccount { id: string; name: string; bank_name: string; }

interface Payment {
  id: string; payment_number: string; type: string; party_type: string; party_id: string;
  amount: number; payment_method: string; bank_account_id: string | null;
  cheque_number: string | null; cheque_date: string | null; reference: string | null;
  date: string; notes: string | null; created_at: string;
}

export default function Payments() {
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("all");

  // Party name lookup
  const [partyNames, setPartyNames] = useState<Record<string, string>>({});

  const [paymentType, setPaymentType] = useState<"received" | "made">("received");
  const [partyType, setPartyType] = useState<"customer" | "supplier">("customer");
  const [partyId, setPartyId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [bankAccountId, setBankAccountId] = useState("");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [reference, setReference] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [pay, cust, sup, banks] = await Promise.all([
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name"),
      supabase.from("suppliers").select("id, name"),
      supabase.from("bank_accounts").select("id, name, bank_name"),
    ]);
    if (pay.data) setPayments(pay.data);
    if (cust.data) setCustomers(cust.data);
    if (sup.data) setSuppliers(sup.data);
    if (banks.data) setBankAccounts(banks.data);

    // Build lookup
    const names: Record<string, string> = {};
    cust.data?.forEach(c => { names[c.id] = c.name; });
    sup.data?.forEach(s => { names[s.id] = s.name; });
    setPartyNames(names);
  };

  const handleSave = async () => {
    if (!partyId || !amount || Number(amount) <= 0) { toast.error("Party and amount required"); return; }
    const { data: paymentNumber } = await supabase.rpc("generate_document_number", { p_document_type: "payment" });
    if (!paymentNumber) { toast.error("Failed to generate payment number"); return; }

    await supabase.from("payments").insert({
      payment_number: paymentNumber, type: paymentType, party_type: partyType, party_id: partyId,
      amount: Number(amount), payment_method: paymentMethod,
      bank_account_id: bankAccountId || null, cheque_number: chequeNumber || null,
      cheque_date: chequeDate || null, reference: reference || null, date: payDate, notes: notes || null,
    });

    toast.success(`Payment ${paymentNumber} recorded`);
    resetForm(); load();
  };

  const resetForm = () => {
    setOpen(false); setPartyId(""); setAmount(""); setPaymentMethod("cash");
    setBankAccountId(""); setChequeNumber(""); setChequeDate(""); setReference(""); setNotes("");
  };

  const parties = partyType === "customer" ? customers : suppliers;

  const filtered = payments.filter(p => {
    const matchSearch = p.payment_number.toLowerCase().includes(search.toLowerCase()) ||
      (partyNames[p.party_id] || "").toLowerCase().includes(search.toLowerCase());
    if (tab === "received") return matchSearch && p.type === "received";
    if (tab === "made") return matchSearch && p.type === "made";
    return matchSearch;
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Payments</h1>
              <p className="text-sm text-muted-foreground">Record payments received & made with cheque tracking</p>
            </div>
            <Dialog open={open} onOpenChange={o => { if (!o) resetForm(); else setOpen(true); }}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Record Payment</Button></DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Record Payment</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div>
                    <Label>Type</Label>
                    <Select value={paymentType} onValueChange={(v: "received" | "made") => { setPaymentType(v); setPartyType(v === "received" ? "customer" : "supplier"); setPartyId(""); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="received">Payment Received</SelectItem>
                        <SelectItem value="made">Payment Made</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{partyType === "customer" ? "Customer" : "Supplier"} *</Label>
                    <Select value={partyId} onValueChange={setPartyId}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Amount (PKR) *</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                  <div><Label>Date</Label><Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} /></div>
                  <div>
                    <Label>Method</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="cheque">Cheque</SelectItem>
                        <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                        <SelectItem value="online">Online</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {bankAccounts.length > 0 && (paymentMethod === "bank_transfer" || paymentMethod === "cheque") && (
                    <div>
                      <Label>Bank Account</Label>
                      <Select value={bankAccountId} onValueChange={setBankAccountId}>
                        <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>{bankAccounts.map(b => <SelectItem key={b.id} value={b.id}>{b.name} — {b.bank_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}
                  {paymentMethod === "cheque" && (
                    <>
                      <div><Label>Cheque #</Label><Input value={chequeNumber} onChange={e => setChequeNumber(e.target.value)} /></div>
                      <div><Label>Cheque Date</Label><Input type="date" value={chequeDate} onChange={e => setChequeDate(e.target.value)} /></div>
                    </>
                  )}
                  <div><Label>Reference</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Ref / Txn ID" /></div>
                  <div className="col-span-2"><Label>Notes</Label><Input value={notes} onChange={e => setNotes(e.target.value)} /></div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">Record Payment</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search payments..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="received">Received</TabsTrigger>
                  <TabsTrigger value="made">Made</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment #</TableHead><TableHead>Type</TableHead><TableHead>Party</TableHead>
                      <TableHead>Method</TableHead><TableHead>Cheque</TableHead><TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                        <Wallet className="h-8 w-8 mx-auto mb-2 opacity-40" />No payments recorded.
                      </TableCell></TableRow>
                    ) : filtered.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium font-mono">{p.payment_number}</TableCell>
                        <TableCell>
                          {p.type === "received" ? (
                            <span className="status-pill bg-emerald-50 text-emerald-700"><ArrowDownLeft className="h-3 w-3 mr-1 inline" />Received</span>
                          ) : (
                            <span className="status-pill bg-destructive/10 text-destructive"><ArrowUpRight className="h-3 w-3 mr-1 inline" />Made</span>
                          )}
                        </TableCell>
                        <TableCell>{partyNames[p.party_id] || p.party_id}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{p.payment_method.replace("_", " ")}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{p.cheque_number || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{p.date}</TableCell>
                        <TableCell className={`text-right font-mono font-medium ${p.type === "received" ? "text-emerald-600" : "text-destructive"}`}>
                          {p.type === "received" ? "+" : "-"}{Number(p.amount).toLocaleString()}
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
    </SidebarProvider>
  );
}
