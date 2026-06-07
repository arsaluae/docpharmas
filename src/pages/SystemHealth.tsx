import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, Wrench, Activity } from "lucide-react";

type Row = {
  id: string;
  run_at: string;
  scope: string;
  entity_label: string | null;
  stored_value: number | null;
  computed_value: number | null;
  drift: number | null;
  status: string;
};

export default function SystemHealth() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("reconciliation_log")
      .select("id,run_at,scope,entity_label,stored_value,computed_value,drift,status")
      .order("run_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    else setRows((data as Row[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function run(autoFix: boolean) {
    setRunning(true);
    try {
      const { data: tenantData } = await supabase.rpc("get_user_tenant_id" as never);
      const tenant = tenantData as string | null;
      const { error } = await supabase.rpc("run_reconciliation" as never, {
        p_tenant: tenant,
        p_auto_fix: autoFix,
      });
      if (error) throw error;
      toast.success(autoFix ? "Reconciliation complete — drifts corrected" : "Reconciliation scan complete");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Reconciliation failed");
    } finally {
      setRunning(false);
    }
  }

  async function refreshTB() {
    const { error } = await supabase.rpc("refresh_trial_balance" as never);
    if (error) toast.error(error.message);
    else toast.success("Trial balance refreshed");
  }

  const drifted = rows.filter(r => r.status === "drift").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Detect and repair balance drift between stored values and ledger truth.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshTB}>
            <Activity className="h-4 w-4 mr-2" /> Refresh trial balance
          </Button>
          <Button variant="outline" size="sm" onClick={() => run(false)} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Scan
          </Button>
          <Button size="sm" onClick={() => run(true)} disabled={running}>
            <Wrench className="h-4 w-4 mr-2" /> Scan & auto-fix
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Recent entries</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{rows.length}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Open drift</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-amber-600">{drifted}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Auto-fixed</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums text-emerald-600">
            {rows.filter(r => r.status === "fixed").length}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Reconciliation log</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No drift detected. Run a scan to verify.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th className="text-left p-3 font-medium">When</th>
                    <th className="text-left p-3 font-medium">Scope</th>
                    <th className="text-left p-3 font-medium">Entity</th>
                    <th className="text-right p-3 font-medium">Stored</th>
                    <th className="text-right p-3 font-medium">Computed</th>
                    <th className="text-right p-3 font-medium">Drift</th>
                    <th className="text-left p-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b hover:bg-muted/30">
                      <td className="p-3 text-muted-foreground">{new Date(r.run_at).toLocaleString()}</td>
                      <td className="p-3 font-mono text-xs">{r.scope}</td>
                      <td className="p-3">{r.entity_label ?? "—"}</td>
                      <td className="p-3 text-right tabular-nums">{Number(r.stored_value ?? 0).toFixed(2)}</td>
                      <td className="p-3 text-right tabular-nums">{Number(r.computed_value ?? 0).toFixed(2)}</td>
                      <td className="p-3 text-right tabular-nums font-medium">{Number(r.drift ?? 0).toFixed(2)}</td>
                      <td className="p-3">
                        <Badge variant={r.status === "fixed" ? "default" : r.status === "drift" ? "destructive" : "secondary"}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
