import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BACKUP_TABLES = [
  "customers","suppliers","products","proforma_invoices","sales_invoices","sales_invoice_items",
  "purchase_proformas","purchase_proforma_items","purchase_orders","purchase_order_items",
  "purchase_invoices","payments","expenses","expense_ledgers","bank_accounts","delivery_notes",
  "print_jobs","printers","sales_agents","agent_customers","agent_commissions","credit_notes",
  "salary_payments","stock_movements","sales_returns","sales_return_items","purchase_returns",
  "purchase_return_items","document_templates","document_counters","company_settings",
  "customer_products","customer_licenses","customer_distributors","chart_of_accounts",
  "journal_entries","journal_lines","goods_received_notes","grn_items","drap_registrations",
  "additional_costs",
];

// Retention: keep most recent N files per (tenant, schedule).
const RETENTION: Record<string, number> = { daily: 14, weekly: 8, monthly: 12, manual: 4 };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // ---- AuthN/Z: owner JWT OR matching CRON_SECRET header ----
  const headerSecret = req.headers.get("x-cron-secret") ?? "";
  const isCron = !!cronSecret && headerSecret === cronSecret;

  let schedule = "manual";
  let triggeredBy: string | null = null;

  if (!isCron) {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Verify the caller is a workspace owner (via service role to bypass RLS recursion).
    const { data: ownerRow } = await admin
      .from("tenant_users")
      .select("user_id, role, is_active")
      .eq("user_id", userData.user.id)
      .eq("is_active", true)
      .eq("role", "owner")
      .maybeSingle();
    if (!ownerRow) {
      return new Response(JSON.stringify({ error: "Forbidden: owner only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    triggeredBy = userData.user.id;
  } else {
    try {
      const body = await req.clone().json();
      if (body?.schedule && ["daily","weekly","monthly"].includes(body.schedule)) schedule = body.schedule;
    } catch { /* no body */ }
  }

  // ---- Create backup_runs row ----
  const { data: runRow, error: runErr } = await admin
    .from("backup_runs")
    .insert({ schedule, status: "running" })
    .select("id")
    .single();
  if (runErr) {
    return new Response(JSON.stringify({ error: "Could not start run: " + runErr.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const runId = runRow.id as string;

  const results: { tenant_id: string; status: string; file?: string; bytes?: number; error?: string }[] = [];
  let totalBytes = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const { data: tenants, error: tenantErr } = await admin
      .from("tenants").select("id, name").eq("is_active", true);
    if (tenantErr) throw tenantErr;

    for (const tenant of tenants || []) {
      try {
        const backupData: Record<string, any[]> = {};
        for (const table of BACKUP_TABLES) {
          const allRows: any[] = [];
          let from = 0; const PAGE_SIZE = 500; let hasMore = true;
          while (hasMore) {
            const { data, error } = await admin.from(table).select("*").eq("tenant_id", tenant.id).range(from, from + PAGE_SIZE - 1);
            if (error) { console.warn(`skip ${table} for ${tenant.id}: ${error.message}`); break; }
            if (data) allRows.push(...data);
            hasMore = data ? data.length === PAGE_SIZE : false;
            from += PAGE_SIZE;
          }
          if (allRows.length > 0) backupData[table] = allRows;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const fileName = `${tenant.id}/${schedule}/backup_${timestamp}.json`;
        const jsonStr = JSON.stringify({
          tenant_id: tenant.id, tenant_name: tenant.name, schedule,
          backup_date: new Date().toISOString(), tables: backupData,
          table_counts: Object.fromEntries(Object.entries(backupData).map(([k, v]) => [k, v.length])),
        });
        const blob = new Blob([jsonStr], { type: "application/json" });

        const { error: uploadErr } = await admin.storage
          .from("tenant-backups")
          .upload(fileName, blob, { contentType: "application/json", upsert: false });
        if (uploadErr) throw uploadErr;

        // Retention per (tenant, schedule)
        const keep = RETENTION[schedule] ?? 4;
        const { data: files } = await admin.storage
          .from("tenant-backups")
          .list(`${tenant.id}/${schedule}`, { sortBy: { column: "created_at", order: "desc" }, limit: 1000 });
        if (files && files.length > keep) {
          const toDelete = files.slice(keep).map((f) => `${tenant.id}/${schedule}/${f.name}`);
          await admin.storage.from("tenant-backups").remove(toDelete);
        }

        succeeded++;
        totalBytes += jsonStr.length;
        results.push({ tenant_id: tenant.id, status: "success", file: fileName, bytes: jsonStr.length });
      } catch (err: any) {
        failed++;
        results.push({ tenant_id: tenant.id, status: "error", error: err.message });
      }
    }

    const finalStatus = failed === 0 ? "success" : (succeeded === 0 ? "failed" : "partial");
    await admin.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: finalStatus,
      tenants_total: (tenants?.length ?? 0),
      tenants_succeeded: succeeded,
      tenants_failed: failed,
      total_bytes: totalBytes,
      results,
    }).eq("id", runId);

    // Audit (best-effort)
    try {
      await admin.from("audit_log").insert({
        user_id: triggeredBy,
        user_email: triggeredBy ? null : "cron@system",
        user_role: triggeredBy ? "owner" : "system",
        action: finalStatus === "failed" ? "backup_failed" : "backup_created",
        entity_type: "backup_run",
        entity_id: runId,
        entity_number: `${schedule}/${runId.slice(0,8)}`,
        changes: { schedule, succeeded, failed, total_bytes: totalBytes },
      });
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ success: true, run_id: runId, status: finalStatus, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    await admin.from("backup_runs").update({
      finished_at: new Date().toISOString(),
      status: "failed",
      error: err.message,
      results,
      tenants_succeeded: succeeded,
      tenants_failed: failed,
      total_bytes: totalBytes,
    }).eq("id", runId);
    try {
      await admin.from("audit_log").insert({
        user_id: triggeredBy, user_email: triggeredBy ? null : "cron@system",
        user_role: triggeredBy ? "owner" : "system",
        action: "backup_failed", entity_type: "backup_run", entity_id: runId,
        entity_number: `${schedule}/${runId.slice(0,8)}`, changes: { error: err.message },
      });
    } catch {}
    return new Response(JSON.stringify({ error: err.message, run_id: runId }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
