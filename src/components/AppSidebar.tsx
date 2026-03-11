import { useState } from "react";
import {
  LayoutDashboard, Users, Truck, Package, LogOut, FileText,
  ClipboardList, Wallet, CreditCard, Landmark,
  BarChart3, RotateCcw, Upload, Settings, Printer, ChevronDown, Shield, CreditCard as SubIcon,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Sidebar, SidebarContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import docpharmasLogo from "@/assets/docpharmas-logo.jpg";

const allSections = [
  { label: "Sales", icon: FileText, staffVisible: true, items: [
    { title: "Customers", url: "/customers", icon: Users },
    { title: "Sales Invoices", url: "/proforma", icon: FileText },
    { title: "Warranty Invoices", url: "/warranty-invoices", icon: ClipboardList },
    { title: "Receive Payment", url: "/payments?tab=received", icon: Wallet },
    { title: "Returns", url: "/sales-returns", icon: RotateCcw },
  ]},
  { label: "Purchase", icon: Truck, staffVisible: false, items: [
    { title: "Suppliers", url: "/suppliers", icon: Truck },
    { title: "Purchase Orders", url: "/purchase-proforma", icon: FileText },
    { title: "Make Payment", url: "/payments?tab=made", icon: Wallet },
    { title: "Returns", url: "/purchase-returns", icon: RotateCcw },
  ]},
  { label: "Inventory", icon: Package, staffVisible: false, items: [
    { title: "Products & Stock", url: "/products", icon: Package },
    { title: "Stock Movements", url: "/stock", icon: RotateCcw },
  ]},
  { label: "Printing", icon: Printer, staffVisible: false, items: [
    { title: "Printers", url: "/printers", icon: Printer },
    { title: "Print Jobs", url: "/print-jobs", icon: ClipboardList },
  ]},
  { label: "Finance", icon: Wallet, staffVisible: false, items: [
    { title: "Payments", url: "/payments", icon: Wallet },
    { title: "Credit Notes", url: "/credit-notes", icon: FileText },
    { title: "Expenses", url: "/expenses", icon: CreditCard },
    { title: "Staff & Salaries", url: "/salaries", icon: Users },
    { title: "Bank Accounts", url: "/bank", icon: Landmark },
  ]},
  { label: "Reports", icon: BarChart3, staffVisible: false, items: [
    { title: "Reports", url: "/reports", icon: BarChart3 },
    { title: "AI Insights", url: "/insights", icon: BarChart3 },
  ]},
  { label: "Settings", icon: Settings, staffVisible: false, items: [
    { title: "Company Settings", url: "/settings", icon: Settings },
    { title: "Data Import", url: "/import", icon: Upload },
    { title: "Subscription", url: "/subscription", icon: SubIcon },
  ]},
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantRole, isAdmin, tenantName } = useTenant();

  const matchUrl = (itemUrl: string) => {
    const [path, qs] = itemUrl.split("?");
    if (qs) return location.pathname === path && location.search === `?${qs}`;
    return location.pathname === path || (path !== "/" && location.pathname.startsWith(path));
  };

  const sections = tenantRole === "staff" && !isAdmin
    ? allSections.filter(s => s.staffVisible)
    : allSections;

  const activeSectionIdx = sections.findIndex(s =>
    s.items.some(i => matchUrl(i.url))
  );

  const [openSections, setOpenSections] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    if (activeSectionIdx >= 0) initial[activeSectionIdx] = true;
    return initial;
  });

  const toggleSection = (idx: number) => {
    setOpenSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleLogout = async () => { await supabase.auth.signOut(); navigate("/auth"); };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Brand header */}
      <div className="p-4 flex items-center gap-3 border-b border-border/50">
        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md ring-2 ring-primary/20">
          <img src={docpharmasLogo} alt="DocPharmas" className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <span className="font-heading font-bold text-foreground text-lg tracking-tight block">DocPharmas</span>
            {tenantName && <span className="text-[10px] text-muted-foreground truncate block">{tenantName}</span>}
          </div>
        )}
      </div>
      <SidebarContent className="mt-2 px-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/dashboard" end
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/dashboard" ? "pharma-sidebar-active text-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
                activeClassName="pharma-sidebar-active text-primary font-medium">
                <LayoutDashboard className={`h-4 w-4 ${location.pathname === "/dashboard" ? "text-primary" : ""}`} />
                {!collapsed && <span>Dashboard</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {isAdmin && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink to="/admin"
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${location.pathname === "/admin" ? "pharma-sidebar-active text-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
                  activeClassName="pharma-sidebar-active text-primary font-medium">
                  <Shield className={`h-4 w-4 ${location.pathname === "/admin" ? "text-primary" : ""}`} />
                  {!collapsed && <span>Admin Panel</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}

        {sections.map((section, idx) => {
          const isOpen = openSections[idx] || false;
          const sectionActive = section.items.some(i => matchUrl(i.url));

          if (collapsed) {
            return (
              <SidebarMenu key={section.label}>
                {section.items.map((item) => {
                  const isActive = matchUrl(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url}
                          className={`flex items-center justify-center px-2 py-2 rounded-xl transition-all ${isActive ? "pharma-sidebar-active text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
                          activeClassName="pharma-sidebar-active text-primary">
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            );
          }

          return (
            <Collapsible key={section.label} open={isOpen} onOpenChange={() => toggleSection(idx)}>
              <CollapsibleTrigger className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer select-none ${sectionActive ? "text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-lg ${sectionActive ? "bg-primary/10" : "bg-muted"}`}>
                  <section.icon className={`h-3.5 w-3.5 ${sectionActive ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <span className="flex-1 text-left text-xs uppercase tracking-widest">{section.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenu className="ml-3 mt-0.5 border-l border-primary/10 pl-2">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.url || (item.url !== "/" && location.pathname.startsWith(item.url));
                    return (
                      <SidebarMenuItem key={item.url}>
                        <SidebarMenuButton asChild>
                          <NavLink to={item.url}
                            className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-all ${isActive ? "pharma-sidebar-active text-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
                            activeClassName="pharma-sidebar-active text-primary font-medium">
                            <item.icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : ""}`} />
                            <span>{item.title}</span>
                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-border/50">
        {tenantRole && !collapsed && (
          <div className="px-3 py-1.5 mb-1">
            <span className="text-[10px] font-medium uppercase tracking-widest text-primary/60">
              {tenantRole === "owner" ? "Admin Account" : "Staff Account"}
            </span>
          </div>
        )}
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full">
          <LogOut className="h-4 w-4" />{!collapsed && <span>Logout</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
