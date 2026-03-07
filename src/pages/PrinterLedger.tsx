import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

interface LedgerEntry { date: string; type: string; reference: string; debit: number; credit: number; balance: number; }

export default function PrinterLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [printer, setPrinter] = useState<any>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => {
    const check = async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) navigate("/auth"); };
    check();
    if (id) loadLedger(id);
  }, [id, navigate]);

  const loadLedger = async (printerId: string) => {
    const [{ data: pr }, { data: jobs }, { data: payments }] = await Promise.all([
      supabase.from("printers").select("*").eq("id", printerId).single(),
      supabase.from("print_jobs").select("*").eq("printer_id", printerId),
      supabase.from("payments").select("*").eq("party_id", printerId).eq("party_type", "printer"),
    ]);
    if (pr) setPrinter(pr);

    const raw: Omit<LedgerEntry, "balance">[] = [];
    if (pr) raw.push({ date: pr.created_at.split("T")[0], type: "Opening Balance", reference: "—", debit: 0, credit: Number(pr.opening_balance) });
    (jobs || []).filter(j => j.status === "settled").forEach(j => raw.push({ date: j.date, type: "Print Job", reference: j.job_number, debit: 0, credit: Number(j.total_cost) }));
    (payments || []).forEach(p => raw.push({ date: p.date, type: "Payment Made", reference: p.payment_number, debit: Number(p.amount), credit: 0 }));

    raw.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    setEntries(raw.map(e => { bal += e.credit - e.debit; return { ...e, balance: bal }; }));
  };

  const totalJobs = entries.filter(e => e.type === "Print Job").reduce((s, e) => s + e.credit, 0);
  const totalPaid = entries.filter(e => e.type === "Payment Made").reduce((s, e) => s + e.debit, 0);
  const outstanding = entries.length > 0 ? entries[entries.length - 1].balance : 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <Button variant="ghost" size="icon" asChild><Link to="/printers"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">{printer?.name || "Printer"} — Ledger</h1>
              <p className="text-sm text-muted-foreground">{printer?.company || ""}</p>
            </div>
          </header>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[
                { label: "Total Print Jobs", value: totalJobs, color: "text-primary" },
                { label: "Total Paid", value: totalPaid, color: "text-primary" },
                { label: "Outstanding", value: outstanding, color: outstanding > 0 ? "text-destructive" : "text-primary" },
              ].map(c => (
                <Card key={c.label} className="glass-card"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{c.label}</p><p className={`text-lg font-bold font-mono ${c.color}`}>{c.value.toLocaleString()}</p></CardContent></Card>
              ))}
            </div>
            <Card className="glass-card"><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                <TableBody>
                  {entries.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No transactions.</TableCell></TableRow> :
                    entries.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.date}</TableCell><TableCell>{e.type}</TableCell><TableCell className="text-xs text-muted-foreground">{e.reference}</TableCell>
                        <TableCell className="text-right font-mono">{e.debit ? e.debit.toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-right font-mono">{e.credit ? e.credit.toLocaleString() : "—"}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">{e.balance.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
