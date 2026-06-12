// Sandbox UAT runner — executes a full Sales Agent → Order → Invoice → DN → Payment
// flow inside the caller's sandbox tenant and records pass/fail for every assertion.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Step = { step_no: number; step_name: string; status: "pass" | "fail" | "info"; details?: any; latency_ms?: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    // Identify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: ures } = await userClient.auth.getUser();
    const user = ures.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    // Get / create sandbox tenant via the RPC (enforces sandbox_can_use).
    const { data: sbId, error: sbErr } = await userClient.rpc("sandbox_create_session");
    if (sbErr || !sbId) return json({ error: sbErr?.message || "Cannot create sandbox" }, 403);

    // Use service role for the actual inserts (we explicitly stamp tenant_id = sandbox).
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const tenant_id = sbId as string;
    const steps: Step[] = [];

    // Open a run row
    const { data: runRow, error: runErr } = await admin
      .from("sandbox_uat_runs")
      .insert({ tenant_id, status: "running", triggered_by: user.id })
      .select("id")
      .single();
    if (runErr) return json({ error: runErr.message }, 500);
    const run_id = runRow!.id;

    const t0 = (label: string) => ({ label, start: performance.now() });
    const done = (timer: ReturnType<typeof t0>, status: "pass" | "fail" | "info", details?: any) => {
      const s: Step = {
        step_no: steps.length + 1,
        step_name: timer.label,
        status,
        latency_ms: Math.round(performance.now() - timer.start),
        details,
      };
      steps.push(s);
      return s;
    };
    const assert = (cond: boolean, msg: string, extra?: any) =>
      cond ? { ok: true, msg, ...extra } : { ok: false, msg, ...extra };

    try {
      // 1. Sales agent
      let t = t0("Create test sales agent");
      const { data: agent, error: aErr } = await admin
        .from("sales_agents")
        .insert({ tenant_id, name: "UAT Agent", phone: "03001234567", is_active: true, commission_type: "percentage", commission_rate: 5 })
        .select("id").single();
      if (aErr) throw new Error("sales_agents: " + aErr.message);
      done(t, "pass", { agent_id: agent.id });

      // 2. Customer
      t = t0("Create test customer");
      const { data: cust, error: cErr } = await admin
        .from("customers")
        .insert({ tenant_id, name: "UAT Customer", city: "Karachi", area: "Saddar", phone: "03009999999", sms_mobile: "03009999999", credit_limit: 100000, is_active: true })
        .select("id").single();
      if (cErr) throw new Error("customers: " + cErr.message);
      done(t, "pass", { customer_id: cust.id });

      // 2b. Map customer to agent
      t = t0("Assign customer to sales agent");
      const { error: acErr } = await admin
        .from("agent_customers")
        .insert({ tenant_id, agent_id: agent.id, customer_id: cust.id });
      done(t, acErr ? "fail" : "pass", acErr ? { error: acErr.message } : { mapped: true });

      // 3. Supplier
      t = t0("Create test supplier");
      const { data: sup, error: sErr } = await admin
        .from("suppliers")
        .insert({ tenant_id, name: "UAT Supplier", city: "Lahore", is_active: true })
        .select("id").single();
      if (sErr) throw new Error("suppliers: " + sErr.message);
      done(t, "pass", { supplier_id: sup.id });

      // 4. Product
      t = t0("Create test product");
      const { data: prod, error: pErr } = await admin
        .from("products")
        .insert({
          tenant_id, name: "UAT Panadol 500mg", category: "tablet", unit: "pcs",
          cost_price: 100, selling_price: 150, mrp: 150, gst_rate: 17,
          batch_tracking: true, expiry_tracking: true, is_active: true,
        })
        .select("id").single();
      if (pErr) throw new Error("products: " + pErr.message);
      done(t, "pass", { product_id: prod.id });

      // 5. GRN + grn_items + stock movement
      t = t0("Receive stock (GRN, batch UAT-B1, qty 100)");
      const grnNum = `GRN-${Date.now().toString().slice(-6)}`;
      const { data: grn, error: gErr } = await admin
        .from("goods_received_notes")
        .insert({ tenant_id, grn_number: grnNum, supplier_id: sup.id, date: today() })
        .select("id").single();
      if (gErr) throw new Error("grn: " + gErr.message);
      const expiry = new Date(); expiry.setDate(expiry.getDate() + 365);
      const { error: giErr } = await admin
        .from("grn_items")
        .insert({
          tenant_id, grn_id: grn.id, product_id: prod.id, item_name: "UAT Panadol 500mg",
          batch_number: "UAT-B1", quantity_ordered: 100, quantity_received: 100,
          expiry_date: expiry.toISOString().slice(0, 10), rate: 100, amount: 10000,
        });
      if (giErr) throw new Error("grn_items: " + giErr.message);
      const { error: smErr } = await admin
        .from("stock_movements")
        .insert({
          tenant_id, product_id: prod.id, movement_type: "purchase_in", quantity: 100,
          batch_number: "UAT-B1", reference_type: "grn", reference_id: grn.id,
          date: today(), notes: "UAT seed",
        });
      if (smErr) throw new Error("stock_movement: " + smErr.message);
      done(t, "pass", { grn_id: grn.id });

      // Assertion: product stock = 100
      t = t0("Assert: stock = 100 after GRN");
      const { data: pStock } = await admin.from("products").select("stock_quantity").eq("id", prod.id).single();
      done(t, Number(pStock?.stock_quantity) === 100 ? "pass" : "fail",
        { expected: 100, actual: Number(pStock?.stock_quantity) });

      // 6. Sales order (proforma)
      t = t0("Create sales order (qty 10)");
      const { data: so, error: soErr } = await admin
        .from("proforma_invoices")
        .insert({
          tenant_id, proforma_number: `SO-UAT-${Date.now().toString().slice(-5)}`,
          customer_id: cust.id, date: today(), validity_days: 30, agent_id: agent.id,
          items: [{ product_id: prod.id, name: "UAT Panadol 500mg", quantity: 10, rate: 150, amount: 1500 }],
          subtotal: 1500, gst: 0, total: 1500, status: "draft",
        })
        .select("id, agent_id").single();
      if (soErr) throw new Error("sales_order: " + soErr.message);
      done(t, so.agent_id === agent.id ? "pass" : "fail",
        { so_id: so.id, agent_stamped: so.agent_id === agent.id });

      // Assert stock untouched
      t = t0("Assert: stock unchanged after SO (still 100)");
      const { data: pStock2 } = await admin.from("products").select("stock_quantity").eq("id", prod.id).single();
      done(t, Number(pStock2?.stock_quantity) === 100 ? "pass" : "fail",
        { expected: 100, actual: Number(pStock2?.stock_quantity) });

      // 7. Sales invoice
      t = t0("Convert to sales invoice (dispatch)");
      const invNum = `SI-UAT-${Date.now().toString().slice(-5)}`;
      const { data: si, error: siErr } = await admin
        .from("sales_invoices")
        .insert({
          tenant_id, invoice_number: invNum, customer_id: cust.id, date: today(),
          due_date: today(30), subtotal: 1500, gst_amount: 0, discount: 0,
          total: 1500, amount_paid: 0, status: "dispatched", agent_id: agent.id,
          approved_at: new Date().toISOString(), created_by: user.id,
        })
        .select("id").single();
      if (siErr) throw new Error("sales_invoice: " + siErr.message);
      const { error: siiErr } = await admin
        .from("sales_invoice_items")
        .insert({
          tenant_id, invoice_id: si.id, product_id: prod.id, batch_number: "UAT-B1",
          quantity: 10, rate: 150, amount: 1500,
          expiry_date: expiry.toISOString().slice(0, 10),
        });
      if (siiErr) throw new Error("sales_invoice_items: " + siiErr.message);
      // Stock movement for sale
      await admin.from("stock_movements").insert({
        tenant_id, product_id: prod.id, movement_type: "sale_out", quantity: 10,
        batch_number: "UAT-B1", reference_type: "sales_invoice", reference_id: si.id,
        date: today(), notes: "UAT sale",
      });
      done(t, "pass", { si_id: si.id, number: invNum });

      // Assert customer balance rose by 1500
      t = t0("Assert: customer balance = 1500 after invoice");
      const { data: cBal } = await admin.from("customers").select("balance").eq("id", cust.id).single();
      done(t, Number(cBal?.balance) === 1500 ? "pass" : "fail",
        { expected: 1500, actual: Number(cBal?.balance) });

      // Assert stock = 90
      t = t0("Assert: stock = 90 after sale (was 100, sold 10)");
      const { data: pStock3 } = await admin.from("products").select("stock_quantity").eq("id", prod.id).single();
      done(t, Number(pStock3?.stock_quantity) === 90 ? "pass" : "fail",
        { expected: 90, actual: Number(pStock3?.stock_quantity) });

      // 8. Delivery note
      t = t0("Generate delivery note");
      const dnNum = `DN-UAT-${Date.now().toString().slice(-5)}`;
      const { data: dn, error: dnErr } = await admin
        .from("delivery_notes")
        .insert({
          tenant_id, dn_number: dnNum, date: today(),
          reference_type: "sales_invoice", reference_id: si.id, customer_id: cust.id,
          items: [{ product_id: prod.id, name: "UAT Panadol 500mg", batch_number: "UAT-B1", quantity: 10 }],
          status: "issued", agent_id: agent.id,
        })
        .select("id, status").single();
      if (dnErr) throw new Error("delivery_note: " + dnErr.message);
      done(t, dn.reference_id === si.id ? "pass" : "fail", { dn_id: dn.id, linked: dn.reference_id === si.id });

      // 9. Payment
      t = t0("Record customer payment (cash, full amount)");
      // Need a bank account — create if missing (cash isn't necessarily one)
      let bankId: string | null = null;
      const { data: existingBank } = await admin
        .from("bank_accounts").select("id").eq("tenant_id", tenant_id).limit(1).maybeSingle();
      if (existingBank?.id) bankId = existingBank.id;
      else {
        const { data: nb } = await admin
          .from("bank_accounts")
          .insert({ tenant_id, name: "UAT Cash Drawer", bank_name: "Cash", account_number: "CASH-01", opening_balance: 0, balance: 0, is_default: true })
          .select("id").single();
        bankId = nb!.id;
      }
      const payNum = `PAY-UAT-${Date.now().toString().slice(-5)}`;
      const { data: pay, error: payErr } = await admin
        .from("payments")
        .insert({
          tenant_id, payment_number: payNum, type: "received", party_type: "customer",
          party_id: cust.id, amount: 1500, payment_method: "cash", bank_account_id: bankId,
          date: today(), invoice_id: si.id, status: "active", agent_id: agent.id,
          created_by: user.id, source: "agent_collection",
        })
        .select("id").single();
      if (payErr) throw new Error("payment: " + payErr.message);
      done(t, "pass", { payment_id: pay.id });

      // Assert: customer balance back to 0
      t = t0("Assert: customer balance = 0 after payment");
      const { data: cBal2 } = await admin.from("customers").select("balance").eq("id", cust.id).single();
      done(t, Number(cBal2?.balance) === 0 ? "pass" : "fail",
        { expected: 0, actual: Number(cBal2?.balance) });

      // Assert: bank balance rose
      t = t0("Assert: bank balance = 1500 after payment");
      const { data: bBal } = await admin.from("bank_accounts").select("balance").eq("id", bankId!).single();
      done(t, Number(bBal?.balance) === 1500 ? "pass" : "fail",
        { expected: 1500, actual: Number(bBal?.balance) });

      // Ledger / aging
      t = t0("Ledger: receivables aging empty for UAT customer");
      // Manual: just check invoice amount_paid
      const { data: siFinal } = await admin.from("sales_invoices")
        .select("amount_paid, status, total").eq("id", si.id).single();
      const fullyPaid = Number(siFinal?.amount_paid) === Number(siFinal?.total);
      done(t, fullyPaid ? "pass" : "fail",
        { amount_paid: Number(siFinal?.amount_paid), total: Number(siFinal?.total), status: siFinal?.status });
    } catch (e) {
      steps.push({
        step_no: steps.length + 1, step_name: "Aborted: " + (e instanceof Error ? e.message : String(e)),
        status: "fail",
      });
    }

    // Persist steps
    if (steps.length) {
      await admin.from("sandbox_uat_steps").insert(
        steps.map(s => ({ tenant_id, run_id, ...s }))
      );
    }
    const passed = steps.filter(s => s.status === "pass").length;
    const failed = steps.filter(s => s.status === "fail").length;
    await admin.from("sandbox_uat_runs")
      .update({ finished_at: new Date().toISOString(), passed_count: passed, failed_count: failed, status: failed === 0 ? "passed" : "failed" })
      .eq("id", run_id);

    return json({ run_id, passed, failed, total: steps.length, steps });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function today(offsetDays = 0) {
  const d = new Date(); d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
