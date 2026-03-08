import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface TenantContextType {
  tenantId: string | null;
  tenantRole: "owner" | "staff" | null;
  tenantName: string | null;
  isAdmin: boolean;
  loading: boolean;
  subscriptionStatus: string | null;
  subscriptionEndsAt: string | null;
  daysRemaining: number;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: true,
  subscriptionStatus: null, subscriptionEndsAt: null, daysRemaining: 0,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<TenantContextType>({
    tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: true,
    subscriptionStatus: null, subscriptionEndsAt: null, daysRemaining: 0,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: false, subscriptionStatus: null, subscriptionEndsAt: null, daysRemaining: 0 });
      return;
    }

    const load = async () => {
      const { data: adminData } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const isAdmin = !!adminData;

      const { data: tuData } = await supabase
        .from("tenant_users")
        .select("tenant_id, role, tenants:tenant_id(company_name, subscription_status, subscription_ends_at)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1)
        .single();

      if (tuData) {
        const tenantInfo = tuData.tenants as any;
        const endsAt = tenantInfo?.subscription_ends_at;
        const now = new Date();
        const endDate = endsAt ? new Date(endsAt) : now;
        const diffMs = endDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        
        let status = tenantInfo?.subscription_status || "trial";
        if (endsAt && endDate < now && status !== "active") {
          status = "expired";
        } else if (endsAt && endDate < now) {
          status = "expired";
        }

        setState({
          tenantId: tuData.tenant_id,
          tenantRole: tuData.role as "owner" | "staff",
          tenantName: tenantInfo?.company_name || null,
          isAdmin,
          loading: false,
          subscriptionStatus: status,
          subscriptionEndsAt: endsAt || null,
          daysRemaining,
        });
      } else {
        setState({ tenantId: null, tenantRole: null, tenantName: null, isAdmin, loading: false, subscriptionStatus: null, subscriptionEndsAt: null, daysRemaining: 0 });
      }
    };

    load();
  }, [user, authLoading]);

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext);
}
