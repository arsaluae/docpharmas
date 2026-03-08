import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch products
    const { data: products } = await supabase.from("products").select("id, name, stock_quantity, cost_price, selling_price, reorder_level");
    if (!products || products.length === 0) {
      return new Response(JSON.stringify({ alerts: [], whatsapp_url: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch last 90 days of sales
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const dateStr = ninetyDaysAgo.toISOString().split("T")[0];

    const { data: invoices } = await supabase.from("sales_invoices").select("id, date").gte("date", dateStr);
    const invoiceIds = (invoices || []).map(i => i.id);

    let salesByProduct: Record<string, number> = {};
    if (invoiceIds.length > 0) {
      // Fetch in chunks of 200
      for (let i = 0; i < invoiceIds.length; i += 200) {
        const chunk = invoiceIds.slice(i, i + 200);
        const { data: items } = await supabase.from("sales_invoice_items").select("product_id, quantity").in("invoice_id", chunk);
        (items || []).forEach(item => {
          if (item.product_id) {
            salesByProduct[item.product_id] = (salesByProduct[item.product_id] || 0) + Number(item.quantity);
          }
        });
      }
    }

    // Calculate alerts
    const alerts: any[] = [];
    const daysInPeriod = 90;

    for (const product of products) {
      const totalSold = salesByProduct[product.id] || 0;
      const avgDaily = totalSold / daysInPeriod;
      const currentStock = Number(product.stock_quantity);
      
      if (avgDaily <= 0) continue; // No sales = no consumption-based alert

      const daysUntilStockout = currentStock / avgDaily;
      
      let severity: string;
      if (daysUntilStockout <= 7) severity = "critical";
      else if (daysUntilStockout <= 14) severity = "warning";
      else if (daysUntilStockout <= 21) severity = "info";
      else continue; // More than 3 weeks of stock, skip

      alerts.push({
        product_id: product.id,
        product_name: product.name,
        current_stock: currentStock,
        avg_daily_consumption: Math.round(avgDaily * 100) / 100,
        days_until_stockout: Math.round(daysUntilStockout),
        severity,
      });
    }

    // Sort by severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => (severityOrder[a.severity as keyof typeof severityOrder] || 3) - (severityOrder[b.severity as keyof typeof severityOrder] || 3));

    // Store alerts in DB (clear old ones first)
    await supabase.from("reorder_alerts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    
    if (alerts.length > 0) {
      await supabase.from("reorder_alerts").insert(
        alerts.map(a => ({
          product_id: a.product_id,
          product_name: a.product_name,
          current_stock: a.current_stock,
          avg_daily_consumption: a.avg_daily_consumption,
          days_until_stockout: a.days_until_stockout,
          severity: a.severity,
        }))
      );
    }

    // Generate WhatsApp message URL if requested
    const body = await req.json().catch(() => ({}));
    let whatsapp_url: string | null = null;
    
    if (body.whatsapp_number && alerts.length > 0) {
      const criticalAlerts = alerts.filter(a => a.severity === "critical" || a.severity === "warning");
      if (criticalAlerts.length > 0) {
        const message = `⚠️ *PharmaZen Reorder Alert*\n\n${criticalAlerts.map(a => 
          `${a.severity === "critical" ? "🔴" : "🟡"} *${a.product_name}*\n   Stock: ${a.current_stock} | ${a.days_until_stockout} days left`
        ).join("\n\n")}\n\n_Generated ${new Date().toLocaleDateString("en-PK")}_`;
        
        const number = body.whatsapp_number.replace(/[^0-9]/g, "");
        whatsapp_url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
      }
    }

    return new Response(JSON.stringify({ alerts, whatsapp_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reorder-alerts error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
