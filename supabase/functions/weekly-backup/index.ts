import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKUP_TABLES = [
  "customers",
  "suppliers",
  "products",
  "proforma_invoices",
  "sales_invoices",
  "sales_invoice_items",
  "purchase_proformas",
  "purchase_proforma_items",
  "purchase_orders",
  "purchase_order_items",
  "purchase_invoices",
  "payments",
  "expenses",
  "expense_ledgers",
  "bank_accounts",
  "delivery_notes",
  "print_jobs",
  "printers",
  "sales_agents",
  "agent_customers",
  "agent_commissions",
  "credit_notes",
  "salary_payments",
  "stock_movements",
  "sales_returns",
  "sales_return_items",
  "purchase_returns",
  "purchase_return_items",
  "document_templates",
  "document_counters",
  "company_settings",
  "customer_products",
  "customer_licenses",
  "customer_distributors",
  "chart_of_accounts",
  "journal_entries",
  "journal_lines",
  "goods_received_notes",
  "grn_items",
  "drap_registrations",
  "additional_costs",
];

const MAX_BACKUPS = 4; // 4-week (1-month) rolling retention

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all active tenants
    const { data: tenants, error: tenantErr } = await supabase
      .from("tenants")
      .select("id, name")
      .eq("is_active", true);

    if (tenantErr) throw tenantErr;

    const results: { tenant_id: string; status: string; file?: string; error?: string }[] = [];

    for (const tenant of tenants || []) {
      try {
        const backupData: Record<string, any[]> = {};

        for (const table of BACKUP_TABLES) {
          const allRows: any[] = [];
          let from = 0;
          const PAGE_SIZE = 500;
          let hasMore = true;

          while (hasMore) {
            const { data, error } = await supabase
              .from(table)
              .select("*")
              .eq("tenant_id", tenant.id)
              .range(from, from + PAGE_SIZE - 1);

            if (error) {
              console.warn(`Skipping ${table} for tenant ${tenant.id}: ${error.message}`);
              break;
            }
            if (data) allRows.push(...data);
            hasMore = data ? data.length === PAGE_SIZE : false;
            from += PAGE_SIZE;
          }

          if (allRows.length > 0) {
            backupData[table] = allRows;
          }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `${tenant.id}/backup_${timestamp}.json`;

        // Compress: store as JSON string
        const jsonStr = JSON.stringify({
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          backup_date: new Date().toISOString(),
          tables: backupData,
          table_counts: Object.fromEntries(
            Object.entries(backupData).map(([k, v]) => [k, v.length])
          ),
        });

        const blob = new Blob([jsonStr], { type: "application/json" });

        const { error: uploadErr } = await supabase.storage
          .from("tenant-backups")
          .upload(fileName, blob, {
            contentType: "application/json",
            upsert: false,
          });

        if (uploadErr) throw uploadErr;

        // Clean up old backups (keep only MAX_BACKUPS)
        const { data: files } = await supabase.storage
          .from("tenant-backups")
          .list(tenant.id, { sortBy: { column: "created_at", order: "desc" } });

        if (files && files.length > MAX_BACKUPS) {
          const toDelete = files.slice(MAX_BACKUPS).map((f) => `${tenant.id}/${f.name}`);
          await supabase.storage.from("tenant-backups").remove(toDelete);
        }

        results.push({ tenant_id: tenant.id, status: "success", file: fileName });
      } catch (err: any) {
        results.push({ tenant_id: tenant.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
