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
  gst_enabled: boolean;
  default_gst_rate: number;
  wht_enabled: boolean;
  default_wht_rate: number;
  whatsapp_number: string | null;
  invoice_delete_grace_hours: number;
  auto_create_missing_suppliers: boolean;
  show_customer_mobile_on_docs?: boolean;
  show_customer_phone_on_docs?: boolean;
  show_supplier_mobile_on_docs?: boolean;
  show_supplier_phone_on_docs?: boolean;
  warranty_note_text?: string | null;
  warranty_declaration_enabled?: boolean;
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
