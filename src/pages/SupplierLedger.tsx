import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, MessageCircle, Download, Filter, FileText, Wallet, RotateCcw } from "lucide-react";
import { toast } from "sonner";

type EntryType = "Opening Balance" | "Purchase Bill" | "Payment Made" | "Purchase Return" | "Additional Cost" | "Debit Note";
interface LedgerEntry {
  date: string; type: EntryType; reference: string;
  debit: number; credit: number; balance: number; source_id?: string;
}

const TYPE_FILTERS: { key: EntryType | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "Purchase Bill", label: "Bills" },
  { key: "Payment Made", label: "Payments" },
  { key: "Purchase Return", label: "Returns" },
  { key: "Debit Note", label: "Debit Notes" },
  { key: "Additional Cost", label: "Add. Costs" },
];

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const daysBetween = (a: string, b: string) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

export default function SupplierLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<any>(null);
  const [allEntries, setAllEntries] = useState<LedgerEntry[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [dateRange, setDateRange] = useState<"30" | "90" | "365" | "all">("90");
  const [search, setSearch] = useState("");

  useEffect(() => { if (id) loadLedger(id); }, [id]);

  const loadLedger = async (supplierId: string) => {
    const [{ data: sup }, { data: invs }, { data: payments }, { data: returns }, { data: costs }, { data: debitNotes }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", supplierId).single(),
      supabase.from("purchase_invoices").select("id, bill_number, date, total").eq("supplier_id", supplierId),
      supabase.from("payments").select("*").eq("party_id", supplierId).eq("party_type", "supplier"),
      supabase.from("purchase_returns").select("*").eq("supplier_id", supplierId),
      supabase.from("additional_costs").select("*").eq("vendor_id", supplierId),
      supabase.from("debit_notes").select("*").eq("party_id", supplierId).eq("party_type", "supplier"),
    ]);
    if (sup) setSupplier(sup);
    if (invs) setBills(invs);

    const raw: Omit<LedgerEntry, "balance">[] = [];
    if (sup) raw.push({ date: sup.created_at.split("T")[0], type: "Opening Balance", reference: "—", debit: 0, credit: Number(sup.opening_balance) });
    (invs || []).forEach((inv: any) => raw.push({ date: inv.date, type: "Purchase Bill", reference: inv.bill_number, debit: 0, credit: Number(inv.total), source_id: inv.id }));
    (payments || []).forEach((p: any) => raw.push({ date: p.date, type: "Payment Made", reference: p.payment_number, debit: Number(p.amount), credit: 0, source_id: p.id }));
    (returns || []).forEach((r: any) => raw.push({ date: r.date, type: "Purchase Return", reference: r.return_number, debit: Number(r.total), credit: 0, source_id: r.id }));
    (costs || []).forEach((c: any) => raw.push({ date: c.date, type: "Additional Cost", reference: c.description || "—", debit: 0, credit: Number(c.amount), source_id: c.id }));
    (debitNotes || []).forEach((d: any) => raw.push({ date: d.date, type: "Debit Note", reference: d.debit_note_number, debit: Number(d.amount), credit: 0, source_id: d.id }));

    raw.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    setAllEntries(raw.map(e => { bal += e.credit - e.debit; return { ...e, balance: bal }; }));
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

  const totalPurchases = allEntries.filter(e => e.type === "Purchase Bill").reduce((s, e) => s + e.credit, 0);
  const totalPaid = allEntries.filter(e => e.type === "Payment Made").reduce((s, e) => s + e.debit, 0);
  const totalReturns = allEntries.filter(e => e.type === "Purchase Return").reduce((s, e) => s + e.debit, 0);
  const outstanding = allEntries.length > 0 ? allEntries[allEntries.length - 1].balance : 0;

  const aging = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    if (outstanding <= 0) return buckets;
    bills.forEach((b: any) => {
      const age = daysBetween(b.date, today);
      const amt = Number(b.total);
      if (age <= 30) buckets["0-30"] += amt;
      else if (age <= 60) buckets["31-60"] += amt;
      else if (age <= 90) buckets["61-90"] += amt;
      else buckets["90+"] += amt;
    });
    const sum = Object.values(buckets).reduce((s, n) => s + n, 0);
    if (sum > 0) {
      const ratio = outstanding / sum;
      Object.keys(buckets).forEach(k => { (buckets as any)[k] = Math.round((buckets as any)[k] * ratio); });
    }
    return buckets;
  }, [bills, outstanding]);

  const handleRowClick = (e: LedgerEntry) => {
    if (!e.source_id) return;
    switch (e.type) {
      case "Payment Made": navigate(`/payments?tab=made&highlight=${e.source_id}`); break;
      case "Purchase Return": navigate(`/purchase-returns?highlight=${e.source_id}`); break;
      case "Debit Note": navigate(`/debit-notes?highlight=${e.source_id}`); break;
      case "Purchase Bill": toast.info(`Bill ${e.reference} — open from Purchase Hub`); break;
    }
  };

  const exportCSV = () => {
    const rows = [["Date", "Type", "Reference", "Debit", "Credit", "Balance"]];
    filtered.forEach(e => rows.push([e.date, e.type, e.reference, String(e.debit), String(e.credit), String(e.balance)]));
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `ledger-${supplier?.name || "supplier"}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("Ledger exported");
  };

  const shareViaWhatsApp = () => {
    if (!supplier?.phone) { toast.error("No phone number on record for this supplier"); return; }
    const msg = `📊 *Ledger Summary — ${supplier.name}*\n\n` +
      `Total Purchases: PKR ${totalPurchases.toLocaleString()}\n` +
      `Total Paid: PKR ${totalPaid.toLocaleString()}\n` +
      `*Outstanding Balance: PKR ${outstanding.toLocaleString()}*\n\n` +
      `As of ${new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}`;
    const num = supplier.phone.replace(/[^0-9]/g, "");
    window.open(`https://api.whatsapp.com/send?phone=${num}&text=${encodeURIComponent(msg)}`, "_blank");
  };

  const headerActions = (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={exportCSV}><Download className="h-3.5 w-3.5" /> Export CSV</Button>
      <Button variant="outline" size="sm" className="text-xs gap-1.5 text-success border-border hover:bg-success/5" onClick={shareViaWhatsApp}>
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </Button>
      <Button variant="ghost" size="icon" asChild><Link to="/suppliers"><ArrowLeft className="h-4 w-4" /></Link></Button>
    </div>
  );

  return (
    <AppLayout title={`${supplier?.name || "Supplier"} — Ledger`} subtitle={supplier?.company || ""} headerActions={headerActions}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Purchases", value: totalPurchases, icon: FileText, color: "text-primary" },
            { label: "Total Paid", value: totalPaid, icon: Wallet, color: "text-success" },
            { label: "Returns + Debit Notes", value: totalReturns, icon: RotateCcw, color: "text-warning" },
            { label: "Outstanding", value: outstanding, icon: FileText, color: outstanding > 0 ? "text-destructive" : "text-success" },
          ].map(c => (
            <Card key={c.label} className="glass-card"><CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{c.label}</p>
                <c.icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <p className={`text-xl font-bold font-mono tabular-nums ${c.color}`}>PKR {Math.round(c.value).toLocaleString()}</p>
            </CardContent></Card>
          ))}
        </div>

        {outstanding > 0 && (
          <Card className="glass-card"><CardContent className="p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Payables Aging</p>
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(aging).map(([bucket, amt]) => (
                <div key={bucket} className="border border-border rounded-lg px-3 py-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{bucket} days</p>
                  <p className={`text-sm font-mono font-semibold tabular-nums ${bucket === "90+" ? "text-destructive" : bucket === "61-90" ? "text-warning" : "text-foreground"}`}>PKR {amt.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </CardContent></Card>
        )}

        <Card className="glass-card"><CardContent className="p-3 flex flex-wrap items-center gap-3">
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
              <Badge key={t.key} variant={typeFilter === t.key ? "default" : "outline"} className="cursor-pointer text-xs" onClick={() => setTypeFilter(t.key)}>{t.label}</Badge>
            ))}
          </div>
          <Input className="h-8 text-xs max-w-xs ml-auto" placeholder="Search reference…" value={search} onChange={e => setSearch(e.target.value)} />
        </CardContent></Card>

        <Card className="glass-card"><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Reference</TableHead>
              <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">No transactions match current filters.</TableCell></TableRow>
              ) : filtered.map((e, i) => (
                <TableRow key={i} className={e.source_id ? "cursor-pointer hover:bg-accent/50" : ""} onClick={() => handleRowClick(e)}>
                  <TableCell className="tabular-nums">{fmtDate(e.date)}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs font-normal">{e.type}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{e.reference}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{e.debit ? e.debit.toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{e.credit ? e.credit.toLocaleString() : "—"}</TableCell>
                  <TableCell className="text-right font-mono font-semibold tabular-nums">{e.balance.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      </div>
    </AppLayout>
  );
}
