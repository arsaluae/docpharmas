import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Wallet, Users, FileText, ClipboardList, Truck } from "lucide-react";

const fmtPKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const startOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

export default function AgentReports() {
  const nav = useNavigate();
  const [from, setFrom] = useState(startOfMonth());
  const [to, setTo] = useState(today());
  const [invoices, setInvoices] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => { (async () => {
    const [{ data: inv }, { data: pay }, { data: cust }, { data: dn }, { data: pf }] = await Promise.all([
      supabase.from("sales_invoices").select("id, invoice_number, date, total, amount_paid, status, customer_id, customers(name)")
        .neq("status", "voided").gte("date", from).lte("date", to).order("date", { ascending: false }),
      supabase.from("payments").select("id, payment_number, date, amount, payment_method, party_id, status")
        .eq("type", "received").eq("party_type", "customer").gte("date", from).lte("date", to).order("date", { ascending: false }),
      supabase.from("customers").select("id, name, balance, phone, city"),
      supabase.from("delivery_notes").select("id, dn_number, date, customer_id, status").order("date", { ascending: false }).limit(100),
      supabase.from("proforma_invoices").select("id, pi_number:invoice_number, date, total, status, customer_id, customers(name)")
        .neq("status", "voided").order("date", { ascending: false }).limit(100),
    ]);
    setInvoices(inv ?? []);
    setCollections(pay ?? []);
    setCustomers(cust ?? []);
    setDeliveries(dn ?? []);
    setOrders(pf ?? []);
  })(); }, [from, to]);

  const summary = useMemo(() => ({
    invoiceCount: invoices.length,
    salesTotal: invoices.reduce((s, i) => s + Number(i.total || 0), 0),
    collected: collections.reduce((s, p) => s + Number(p.amount || 0), 0),
    outstanding: customers.reduce((s, c) => s + Math.max(0, Number(c.balance) || 0), 0),
    openOrders: orders.filter((o: any) => !["voided", "converted", "cancelled"].includes(o.status ?? "")).length,
    pendingDeliveries: deliveries.filter((d: any) => ["pending", "in_transit"].includes(d.status ?? "")).length,
  }), [invoices, collections, customers, orders, deliveries]);

  const outstandingCustomers = useMemo(() =>
    customers.filter(c => (Number(c.balance) || 0) > 0).sort((a, b) => Number(b.balance) - Number(a.balance)).slice(0, 20),
    [customers]
  );

  const followUp = useMemo(() => {
    const lastInv = new Map<string, string>();
    invoices.forEach((i: any) => { const cur = lastInv.get(i.customer_id); if (!cur || i.date > cur) lastInv.set(i.customer_id, i.date); });
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10);
    return customers
      .map(c => ({ ...c, lastInvoiceDate: lastInv.get(c.id) ?? null }))
      .filter(c => !c.lastInvoiceDate || c.lastInvoiceDate < thirtyDaysAgo)
      .slice(0, 15);
  }, [customers, invoices]);

  return (
    <AppLayout title="My Reports" subtitle="Your sales, collections, customers — within your scope">
      <div className="space-y-5">
        {/* Period */}
        <Card className="glass-card"><CardContent className="p-4 flex items-end gap-3 flex-wrap">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" /></div>
        </CardContent></Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { l: "Invoices", v: summary.invoiceCount, icon: FileText },
            { l: "Sales", v: fmtPKR(summary.salesTotal), icon: BarChart3 },
            { l: "Collected", v: fmtPKR(summary.collected), icon: Wallet },
            { l: "Outstanding", v: fmtPKR(summary.outstanding), icon: Users },
            { l: "Open Orders", v: summary.openOrders, icon: ClipboardList },
            { l: "Pending Deliveries", v: summary.pendingDeliveries, icon: Truck },
          ].map(k => (
            <Card key={k.l} className="glass-card"><CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2"><k.icon className="h-3.5 w-3.5 text-muted-foreground" /><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{k.l}</div></div>
              <div className="text-lg font-bold tabular-nums">{k.v}</div>
            </CardContent></Card>
          ))}
        </div>

        {/* Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="glass-card"><CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">My Customers Outstanding</div>
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>City</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
              <TableBody>
                {outstandingCustomers.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">All clear.</TableCell></TableRow>
                ) : outstandingCustomers.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => nav(`/customers/${c.id}/ledger`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.city ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtPKR(Number(c.balance))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>

          <Card className="glass-card"><CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Follow-up (no invoice in 30 days)</div>
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Last Invoice</TableHead><TableHead>Phone</TableHead></TableRow></TableHeader>
              <TableBody>
                {followUp.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="py-10 text-center text-muted-foreground">No follow-ups.</TableCell></TableRow>
                ) : followUp.map(c => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => nav(`/customers/${c.id}/ledger`)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="font-mono text-xs">{c.lastInvoiceDate ? fmtDate(c.lastInvoiceDate) : <Badge variant="outline" className="text-[10px]">Never</Badge>}</TableCell>
                    <TableCell className="font-mono text-xs">{c.phone ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>

          <Card className="glass-card lg:col-span-2"><CardContent className="p-0">
            <div className="px-5 py-4 border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">My Collections</div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Receipt #</TableHead><TableHead>Customer</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {collections.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No collections in this period.</TableCell></TableRow>
                ) : collections.map(p => {
                  const cust = customers.find(c => c.id === p.party_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{fmtDate(p.date)}</TableCell>
                      <TableCell className="font-mono text-xs">{p.payment_number}</TableCell>
                      <TableCell>{cust?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs capitalize">{(p.payment_method ?? "").replace("_", " ")}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums">{fmtPKR(Number(p.amount))}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent></Card>
        </div>
      </div>
    </AppLayout>
  );
}
