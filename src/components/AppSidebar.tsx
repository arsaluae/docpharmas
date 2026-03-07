import {
  LayoutDashboard, Users, Truck, Package, LogOut, Pill, FileText,
  ClipboardList, Wallet, CreditCard, Landmark,
  BarChart3, RotateCcw, Upload, Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupLabel, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const sections = [
  { label: "Overview", items: [{ title: "Dashboard", url: "/", icon: LayoutDashboard }] },
  { label: "Sales", items: [
    { title: "Customers", url: "/customers", icon: Users },
    { title: "Sales Orders", url: "/proforma", icon: FileText },
    { title: "Warranty Invoices", url: "/warranty-invoices", icon: ClipboardList },
    { title: "Returns", url: "/sales-returns", icon: RotateCcw },
  ]},
  { label: "Purchases", items: [
    { title: "Suppliers", url: "/suppliers", icon: Truck },
    { title: "Purchases", url: "/purchase-proforma", icon: FileText },
    { title: "Returns", url: "/purchase-returns", icon: RotateCcw },
  ]},
  { label: "Inventory", items: [
    { title: "Products & Stock", url: "/products", icon: Package },
  ]},
  { label: "Finance", items: [
    { title: "Payments", url: "/payments", icon: Wallet },
    { title: "Expenses", url: "/expenses", icon: CreditCard },
    { title: "Bank Accounts", url: "/bank", icon: Landmark },
  ]},
  { label: "Reports", items: [
    { title: "Reports", url: "/reports", icon: BarChart3 },
  ]},
  { label: "Settings", items: [
    { title: "Company Settings", url: "/settings", icon: Settings },
    { title: "Data Import", url: "/import", icon: Upload },
  ]},
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  return (
    <Sidebar collapsible="icon" className="border-r-0 bg-sidebar">
      <div className="p-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center glow-primary">
          <Pill className="h-4 w-4 text-primary" />
        </div>
        {!collapsed && <span className="font-heading font-bold text-foreground text-lg tracking-tight">PharmBooks</span>}
      </div>
      <SidebarContent className="mt-2">
        {sections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/60 px-3">{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = location.pathname === item.url || (item.url !== "/" && location.pathname.startsWith(item.url));
                  return (
                    <SidebarMenuItem key={item.title + item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end={item.url === "/"}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive ? "bg-primary/10 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
                          activeClassName="bg-primary/10 text-primary">
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          {!collapsed && <span>{item.title}</span>}
                          {isActive && !collapsed && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="p-3">
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-all w-full">
          <LogOut className="h-4 w-4" />{!collapsed && <span>Logout</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
