import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Download, RefreshCw, Loader2, ShieldCheck } from "lucide-react";
import { format } from "date-fns";

type Row = {
  id: string;
  kind: string;
  status: string;
  size_bytes: number | null;
  file_path: string | null;
  bucket: string | null;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  retention_days: number | null;
};

const KIND_COLOR: Record<string, string> = {
  daily: "bg-primary/15 text-primary",
  weekly: "bg-accent/15 text-accent-foreground",
  monthly: "bg-secondary/15 text-secondary-foreground",
  manual: "bg-muted/40 text-foreground",
};

function fmtSize(b: number | null) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default function Backups() {
  const { tenantRole, tenantId, loading: tenantLoading } = useTenant();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [running, setRunning] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = async () => {
    if (!tenantId) return;
    const { data, error } = await supabase
      .from("backup_runs" as any)
      .select("id, kind, status, size_bytes, file_path, bucket, started_at, finished_at, error, retention_days")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) { toast.error(error.message); return; }
    setRows((data as any) ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tenantId]);

  if (tenantLoading) return <AppLayout title="Backups & Recovery"><div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div></AppLayout>;
  if (tenantRole !== "owner") return <Navigate to="/dashboard" replace />;

  const runNow = async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("weekly-backup", { body: { kind: "manual" } });
      if (error) throw error;
      toast.success("Backup started — refreshing history…");
      setTimeout(load, 1500);
    } catch (e: any) {
      toast.error(e?.message || "Failed to start backup");
    } finally {
      setRunning(false);
    }
  };

  const download = async (row: Row) => {
    if (!row.file_path || !row.bucket) return;
    setDownloading(row.id);
    try {
      const { data, error } = await supabase.storage.from(row.bucket).createSignedUrl(row.file_path, 300);
      if (error || !data?.signedUrl) throw error || new Error("No URL");
      window.open(data.signedUrl, "_blank");
    } catch (e: any) {
      toast.error(e?.message || "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const lastSuccess = rows?.find((r) => r.status === "success");
  const lastFailure = rows?.find((r) => r.status === "failed");

  return (
    <AppLayout title="Backups & Recovery">
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-primary" /> Backups & Disaster Recovery</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automated daily (14d), weekly (8w), and monthly (12m) backups of your tenant data. Stored in a private bucket; downloads require an owner signed URL.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</Button>
            <Button size="sm" onClick={runNow} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
              Run backup now
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Last successful backup</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-semibold tabular-nums">
                {lastSuccess ? format(new Date(lastSuccess.finished_at || lastSuccess.started_at), "dd MMM yyyy HH:mm") : "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{lastSuccess ? fmtSize(lastSuccess.size_bytes) : "No successful backups yet"}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total runs (last 100)</CardTitle></CardHeader>
            <CardContent><div className="text-lg font-semibold tabular-nums">{rows?.length ?? "—"}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Last failure</CardTitle></CardHeader>
            <CardContent>
              <div className="text-lg font-semibold tabular-nums">
                {lastFailure ? format(new Date(lastFailure.started_at), "dd MMM yyyy HH:mm") : "None"}
              </div>
              {lastFailure?.error ? <div className="text-xs text-destructive mt-1 truncate" title={lastFailure.error}>{lastFailure.error}</div> : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Backup history</CardTitle></CardHeader>
          <CardContent>
            {rows === null ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No backups have run yet. Click "Run backup now" to create your first snapshot.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Retention</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="tabular-nums">{format(new Date(r.started_at), "dd MMM yyyy HH:mm")}</TableCell>
                      <TableCell><Badge variant="outline" className={KIND_COLOR[r.kind] || ""}>{r.kind}</Badge></TableCell>
                      <TableCell>
                        {r.status === "success" ? <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">success</Badge>
                          : r.status === "failed" ? <Badge variant="destructive">failed</Badge>
                          : <Badge variant="secondary">{r.status}</Badge>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtSize(r.size_bytes)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{r.retention_days ? `${r.retention_days}d` : "—"}</TableCell>
                      <TableCell className="text-right">
                        {r.status === "success" && r.file_path ? (
                          <Button size="sm" variant="ghost" onClick={() => download(r)} disabled={downloading === r.id}>
                            {downloading === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Restore procedure</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Restores are intentionally a manual operation to prevent accidental tenant wipes. See <code className="text-foreground">docs/disaster-recovery.md</code> in the repo for the full runbook, or contact support.</p>
            <p>Each backup file is a JSON snapshot of every business table for your tenant only; cross-tenant data is never included.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
