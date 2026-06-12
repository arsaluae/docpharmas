// Bulk sandbox data seeder.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Multan", "Faisalabad", "Peshawar", "Quetta"];
const PHARMA = ["Panadol", "Brufen", "Augmentin", "Disprin", "Calpol", "Risek", "Nexum", "Velosef", "Septran", "Flagyl"];
const STRENGTHS = ["250mg", "500mg", "1g", "20mg", "40mg", "100ml"];
const FORMS = ["tablet", "capsule", "syrup", "injection"];

const rnd = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const today = (off = 0) => { const d = new Date(); d.setDate(d.getDate() + off); return d.toISOString().slice(0, 10); };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const counts = {
      customers: clamp(body.customers ?? 20, 0, 100),
      suppliers: clamp(body.suppliers ?? 10, 0, 50),
      products:  clamp(body.products  ?? 50, 0, 200),
      sales_orders: clamp(body.sales_orders ?? 20, 0, 100),
      invoices:  clamp(body.invoices  ?? 20, 0, 100),
      delivery_notes: clamp(body.delivery_notes ?? 10, 0, 100),
      payments:  clamp(body.payments  ?? 10, 0, 100),
    };

    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: sbId, error: sbErr } = await userClient.rpc("sandbox_create_session");
    if (sbErr || !sbId) return json({ error: sbErr?.message || "no sandbox" }, 403);
    const tenant_id = sbId as string;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Bank account
    let { data: bank } = await admin.from("bank_accounts").select("id").eq("tenant_id", tenant_id).limit(1).maybeSingle();
    if (!bank) {
      const r = await admin.from("bank_accounts").insert({ tenant_id, name: "Sandbox Cash", bank_name: "Cash", account_number: "SBX-CASH", opening_balance: 0, balance: 0, is_default: true }).select("id").single();
      bank = r.data;
    }

    // Suppliers
    const supRows = Array.from({ length: counts.suppliers }, (_, i) => ({
      tenant_id, name: `Sandbox Supplier ${i + 1}`, city: rnd(CITIES), is_active: true,
    }));
    const supIds: string[] = [];
    if (supRows.length) {
      const { data } = await admin.from("suppliers").insert(supRows).select("id");
      data?.forEach(d => supIds.push(d.id));
    }

    // Customers
    const custRows = Array.from({ length: counts.customers }, (_, i) => ({
      tenant_id, name: `Sandbox Customer ${i + 1}`, city: rnd(CITIES), area: "Test Area",
      phone: `0300${(1000000 + i).toString().slice(-7)}`,
      sms_mobile: `0300${(1000000 + i).toString().slice(-7)}`,
      credit_limit: 50000, is_active: true,
    }));
    const custIds: string[] = [];
    if (custRows.length) {
      const { data } = await admin.from("customers").insert(custRows).select("id");
      data?.forEach(d => custIds.push(d.id));
    }

    // Products + initial stock
    const prodRows = Array.from({ length: counts.products }, (_, i) => {
      const cost = 50 + Math.floor(Math.random() * 200);
      return {
        tenant_id,
        name: `${rnd(PHARMA)} ${rnd(STRENGTHS)} #${i + 1}`,
        category: rnd(FORMS), unit: "pcs",
        cost_price: cost, selling_price: Math.round(cost * 1.4), mrp: Math.round(cost * 1.4),
        gst_rate: 17, batch_tracking: true, expiry_tracking: true, is_active: true,
      };
    });
    const prodIds: { id: string; sell: number }[] = [];
    if (prodRows.length) {
      const { data } = await admin.from("products").insert(prodRows).select("id, selling_price");
      data?.forEach((d: any) => prodIds.push({ id: d.id, sell: Number(d.selling_price) }));
    }

    // GRN per product (1 batch each, qty 200)
    if (prodIds.length && supIds.length) {
      const grnRows = prodIds.map((_, i) => ({
        tenant_id, grn_number: `GRN-SBX-${Date.now()}-${i}`, supplier_id: rnd(supIds), date: today(-30),
      }));
      const { data: grns } = await admin.from("goods_received_notes").insert(grnRows).select("id");
      const grnItems: any[] = []; const moves: any[] = [];
      const expiry = today(365);
      prodIds.forEach((p, i) => {
        const grn_id = grns![i].id;
        grnItems.push({
          tenant_id, grn_id, product_id: p.id, item_name: `Batch B${i + 1}`,
          batch_number: `SBX-B${i + 1}`, quantity_ordered: 200, quantity_received: 200,
          expiry_date: expiry, rate: Math.round(p.sell / 1.4), amount: 200 * Math.round(p.sell / 1.4),
        });
        moves.push({
          tenant_id, product_id: p.id, movement_type: "purchase_in", quantity: 200,
          batch_number: `SBX-B${i + 1}`, reference_type: "grn", reference_id: grn_id, date: today(-30), notes: "Sandbox seed",
        });
      });
      if (grnItems.length) await admin.from("grn_items").insert(grnItems);
      if (moves.length) await admin.from("stock_movements").insert(moves);
    }

    // Sales orders
    const orderIds: string[] = [];
    for (let i = 0; i < counts.sales_orders && custIds.length && prodIds.length; i++) {
      const p = rnd(prodIds), qty = 5 + Math.floor(Math.random() * 15);
      const { data } = await admin.from("proforma_invoices").insert({
        tenant_id, proforma_number: `SO-SBX-${Date.now()}-${i}`,
        customer_id: rnd(custIds), date: today(-Math.floor(Math.random() * 14)),
        validity_days: 30,
        items: [{ product_id: p.id, name: "Item", quantity: qty, rate: p.sell, amount: qty * p.sell }],
        subtotal: qty * p.sell, gst: 0, total: qty * p.sell, status: "draft",
      }).select("id").single();
      if (data) orderIds.push(data.id);
    }

    // Sales invoices
    const invIds: { id: string; total: number; customer_id: string }[] = [];
    for (let i = 0; i < counts.invoices && custIds.length && prodIds.length; i++) {
      const p = rnd(prodIds), qty = 3 + Math.floor(Math.random() * 10);
      const total = qty * p.sell, cust = rnd(custIds);
      const { data: inv } = await admin.from("sales_invoices").insert({
        tenant_id, invoice_number: `SI-SBX-${Date.now()}-${i}`, customer_id: cust,
        date: today(-Math.floor(Math.random() * 14)), due_date: today(15),
        subtotal: total, gst_amount: 0, discount: 0, total, amount_paid: 0,
        status: "dispatched", approved_at: new Date().toISOString(),
      }).select("id").single();
      if (!inv) continue;
      await admin.from("sales_invoice_items").insert({
        tenant_id, invoice_id: inv.id, product_id: p.id, batch_number: `SBX-B${(prodIds.indexOf(p) + 1)}`,
        quantity: qty, rate: p.sell, amount: total, expiry_date: today(365),
      });
      await admin.from("stock_movements").insert({
        tenant_id, product_id: p.id, movement_type: "sale_out", quantity: qty,
        batch_number: `SBX-B${(prodIds.indexOf(p) + 1)}`,
        reference_type: "sales_invoice", reference_id: inv.id, date: today(),
      });
      invIds.push({ id: inv.id, total, customer_id: cust });
    }

    // Delivery notes
    for (let i = 0; i < Math.min(counts.delivery_notes, invIds.length); i++) {
      const inv = invIds[i];
      await admin.from("delivery_notes").insert({
        tenant_id, dn_number: `DN-SBX-${Date.now()}-${i}`, date: today(),
        reference_type: "sales_invoice", reference_id: inv.id, customer_id: inv.customer_id,
        items: [], status: "issued",
      });
    }

    // Payments
    for (let i = 0; i < Math.min(counts.payments, invIds.length); i++) {
      const inv = invIds[i];
      await admin.from("payments").insert({
        tenant_id, payment_number: `PAY-SBX-${Date.now()}-${i}`, type: "received",
        party_type: "customer", party_id: inv.customer_id, amount: inv.total,
        payment_method: "cash", bank_account_id: bank!.id, date: today(),
        invoice_id: inv.id, status: "active",
      });
    }

    return json({ ok: true, tenant_id, created: {
      suppliers: supIds.length, customers: custIds.length, products: prodIds.length,
      sales_orders: orderIds.length, invoices: invIds.length,
      delivery_notes: Math.min(counts.delivery_notes, invIds.length),
      payments: Math.min(counts.payments, invIds.length),
    }});
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, Math.floor(Number(n) || 0))); }
