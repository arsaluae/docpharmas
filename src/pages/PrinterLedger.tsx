import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface LedgerEntry { date: string; type: string; reference: string; debit: number; credit: number; balance: number; source_id?: string; }

const fmtDate = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

const typePillCls = (type: string) => {
  if (type === "Print Job") return "bg-primary/10 text-primary border-primary/20";
  if (type === "Payment Made") return "bg-success/10 text-success border-success/20";
  return "bg-muted text-muted-foreground border-border";
};

export default function PrinterLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [printer, setPrinter] = useState<any>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  useEffect(() => { if (id) loadLedger(id); }, [id]);

  const loadLedger = async (printerId: string) => {
    const [{ data: pr }, { data: jobs }, { data: payments }] = await Promise.all([
      supabase.from("printers").select("*").eq("id", printerId).single(),
      supabase.from("print_jobs").select("*").eq("printer_id", printerId),
      supabase.from("payments").select("*").eq("party_id", printerId).eq("party_type", "printer"),
    ]);
    if (pr) setPrinter(pr);

    const raw: Omit<LedgerEntry, "balance">[] = [];
    if (pr) raw.push({ date: pr.created_at.split("T")[0], type: "Opening Balance", reference: "—", debit: 0, credit: Number(pr.opening_balance) });
    (jobs || []).filter((j: any) => j.status === "settled").forEach((j: any) => raw.push({ date: j.date, type: "Print Job", reference: j.job_number, debit: 0, credit: Number(j.total_cost), source_id: j.id }));
    (payments || []).forEach((p: any) => raw.push({ date: p.date, type: "Payment Made", reference: p.payment_number, debit: Number(p.amount), credit: 0, source_id: p.id }));

    raw.sort((a, b) => a.date.localeCompare(b.date));
    let bal = 0;
    setEntries(raw.map(e => { bal += e.credit - e.debit; return { ...e, balance: bal }; }));
  };

  const totalJobs = entries.filter(e => e.type === "Print Job").reduce((s, e) => s + e.credit, 0);
  const totalPaid = entries.filter(e => e.type === "Payment Made").reduce((s, e) => s + e.debit, 0);
  const outstanding = entries.length > 0 ? entries[entries.length - 1].balance : 0;
  const grossMax = Math.max(totalJobs, 1);

  const handleRowClick = (e: LedgerEntry) => {
    if (!e.source_id) return;
    if (e.type === "Payment Made") navigate(`/payments?tab=made&highlight=${e.source_id}`);
    else if (e.type === "Print Job") navigate(`/print-jobs?highlight=${e.source_id}`);
  };

  const kpis = [
    { label: "Total Print Jobs", value: totalJobs, color: "text-foreground", bar: "bg-primary/50" },
    { label: "Total Paid", value: totalPaid, color: "text-success", bar: "bg-success/50" },
    { label: "Outstanding", value: outstanding, color: outstanding > 0 ? "text-warning" : "text-success", bar: "bg-warning/50" },
  ];

  const headerActions = (
    <Button variant="ghost" size="icon" asChild><Link to="/printers"><ArrowLeft className="h-4 w-4" /></Link></Button>
  );

  return (
    <AppLayout title={`${printer?.name || "Printer"} — Ledger`} subtitle={printer?.company || ""} headerActions={headerActions}>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="p-6 md:p-8 border-b border-border flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-primary text-[11px] font-semibold tracking-[0.2em] uppercase mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Printer Account
            </div>
            <h1 className="text-3xl font-light text-foreground tracking-tight">
              {printer?.name || "Printer"} <span className="text-muted-foreground/50 text-2xl font-extralight mx-1">/</span> <span className="font-medium">Ledger</span>
            </h1>
            <p className="text-muted-foreground text-sm mt-1.5 font-light">
              {[printer?.company, printer?.phone].filter(Boolean).join(" • ") || "—"}
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
          </div>
        </div>

        <div className="grid grid-cols-3 bg-muted/20 border-b border-border">
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
              {entries.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-muted-foreground">No transactions yet.</td></tr>
              ) : entries.map((e, i) => {
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
