import { useEffect, useState } from "react";
import { logAudit } from "@/lib/audit";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Lock, Unlock, Plus, Trash2, ShieldCheck } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { Navigate } from "react-router-dom";

type Period = {
  id: string;
  period_start: string;
  period_end: string;
  is_locked: boolean;
  locked_at: string | null;
  lock_reason: string | null;
};

export default function AccountingPeriods() {
  const { tenantRole, isAdmin, loading: tenantLoading } = useTenant();
  const canManage = tenantRole === "owner" || isAdmin;

  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [lockReasonDraft, setLockReasonDraft] = useState("");
  const [reasonOpen, setReasonOpen] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("accounting_periods")
      .select("id, period_start, period_end, is_locked, locked_at, lock_reason")
      .order("period_start", { ascending: false });
    if (error) toast.error(error.message);
    setPeriods((data as Period[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addPeriod = async () => {
    if (!periodStart || !periodEnd) { toast.error("Pick start and end dates"); return; }
    if (periodEnd < periodStart) { toast.error("End must be on or after start"); return; }
    const { error } = await supabase.from("accounting_periods").insert({
      period_start: periodStart, period_end: periodEnd, is_locked: false,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Period created");
    setOpen(false); setPeriodStart(""); setPeriodEnd(""); load();
  };

  const lockPeriod = async (id: string, reason: string) => {
    const { error } = await supabase.from("accounting_periods")
      .update({ is_locked: true, locked_at: new Date().toISOString(), lock_reason: reason || null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Period locked");
    setReasonOpen(null); setLockReasonDraft(""); load();
  };

  const unlockPeriod = async (id: string) => {
    const { error } = await supabase.from("accounting_periods")
      .update({ is_locked: false, locked_at: null, lock_reason: null })
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Period unlocked");
    load();
  };

  const deletePeriod = async (id: string) => {
    if (!confirm("Delete this period definition?")) return;
    const { error } = await supabase.from("accounting_periods").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Period deleted");
    load();
  };

  if (tenantLoading) return <AppLayout title="Accounting Periods"><div className="p-8">Loading…</div></AppLayout>;
  if (!canManage) return <Navigate to="/dashboard" replace />;

  return (
    <AppLayout title="Accounting Periods" subtitle="Lock financial periods to prevent backdated edits">
      <div className="max-w-3xl mx-auto space-y-4">
        <Card className="glass-card border-primary/20">
          <CardContent className="pt-6 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm text-muted-foreground">
              When a period is locked, the system blocks any insert, update, or delete on sales/purchase invoices, payments,
              expenses, returns, GRNs, credit/debit notes, and salary payments dated inside it. Unlock the period first if you need to adjust history.
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Period</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Define accounting period</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3 py-2">
                <div><Label>Start</Label><Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
                <div><Label>End</Label><Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={addPeriod}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-base">Periods</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Loading…</p>
            ) : periods.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No periods defined yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {periods.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-3 gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm">{p.period_start} → {p.period_end}</div>
                      {p.lock_reason && <div className="text-xs text-muted-foreground truncate">Reason: {p.lock_reason}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.is_locked
                        ? <Badge variant="destructive" className="gap-1"><Lock className="h-3 w-3" />Locked</Badge>
                        : <Badge variant="secondary" className="gap-1"><Unlock className="h-3 w-3" />Open</Badge>}
                      {p.is_locked ? (
                        <Button size="sm" variant="outline" onClick={() => unlockPeriod(p.id)}>Unlock</Button>
                      ) : (
                        <Dialog open={reasonOpen === p.id} onOpenChange={o => { setReasonOpen(o ? p.id : null); if (!o) setLockReasonDraft(""); }}>
                          <DialogTrigger asChild>
                            <Button size="sm">Lock</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>Lock period {p.period_start} → {p.period_end}</DialogTitle></DialogHeader>
                            <div className="py-2">
                              <Label>Reason (optional)</Label>
                              <Textarea rows={3} value={lockReasonDraft} onChange={e => setLockReasonDraft(e.target.value)} placeholder="e.g. Audited and closed" />
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setReasonOpen(null)}>Cancel</Button>
                              <Button onClick={() => lockPeriod(p.id, lockReasonDraft)}>Lock period</Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => deletePeriod(p.id)} title="Delete">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
