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
  isDeactivated: boolean;
  isPending: boolean;
}

const TenantContext = createContext<TenantContextType>({
  tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: true,
  subscriptionStatus: null, subscriptionEndsAt: null, daysRemaining: 0,
  isDeactivated: false, isPending: false,
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<TenantContextType>({
    tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: true,
    subscriptionStatus: null, subscriptionEndsAt: null, daysRemaining: 0,
    isDeactivated: false, isPending: false,
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setState({ tenantId: null, tenantRole: null, tenantName: null, isAdmin: false, loading: false, subscriptionStatus: null, subscriptionEndsAt: null, daysRemaining: 0, isDeactivated: false, isPending: false });
      return;
    }

    const load = async () => {
      const { data: adminData } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const isAdmin = !!adminData;

      const { data: tuData } = await supabase
        .from("tenant_users")
        .select("tenant_id, role, is_active, tenants:tenant_id(company_name, subscription_status, subscription_ends_at, is_active)")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (tuData) {
        // Check if tenant_user is deactivated
        if (!tuData.is_active) {
          setState({
            tenantId: tuData.tenant_id, tenantRole: null, tenantName: null, isAdmin,
            loading: false, subscriptionStatus: null, subscriptionEndsAt: null,
            daysRemaining: 0, isDeactivated: true, isPending: false,
          });
          return;
        }

        const tenantInfo = tuData.tenants as any;
        
        // Check if tenant itself is deactivated
        if (tenantInfo && !tenantInfo.is_active) {
          setState({
            tenantId: tuData.tenant_id, tenantRole: null, tenantName: tenantInfo.company_name,
            isAdmin, loading: false, subscriptionStatus: null, subscriptionEndsAt: null,
            daysRemaining: 0, isDeactivated: true, isPending: false,
          });
          return;
        }

        const endsAt = tenantInfo?.subscription_ends_at;
        const now = new Date();
        const endDate = endsAt ? new Date(endsAt) : now;
        const diffMs = endDate.getTime() - now.getTime();
        const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
        
        let status = tenantInfo?.subscription_status || "trial";
        if (endsAt && endDate < now) {
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
          isDeactivated: false,
          isPending: false,
        });
      } else {
        // No tenant link — check if there's a pending signup
        let isPending = false;
        const { data: pendingData } = await supabase
          .from("pending_signups")
          .select("status")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .limit(1) as any;
        
        if (pendingData && pendingData.length > 0) {
          isPending = true;
        }

        setState({ tenantId: null, tenantRole: null, tenantName: null, isAdmin, loading: false, subscriptionStatus: null, subscriptionEndsAt: null, daysRemaining: 0, isDeactivated: false, isPending });
      }
    };

    load();
  }, [user, authLoading]);

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  return useContext(TenantContext);
}
