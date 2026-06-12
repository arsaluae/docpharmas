import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "lovable:active_tenant_id";

export interface SandboxInfo {
  exists: boolean;
  can_use: boolean;
  prod_tenant_id: string | null;
  sandbox_tenant_id?: string | null;
  session_id?: string | null;
  created_at?: string | null;
  created_by?: string | null;
  counts?: Record<string, number>;
}

/**
 * Resolves whether the current browser session is viewing the production
 * tenant or its sandbox tenant. Calls `set_active_tenant` on mount so the
 * Postgres GUC always matches what the UI is displaying after a hard refresh.
 */
export function useActiveTenant() {
  const [info, setInfo] = useState<SandboxInfo | null>(null);
  const [isSandbox, setIsSandbox] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.rpc("sandbox_session_info");
    const i = ((data as unknown) as SandboxInfo) ?? { exists: false, can_use: false, prod_tenant_id: null };
    setInfo(i);
    // Honour persisted choice — but only if it still corresponds to a real sandbox.
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && i.sandbox_tenant_id && stored === i.sandbox_tenant_id) {
      await supabase.rpc("set_active_tenant", { p_tenant: stored });
      setIsSandbox(true);
    } else {
      await supabase.rpc("set_active_tenant", { p_tenant: null });
      setIsSandbox(false);
      if (stored) localStorage.removeItem(STORAGE_KEY);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enterSandbox = useCallback(async () => {
    // Create or reuse, then switch.
    const { data: sbId, error } = await supabase.rpc("sandbox_create_session");
    if (error) throw error;
    localStorage.setItem(STORAGE_KEY, sbId as string);
    await supabase.rpc("set_active_tenant", { p_tenant: sbId });
    setIsSandbox(true);
    await refresh();
    // Hard reload so every cached query refetches under the new tenant.
    window.location.reload();
  }, [refresh]);

  const exitSandbox = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEY);
    await supabase.rpc("set_active_tenant", { p_tenant: null });
    setIsSandbox(false);
    window.location.reload();
  }, []);

  const deleteSession = useCallback(async () => {
    if (!info?.sandbox_tenant_id) return;
    const { error } = await supabase.rpc("sandbox_delete_session", { p_sandbox_tenant: info.sandbox_tenant_id });
    if (error) throw error;
    localStorage.removeItem(STORAGE_KEY);
    await supabase.rpc("set_active_tenant", { p_tenant: null });
    window.location.reload();
  }, [info]);

  const rollbackSession = useCallback(async () => {
    if (!info?.sandbox_tenant_id) return;
    const { error } = await supabase.rpc("sandbox_rollback_session", { p_sandbox_tenant: info.sandbox_tenant_id });
    if (error) throw error;
    window.location.reload();
  }, [info]);

  return { info, isSandbox, loading, refresh, enterSandbox, exitSandbox, deleteSession, rollbackSession };
}
