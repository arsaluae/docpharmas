import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditEntity } from "@/lib/audit";

interface AuditRow {
  id: string;
  action: string;
  user_email: string | null;
  user_role: string | null;
  created_at: string;
  entity_number: string | null;
  changes: any;
}

interface Props {
  entityType: AuditEntity;
  entityId: string;
  className?: string;
}

const ACTION_LABEL: Record<string, string> = {
  created: "Created",
  approved: "Approved",
  rejected: "Rejected",
  submitted: "Submitted for approval",
  edited: "Edited",
  deleted: "Deleted (grace period)",
  voided: "Voided",
  return_raised: "Return raised",
  credit_note_issued: "Credit note issued",
  debit_note_issued: "Debit note issued",
  invoice_generated: "Invoice generated",
  stock_adjusted: "Stock adjusted",
  period_locked: "Period locked",
  period_unlocked: "Period unlocked",
};

export function ActivityTimeline({ entityType, entityId, className }: Props) {
  const [rows, setRows] = useState<AuditRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("audit_log" as any)
        .select("id, action, user_email, user_role, created_at, entity_number, changes")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) setRows(((data ?? []) as unknown) as AuditRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  return (
    <Card className={"p-4 " + (className ?? "")}>
      <h3 className="text-sm font-medium mb-3">Activity</h3>
      {rows === null ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ol className="relative border-l border-border ml-2 space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary" />
              <p className="text-xs text-muted-foreground tabular-nums">
                {format(new Date(r.created_at), "dd MMM yyyy, hh:mm a")}
              </p>
              <p className="text-sm">
                <span className="font-medium">{ACTION_LABEL[r.action] ?? r.action}</span>
                {" "}— by {r.user_email ?? "Unknown"}
                {r.user_role ? ` (${r.user_role})` : ""}
              </p>
              {r.changes?.reason && (
                <p className="text-xs text-muted-foreground mt-0.5">Reason: {String(r.changes.reason)}</p>
              )}
              {r.changes?.note && (
                <p className="text-xs text-muted-foreground mt-0.5">{String(r.changes.note)}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
