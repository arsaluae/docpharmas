import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface AgingRow {
  invoice_number: string; customer: string; total: number; amount_paid: number;
  due_date: string; days: number; bucket: string;
}

const bucketLabel = (days: number) => {
  if (days <= 0) return "Current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
};

const bucketColor = (b: string) => {
  if (b === "Current") return "bg-primary/10 text-primary";
  if (b === "1-30") return "bg-warning/10 text-warning";
  if (b === "31-60") return "bg-warning/20 text-warning";
  if (b === "61-90") return "bg-destructive/10 text-destructive";
  return "bg-destructive/20 text-destructive";
};

export default function ReceivablesAging() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<AgingRow[]>([]);
  const [bucketTotals, setBucketTotals] = useState<Record<string, number>>({});

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    const [inv, custs] = await Promise.all([
      supabase.from("sales_invoices").select("invoice_number, customer_id, total, amount_paid, due_date").in("status", ["unpaid", "partial"]),
      supabase.from("customers").select("id, name"),
    ]);
    const nameMap: Record<string, string> = {};
    (custs.data || []).forEach(c => { nameMap[c.id] = c.name; });
    const today = new Date();
    const data: AgingRow[] = (inv.data || []).map(i => {
      const due = i.due_date ? new Date(i.due_date) : today;
      const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
      return {
        invoice_number: i.invoice_number, customer: nameMap[i.customer_id || ""] || "—",
        total: Number(i.total), amount_paid: Number(i.amount_paid), due_date: i.due_date || "—",
        days: Math.max(days, 0), bucket: bucketLabel(days),
      };
    });
    setRows(data);
    const totals: Record<string, number> = {};
    data.forEach(r => { totals[r.bucket] = (totals[r.bucket] || 0) + (r.total - r.amount_paid); });
    setBucketTotals(totals);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-bold text-foreground font-heading">Receivables Aging</h1>
          </header>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-5 gap-3">
              {["Current", "1-30", "31-60", "61-90", "90+"].map(b => (
                <Card key={b} className="glass-card">
                  <CardHeader className="pb-1"><CardTitle className="text-xs text-muted-foreground">{b} days</CardTitle></CardHeader>
                  <CardContent><p className="text-lg font-bold font-mono">PKR {(bucketTotals[b] || 0).toLocaleString()}</p></CardContent>
                </Card>
              ))}
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead><TableHead>Customer</TableHead><TableHead>Due Date</TableHead>
                      <TableHead>Days</TableHead><TableHead>Bucket</TableHead><TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No outstanding receivables.</TableCell></TableRow>
                    ) : rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono">{r.invoice_number}</TableCell>
                        <TableCell>{r.customer}</TableCell>
                        <TableCell className="text-muted-foreground">{r.due_date}</TableCell>
                        <TableCell className="font-mono">{r.days}</TableCell>
                        <TableCell><Badge className={`border-0 ${bucketColor(r.bucket)}`}>{r.bucket}</Badge></TableCell>
                        <TableCell className="text-right font-mono font-medium">PKR {(r.total - r.amount_paid).toLocaleString()}</TableCell>
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
