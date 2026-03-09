import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import {
  Brain, AlertTriangle, TrendingDown, TrendingUp, Users, DollarSign,
  Sparkles, PackageX, ArrowDown, ArrowUp, Minus, RefreshCw,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Cell } from "recharts";

interface InsightsData {
  demand_forecast: { product_name: string; last_month_qty: number; predicted_qty: number; confidence: number; trend: string }[];
  reorder_alerts: { product_name: string; current_stock: number; avg_monthly_consumption: number; days_until_stockout: number; severity: string }[];
  slow_movers: { product_name: string; decline_percent: number; suggestion: string }[];
  customer_insights: { customer_name: string; trend: string; change_percent: number; note: string }[];
  margin_warnings: { product_name: string; margin_percent: number; cost_price: number; selling_price: number; recommendation: string }[];
  summary: string;
}

export default function AIInsights() {
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);

  const generateInsights = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const sixMonthsAgo = new Date(today);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const sixMonthsAgoStr = sixMonthsAgo.toISOString().split("T")[0];
      const todayStr = today.toISOString().split("T")[0];

      const [productsRes, invoicesRes, itemsRes, customersRes] = await Promise.all([
        supabase.from("products").select("id, name, stock_quantity, cost_price, selling_price, reorder_level"),
        supabase.from("sales_invoices").select("id, date, subtotal, customer_id").gte("date", sixMonthsAgoStr).lte("date", todayStr),
        supabase.from("sales_invoice_items").select("product_id, quantity, invoice_id"),
        supabase.from("customers").select("id, name"),
      ]);

      const products = productsRes.data || [];
      const invoices = invoicesRes.data || [];
      const items = itemsRes.data || [];
      const customers = customersRes.data || [];

      const invoiceDateMap: Record<string, string> = {};
      invoices.forEach(inv => { invoiceDateMap[inv.id] = inv.date; });

      const custMap: Record<string, string> = {};
      customers.forEach(c => { custMap[c.id] = c.name; });

      // Build product monthly sales
      const productMonthly: Record<string, Record<string, number>> = {};
      items.forEach(item => {
        if (!item.product_id || !invoiceDateMap[item.invoice_id]) return;
        const month = invoiceDateMap[item.invoice_id].slice(0, 7);
        if (!productMonthly[item.product_id]) productMonthly[item.product_id] = {};
        productMonthly[item.product_id][month] = (productMonthly[item.product_id][month] || 0) + Number(item.quantity);
      });

      const productPayload = products.map(p => ({
        name: p.name,
        stock: Number(p.stock_quantity),
        cost: Number(p.cost_price),
        price: Number(p.selling_price),
        reorder: Number(p.reorder_level),
        monthly_sales: productMonthly[p.id] || {},
      }));

      // Build customer monthly totals
      const customerMonthly: Record<string, Record<string, number>> = {};
      invoices.forEach(inv => {
        if (!inv.customer_id) return;
        const month = inv.date.slice(0, 7);
        if (!customerMonthly[inv.customer_id]) customerMonthly[inv.customer_id] = {};
        customerMonthly[inv.customer_id][month] = (customerMonthly[inv.customer_id][month] || 0) + Number(inv.subtotal);
      });

      const customerPayload = Object.entries(customerMonthly).map(([id, months]) => ({
        name: custMap[id] || "Unknown",
        monthly_totals: months,
      }));

      const { data, error } = await supabase.functions.invoke("ai-insights", {
        body: { products: productPayload, customers: customerPayload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setInsights(data);
      localStorage.setItem("ai_insights_timestamp", new Date().toISOString());
      toast({ title: "Insights generated", description: "AI analysis complete" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to generate insights", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const trendIcon = (trend: string) => {
    if (trend === "rising" || trend === "growing") return <ArrowUp className="h-4 w-4 text-emerald-500" />;
    if (trend === "declining") return <ArrowDown className="h-4 w-4 text-destructive" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const severityColor = (s: string) => {
    if (s === "critical") return "destructive";
    if (s === "warning") return "secondary";
    return "outline";
  };

  const headerActions = (
    <Button onClick={generateInsights} disabled={loading} className="gap-2">
      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {loading ? "Analyzing..." : "Generate Insights"}
    </Button>
  );

  return (
    <AppLayout title="AI Business Insights" subtitle="AI-powered demand forecasting & data analysis" headerActions={headerActions}>
      <div className="space-y-6">
        {!insights && !loading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <Brain className="h-16 w-16 text-muted-foreground/30" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground">No insights generated yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Click "Generate Insights" to analyze your sales data with AI</p>
              </div>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Card key={i}>
                <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {insights && !loading && (
          <>
            {/* Summary */}
            <Card className="border-l-4 border-l-primary bg-primary/5">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm text-foreground">{insights.summary}</p>
                </div>
              </CardContent>
            </Card>

            {/* Demand Forecast */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Demand Forecast (Next Month)
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {insights.demand_forecast.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Insufficient data for forecasting</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Last Month</TableHead>
                        <TableHead className="text-right">Predicted</TableHead>
                        <TableHead className="text-right">Confidence</TableHead>
                        <TableHead className="text-center">Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insights.demand_forecast.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{item.product_name}</TableCell>
                          <TableCell className="text-right font-mono text-sm">{item.last_month_qty}</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">{item.predicted_qty}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="outline" className="font-mono text-xs">{item.confidence}%</Badge>
                          </TableCell>
                          <TableCell className="text-center">{trendIcon(item.trend)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Reorder Alerts */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" /> Reorder Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-4">
                {insights.reorder_alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">All stock levels healthy</p>
                ) : (
                  <div className="space-y-2.5">
                    {insights.reorder_alerts.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Badge variant={severityColor(item.severity) as any} className="text-[10px] uppercase">{item.severity}</Badge>
                          <span className="text-sm font-medium">{item.product_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>Stock: <strong className="text-foreground">{item.current_stock}</strong></span>
                          <span>Avg/mo: <strong className="text-foreground">{item.avg_monthly_consumption}</strong></span>
                          <Badge variant={item.days_until_stockout < 15 ? "destructive" : "secondary"} className="font-mono">
                            {item.days_until_stockout} days
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Slow Movers + Margin Warnings side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <PackageX className="h-4 w-4 text-muted-foreground" /> Slow Movers
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  {insights.slow_movers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No declining products detected</p>
                  ) : (
                    <div className="space-y-2.5">
                      {insights.slow_movers.map((item, i) => (
                        <div key={i} className="py-2 px-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium flex items-center gap-1.5">
                              <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                              {item.product_name}
                            </span>
                            <Badge variant="destructive" className="font-mono text-xs">-{item.decline_percent}%</Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">{item.suggestion}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-heading flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-amber-500" /> Margin Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-4">
                  {insights.margin_warnings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">All margins healthy</p>
                  ) : (
                    <div className="space-y-2.5">
                      {insights.margin_warnings.map((item, i) => (
                        <div key={i} className="py-2 px-3 rounded-lg bg-muted/50">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{item.product_name}</span>
                            <Badge variant={item.margin_percent < 0 ? "destructive" : "secondary"} className="font-mono text-xs">
                              {item.margin_percent.toFixed(1)}%
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Cost: PKR {item.cost_price.toLocaleString()} → Sell: PKR {item.selling_price.toLocaleString()} · {item.recommendation}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Customer Insights */}
            <Card>
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> Customer Trends
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-4">
                {insights.customer_insights.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Insufficient customer data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-center">Trend</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                        <TableHead>Note</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {insights.customer_insights.map((item, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium text-sm">{item.customer_name}</TableCell>
                          <TableCell className="text-center">{trendIcon(item.trend)}</TableCell>
                          <TableCell className="text-right">
                            <span className={`font-mono text-sm ${item.change_percent >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                              {item.change_percent >= 0 ? "+" : ""}{item.change_percent.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{item.note}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
