import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, PlayCircle, Trash2, RotateCcw, Database, CheckCircle2, XCircle, AlertCircle, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveTenant } from "@/hooks/useActiveTenant";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Step = {
  id: string; step_no: number; step_name: string; status: "pass" | "fail" | "info";
  latency_ms: number | null; details: any; created_at: string;
};
type Run = {
  id: string; started_at: string; finished_at: string | null;
  passed_count: number; failed_count: number; status: string;
};

const COUNT_LABELS: Record<string, string> = {
  customers: "Customers", suppliers: "Suppliers", products: "Products",
  batches: "Batches (GRN lines)", sales_orders: "Sales Orders",
  sales_invoices: "Sales Invoices", delivery_notes: "Delivery Notes", payments: "Payments",
};

export function SandboxTestingTab() {
  const { info, isSandbox, loading, enterSandbox, exitSandbox, deleteSession, rollbackSession, refresh } = useActiveTenant();
  const [seedForm, setSeedForm] = useState({
    customers: 20, suppliers: 10, products: 50,
    sales_orders: 20, invoices: 20, delivery_notes: 10, payments: 10,
  });
  const [seeding, setSeeding] = useState(false);
  const [runningUat, setRunningUat] = useState(false);
  const [lastRun, setLastRun] = useState<Run | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => { loadLastRun(); }, [info?.sandbox_tenant_id]);

  async function loadLastRun() {
    if (!info?.sandbox_tenant_id) { setLastRun(null); setSteps([]); return; }
    const { data: runs } = await supabase
      .from("sandbox_uat_runs" as any).select("*")
      .order("started_at", { ascending: false }).limit(1);
    const run = (runs?.[0] as unknown) as Run | undefined;
    if (!run) { setLastRun(null); setSteps([]); return; }
    setLastRun(run);
    const { data: rows } = await supabase
      .from("sandbox_uat_steps" as any).select("*")
      .eq("run_id", run.id).order("step_no", { ascending: true });
    setSteps((rows as unknown as Step[]) ?? []);
  }

  async function handleEnable() {
    try { await enterSandbox(); } catch (e: any) { toast.error(e.message || "Failed to enable sandbox"); }
  }
  async function handleSeed() {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("seed-sandbox-data", { body: seedForm });
      if (error) throw error;
      toast.success(`Seeded sandbox: ${JSON.stringify((data as any)?.created || {})}`);
      await refresh();
    } catch (e: any) { toast.error(e.message || "Seed failed"); }
    finally { setSeeding(false); }
  }
  async function handleRunUat() {
    setRunningUat(true);
    try {
      const { data, error } = await supabase.functions.invoke("run-sales-agent-uat", { body: {} });
      if (error) throw error;
      const r = data as any;
      if (r.failed > 0) toast.error(`UAT: ${r.passed} passed · ${r.failed} failed`);
      else toast.success(`UAT: ${r.passed}/${r.total} passed`);
      await loadLastRun();
      await refresh();
    } catch (e: any) { toast.error(e.message || "UAT failed"); }
    finally { setRunningUat(false); }
  }
  async function handleDelete() {
    try { await deleteSession(); toast.success("Sandbox deleted"); }
    catch (e: any) { toast.error(e.message); }
  }
  async function handleRollback() {
    try { await rollbackSession(); toast.success("Sandbox rolled back"); }
    catch (e: any) { toast.error(e.message); }
  }

  if (loading) return <div className="text-sm text-muted-foreground">Loading sandbox status…</div>;

  if (!info?.can_use) {
    return (
      <Card className="glass-card">
        <CardContent className="p-8 text-center">
          <FlaskConical className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
          <h3 className="text-lg font-semibold">Sandbox not available</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Only the workspace owner — or team members granted "Use sandbox" access — can open a sandbox session.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Status */}
      <Card className="glass-card border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-amber-500" />
            Testing Environment
            {isSandbox && <Badge className="bg-amber-500 text-white border-0 ml-2">Active</Badge>}
            {!isSandbox && info.exists && <Badge variant="outline" className="ml-2">Inactive · session exists</Badge>}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            A fully isolated copy of your workspace. Production stock, ledger, customers and reports are never touched.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {!info.exists ? (
            <div className="flex items-center justify-between p-4 rounded-lg border border-dashed">
              <div>
                <div className="font-semibold text-sm">No sandbox session yet</div>
                <div className="text-xs text-muted-foreground">Click below to create one and switch into it.</div>
              </div>
              <Button onClick={handleEnable} className="bg-amber-500 hover:bg-amber-600 text-white">
                <FlaskConical className="h-4 w-4 mr-1" /> Enable Sandbox Mode
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(info.counts ?? {}).map(([k, v]) => (
                  <div key={k} className="p-3 rounded-lg border bg-card">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{COUNT_LABELS[k] ?? k}</div>
                    <div className="text-xl font-bold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                Session SBX-{(info.session_id || "").slice(0, 8)} ·
                created {info.created_at ? new Date(info.created_at).toLocaleString("en-GB") : "—"}
              </div>
              <div className="flex flex-wrap gap-2">
                {!isSandbox ? (
                  <Button onClick={handleEnable} className="bg-amber-500 hover:bg-amber-600 text-white">
                    <FlaskConical className="h-4 w-4 mr-1" /> Enter Sandbox
                  </Button>
                ) : (
                  <Button variant="outline" onClick={exitSandbox}>Exit Sandbox</Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline"><RotateCcw className="h-4 w-4 mr-1" /> Rollback Session</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Rollback sandbox?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This deletes every customer / order / invoice / stock movement / payment inside the sandbox.
                        The sandbox itself stays, so you can start fresh. Production is untouched.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRollback}>Rollback</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive"><Trash2 className="h-4 w-4 mr-1" /> Delete Session</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete sandbox session?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Removes the sandbox tenant entirely. You can always create a fresh one. Production is untouched.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                        Delete sandbox
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Seed */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5" /> Seed Test Data
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Bulk-creates realistic test records inside the sandbox. Re-run to top up. Disabled until a sandbox exists.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(seedForm).map(([k, v]) => (
              <div key={k}>
                <Label className="text-xs">{COUNT_LABELS[k as keyof typeof COUNT_LABELS] ?? k}</Label>
                <Input
                  type="number" min={0} max={200} value={v}
                  onChange={e => setSeedForm({ ...seedForm, [k]: Math.max(0, Number(e.target.value || 0)) })}
                />
              </div>
            ))}
          </div>
          <Button onClick={handleSeed} disabled={seeding || !info.exists}>
            <Sparkles className="h-4 w-4 mr-1" /> {seeding ? "Seeding…" : "Seed Sandbox"}
          </Button>
        </CardContent>
      </Card>

      {/* UAT */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PlayCircle className="h-5 w-5" /> Run Sales Agent UAT
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            End-to-end test: creates a sales agent, customer, supplier, product, GRN, sales order, sales invoice,
            delivery note and payment — then asserts customer balance, stock, and bank balance all reconcile to zero
            outstanding. All inside the sandbox.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleRunUat} disabled={runningUat || !info.exists}>
            <PlayCircle className="h-4 w-4 mr-1" /> {runningUat ? "Running…" : "Run UAT"}
          </Button>
          {lastRun && (
            <div className="space-y-2">
              <div className="flex items-center gap-3 text-sm">
                <Badge className={lastRun.failed_count === 0 ? "bg-success" : "bg-destructive"}>
                  {lastRun.failed_count === 0 ? "PASSED" : "FAILED"}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">
                  {lastRun.passed_count} passed · {lastRun.failed_count} failed ·
                  {lastRun.finished_at ? ` finished ${new Date(lastRun.finished_at).toLocaleString("en-GB")}` : " running…"}
                </span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-24 text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {steps.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-xs">{s.step_no}</TableCell>
                        <TableCell className="text-sm">
                          {s.step_name}
                          {s.details && s.status === "fail" && (
                            <div className="text-[11px] text-destructive font-mono mt-0.5">
                              {JSON.stringify(s.details)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {s.status === "pass" && <span className="inline-flex items-center gap-1 text-success text-xs"><CheckCircle2 className="h-3.5 w-3.5" /> Pass</span>}
                          {s.status === "fail" && <span className="inline-flex items-center gap-1 text-destructive text-xs"><XCircle className="h-3.5 w-3.5" /> Fail</span>}
                          {s.status === "info" && <span className="inline-flex items-center gap-1 text-muted-foreground text-xs"><AlertCircle className="h-3.5 w-3.5" /> Info</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {s.latency_ms ? `${s.latency_ms}ms` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
