// AI Command Center – single-shot Q&A over read-only pharma context.
// Returns a markdown answer scoped to the caller's tenant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateText } from "npm:ai@4.3.16";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const question = String(body?.question ?? "").trim().slice(0, 1000);
    if (!question) {
      return new Response(JSON.stringify({ error: "Missing question" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lightweight tenant snapshot — counts, top customers, overdue, low stock.
    const [
      { data: kpiRow },
      { data: topCustomers },
      { data: overdueInvs },
      { data: lowStock },
    ] = await Promise.all([
      supa.rpc("dashboard_kpis", {
        p_week_start: new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10),
        p_month_start: new Date().toISOString().slice(0, 7) + "-01",
        p_year_start: new Date().getFullYear() + "-01-01",
        p_last_month_start: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString().slice(0, 10),
        p_last_month_end: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString().slice(0, 10),
        p_today: new Date().toISOString().slice(0, 10),
      }).single(),
      supa.from("customers").select("name, balance, city").order("balance", { ascending: false }).limit(10),
      supa.from("sales_invoices").select("invoice_number, customer_id, total, amount_paid, date, status, customers(name)").neq("status", "voided").lt("date", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)).limit(15),
      supa.from("products").select("name, stock_quantity, reorder_level").lt("stock_quantity", 50).order("stock_quantity").limit(15),
    ]);

    const ctx = {
      kpis: kpiRow ?? {},
      top_customers_by_balance: topCustomers ?? [],
      sample_aged_invoices: (overdueInvs ?? []).map((r: any) => ({
        inv: r.invoice_number, date: r.date, total: r.total, paid: r.amount_paid,
        customer: r.customers?.name, status: r.status,
      })),
      low_stock_products: lowStock ?? [],
    };

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const gateway = createLovableAiGatewayProvider(apiKey);
    const model = gateway("google/gemini-3-flash-preview");

    const { text } = await generateText({
      model,
      system:
        "You are the business intelligence assistant for a Pakistani pharma distributor ERP. " +
        "Answer concisely in markdown. Use the JSON snapshot of the caller's tenant data below. " +
        "If the data is insufficient, say so plainly. Currency is PKR. Format large numbers compactly. " +
        "Prefer bullet lists with bold labels. Never invent numbers.",
      prompt:
        `Tenant snapshot (JSON):\n\n\`\`\`json\n${JSON.stringify(ctx).slice(0, 12000)}\n\`\`\`\n\n` +
        `Question: ${question}`,
    });

    return new Response(JSON.stringify({ answer: text }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const msg = err?.message || "Unknown error";
    const status = msg.includes("429") ? 429 : msg.includes("402") ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
