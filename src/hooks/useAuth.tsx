import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { logAudit, clearAuditUserCache } from "@/lib/audit";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let prevUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUser = session?.user ?? null;
      // On sign-out OR user switch, drop all cached query data to prevent
      // a new user briefly seeing the previous user's records.
      if (prevUserId && prevUserId !== (nextUser?.id ?? null)) {
        try { (window as any).__queryClient?.clear(); } catch {}
      }

      // Audit auth lifecycle (defer to avoid blocking the auth callback).
      if (event === "SIGNED_IN" && nextUser && prevUserId !== nextUser.id) {
        clearAuditUserCache();
        setTimeout(() => {
          logAudit({ action: "login", entity_type: "auth_session", entity_id: nextUser.id, entity_number: nextUser.email ?? null });
        }, 0);
      } else if (event === "SIGNED_OUT" && prevUserId) {
        const goneId = prevUserId;
        setTimeout(() => {
          logAudit({ action: "logout", entity_type: "auth_session", entity_id: goneId });
          clearAuditUserCache();
        }, 0);
      }

      prevUserId = nextUser?.id ?? null;
      setUser(nextUser);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      prevUserId = session?.user?.id ?? null;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}
