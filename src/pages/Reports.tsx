import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Scale, BarChart3, Clock, DollarSign, Package, ShieldCheck, Layers, Boxes, UserCheck, Truck, ClipboardList, MapPin, Sparkles, LineChart, Activity, ArchiveX, ShieldAlert, Wallet, Globe2, Lock } from "lucide-react";

const reportSections = [
  { label: "Intelligence", items: [
    { title: "AI Insights", desc: "AI-generated business observations", url: "/insights", icon: Sparkles, color: "text-primary" },
  ]},
  { label: "Sales Analytics", items: [
    { title: "Sales Trend", desc: "Monthly revenue & MoM growth", url: "/reports/sales-trend", icon: LineChart, color: "text-primary" },
    { title: "Product Performance", desc: "Units, revenue, margin & slow-movers", url: "/reports/product-performance", icon: Activity, color: "text-primary" },
  ]},
  { label: "Purchase Analytics", items: [
    { title: "Supplier Performance", desc: "Purchases, GRNs & return rate", url: "/reports/supplier-performance", icon: Truck, color: "text-primary" },
  ]},
  { label: "Financial", items: [
    { title: "Profit & Loss", desc: "Revenue, costs & net income", url: "/reports/pl", icon: TrendingUp, color: "text-primary" },
    { title: "Balance Sheet", desc: "Assets, liabilities & equity", url: "/reports/balance-sheet", icon: Scale, color: "text-primary" },
    { title: "Cash Flow", desc: "Cash inflows & outflows", url: "/reports/cash-flow", icon: BarChart3, color: "text-warning" },
    { title: "Daily Cash Position", desc: "Live bank balances & 30-day flow", url: "/reports/daily-cash", icon: Wallet, color: "text-primary" },
    { title: "Accounting Periods", desc: "Lock periods to prevent backdated edits", url: "/accounting/periods", icon: Lock, color: "text-destructive" },
  ]},
  { label: "Receivables & Payables", items: [
    { title: "Receivables Aging", desc: "Outstanding customer balances", url: "/reports/receivables", icon: Clock, color: "text-warning" },
    { title: "Payables Aging", desc: "Outstanding supplier balances", url: "/reports/payables", icon: DollarSign, color: "text-destructive" },
  ]},
  { label: "Inventory", items: [
    { title: "Product Costing", desc: "Cost analysis & margins", url: "/reports/product-costing", icon: Package, color: "text-warning" },
    { title: "Item-wise Report", desc: "Sales & purchase by item", url: "/reports/item-wise", icon: Layers, color: "text-primary" },
    { title: "Batch-wise Report", desc: "Batch tracking & expiry", url: "/reports/batch-wise", icon: Boxes, color: "text-warning" },
    { title: "Slow & Dead Stock", desc: "Products idle 60+ days", url: "/reports/slow-dead-stock", icon: ArchiveX, color: "text-destructive" },
    { title: "Stock Audit", desc: "Cross-check live vs derived stock", url: "/stock-audit", icon: ShieldAlert, color: "text-destructive" },
  ]},
  { label: "Party Reports", items: [
    { title: "Customer-wise", desc: "Sales & balance by customer", url: "/reports/customer-wise", icon: UserCheck, color: "text-primary" },
    { title: "Supplier-wise", desc: "Purchases & balance by supplier", url: "/reports/supplier-wise", icon: Truck, color: "text-primary" },
    { title: "Product Allocations", desc: "Products allocated to parties with rates", url: "/reports/allocations", icon: ClipboardList, color: "text-warning" },
  ]},
  { label: "Geographic", items: [
    { title: "City-wise Sales", desc: "Revenue, orders & top product per city", url: "/reports/citywise-sales", icon: Globe2, color: "text-primary" },
    { title: "Area-wise Sales", desc: "Drill into area performance within cities", url: "/reports/area-sales", icon: MapPin, color: "text-primary" },
    { title: "Vacant Areas", desc: "Cities × products without coverage", url: "/reports/vacant-areas", icon: MapPin, color: "text-destructive" },
  ]},
  { label: "Compliance", items: [
    { title: "Tax & DRAP", desc: "GST, WHT & DRAP compliance", url: "/reports/tax", icon: ShieldCheck, color: "text-destructive" },
  ]},
];

export default function Reports() {
  const navigate = useNavigate();

  return (
    <AppLayout title="Reports" subtitle="Financial, inventory & compliance reports">
      <div className="space-y-8">
        {reportSections.map(section => (
          <div key={section.label}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">{section.label}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.items.map(item => (
                <Card key={item.url} className="glass-card hover:shadow-md transition-all cursor-pointer group" onClick={() => navigate(item.url)}>
                  <CardContent className="p-5 flex items-start gap-4">
                    <div className="p-2.5 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors">
                      <item.icon className={`h-5 w-5 ${item.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
