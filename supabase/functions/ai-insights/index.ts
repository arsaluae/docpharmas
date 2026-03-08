import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { products, customers } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a pharmaceutical business analyst AI. Analyze the provided sales data for a pharma distribution company in Pakistan.

The data includes:
- Products with their monthly sales quantities (last 6 months), current stock, cost price, selling price, and reorder level
- Customers with their monthly purchase totals

Analyze this data and call the "business_insights" function with your analysis. Be specific with product names and numbers. Base predictions on actual trends in the data. If data is insufficient, say so honestly.

For demand_forecast: Look at sales trends and predict next month quantities.
For reorder_alerts: Calculate days until stockout based on average monthly consumption vs current stock.
For slow_movers: Identify products with declining month-over-month sales.
For customer_insights: Identify customers with growing or declining purchase patterns.
For margin_warnings: Flag products with margins below 10% or negative.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "business_insights",
          description: "Return structured business insights and forecasts",
          parameters: {
            type: "object",
            properties: {
              demand_forecast: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product_name: { type: "string" },
                    last_month_qty: { type: "number" },
                    predicted_qty: { type: "number" },
                    confidence: { type: "number", description: "0-100 percentage" },
                    trend: { type: "string", enum: ["rising", "stable", "declining"] },
                  },
                  required: ["product_name", "last_month_qty", "predicted_qty", "confidence", "trend"],
                  additionalProperties: false,
                },
              },
              reorder_alerts: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product_name: { type: "string" },
                    current_stock: { type: "number" },
                    avg_monthly_consumption: { type: "number" },
                    days_until_stockout: { type: "number" },
                    severity: { type: "string", enum: ["critical", "warning", "info"] },
                  },
                  required: ["product_name", "current_stock", "avg_monthly_consumption", "days_until_stockout", "severity"],
                  additionalProperties: false,
                },
              },
              slow_movers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product_name: { type: "string" },
                    decline_percent: { type: "number" },
                    suggestion: { type: "string" },
                  },
                  required: ["product_name", "decline_percent", "suggestion"],
                  additionalProperties: false,
                },
              },
              customer_insights: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    customer_name: { type: "string" },
                    trend: { type: "string", enum: ["growing", "declining", "stable"] },
                    change_percent: { type: "number" },
                    note: { type: "string" },
                  },
                  required: ["customer_name", "trend", "change_percent", "note"],
                  additionalProperties: false,
                },
              },
              margin_warnings: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    product_name: { type: "string" },
                    margin_percent: { type: "number" },
                    cost_price: { type: "number" },
                    selling_price: { type: "number" },
                    recommendation: { type: "string" },
                  },
                  required: ["product_name", "margin_percent", "cost_price", "selling_price", "recommendation"],
                  additionalProperties: false,
                },
              },
              summary: { type: "string", description: "2-3 sentence executive summary of the business health" },
            },
            required: ["demand_forecast", "reorder_alerts", "slow_movers", "customer_insights", "margin_warnings", "summary"],
            additionalProperties: false,
          },
        },
      },
    ];

    const userMessage = `Here is the business data to analyze:

PRODUCTS DATA:
${JSON.stringify(products, null, 1)}

CUSTOMERS DATA:
${JSON.stringify(customers, null, 1)}

Please analyze this data and provide comprehensive business insights.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "business_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a minute." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "AI did not return structured insights" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const insights = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
