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
    { title: "Delivery Notes", url: "/delivery-notes", icon: Truck },
    { title: "Warranty Invoices", url: "/warranty-invoices", icon: ClipboardList },
    { title: "Receive Payment", url: "/payments?tab=received", icon: Wallet },
    { title: "Returns", url: "/sales-returns", icon: RotateCcw },
  ]},
  { label: "Purchase", icon: Truck, staffVisible: false, items: [
    { title: "Suppliers", url: "/suppliers", icon: Truck },
    { title: "Purchase Orders", url: "/purchase-proforma", icon: FileText },
    { title: "Delivery Notes", url: "/delivery-notes", icon: Truck },
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

  const getInitials = () => {
    if (tenantName) return tenantName.slice(0, 2).toUpperCase();
    return tenantRole === "owner" ? "AD" : "ST";
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Brand header */}
      <div className="relative p-4 flex items-center gap-3 border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-transparent pointer-events-none" />
        <div className="relative w-10 h-10 rounded-2xl overflow-hidden shadow-md ring-2 ring-primary/15 transition-transform duration-300 hover:scale-105">
          <img src={docpharmasLogo} alt="DocPharmas" className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <div className="relative flex-1 min-w-0">
            <span className="font-heading font-bold text-foreground text-lg tracking-tight block leading-tight">DocPharmas</span>
            {tenantName && (
              <span className="text-[10px] text-muted-foreground truncate block mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                {tenantName}
              </span>
            )}
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
                <LayoutDashboard className={`h-4 w-4 transition-colors ${location.pathname === "/dashboard" ? "text-primary" : ""}`} />
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
                  <Shield className={`h-4 w-4 transition-colors ${location.pathname === "/admin" ? "text-primary" : ""}`} />
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
                          <item.icon className={`h-4 w-4 transition-colors ${isActive ? "text-primary" : ""}`} />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            );
          }

          return (
            <div key={section.label}>
              {idx > 0 && <div className="mx-3 my-2 h-px bg-border/30" />}
              <Collapsible open={isOpen} onOpenChange={() => toggleSection(idx)}>
                <CollapsibleTrigger className={`flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer select-none ${sectionActive ? "text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}>
                  <div className={`flex items-center justify-center w-6 h-6 rounded-lg transition-colors ${sectionActive ? "bg-primary/10" : "bg-muted"}`}>
                    <section.icon className={`h-3.5 w-3.5 transition-colors ${sectionActive ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className="flex-1 text-left text-[10px] uppercase tracking-[0.15em] font-bold">{section.label}</span>
                  {sectionActive && <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1" />}
                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenu className="ml-3 mt-0.5 border-l-2 border-primary/10 pl-2">
                    {section.items.map((item) => {
                      const isActive = matchUrl(item.url);
                      return (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild>
                            <NavLink to={item.url}
                              className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] transition-all ${isActive ? "pharma-sidebar-active text-primary font-medium" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"}`}
                              activeClassName="pharma-sidebar-active text-primary font-medium">
                              {isActive && (
                                <div className="absolute left-[-10px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full pharma-accent-line" />
                              )}
                              <item.icon className={`h-3.5 w-3.5 transition-colors ${isActive ? "text-primary" : ""}`} />
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
            </div>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-border/40">
        {tenantRole && !collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1 rounded-xl bg-muted/50">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-[11px] font-bold shadow-sm">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-semibold text-foreground block truncate">
                {tenantName || "My Company"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {tenantRole === "owner" ? "Admin" : "Staff"}
              </span>
            </div>
          </div>
        )}
        <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all w-full press-scale">
          <LogOut className="h-4 w-4" />{!collapsed && <span>Logout</span>}
        </button>
      </SidebarFooter>
    </Sidebar>
  );
}
