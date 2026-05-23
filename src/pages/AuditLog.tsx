import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Shield } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";

interface Row {
  id: string;
  created_at: string;
  user_email: string | null;
  user_role: string | null;
  action: string;
  entity_type: string;
  entity_number: string | null;
  entity_id: string | null;
  ip_address: string | null;
  changes: any;
}

const ENTITY_TYPES = [
  "sales_order", "sales_invoice", "purchase_order", "purchase_invoice",
  "sales_return", "purchase_return", "credit_note", "debit_note",
  "payment", "grn", "stock_movement", "print_job", "accounting_period",
];

export default function AuditLogPage() {
  const { role } = useTenant();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const canView = role === "owner" || role === "admin";

  useEffect(() => {
    if (!canView) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      let q = supabase.from("audit_log" as any).select("*").order("created_at", { ascending: false }).limit(1000);
      if (entityFilter !== "all") q = q.eq("entity_type", entityFilter);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");
      const { data } = await q;
      setRows(((data ?? []) as unknown) as Row[]);
      setLoading(false);
    })();
  }, [canView, entityFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.toLowerCase();
    return rows.filter(r =>
      (r.user_email ?? "").toLowerCase().includes(s) ||
      (r.entity_number ?? "").toLowerCase().includes(s) ||
      r.action.toLowerCase().includes(s)
    );
  }, [rows, search]);

  function exportCsv() {
    const headers = ["Date", "User", "Role", "Action", "Entity Type", "Entity Number", "IP", "Details"];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      const cells = [
        format(new Date(r.created_at), "yyyy-MM-dd HH:mm:ss"),
        r.user_email ?? "",
        r.user_role ?? "",
        r.action,
        r.entity_type,
        r.entity_number ?? "",
        r.ip_address ?? "",
        r.changes ? JSON.stringify(r.changes).replace(/"/g, '""') : "",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${format(new Date(), "yyyyMMdd-HHmm")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!canView) {
    return (
      <div className="p-6">
        <Card className="p-8 text-center">
          <Shield className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
          <p>Audit log is restricted to owners and admins.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Log</h1>
          <p className="text-sm text-muted-foreground">Immutable record of every significant action. Cannot be edited or deleted by anyone.</p>
        </div>
        <Button onClick={exportCsv} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <Input placeholder="Search user, doc number, action…" value={search} onChange={e => setSearch(e.target.value)} />
          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entity types</SelectItem>
              {ENTITY_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No entries.</TableCell></TableRow>
            ) : filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums text-xs">{format(new Date(r.created_at), "dd MMM yyyy, hh:mm a")}</TableCell>
                <TableCell className="text-sm">
                  {r.user_email ?? "—"}
                  {r.user_role && <Badge variant="outline" className="ml-2 text-xs">{r.user_role}</Badge>}
                </TableCell>
                <TableCell className="text-sm">{r.action}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.entity_type.replace(/_/g, " ")}</TableCell>
                <TableCell className="text-sm font-mono">{r.entity_number ?? "—"}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{r.ip_address ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
