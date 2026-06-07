import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { TenantRole } from "@/lib/rbac";

interface TenantContextType {
  tenantId: string | null;
  tenantRole: TenantRole | null;
  tenantName: string | null;
  /** Legacy: true only for the tenant owner. Prefer useRoles().can(...) for fine-grained checks. */
  isAdmin: boolean;
  loading: boolean;
}

const DEFAULT: TenantContextType = {
  tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: true,
};

const TenantContext = createContext<TenantContextType>(DEFAULT);

const cacheKey = (uid: string) => `tenant:cache:${uid}`;

function readCache(uid: string): TenantContextType | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...parsed, loading: false };
  } catch { return null; }
}

function writeCache(uid: string, state: TenantContextType) {
  try {
    const { loading, ...rest } = state;
    sessionStorage.setItem(cacheKey(uid), JSON.stringify(rest));
  } catch { /* ignore quota */ }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<TenantContextType>(DEFAULT);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: false });
      return;
    }

    const cached = readCache(user.id);
    if (cached) setState(cached);

    let cancelled = false;
    (async () => {
      const { data: tuData } = await supabase
        .from("tenant_users")
        .select("tenant_id, role, tenants:tenant_id(company_name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (cancelled) return;
      const tenantInfo = tuData?.tenants as any;
      const role = (tuData?.role as TenantRole) ?? null;
      const next: TenantContextType = {
        tenantId: tuData?.tenant_id ?? null,
        tenantRole: role,
        tenantName: tenantInfo?.company_name ?? null,
        isAdmin: role === "owner",
        loading: false,
      };
      setState(next);
      writeCache(user.id, next);
    })();

    return () => { cancelled = true; };
  }, [user, authLoading]);

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext);
}
