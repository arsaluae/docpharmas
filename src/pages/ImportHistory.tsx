import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ENTITIES, EntityType } from "@/lib/import/types";
import { downloadFailedRowsCsv } from "@/lib/import/templates";
import { useTenant } from "@/hooks/useTenant";

interface Batch {
  id: string; entity_type: EntityType; file_name: string | null;
  row_count: number; valid_count: number; invalid_count: number; posted_count: number;
  status: string; created_at: string; rolled_back_at: string | null; rollback_reason: string | null;
  error_summary: any; column_mapping: any; options: any;
}

export default function ImportHistory() {
  const nav = useNavigate();
  const { isAdmin } = useTenant();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Batch | null>(null);
  const [rollbackReason, setRollbackReason] = useState("");
  const [rolling, setRolling] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("import_batches").select("*").order("created_at", { ascending: false }).limit(200);
    setBatches((data ?? []) as unknown as Batch[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function downloadFailedFor(b: Batch) {
    const { data } = await supabase.from("import_staging_rows")
      .select("row_number, raw, errors")
      .eq("batch_id", b.id)
      .eq("status", "invalid")
      .limit(5000);
    if (!data || data.length === 0) { toast.info("No failed rows on this batch"); return; }
    downloadFailedRowsCsv(b.entity_type, data.map((r: any) => ({
      rowNumber: r.row_number, raw: r.raw ?? {}, errors: r.errors ?? [],
    })));
  }

  async function rollback(b: Batch) {
    if (rollbackReason.trim().length < 3) { toast.error("Reason is required (min 3 chars)"); return; }
    setRolling(true);
    const { error } = await supabase.rpc("rollback_import_batch" as any, { p_batch_id: b.id, p_reason: rollbackReason });
    setRolling(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Batch rolled back");
    setActive(null); setRollbackReason(""); load();
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => nav("/import")}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Import History</h1>
            <p className="text-sm text-muted-foreground">Every migration batch, with rollback for the workspace owner.</p>
          </div>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Rows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Loading…</TableCell></TableRow>
                : batches.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No imports yet.</TableCell></TableRow>
                : batches.map(b => (
                <TableRow key={b.id} className="cursor-pointer" onClick={() => setActive(b)}>
                  <TableCell className="text-xs tabular-nums">{format(new Date(b.created_at), "dd MMM yyyy, HH:mm")}</TableCell>
                  <TableCell className="text-sm">{ENTITIES[b.entity_type]?.label ?? b.entity_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{b.file_name ?? "—"}</TableCell>
                  <TableCell className="text-xs tabular-nums">
                    <span className="text-emerald-600">{b.posted_count}</span> / <span>{b.valid_count}</span>
                    {b.invalid_count > 0 && <span className="text-destructive"> · {b.invalid_count} bad</span>}
                  </TableCell>
                  <TableCell><StatusBadge s={b.status} /></TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setActive(b); }}>Details</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Sheet open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <SheetContent className="sm:max-w-xl">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle>{ENTITIES[active.entity_type]?.label ?? active.entity_type}</SheetTitle>
              </SheetHeader>
              <div className="mt-5 space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <Info label="Batch ID" value={<code className="text-[11px]">{active.id}</code>} />
                  <Info label="Status" value={<StatusBadge s={active.status} />} />
                  <Info label="File" value={active.file_name ?? "—"} />
                  <Info label="Created" value={format(new Date(active.created_at), "dd MMM yyyy, HH:mm")} />
                  <Info label="Valid" value={active.valid_count} />
                  <Info label="Invalid" value={active.invalid_count} />
                  <Info label="Posted" value={active.posted_count} />
                  {active.rolled_back_at && <Info label="Rolled back" value={format(new Date(active.rolled_back_at), "dd MMM yyyy, HH:mm")} />}
                </div>

                {active.rollback_reason && (
                  <div className="text-xs p-2 rounded bg-foreground/[0.04] border border-border">
                    <span className="text-muted-foreground">Reason:</span> {active.rollback_reason}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {active.invalid_count > 0 && (
                    <Button variant="outline" size="sm" onClick={() => downloadFailedFor(active)}>
                      <Download className="h-4 w-4 mr-2" /> Failed rows CSV
                    </Button>
                  )}
                  {active.status !== "rolled_back" && isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                          <RotateCcw className="h-4 w-4 mr-2" /> Rollback batch
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Rollback import batch?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete every record posted by this batch from products, customers, suppliers, invoices, stock movements and ledgers. Cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="space-y-2">
                          <Label className="text-xs">Reason (required, min 3 chars)</Label>
                          <Textarea value={rollbackReason} onChange={(e) => setRollbackReason(e.target.value)} rows={3} />
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction disabled={rolling} onClick={() => rollback(active)}>
                            {rolling ? "Rolling back…" : "Rollback"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                {active.error_summary && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Error summary</p>
                    <pre className="text-[11px] p-2 bg-foreground/[0.04] rounded border border-border overflow-auto max-h-60">{JSON.stringify(active.error_summary, null, 2)}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const cls = s === "completed" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            : s === "failed" ? "bg-destructive/10 text-destructive border-destructive/20"
            : s === "rolled_back" ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
            : s === "posting" ? "bg-primary/10 text-primary border-primary/20"
            : "bg-foreground/[0.06] text-muted-foreground border-border";
  return <Badge variant="outline" className={`text-[10px] ${cls}`}>{s.replace(/_/g, " ")}</Badge>;
}
