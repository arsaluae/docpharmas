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
  { document_type: "supplier", prefix: "SUP-" },
  { document_type: "customer", prefix: "CUS-" },
  { document_type: "product", prefix: "PRD-" },
  { document_type: "credit_note", prefix: "CN-" },
  { document_type: "salary", prefix: "SAL-" },
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

    const body = await req.json();
    const { action } = body;

    // Public action: create_pending_signup (no admin auth required)
    if (action === "create_pending_signup") {
      const { user_id, email, company_name, phone } = body;
      if (!user_id || !email || !company_name) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify user exists in auth.users
      const { data: authUser, error: authLookupErr } = await supabaseAdmin.auth.admin.getUserById(user_id);
      if (authLookupErr || !authUser?.user) {
        return new Response(JSON.stringify({ error: "Invalid user" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check for duplicate
      const { data: existing } = await supabaseAdmin
        .from("pending_signups")
        .select("id")
        .eq("user_id", user_id)
        .limit(1);
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ success: true, message: "Already registered" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: insertErr } = await supabaseAdmin.from("pending_signups").insert({
        user_id,
        email,
        company_name,
        phone: phone || null,
      });
      if (insertErr) {
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // owner_create_user: tenant owners can create sub-users for their own tenant
    if (action === "owner_create_user") {
      const { tenant_id, email, password, role } = body;
      if (!tenant_id || !email || !password) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const ALLOWED_ROLES = ["owner","accountant","sales_mgr","sales_agent","staff","inventory","purchase_mgr","viewer"] as const;
      const resolvedRole = (ALLOWED_ROLES as readonly string[]).includes(role) ? role : "sales_agent";

      // Verify caller is owner of the specified tenant (or admin)
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const { data: ownerRecord } = await supabaseAdmin
        .from("tenant_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .single();

      if (!isAdmin && ownerRecord?.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only tenant owners can create users" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

      // Link to the specified tenant (owner = Admin, staff = Sales)
      const { error: tuError } = await supabaseAdmin.from("tenant_users").insert({
        tenant_id,
        user_id: newUser.user.id,
        role: resolvedRole,
      });

      if (tuError) {
        return new Response(JSON.stringify({ error: tuError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-provision sales_agents row so RLS scoping works immediately
      if (resolvedRole === "sales_agent" || resolvedRole === "staff") {
        // Try to attach to an existing unlinked agent record with the same email first
        const { data: existingAgent } = await supabaseAdmin
          .from("sales_agents")
          .select("id, user_id")
          .eq("tenant_id", tenant_id)
          .ilike("email", email)
          .is("user_id", null)
          .limit(1)
          .maybeSingle();
        if (existingAgent?.id) {
          await supabaseAdmin
            .from("sales_agents")
            .update({ user_id: newUser.user.id, is_active: true, status: "active" })
            .eq("id", existingAgent.id);
        } else {
          await supabaseAdmin.from("sales_agents").insert({
            tenant_id,
            user_id: newUser.user.id,
            name: email.split("@")[0] || "Sales Agent",
            email,
            status: "active",
            is_active: true,
            commission_type: "percentage",
            commission_rate: 0,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // toggle_user_active: owners can deactivate / reactivate their own sub-users
    if (action === "toggle_user_active") {
      const { tenant_id, user_id: target_user_id, is_active } = body;
      if (!tenant_id || !target_user_id || typeof is_active !== "boolean") {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const { data: ownerRecord } = await supabaseAdmin
        .from("tenant_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("tenant_id", tenant_id)
        .eq("is_active", true)
        .single();

      if (!isAdmin && ownerRecord?.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only tenant owners can manage users" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent owners from disabling themselves via this endpoint
      if (target_user_id === user.id) {
        return new Response(JSON.stringify({ error: "You cannot change your own active status" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updErr } = await supabaseAdmin
        .from("tenant_users")
        .update({ is_active })
        .eq("tenant_id", tenant_id)
        .eq("user_id", target_user_id);

      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // list_tenant_users: return { user_id, email } for current tenant (owner-only)
    if (action === "list_tenant_users") {
      const { tenant_id } = body;
      if (!tenant_id) {
        return new Response(JSON.stringify({ error: "Missing tenant_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdminL } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const { data: ownerL } = await supabaseAdmin
        .from("tenant_users").select("role")
        .eq("user_id", user.id).eq("tenant_id", tenant_id).eq("is_active", true).single();
      if (!isAdminL && ownerL?.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only tenant owners can view team emails" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: tus } = await supabaseAdmin
        .from("tenant_users").select("user_id, role, is_active, created_at").eq("tenant_id", tenant_id)
        .order("created_at", { ascending: true });
      const results: { user_id: string; email: string | null; role: string; is_active: boolean; created_at: string }[] = [];
      for (const t of tus || []) {
        const { data: au } = await supabaseAdmin.auth.admin.getUserById(t.user_id);
        results.push({ user_id: t.user_id, email: au?.user?.email ?? null, role: t.role, is_active: t.is_active, created_at: t.created_at });
      }
      return new Response(JSON.stringify({ users: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // owner_reset_password: owner-only; set a sub-user's password
    if (action === "owner_reset_password") {
      const { tenant_id, user_id: target_user_id, new_password } = body;
      if (!tenant_id || !target_user_id || !new_password || new_password.length < 6) {
        return new Response(JSON.stringify({ error: "Missing fields or password too short (min 6)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: isAdminR } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const { data: ownerR } = await supabaseAdmin
        .from("tenant_users").select("role")
        .eq("user_id", user.id).eq("tenant_id", tenant_id).eq("is_active", true).single();
      if (!isAdminR && ownerR?.role !== "owner") {
        return new Response(JSON.stringify({ error: "Only tenant owners can reset passwords" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: targetTU } = await supabaseAdmin
        .from("tenant_users").select("user_id")
        .eq("tenant_id", tenant_id).eq("user_id", target_user_id).single();
      if (!targetTU) {
        return new Response(JSON.stringify({ error: "User is not part of this workspace" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
        password: new_password,
      });
      if (updErr) {
        return new Response(JSON.stringify({ error: updErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }



    // All remaining actions require admin role
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      // Confirm user's email so they can log in
      await supabaseAdmin.auth.admin.updateUserById(signup.user_id, {
        email_confirm: true,
      });

      // Mark signup as approved
      await supabaseAdmin.from("pending_signups").update({
        status: "approved",
        reviewed_at: new Date().toISOString(),
      }).eq("id", signup_id);

      // Send approval email (fire-and-forget)
      try {
        const emailPayload = {
          email: signup.email,
          company_name: signup.company_name,
          trial_ends_at: trialEnd.toISOString(),
        };
        const funcUrl = `${supabaseUrl}/functions/v1/send-approval-email`;
        await fetch(funcUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(emailPayload),
        });
      } catch (emailErr) {
        console.error("Failed to send approval email:", emailErr);
      }

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
