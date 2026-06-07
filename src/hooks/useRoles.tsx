import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { can as canCheck, type TenantRole, type Resource, type Action } from "@/lib/rbac";

/**
 * Returns the current user's tenant role and a `can(resource, action)` checker.
 * Server-side RLS + void_document RPC re-enforce all of this.
 */
export function useRoles() {
  const { user } = useAuth();
  const [role, setRole] = useState<TenantRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) { setRole(null); setLoading(false); return; }
    setLoading(true);
    (supabase.rpc as any)("current_tenant_role").then(({ data }: any) => {
      if (!active) return;
      setRole((data as TenantRole) ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  const can = useCallback(
    (resource: Resource, action: Action) => canCheck(role, resource, action),
    [role]
  );

  return {
    role,
    loading,
    isOwner: role === "owner",
    can,
  };
}
