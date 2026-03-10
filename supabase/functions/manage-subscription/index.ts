import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      Deno.env.get("SUPABASE_ANON_KEY")!
    ).auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "approve") {
      const { submission_id, plan } = body;
      if (!submission_id) {
        return new Response(JSON.stringify({ error: "Missing submission_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get submission
      const { data: submission, error: subErr } = await supabaseAdmin
        .from("payment_submissions")
        .select("*")
        .eq("id", submission_id)
        .single();

      if (subErr || !submission) {
        return new Response(JSON.stringify({ error: "Submission not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const daysToAdd = (plan || submission.plan) === "yearly" ? 365 : 30;

      // Get current tenant subscription_ends_at
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("subscription_ends_at")
        .eq("id", submission.tenant_id)
        .single();

      const currentEnd = tenant?.subscription_ends_at ? new Date(tenant.subscription_ends_at) : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = new Date(baseDate);
      newEnd.setDate(newEnd.getDate() + daysToAdd);

      // Update tenant
      const { error: tenantErr } = await supabaseAdmin
        .from("tenants")
        .update({
          subscription_ends_at: newEnd.toISOString(),
          subscription_status: "active",
        })
        .eq("id", submission.tenant_id);

      if (tenantErr) {
        return new Response(JSON.stringify({ error: tenantErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update submission status
      await supabaseAdmin
        .from("payment_submissions")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", submission_id);

      return new Response(JSON.stringify({ success: true, new_end: newEnd.toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reject") {
      const { submission_id, admin_notes } = body;
      if (!submission_id) {
        return new Response(JSON.stringify({ error: "Missing submission_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabaseAdmin
        .from("payment_submissions")
        .update({ status: "rejected", admin_notes: admin_notes || null, reviewed_at: new Date().toISOString() })
        .eq("id", submission_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "extend") {
      const { tenant_id, days } = body;
      if (!tenant_id || !days) {
        return new Response(JSON.stringify({ error: "Missing tenant_id or days" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("subscription_ends_at")
        .eq("id", tenant_id)
        .single();

      const currentEnd = tenant?.subscription_ends_at ? new Date(tenant.subscription_ends_at) : new Date();
      const baseDate = currentEnd > new Date() ? currentEnd : new Date();
      const newEnd = new Date(baseDate);
      newEnd.setDate(newEnd.getDate() + days);

      await supabaseAdmin
        .from("tenants")
        .update({ subscription_ends_at: newEnd.toISOString(), subscription_status: "active" })
        .eq("id", tenant_id);

      return new Response(JSON.stringify({ success: true, new_end: newEnd.toISOString() }), {
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
