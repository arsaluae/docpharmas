import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TenantContextType {
  tenantId: string | null;
  tenantRole: "owner" | "staff" | null;
  tenantName: string | null;
  isAdmin: boolean;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: true,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<TenantContextType>({
    tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: true,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: false });
      return;
    }

    (async () => {
      const { data: tuData } = await supabase
        .from("tenant_users")
        .select("tenant_id, role, tenants:tenant_id(company_name)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      const tenantInfo = tuData?.tenants as any;
      setState({
        tenantId: tuData?.tenant_id ?? null,
        tenantRole: (tuData?.role as "owner" | "staff") ?? null,
        tenantName: tenantInfo?.company_name ?? null,
        isAdmin: false,
        loading: false,
      });
    })();
  }, [user, authLoading]);

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext);
}
