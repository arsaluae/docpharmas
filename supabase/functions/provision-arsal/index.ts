// One-shot provisioning: create arsaluae@gmail.com as owner of existing Mouj tenant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TENANT_ID = "c7548f94-57c2-4004-b3bf-972e1e7d1bd6";
const EMAIL = "arsaluae@gmail.com";
const PASSWORD = "Mouj_1179";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Find or create user
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email?.toLowerCase() === EMAIL);

    if (existing) {
      userId = existing.id;
      // reset password + ensure confirmed
      await admin.auth.admin.updateUserById(userId, {
        password: PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
      });
      if (error) throw error;
      userId = data.user!.id;
    }

    // 2. Upsert into tenant_users
    const { error: tuErr } = await admin.from("tenant_users").upsert(
      {
        user_id: userId,
        tenant_id: TENANT_ID,
        role: "owner",
        is_active: true,
      },
      { onConflict: "user_id,tenant_id" },
    );
    if (tuErr) throw tuErr;

    return new Response(
      JSON.stringify({ ok: true, user_id: userId, email: EMAIL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
