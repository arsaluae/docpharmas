import { useTenant } from "@/hooks/useTenant";
import { isSalesAgentRole } from "@/lib/rbac";

/**
 * Returns true when the logged-in user is a sales agent (or legacy staff).
 * Use this in shared pages to hide cost columns, admin actions, supplier badges, etc.
 * RLS still enforces server-side; this is a UX hide only.
 */
export function useIsSalesAgent(): boolean {
  const { tenantRole } = useTenant();
  return isSalesAgentRole(tenantRole);
}
