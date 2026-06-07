import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "created"
  | "approved"
  | "rejected"
  | "submitted"
  | "edited"
  | "deleted"
  | "voided"
  | "return_raised"
  | "credit_note_issued"
  | "debit_note_issued"
  | "invoice_generated"
  | "stock_adjusted"
  | "period_locked"
  | "period_unlocked"
  | "role_assigned"
  | "role_changed"
  | "role_removed"
  | "member_invited"
  | "member_removed"
  | "member_reactivated"
  | "member_password_reset";

export type AuditEntity =
  | "sales_order"
  | "sales_invoice"
  | "purchase_order"
  | "purchase_invoice"
  | "sales_return"
  | "purchase_return"
  | "credit_note"
  | "debit_note"
  | "payment"
  | "grn"
  | "stock_movement"
  | "print_job"
  | "accounting_period"
  | "tenant_member";

interface LogAuditInput {
  action: AuditAction;
  entity_type: AuditEntity;
  entity_id?: string | null;
  entity_number?: string | null;
  changes?: Record<string, unknown> | null;
}

// Session-cached IP (single fetch). Set window.__AUDIT_DISABLE_IP=true to skip.
let _ipPromise: Promise<string | null> | null = null;
async function getClientIp(): Promise<string | null> {
  if (typeof window !== "undefined" && (window as any).__AUDIT_DISABLE_IP) return null;
  if (!_ipPromise) {
    _ipPromise = fetch("https://api.ipify.org?format=json", { cache: "force-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: any) => (j?.ip as string) || null)
      .catch(() => null);
  }
  return _ipPromise;
}

let _userCache: { id: string; email: string | null; role: string | null } | null = null;
async function getUserContext() {
  if (_userCache) return _userCache;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let role: string | null = null;
  try {
    const { data } = await supabase.rpc("get_user_tenant_role" as any);
    role = (data as any) || null;
  } catch {}
  _userCache = { id: user.id, email: user.email ?? null, role };
  return _userCache;
}

/**
 * Log an audit event. Fire-and-forget; never throws.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const [ctx, ip] = await Promise.all([getUserContext(), getClientIp()]);
    if (!ctx) return; // not authenticated
    await supabase.from("audit_log" as any).insert({
      user_id: ctx.id,
      user_email: ctx.email,
      user_role: ctx.role,
      action: input.action,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      entity_number: input.entity_number ?? null,
      changes: input.changes ?? null,
      ip_address: ip,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    // Audit logging must never break user flows
    console.warn("[audit] log failed", e);
  }
}

export function clearAuditUserCache() {
  _userCache = null;
}
