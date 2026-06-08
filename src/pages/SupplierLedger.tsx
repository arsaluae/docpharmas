import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MessageCircle, Download, Search } from "lucide-react";
import { toast } from "sonner";

type EntryType = "Opening Balance" | "Purchase Bill" | "Payment Made" | "Purchase Return" | "Additional Cost" | "Debit Note";
interface LedgerEntry {
  date: string; type: EntryType; reference: string;
  debit: number; credit: number; balance: number; source_id?: string;
}

const TYPE_FILTERS: { key: EntryType | "all"; label: string }[] = [
  { key: "all", label: "All Transactions" },
  { key: "Purchase Bill", label: "Bills" },
  { key: "Payment Made", label: "Payments" },
  { key: "Purchase Return", label: "Returns" },
  { key: "Debit Note", label: "Debit Notes" },
  { key: "Additional Cost", label: "Add. Costs" },
];

const DATE_FILTERS = [
  { key: "30", label: "30d" }, { key: "90", label: "90d" }, { key: "365", label: "Year" }, { key: "all", label: "All" },
] as const;

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtCompact = (n: number) => Math.abs(n) >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString();
const daysBetween = (a: string, b: string) => Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

const typePillCls = (type: EntryType) => {
  switch (type) {
    case "Purchase Bill":   return "bg-primary/10 text-primary border-primary/20";
    case "Payment Made":    return "bg-success/10 text-success border-success/20";
    case "Purchase Return": return "bg-warning/10 text-warning border-warning/20";
    case "Debit Note":      return "bg-warning/10 text-warning border-warning/20";
    case "Additional Cost": return "bg-accent text-accent-foreground border-border";
    default:                return "bg-muted text-muted-foreground border-border";
  }
};

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
  const totalPaid      = allEntries.filter(e => e.type === "Payment Made").reduce((s, e) => s + e.debit, 0);
  const totalReturns   = allEntries.filter(e => e.type === "Purchase Return").reduce((s, e) => s + e.debit, 0);
  const totalDebits    = allEntries.filter(e => e.type === "Debit Note").reduce((s, e) => s + e.debit, 0);
  const outstanding    = allEntries.length > 0 ? allEntries[allEntries.length - 1].balance : 0;
  const grossMax = Math.max(totalPurchases, 1);

  const aging = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 } as Record<string, number>;
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
    if (sum > 0) { const ratio = outstanding / sum; Object.keys(buckets).forEach(k => { buckets[k] = Math.round(buckets[k] * ratio); }); }
    return buckets;
  }, [bills, outstanding]);
  const agingTotal = Math.max(Object.values(aging).reduce((s, n) => s + n, 0), 1);

  const handleRowClick = (e: LedgerEntry) => {
    if (!e.source_id) return;
    switch (e.type) {
      case "Payment Made":    navigate(`/payments?tab=made&highlight=${e.source_id}`); break;
      case "Purchase Return": navigate(`/purchase-returns?highlight=${e.source_id}`); break;
      case "Debit Note":      navigate(`/debit-notes?highlight=${e.source_id}`); break;
      case "Purchase Bill":   navigate(`/purchase-proforma?bill=${e.source_id}`); break;
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
    if (!supplier?.phone) { toast.error("No phone number on record"); return; }
    const msg = `📊 *Ledger — ${supplier.name}*\n\nPurchases: PKR ${totalPurchases.toLocaleString()}\nPaid: PKR ${totalPaid.toLocaleString()}\n*Outstanding: PKR ${outstanding.toLocaleString()}*`;
    window.open(`https://api.whatsapp.com/send?phone=${supplier.phone.replace(/[^0-9]/g, "")}&text=${encodeURIComponent(msg)}`, "_blank");
  };

  const kpis = [
    { label: "Total Purchases", value: totalPurchases, color: "text-foreground", bar: "bg-primary/50" },
    { label: "Total Paid",      value: totalPaid,      color: "text-success",     bar: "bg-success/50" },
    { label: "Returns",         value: totalReturns,   color: "text-warning",     bar: "bg-warning/50" },
    { label: "Debit Notes",     value: totalDebits,    color: "text-muted-foreground", bar: "bg-muted-foreground/40" },
  ];

  const headerActions = (
    <Button variant="ghost" size="icon" asChild><Link to="/suppliers"><ArrowLeft className="h-4 w-4" /></Link></Button>
  );

  return (
    <AppLayout title={`${supplier?.name || "Supplier"} — Ledger`} subtitle={supplier?.company || ""} headerActions={headerActions}>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-6 md:p-8 border-b border-border flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-primary text-[11px] font-semibold tracking-[0.2em] uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Payables Account
            </div>
            <h1 className="text-3xl font-light text-foreground tracking-tight">
              {supplier?.name || "Supplier"} <span className="text-muted-foreground/50 text-2xl font-extralight mx-1">/</span> <span className="font-medium">Ledger</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5 font-light">
              {[supplier?.company, supplier?.city, supplier?.phone].filter(Boolean).join(" • ") || "—"}
            </p>
          </div>
          <div className="flex flex-col md:items-end">
            <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase mb-1">
              {outstanding > 0 ? "Amount Payable" : "Advance Paid"}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-primary text-xl font-light">PKR</span>
              <span className={`text-4xl md:text-5xl font-semibold tracking-tighter tabular-nums ${outstanding > 0 ? "text-foreground" : "text-success"}`}>
                {Math.abs(Math.round(outstanding)).toLocaleString()}
              </span>
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={exportCSV} className="h-8 text-xs gap-2"><Download className="h-3.5 w-3.5" /> Export CSV</Button>
              <Button size="sm" variant="outline" onClick={shareViaWhatsApp} className="h-8 text-xs gap-2 text-success border-success/30 hover:bg-success/10"><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 bg-muted/20 border-b border-border">
          <div className="lg:col-span-2 grid grid-cols-2 md:grid-cols-4">
            {kpis.map(k => {
              const pct = Math.min(100, (k.value / grossMax) * 100);
              return (
                <div key={k.label} className="p-5 md:p-6 border-r border-border last:border-r-0">
                  <div className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase mb-3">{k.label}</div>
                  <div className={`text-xl font-medium tabular-nums tracking-tight ${k.color}`}>{Math.round(k.value).toLocaleString()}</div>
                  <div className="mt-3 w-full bg-border/60 h-1 rounded-full overflow-hidden">
                    <div className={`${k.bar} h-full rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="p-5 md:p-6 bg-primary/[0.03] border-t lg:border-t-0 lg:border-l border-border">
            <div className="flex justify-between items-center mb-4">
              <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">Aging Distribution</span>
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">Real-time</span>
            </div>
            <div className="flex h-8 gap-0.5 rounded overflow-hidden">
              {Object.entries(aging).map(([bucket, amt], i) => {
                const pct = (amt / agingTotal) * 100;
                const tone = i === 0 ? "bg-primary/80" : i === 1 ? "bg-primary/60" : i === 2 ? "bg-warning/70" : "bg-destructive/70";
                return amt > 0 ? <div key={bucket} className={tone} style={{ width: `${pct}%` }} title={`${bucket}: ${amt.toLocaleString()}`} /> : <div key={bucket} className="flex-1 bg-border/40" />;
              })}
            </div>
            <div className="grid grid-cols-4 mt-3 gap-2">
              {Object.entries(aging).map(([bucket, amt]) => (
                <div key={bucket} className={`text-center ${amt === 0 ? "opacity-40" : ""}`}>
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{bucket}d</div>
                  <div className="text-xs font-semibold text-foreground tabular-nums mt-0.5">{fmtCompact(amt)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-4 border-b border-border bg-muted/10">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex bg-muted/40 p-1 rounded-md border border-border">
              {DATE_FILTERS.map(d => (
                <button key={d.key} onClick={() => setDateRange(d.key)}
                  className={`px-3 py-1 text-xs font-medium rounded transition-colors ${dateRange === d.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                  {d.label}
                </button>
              ))}
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="flex gap-3 flex-wrap">
              {TYPE_FILTERS.map(t => (
                <button key={t.key} onClick={() => setTypeFilter(t.key)}
                  className={`text-xs pb-0.5 transition-colors ${typeFilter === t.key ? "text-primary border-b border-primary font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative flex-1 max-w-xs min-w-[180px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search reference…" className="h-7 text-xs pl-8 bg-background border-border" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-left border-b border-border bg-muted/10">
                <th className="py-3 px-5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</th>
                <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Entry Type</th>
                <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reference</th>
                <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Debit</th>
                <th className="py-3 px-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">Credit</th>
                <th className="py-3 px-5 text-[10px] font-bold text-primary uppercase tracking-widest text-right bg-primary/[0.03] sticky right-0 border-l border-border">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-muted-foreground">No transactions match current filters.</td></tr>
              ) : filtered.map((e, i) => {
                const clickable = !!e.source_id;
                return (
                  <tr key={i} onClick={() => handleRowClick(e)} tabIndex={clickable ? 0 : undefined}
                    onKeyDown={ev => clickable && (ev.key === "Enter" || ev.key === " ") && handleRowClick(e)}
                    className={`group border-b border-border/60 transition-colors ${clickable ? "cursor-pointer hover:bg-accent/40 focus-visible:bg-accent/40 outline-none" : ""}`}>
                    <td className="py-3.5 px-5 font-mono text-[13px] text-muted-foreground tabular-nums tracking-tight">{fmtDate(e.date)}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-tight uppercase border ${typePillCls(e.type)}`}>{e.type}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[12.5px] text-foreground/80 tracking-tight">{e.reference}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-[13px] tabular-nums">
                      {e.debit > 0 ? <span className="text-success">{e.debit.toLocaleString()}</span> : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-[13px] tabular-nums">
                      {e.credit > 0 ? <span className="text-foreground">{e.credit.toLocaleString()}</span> : <span className="text-muted-foreground/60">—</span>}
                    </td>
                    <td className="py-3.5 px-5 text-right font-mono text-[13px] font-semibold text-primary tabular-nums bg-primary/[0.02] group-hover:bg-primary/[0.06] sticky right-0 border-l border-border transition-colors">
                      {e.balance.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-6 text-center border-t border-border bg-muted/5">
          <div className="text-muted-foreground/70 text-[10px] font-bold tracking-[0.3em] uppercase">End of Statement</div>
        </div>
      </div>
    </AppLayout>
  );
}
