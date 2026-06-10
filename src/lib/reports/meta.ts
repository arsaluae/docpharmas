import { supabase } from "@/integrations/supabase/client";

export interface ReportMeta {
  company: string;
  user: string;
  generatedAt: string; // ISO
  dateRange?: { from?: string; to?: string };
  filters?: { label: string; value: string }[];
}

let cachedCompany: string | null = null;

/** Get the standard header metadata for any report export. */
export async function getReportMeta(opts: {
  dateRange?: { from?: string; to?: string };
  filters?: { label: string; value: string }[];
} = {}): Promise<ReportMeta> {
  if (cachedCompany === null) {
    const { data } = await supabase
      .from("company_settings")
      .select("company_name")
      .limit(1)
      .maybeSingle();
    cachedCompany = data?.company_name || "";
  }
  const { data: { user } } = await supabase.auth.getUser();
  return {
    company: cachedCompany || "—",
    user: user?.email || user?.id || "—",
    generatedAt: new Date().toISOString(),
    dateRange: opts.dateRange,
    filters: opts.filters,
  };
}
