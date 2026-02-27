import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CompanySettings {
  id: string;
  company_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  fbr_enabled: boolean;
  ntn: string | null;
  strn: string | null;
}

export function useCompanySettings() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("company_settings").select("*").limit(1).single();
    setSettings(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return { settings, loading, reload: load };
}
