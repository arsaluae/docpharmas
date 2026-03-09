import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DOCUMENT_COUNTER_SEEDS = [
  { document_type: "sales_invoice", prefix: "INV-" },
  { document_type: "proforma", prefix: "PI-" },
  { document_type: "warranty_invoice", prefix: "WI-" },
  { document_type: "purchase_proforma", prefix: "PP-" },
  { document_type: "purchase_order", prefix: "PO-" },
  { document_type: "purchase_invoice", prefix: "BILL-" },
  { document_type: "grn", prefix: "GRN-" },
  { document_type: "payment", prefix: "PAY-" },
  { document_type: "expense", prefix: "EXP-" },
  { document_type: "delivery_note", prefix: "DN-" },
  { document_type: "journal", prefix: "JE-" },
  { document_type: "sales_return", prefix: "SR-" },
  { document_type: "purchase_return", prefix: "PR-" },
  { document_type: "print_job", prefix: "PJ-" },
];

async function seedTenantData(supabaseAdmin: any, tenantId: string) {
  // Seed document counters
  const counters = DOCUMENT_COUNTER_SEEDS.map(c => ({
    ...c,
    tenant_id: tenantId,
    current_value: 0,
  }));
  await supabaseAdmin.from("document_counters").insert(counters);

  // Seed default company settings
  await supabaseAdmin.from("company_settings").insert({
    tenant_id: tenantId,
    company_name: null,
    gst_enabled: false,
    wht_enabled: false,
    fbr_enabled: false,
    default_gst_rate: 17,
    default_wht_rate: 4.5,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!
    ).auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create_user") {
      const { tenant_id, email, password, role } = body;

      if (!tenant_id || !email || !password) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check tenant user limit
      const { data: tenant } = await supabaseAdmin.from("tenants").select("max_users").eq("id", tenant_id).single();
      const { data: existingUsers } = await supabaseAdmin.from("tenant_users").select("id").eq("tenant_id", tenant_id);
      
      if (tenant && existingUsers && existingUsers.length >= tenant.max_users) {
        return new Response(JSON.stringify({ error: `User limit reached (${tenant.max_users} max)` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create tenant_user mapping
      const { error: tuError } = await supabaseAdmin.from("tenant_users").insert({
        tenant_id,
        user_id: newUser.user.id,
        role: role || "owner",
      });

      if (tuError) {
        return new Response(JSON.stringify({ error: tuError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "approve_signup") {
      const { signup_id } = body;
      if (!signup_id) {
        return new Response(JSON.stringify({ error: "Missing signup_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get pending signup
      const { data: signup, error: fetchErr } = await supabaseAdmin
        .from("pending_signups")
        .select("*")
        .eq("id", signup_id)
        .eq("status", "pending")
        .single();

      if (fetchErr || !signup) {
        return new Response(JSON.stringify({ error: "Signup not found or already processed" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create tenant
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 7);

      const { data: tenant, error: tenantErr } = await supabaseAdmin.from("tenants").insert({
        company_name: signup.company_name,
        owner_email: signup.email,
        phone: signup.phone || null,
        plan: "monthly",
        subscription_status: "trial",
        trial_starts_at: new Date().toISOString(),
        subscription_ends_at: trialEnd.toISOString(),
      }).select().single();

      if (tenantErr) {
        return new Response(JSON.stringify({ error: tenantErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Link user to tenant
      const { error: tuErr } = await supabaseAdmin.from("tenant_users").insert({
        tenant_id: tenant.id,
        user_id: signup.user_id,
        role: "owner",
      });

      if (tuErr) {
        return new Response(JSON.stringify({ error: tuErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Seed document counters + company settings
      await seedTenantData(supabaseAdmin, tenant.id);

      // Mark signup as approved
      await supabaseAdmin.from("pending_signups").update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      }).eq("id", signup_id);

      return new Response(JSON.stringify({ success: true, tenant_id: tenant.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject_signup") {
      const { signup_id, admin_notes } = body;
      if (!signup_id) {
        return new Response(JSON.stringify({ error: "Missing signup_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin.from("pending_signups").update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        admin_notes: admin_notes || null,
      }).eq("id", signup_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "seed_tenant") {
      const { tenant_id } = body;
      if (!tenant_id) {
        return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      await seedTenantData(supabaseAdmin, tenant_id);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
