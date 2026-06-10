import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Download, RotateCcw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import DataImport from "./DataImport";
import { EntityType, ENTITIES } from "@/lib/import/types";
import { toast } from "sonner";
import { format } from "date-fns";

interface Step {
  id: string;
  label: string;
  blurb: string;
  entity?: EntityType;
  isReport?: boolean;
}

const STEPS: Step[] = [
  { id: "suppliers", label: "Suppliers", blurb: "Import vendor master so product preferred-supplier links and POs resolve later.", entity: "suppliers" },
  { id: "customers", label: "Customers", blurb: "Import the customer/pharmacy book. Email/phone are cleaned automatically.", entity: "customers" },
  { id: "products", label: "Products", blurb: "Import the product master. Categories are normalized, legacy account fields parked in notes.", entity: "products" },
  { id: "batches", label: "Batch & Opening Stock", blurb: "Per-batch opening stock with expiry. Qty=0 / unknown SKU / invalid expiry rows are skipped automatically.", entity: "batches" },
  { id: "openings", label: "Opening Balances", blurb: "Customer + supplier outstanding receivables and payables. Optional bank/cash opening can follow.", entity: "customer_opening" },
  { id: "verify", label: "Verification Report", blurb: "Summary of everything posted by this migration, with a one-click rollback.", isReport: true },
];

const WIZARD_LS = "erp_migration_wizard_v1";

interface WizardState {
  startedAt: string;
  step: number;
  completed: Record<string, { batchId: string; posted: number; entity: EntityType }[]>;
}

function loadState(): WizardState {
  try {
    const raw = localStorage.getItem(WIZARD_LS);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { startedAt: new Date().toISOString(), step: 0, completed: {} };
}

export default function MigrationWizard() {
  const nav = useNavigate();
  const [state, setState] = useState<WizardState>(loadState);

  useEffect(() => { localStorage.setItem(WIZARD_LS, JSON.stringify(state)); }, [state]);

  const current = STEPS[state.step];
  const goTo = (i: number) => setState(s => ({ ...s, step: Math.max(0, Math.min(STEPS.length - 1, i)) }));

  function handleImportComplete(stepId: string, info: { batchId: string; posted: number; entity: EntityType }) {
    setState(s => {
      const next = { ...s, completed: { ...s.completed } };
      next.completed[stepId] = [...(next.completed[stepId] ?? []), info];
      return next;
    });
  }

  function restartWizard() {
    if (!confirm("Reset the migration wizard? Already-posted data is NOT deleted — use the Rollback button on the verification step for that.")) return;
    localStorage.removeItem(WIZARD_LS);
    setState({ startedAt: new Date().toISOString(), step: 0, completed: {} });
  }

  return (
    <AppLayout title="ERP Migration Wizard">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-semibold tracking-tight">ERP Migration Wizard</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Guided 6-step import for legacy ERP data. Started {format(new Date(state.startedAt), "dd MMM yyyy, HH:mm")}.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={restartWizard}>Reset wizard</Button>
            <Button variant="outline" size="sm" onClick={() => nav("/import")}>Single import</Button>
          </div>
        </div>

        <WizardStepper steps={STEPS} current={state.step} completed={state.completed} onJump={goTo} />

        {current.isReport ? (
          <VerificationReport state={state} />
        ) : (
          <Card className="p-6 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Step {state.step + 1}: {current.label}</h2>
                <p className="text-sm text-muted-foreground mt-1">{current.blurb}</p>
                {(state.completed[current.id]?.length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {state.completed[current.id].map((b, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Batch {i + 1}: {b.posted} posted
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {current.entity && (
              <DataImport
                key={current.id}
                lockedEntity={current.entity}
                embedded
                onComplete={(info) => handleImportComplete(current.id, info)}
              />
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Button variant="ghost" disabled={state.step === 0} onClick={() => goTo(state.step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => goTo(state.step + 1)}>Skip step</Button>
                <Button onClick={() => goTo(state.step + 1)}>
                  Next: {STEPS[state.step + 1]?.label} <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function WizardStepper({ steps, current, completed, onJump }: {
  steps: Step[]; current: number; completed: Record<string, unknown[] | { batchId: string; posted: number; entity: EntityType }[]>; onJump: (i: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((s, i) => {
        const isDone = (completed[s.id] as any[] | undefined)?.length ?? 0;
        const isActive = i === current;
        return (
          <div key={s.id} className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onJump(i)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border transition-colors ${
                isActive ? "border-primary bg-primary/5 text-foreground"
                : isDone ? "border-emerald-500/30 bg-emerald-500/5 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Circle className="h-4 w-4" />}
              <span className="text-xs font-medium">{i + 1}. {s.label}</span>
            </button>
            {i < steps.length - 1 && <div className="w-4 h-px bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

// ============= Verification report =============

interface ReportRow {
  entity: string;
  batches: number;
  totalRows: number;
  posted: number;
  invalid: number;
  merged: number;
  zeroQty: number;
  badExpiry: number;
  unknownSku: number;
  missingBatch: number;
  missingContact: number;
}

function VerificationReport({ state }: { state: WizardState }) {
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [reason, setReason] = useState("");

  const batchIds = useMemo(() =>
    Object.values(state.completed).flat().map(b => b.batchId),
    [state.completed],
  );

  useEffect(() => { void loadReport(); /* eslint-disable-next-line */ }, [state]);

  async function loadReport() {
    setLoading(true);
    if (batchIds.length === 0) { setRows([]); setLoading(false); return; }

    const { data: batches } = await supabase
      .from("import_batches")
      .select("id, entity_type, row_count, valid_count, invalid_count, posted_count")
      .in("id", batchIds);

    const { data: stagingRows } = await supabase
      .from("import_staging_rows")
      .select("batch_id, errors, status, raw, normalized")
      .in("batch_id", batchIds)
      .limit(50000);

    // Group by entity_type
    const byEntity = new Map<string, ReportRow>();
    for (const b of (batches ?? []) as any[]) {
      const e = b.entity_type;
      const r = byEntity.get(e) ?? {
        entity: e, batches: 0, totalRows: 0, posted: 0, invalid: 0, merged: 0,
        zeroQty: 0, badExpiry: 0, unknownSku: 0, missingBatch: 0, missingContact: 0,
      };
      r.batches += 1;
      r.totalRows += Number(b.row_count ?? 0);
      r.posted += Number(b.posted_count ?? 0);
      r.invalid += Number(b.invalid_count ?? 0);
      byEntity.set(e, r);
    }

    const batchToEntity = new Map((batches ?? []).map((b: any) => [b.id, b.entity_type]));
    for (const r of (stagingRows ?? []) as any[]) {
      const entityType = batchToEntity.get(r.batch_id);
      if (!entityType) continue;
      const rep = byEntity.get(entityType);
      if (!rep) continue;
      const errs: { field: string; message: string }[] = Array.isArray(r.errors) ? r.errors : [];
      const errStr = errs.map(e => `${e.field}:${e.message}`).join("|").toLowerCase();
      if (errStr.includes("zero or missing quantity")) rep.zeroQty++;
      if (errStr.includes("invalid or sentinel expiry") || errStr.includes("invalid date") || errStr.includes("past")) rep.badExpiry++;
      if (errStr.includes("sku") && errStr.includes("not found")) rep.unknownSku++;
      if (errStr.includes("missing batch")) rep.missingBatch++;
      const n = (r.normalized ?? {}) as any;
      if ((entityType === "customers" || entityType === "suppliers") && !n.phone && !n.email) rep.missingContact++;
      // merged rows are stored in raw with warnings inside normalized? validators mark merged via NormalizedRow.merged
      // but staging stores status. Count "skipped" with merged-only error count zero & merged set in raw
    }

    setRows([...byEntity.values()]);
    setLoading(false);
  }

  function downloadCsv() {
    if (!rows || rows.length === 0) return;
    const head = ["entity","batches","total_rows","posted","invalid","zero_qty_skipped","bad_expiry","unknown_sku","missing_batch","missing_phone_or_email"];
    const lines = [head.join(",")];
    for (const r of rows) {
      lines.push([r.entity, r.batches, r.totalRows, r.posted, r.invalid, r.zeroQty, r.badExpiry, r.unknownSku, r.missingBatch, r.missingContact].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `migration_report_${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }

  async function rollbackAll() {
    if (reason.trim().length < 3) { toast.error("Reason is required (min 3 chars)"); return; }
    setRolling(true);
    let ok = 0, fail = 0;
    // Rollback in reverse posting order so children/dependents go first.
    for (const id of [...batchIds].reverse()) {
      const { error } = await supabase.rpc("rollback_import_batch" as any, { p_batch_id: id, p_reason: reason });
      if (error) fail++;
      else ok++;
    }
    setRolling(false);
    if (fail === 0) {
      toast.success(`Rolled back ${ok} batches`);
      localStorage.removeItem(WIZARD_LS);
      setTimeout(() => window.location.reload(), 600);
    } else {
      toast.error(`${ok} succeeded, ${fail} failed`);
    }
  }

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Verification Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Final summary of every batch posted by this migration. Use the rollback to undo everything in one go.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadCsv} disabled={!rows || rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Download CSV
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5" disabled={batchIds.length === 0}>
                <RotateCcw className="h-4 w-4 mr-2" /> Rollback entire migration
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Rollback the entire migration?</AlertDialogTitle>
                <AlertDialogDescription>
                  This deletes every record this wizard inserted: {batchIds.length} batches across products, customers, suppliers, batches and openings. Cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label className="text-xs">Reason (required)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction disabled={rolling} onClick={rollbackAll}>
                  {rolling ? "Rolling back…" : `Rollback ${batchIds.length} batches`}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading report…</p>
      ) : !rows || rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          No batches recorded yet. Complete at least one import step above.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Entity</th>
                <th className="py-2 px-3 text-right">Batches</th>
                <th className="py-2 px-3 text-right">Posted</th>
                <th className="py-2 px-3 text-right">Invalid</th>
                <th className="py-2 px-3 text-right">Qty=0</th>
                <th className="py-2 px-3 text-right">Bad expiry</th>
                <th className="py-2 px-3 text-right">Unknown SKU</th>
                <th className="py-2 px-3 text-right">No batch</th>
                <th className="py-2 px-3 text-right">No phone/email</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.entity} className="border-b border-border/40">
                  <td className="py-2 pr-3 font-medium">{ENTITIES[r.entity as EntityType]?.label ?? r.entity}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.batches}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-emerald-600">{r.posted}</td>
                  <td className="py-2 px-3 text-right tabular-nums text-destructive">{r.invalid}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.zeroQty}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.badExpiry}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.unknownSku}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.missingBatch}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{r.missingContact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
