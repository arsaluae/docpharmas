import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Landmark } from "lucide-react";
import { toast } from "sonner";

interface BankAccount {
  id: string; name: string; bank_name: string; account_number: string | null;
  branch: string | null; opening_balance: number; balance: number; is_default: boolean;
}

interface Payment {
  id: string; payment_number: string; type: string; amount: number; date: string; payment_method: string;
}

export default function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [linkedPayments, setLinkedPayments] = useState<Payment[]>([]);
  const [open, setOpen] = useState(false);

  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [branch, setBranch] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const { data } = await supabase.from("bank_accounts").select("*").order("created_at", { ascending: false });
    if (data) setAccounts(data);
  };

  const handleSave = async () => {
    if (!name || !bankName) { toast.error("Name and bank name required"); return; }
    const ob = Number(openingBalance) || 0;
    await supabase.from("bank_accounts").insert({
      name, bank_name: bankName, account_number: accountNumber || null,
      branch: branch || null, opening_balance: ob, balance: ob,
    });
    toast.success("Bank account added");
    setOpen(false); setName(""); setBankName(""); setAccountNumber(""); setBranch(""); setOpeningBalance("");
    load();
  };

  const viewReconciliation = async (id: string) => {
    setSelectedId(id);
    const { data } = await supabase.from("payments").select("*").eq("bank_account_id", id).order("date", { ascending: false });
    setLinkedPayments(data || []);
  };

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Bank Accounts</h1>
              <p className="text-sm text-muted-foreground">Total Balance: PKR {totalBalance.toLocaleString()}</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Account</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Bank Account</DialogTitle></DialogHeader>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div><Label>Account Name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                  <div><Label>Bank Name *</Label><Input value={bankName} onChange={e => setBankName(e.target.value)} /></div>
                  <div><Label>Account Number</Label><Input value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
                  <div><Label>Branch</Label><Input value={branch} onChange={e => setBranch(e.target.value)} /></div>
                  <div><Label>Opening Balance</Label><Input type="number" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} /></div>
                </div>
                <Button onClick={handleSave} className="w-full mt-4">Save</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accounts.length === 0 ? (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                <Landmark className="h-8 w-8 mx-auto mb-2 opacity-40" />No bank accounts yet.
              </div>
            ) : accounts.map(a => (
              <Card key={a.id} className={`glass-card cursor-pointer transition-all ${selectedId === a.id ? "ring-2 ring-primary" : ""}`} onClick={() => viewReconciliation(a.id)}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{a.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{a.bank_name} {a.branch ? `• ${a.branch}` : ""}</p>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">Acc: {a.account_number || "—"}</p>
                  <p className="text-2xl font-bold font-mono mt-1">PKR {Number(a.balance).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Opening: PKR {Number(a.opening_balance).toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedId && (
            <div className="px-6 pb-6">
              <h2 className="text-lg font-semibold mb-2">Linked Payments</h2>
              <Card className="glass-card">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Payment #</TableHead><TableHead>Type</TableHead><TableHead>Method</TableHead>
                        <TableHead>Date</TableHead><TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linkedPayments.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No payments linked.</TableCell></TableRow>
                      ) : linkedPayments.map(p => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono">{p.payment_number}</TableCell>
                          <TableCell className="capitalize">{p.type}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">{p.payment_method.replace("_", " ")}</TableCell>
                          <TableCell className="text-muted-foreground">{p.date}</TableCell>
                          <TableCell className={`text-right font-mono font-medium ${p.type === "received" ? "text-primary" : "text-destructive"}`}>
                            {p.type === "received" ? "+" : "-"}{Number(p.amount).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
}
