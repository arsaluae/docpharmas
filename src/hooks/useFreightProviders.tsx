import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FreightProvider {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  notes?: string | null;
}

export function useFreightProviders(includeInactive = false) {
  const [providers, setProviders] = useState<FreightProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("freight_providers" as any).select("id, name, code, is_active, notes").order("name");
    if (!includeInactive) q = q.eq("is_active", true);
    const { data } = await q;
    setProviders((data as any as FreightProvider[]) || []);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => { load(); }, [load]);

  return { providers, loading, reload: load };
}
