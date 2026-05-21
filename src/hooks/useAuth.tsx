import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let prevUserId: string | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      // On sign-out OR user switch, drop all cached query data to prevent
      // a new user briefly seeing the previous user's records.
      if (prevUserId && prevUserId !== (nextUser?.id ?? null)) {
        try {
          (window as any).__queryClient?.clear();
        } catch {
          /* no-op */
        }
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
