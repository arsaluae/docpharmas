import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Wallet, RotateCcw } from "lucide-react";

interface LedgerEntry { date: string; type: string; reference: string; debit: number; credit: number; balance: number; }

export default function CustomerLedger() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<any>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => { if (id) loadLedger(id); }, [id]);

  const loadLedger = async (customerId: string) => {
    const [{ data: cust }, { data: invoices }, { data: payments }, { data: returns }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).single(),
      supabase.from("sales_invoices").select("*").eq("customer_id", customerId),
      supabase.from("payments").select("*").eq("party_id", customerId).eq("party_type", "customer"),
      supabase.from("sales_returns").select("*").eq("customer_id", customerId),
    ]);
    if (cust) setCustomer(cust);

    const raw: Omit<LedgerEntry, "balance">[] = [];
    if (cust) raw.push({ date: cust.created_at.split("T")[0], type: "Opening Balance", reference: "—", debit: Number(cust.opening_balance), credit: 0 });
    (invoices || []).forEach(inv => raw.push({ date: inv.date, type: "Sales Invoice", reference: inv.invoice_number, debit: Number(inv.total), credit: 0 }));
    (payments || []).forEach(p => raw.push({ date: p.date, type: "Payment Received", reference: p.payment_number, debit: 0, credit: Number(p.amount) }));
    (returns || []).forEach(r => raw.push({ date: r.date, type: "Sales Return", reference: r.return_number, debit: 0, credit: Number(r.total) }));

    raw.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    setEntries(raw.map(e => { bal += e.debit - e.credit; return { ...e, balance: bal }; }));
  };

  const totalSales = entries.filter(e => e.type === "Sales Invoice").reduce((s, e) => s + e.debit, 0);
  const totalReceived = entries.filter(e => e.type === "Payment Received").reduce((s, e) => s + e.credit, 0);
  const totalReturns = entries.filter(e => e.type === "Sales Return").reduce((s, e) => s + e.credit, 0);
  const outstanding = entries.length > 0 ? entries[entries.length - 1].balance : 0;

  const headerActions = (
    <Button variant="ghost" size="icon" asChild><Link to="/customers"><ArrowLeft className="h-4 w-4" /></Link></Button>
  );

  return (
    <AppLayout title={`${customer?.name || "Customer"} — Ledger`} subtitle={`${customer?.company || ""} ${customer?.city ? `• ${customer.city}` : ""}`} headerActions={headerActions}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Sales", value: totalSales, icon: FileText, color: "text-primary" },
            { label: "Received", value: totalReceived, icon: Wallet, color: "text-primary" },
            { label: "Returns", value: totalReturns, icon: RotateCcw, color: "text-warning" },
            { label: "Outstanding", value: outstanding, icon: FileText, color: outstanding > 0 ? "text-destructive" : "text-primary" },
          ].map(c => (
            <Card key={c.label} className="glass-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className={`text-lg font-bold font-mono ${c.color}`}>{c.value.toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No transactions found.</TableCell></TableRow>
                ) : entries.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>{e.date}</TableCell><TableCell>{e.type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.reference}</TableCell>
                    <TableCell className="text-right font-mono">{e.debit ? e.debit.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right font-mono">{e.credit ? e.credit.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{e.balance.toLocaleString()}</TableCell>
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
