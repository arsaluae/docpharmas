import { useState } from "react";
import {
  LayoutDashboard, Users, Truck, Package, LogOut, FileText,
  ClipboardList, Wallet, CreditCard, Landmark,
  BarChart3, RotateCcw, Upload, Settings, Printer, ChevronDown, Shield,
  CreditCard as SubIcon, DollarSign, Building2, Keyboard, Moon, Sun,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import docpharmasLogo from "@/assets/docpharmas-logo.jpg";
import { useTheme } from "@/components/ThemeToggle";

const allSections = [
  { label: "Sales", icon: FileText, staffVisible: true, items: [
    { title: "Customers", url: "/customers", icon: Users },
    { title: "Sales Invoices", url: "/proforma", icon: FileText },
    { title: "Sales Agents", url: "/sales-agents", icon: Users },
    { title: "Delivery Notes", url: "/delivery-notes", icon: Truck },
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
    { title: "Landed Costs", url: "/landed-costs", icon: DollarSign },
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
];

const shortcuts = [
  { keys: ["Ctrl", "K"], desc: "Open search / command palette" },
  { keys: ["Ctrl", "N"], desc: "New record (context-aware)" },
  { keys: ["Esc"], desc: "Close dialog / palette" },
  { keys: ["?"], desc: "Show this shortcuts help" },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { tenantRole, isAdmin, tenantName } = useTenant();
  const { theme, toggleTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

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

  const goAndClose = (url: string) => {
    setSettingsOpen(false);
    navigate(url);
  };

  const reportsActive = location.pathname.startsWith("/reports") || location.pathname === "/insights";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      {/* Brand header — clean, no pulse, no tenant subtitle */}
      <div className="p-4 flex items-center gap-3 border-b border-sidebar-border/60">
        <div className="w-9 h-9 rounded-xl overflow-hidden ring-1 ring-border/40">
          <img src={docpharmasLogo} alt="DocPharmas" className="w-full h-full object-cover" />
        </div>
        {!collapsed && (
          <span className="font-heading font-semibold text-foreground text-[15px] tracking-tight truncate">
            DocPharmas
          </span>
        )}
      </div>

      <SidebarContent className="mt-3 px-2 gap-0">
        {/* Dashboard */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/dashboard" end
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  location.pathname === "/dashboard"
                    ? "bg-primary/12 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                }`}>
                <LayoutDashboard className="h-4 w-4" />
                {!collapsed && <span>Dashboard</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {!collapsed && <div className="mx-3 my-2 h-px bg-sidebar-border/50" />}

        {/* Collapsed mode: flat icon list */}
        {collapsed ? (
          <>
            {sections.map((section) => (
              <SidebarMenu key={section.label}>
                {section.items.map((item) => {
                  const isActive = matchUrl(item.url);
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url}
                          className={`flex items-center justify-center px-2 py-2 rounded-lg transition-colors ${
                            isActive ? "bg-primary/12 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
                          }`}>
                          <item.icon className="h-4 w-4" />
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            ))}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/reports"
                    className={`flex items-center justify-center px-2 py-2 rounded-lg transition-colors ${
                      reportsActive ? "bg-primary/12 text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}>
                    <BarChart3 className="h-4 w-4" />
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        ) : (
          <>
            {sections.map((section, idx) => {
              const isOpen = openSections[idx] || false;
              const sectionActive = section.items.some(i => matchUrl(i.url));
              return (
                <Collapsible key={section.label} open={isOpen} onOpenChange={() => toggleSection(idx)}>
                  <CollapsibleTrigger className={`group flex items-center w-full px-3 py-2 rounded-lg text-[12px] transition-colors cursor-pointer select-none ${
                    sectionActive ? "text-foreground" : "text-sidebar-foreground hover:text-foreground"
                  }`}>
                    <span className="flex-1 text-left font-medium tracking-wide">{section.label}</span>
                    <ChevronDown className={`h-3.5 w-3.5 opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu className="ml-1 mt-0.5 mb-1">
                      {section.items.map((item) => {
                        const isActive = matchUrl(item.url);
                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton asChild>
                              <NavLink to={item.url}
                                className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-[13px] transition-colors ${
                                  isActive
                                    ? "bg-primary/12 text-primary font-medium"
                                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                                }`}>
                                <item.icon className="h-3.5 w-3.5 opacity-80" />
                                <span>{item.title}</span>
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

            <div className="mx-3 my-2 h-px bg-sidebar-border/50" />

            {/* Reports — single link */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/reports"
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                      reportsActive
                        ? "bg-primary/12 text-primary font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                    }`}>
                    <BarChart3 className="h-4 w-4" />
                    <span>Reports</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </>
        )}
      </SidebarContent>

      {/* Shortcuts help dialog (mounted globally so popover can trigger it) */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Keyboard Shortcuts</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {shortcuts.map((s) => (
              <div key={s.desc} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-foreground">{s.desc}</span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="min-w-[28px] text-center text-xs font-mono px-2 py-1 rounded-md bg-muted text-muted-foreground border border-border">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <SidebarFooter className="p-2 border-t border-sidebar-border/60">
        {!collapsed ? (
          <div className="flex items-center gap-1.5 px-1">
            {/* Tenant chip */}
            <div className="flex items-center gap-2 flex-1 min-w-0 px-2 py-1.5 rounded-lg hover:bg-sidebar-accent/60 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                {getInitials()}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-medium text-foreground block truncate leading-tight">
                  {tenantName || "My Company"}
                </span>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {tenantRole === "owner" ? "Admin" : "Staff"}
                </span>
              </div>
            </div>

            {/* Settings popover */}
            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <button
                  className="p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="end" className="w-60 p-1.5">
                <button onClick={() => goAndClose("/settings")} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors">
                  <Building2 className="h-4 w-4 opacity-70" /> Company Settings
                </button>
                <button onClick={() => goAndClose("/import")} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors">
                  <Upload className="h-4 w-4 opacity-70" /> Data Import
                </button>
                <button onClick={() => goAndClose("/subscription")} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors">
                  <SubIcon className="h-4 w-4 opacity-70" /> Subscription
                </button>
                {isAdmin && (
                  <button onClick={() => goAndClose("/admin")} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors">
                    <Shield className="h-4 w-4 opacity-70" /> Admin Panel
                  </button>
                )}
                <div className="my-1 h-px bg-border/60" />
                <button
                  onClick={() => { toggleTheme(); }}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors"
                >
                  {theme === "light" ? <Moon className="h-4 w-4 opacity-70" /> : <Sun className="h-4 w-4 opacity-70" />}
                  {theme === "light" ? "Dark Mode" : "Light Mode"}
                </button>
                <button
                  onClick={() => { setSettingsOpen(false); setShortcutsOpen(true); }}
                  className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors"
                >
                  <Keyboard className="h-4 w-4 opacity-70" /> Keyboard Shortcuts
                  <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">?</kbd>
                </button>
              </PopoverContent>
            </Popover>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 items-center">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              title={theme === "light" ? "Dark Mode" : "Light Mode"}
            >
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="p-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
              title="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
