import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, FileText, Wallet, RotateCcw, MessageCircle, Download, Filter } from "lucide-react";
import { toast } from "sonner";

type EntryType = "Opening Balance" | "Sales Invoice" | "Payment Received" | "Sales Return" | "Warranty Invoice" | "Credit Note";
interface LedgerEntry {
  date: string;
  type: EntryType;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  source_id?: string;
  invoice_id?: string;
}

const TYPE_FILTERS: { key: EntryType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Sales Invoice", label: "Invoices" },
  { key: "Payment Received", label: "Payments" },
  { key: "Sales Return", label: "Returns" },
  { key: "Credit Note", label: "Credit Notes" },
  { key: "Warranty Invoice", label: "Warranty" },
];

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const daysBetween = (a: string, b: string) => {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
};

export default function CustomerLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<any>(null);
  const [allEntries, setAllEntries] = useState<LedgerEntry[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [dateRange, setDateRange] = useState<"30" | "90" | "365" | "all">("90");
  const [search, setSearch] = useState("");

  useEffect(() => { if (id) loadLedger(id); }, [id]);

  const loadLedger = async (customerId: string) => {
    const [{ data: cust }, { data: invs }, { data: payments }, { data: returns }, { data: warranties }, { data: creditNotes }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", customerId).single(),
      supabase.from("sales_invoices").select("id, invoice_number, date, total").eq("customer_id", customerId),
      supabase.from("payments").select("*").eq("party_id", customerId).eq("party_type", "customer"),
      supabase.from("sales_returns").select("*").eq("customer_id", customerId),
      supabase.from("warranty_invoices").select("*").eq("customer_id", customerId),
      supabase.from("credit_notes").select("*").eq("party_id", customerId).eq("party_type", "customer"),
    ]);
    if (cust) setCustomer(cust);
    if (invs) setInvoices(invs);

    const raw: Omit<LedgerEntry, "balance">[] = [];
    if (cust) raw.push({ date: cust.created_at.split("T")[0], type: "Opening Balance", reference: "—", debit: Number(cust.opening_balance), credit: 0 });
    (invs || []).forEach((inv: any) => raw.push({ date: inv.date, type: "Sales Invoice", reference: inv.invoice_number, debit: Number(inv.total), credit: 0, source_id: inv.id, invoice_id: inv.id }));
    (payments || []).forEach((p: any) => raw.push({ date: p.date, type: "Payment Received", reference: p.payment_number, debit: 0, credit: Number(p.amount), source_id: p.id }));
    (returns || []).forEach((r: any) => raw.push({ date: r.date, type: "Sales Return", reference: r.return_number, debit: 0, credit: Number(r.total), source_id: r.id }));
    (warranties || []).forEach((w: any) => raw.push({ date: w.date, type: "Warranty Invoice", reference: w.warranty_number, debit: 0, credit: 0, source_id: w.id }));
    (creditNotes || []).forEach((c: any) => raw.push({ date: c.date, type: "Credit Note", reference: c.credit_note_number, debit: 0, credit: Number(c.amount), source_id: c.id }));

    raw.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    setAllEntries(raw.map(e => { bal += e.debit - e.credit; return { ...e, balance: bal }; }));
  };

  const filtered = useMemo(() => {
    const cutoff = dateRange === "all" ? null : new Date(Date.now() - Number(dateRange) * 86400000).toISOString().split("T")[0];
    return allEntries.filter(e => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (cutoff && e.date < cutoff && e.type !== "Opening Balance") return false;
      if (search && !e.reference.toLowerCase().includes(search.toLowerCase()) && !e.type.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allEntries, typeFilter, dateRange, search]);

  // Stats from full data (not filtered)
  const totalSales = allEntries.filter(e => e.type === "Sales Invoice").reduce((s, e) => s + e.debit, 0);
  const totalReceived = allEntries.filter(e => e.type === "Payment Received").reduce((s, e) => s + e.credit, 0);
  const totalReturns = allEntries.filter(e => e.type === "Sales Return").reduce((s, e) => s + e.credit, 0);
  const outstanding = allEntries.length > 0 ? allEntries[allEntries.length - 1].balance : 0;

  // Aging buckets — based on unpaid invoices
  const aging = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const paidByInvoice = new Map<string, number>();
    invoices.forEach(i => paidByInvoice.set(i.id, 0));
    // Naive: assume invoices are aged by date; if outstanding > 0, distribute by age
    if (outstanding <= 0) return buckets;
    invoices.forEach((inv: any) => {
      const age = daysBetween(inv.date, today);
      const amt = Number(inv.total);
      if (age <= 30) buckets["0-30"] += amt;
      else if (age <= 60) buckets["31-60"] += amt;
      else if (age <= 90) buckets["61-90"] += amt;
      else buckets["90+"] += amt;
    });
    // Scale to outstanding
    const sum = Object.values(buckets).reduce((s, n) => s + n, 0);
    if (sum > 0) {
      const ratio = outstanding / sum;
      Object.keys(buckets).forEach(k => { (buckets as any)[k] = Math.round((buckets as any)[k] * ratio); });
    }
    return buckets;
  }, [invoices, outstanding]);

  const handleRowClick = (e: LedgerEntry) => {
    switch (e.type) {
      case "Sales Invoice":
        navigate(`/?invoice=${e.source_id}`);
        toast.info(`Opening ${e.reference}…`);
        break;
      case "Payment Received":
        navigate(`/payments?tab=received&highlight=${e.source_id}`);
        break;
      case "Sales Return":
        navigate(`/sales-returns?highlight=${e.source_id}`);
        break;
      case "Warranty Invoice":
        navigate(`/warranty-invoices?highlight=${e.source_id}`);
        break;
      case "Credit Note":
        navigate(`/credit-notes?highlight=${e.source_id}`);
        break;
    }
  };

  const exportCSV = () => {
    const rows = [["Date", "Type", "Reference", "Debit", "Credit", "Balance"]];
    filtered.forEach(e => rows.push([e.date, e.type, e.reference, String(e.debit), String(e.credit), String(e.balance)]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ledger-${customer?.name || "customer"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Ledger exported");
  };

  const shareViaWhatsApp = () => {
    if (!customer?.phone) { toast.error("No phone number on record for this customer"); return; }
    const msg = `📊 *Ledger Summary — ${customer.name}*\n\n` +
      `Total Sales: PKR ${totalSales.toLocaleString()}\n` +
      `Total Received: PKR ${totalReceived.toLocaleString()}\n` +
      `Returns: PKR ${totalReturns.toLocaleString()}\n` +
      `*Outstanding Balance: PKR ${outstanding.toLocaleString()}*\n\n` +
      `As of ${new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}`;
    const num = customer.phone.replace(/[^0-9]/g, "");
    window.open(`https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(msg)}`, "_blank");
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={exportCSV}>
        <Download className="h-3.5 w-3.5" /> Export CSV
      </Button>
      <Button variant="outline" size="sm" className="text-xs gap-1.5 text-success border-border hover:bg-success/5" onClick={shareViaWhatsApp}>
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </Button>
      <Button variant="ghost" size="icon" asChild><Link to="/customers"><ArrowLeft className="h-4 w-4" /></Link></Button>
    </div>
  );

  return (
    <AppLayout title={`${customer?.name || "Customer"} — Ledger`} subtitle={`${customer?.company || ""} ${customer?.city ? `• ${customer.city}` : ""}`} headerActions={headerActions}>
      <div className="space-y-4">
        {/* Dashboard KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Sales", value: totalSales, icon: FileText, color: "text-primary" },
            { label: "Received", value: totalReceived, icon: Wallet, color: "text-success" },
            { label: "Returns + Credits", value: totalReturns, icon: RotateCcw, color: "text-warning" },
            { label: "Outstanding", value: outstanding, icon: FileText, color: outstanding > 0 ? "text-destructive" : "text-success" },
          ].map(c => (
            <Card key={c.label} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{c.label}</p>
                  <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className={`text-xl font-bold font-mono tabular-nums ${c.color}`}>PKR {Math.round(c.value).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Aging strip — only when outstanding */}
        {outstanding > 0 && (
          <Card className="glass-card">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Receivables Aging</p>
              <div className="grid grid-cols-4 gap-3">
                {Object.entries(aging).map(([bucket, amt]) => (
                  <div key={bucket} className="border border-border rounded-lg px-3 py-2">
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{bucket} days</p>
                    <p className={`text-sm font-mono font-semibold tabular-nums ${bucket === "90+" ? "text-destructive" : bucket === "61-90" ? "text-warning" : "text-foreground"}`}>PKR {amt.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filter bar */}
        <Card className="glass-card">
          <CardContent className="p-3 flex flex-wrap items-center gap-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-0.5">
              {(["30", "90", "365", "all"] as const).map(d => (
                <button key={d} onClick={() => setDateRange(d)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${dateRange === d ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {d === "all" ? "All" : `${d}d`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {TYPE_FILTERS.map(t => (
                <Badge key={t.key} variant={typeFilter === t.key ? "default" : "outline"}
                  className="cursor-pointer text-xs" onClick={() => setTypeFilter(t.key)}>
                  {t.label}
                </Badge>
              ))}
            </div>
            <Input className="h-8 text-xs max-w-xs ml-auto" placeholder="Search reference…" value={search} onChange={e => setSearch(e.target.value)} />
          </CardContent>
        </Card>

        {/* Ledger table */}
        <Card className="glass-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No transactions match current filters.</TableCell></TableRow>
                ) : filtered.map((e, i) => (
                  <TableRow key={i} className={e.source_id ? "cursor-pointer hover:bg-accent/50" : ""} onClick={() => e.source_id && handleRowClick(e)}>
                    <TableCell className="tabular-nums">{fmtDate(e.date)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-normal">{e.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{e.reference}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{e.debit ? e.debit.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{e.credit ? e.credit.toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right font-mono font-semibold tabular-nums">{e.balance.toLocaleString()}</TableCell>
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
