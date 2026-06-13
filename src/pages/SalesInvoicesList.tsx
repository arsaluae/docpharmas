import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { usePagination } from "@/hooks/usePagination";
import { PaginationControls } from "@/components/PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { escIlike, searchCustomerIds } from "@/lib/search-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, FileText } from "lucide-react";

type SI = {
  id: string; invoice_number: string; date: string; total: number;
  amount_paid: number | null; status: string | null; customer_id: string;
  customers?: { name: string } | null;
};

const fmtPKR = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export default function SalesInvoicesList() {
  const nav = useNavigate();
  const [rows, setRows] = useState<SI[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [loading, setLoading] = useState(true);
  const pagination = usePagination();

  useEffect(() => { pagination.setPage(0); }, [debouncedSearch]);

  useEffect(() => { (async () => {
    setLoading(true);
    let q = supabase.from("sales_invoices")
      .select("id, invoice_number, date, total, amount_paid, status, customer_id, customers(name)", { count: "exact" })
      .neq("status", "voided").order("date", { ascending: false });
    const term = debouncedSearch.trim();
    if (term) {
      const safe = escIlike(term);
      const custIds = await searchCustomerIds(term);
      const idClause = custIds.length > 0 ? `,customer_id.in.(${custIds.join(",")})` : "";
      q = q.or(`invoice_number.ilike.%${safe}%${idClause}`);
    }
    const { data, count } = await q.range(pagination.from, pagination.to);
    setRows((data as any[]) ?? []);
    if (count !== null) pagination.setTotalCount(count);
    setLoading(false);
  })(); }, [pagination.page, debouncedSearch]);

  const totals = useMemo(() => ({
    count: rows.length,
    total: rows.reduce((s, r) => s + Number(r.total || 0), 0),
    paid: rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0),
  }), [rows]);
  const outstanding = totals.total - totals.paid;

  return (
    <AppLayout title="My Sales Invoices" subtitle="Invoices you created for your assigned customers">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Card className="glass-card"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Invoices (page)</div><div className="text-lg font-bold tabular-nums">{totals.count}</div></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Total (page)</div><div className="text-lg font-bold tabular-nums">{fmtPKR(totals.total)}</div></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Paid (page)</div><div className="text-lg font-bold tabular-nums text-success">{fmtPKR(totals.paid)}</div></CardContent></Card>
          <Card className="glass-card"><CardContent className="p-4"><div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Outstanding (page)</div><div className="text-lg font-bold tabular-nums text-destructive">{fmtPKR(outstanding)}</div></CardContent></Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoice or customer..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <Card className="glass-card"><CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground"><FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />No invoices yet.</TableCell></TableRow>
              ) : rows.map(r => {
                const paid = Number(r.amount_paid || 0); const total = Number(r.total || 0);
                return (
                  <TableRow key={r.id} className="cursor-pointer" onClick={() => nav(`/proforma?invoice=${r.id}`)}>
                    <TableCell className="font-mono text-xs">{fmtDate(r.date)}</TableCell>
                    <TableCell className="font-mono text-xs">{r.invoice_number}</TableCell>
                    <TableCell>{r.customers?.name ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtPKR(total)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-success">{fmtPKR(paid)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">{fmtPKR(Math.max(0, total - paid))}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[10px]">{r.status ?? "—"}</Badge></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent></Card>
        <PaginationControls
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalCount={pagination.totalCount}
          pageSize={pagination.pageSize}
          hasNext={pagination.hasNext}
          hasPrev={pagination.hasPrev}
          onNext={pagination.nextPage}
          onPrev={pagination.prevPage}
          onJump={pagination.setPage}
        />
      </div>
    </AppLayout>
  );
}
