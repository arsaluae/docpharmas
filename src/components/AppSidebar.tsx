import { useState } from "react";
import {
  LayoutDashboard, Users, Truck, Package, LogOut, FileText,
  ClipboardList, Wallet, CreditCard, Landmark,
  BarChart3, RotateCcw, Upload, Settings, Printer, ChevronDown,
  DollarSign, Building2, Keyboard, Moon, Sun,
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


import { useTheme } from "@/components/ThemeToggle";

const allSections = [
  { label: "Sales", icon: FileText, staffVisible: true, items: [
    { title: "Customers", url: "/customers", icon: Users, staffVisible: true },
    { title: "Sales Orders", url: "/proforma", icon: FileText, staffVisible: true },
    { title: "Warranty Invoices", url: "/warranty-invoices", icon: ClipboardList, staffVisible: true },
    { title: "Returns", url: "/sales-returns", icon: RotateCcw, staffVisible: true },
  ]},
  { label: "Purchase", icon: Truck, staffVisible: false, items: [
    { title: "Suppliers", url: "/suppliers", icon: Truck },
    { title: "Purchase Orders", url: "/purchase-proforma", icon: FileText },
    { title: "Returns", url: "/purchase-returns", icon: RotateCcw },
  ]},
  { label: "Inventory", icon: Package, staffVisible: true, items: [
    { title: "Products & Stock", url: "/products", icon: Package, staffVisible: true },
    { title: "Stock Movements", url: "/stock", icon: RotateCcw, staffVisible: true },
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
    <Sidebar collapsible="icon" className="mouj-dark-sidebar border-r" style={{ borderColor: "#1F1F3D" }}>
      {/* Brand header — wordmark */}
      <div className="mouj-brand">
        {collapsed ? (
          <span className="mouj-wordmark-short">M</span>
        ) : (
          <span className="mouj-wordmark">MOUJ <span className="mouj-wordmark-accent">PHARMA</span></span>
        )}
      </div>

      <SidebarContent className="mt-2 px-2 gap-0">
        {/* Dashboard */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/dashboard" end
                className={`mouj-nav-row ${location.pathname === "/dashboard" ? "is-active" : ""}`}>
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                {!collapsed && <span>Dashboard</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {!collapsed && <div className="mouj-divider mx-3" />}

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
                          className={`mouj-nav-row justify-center ${isActive ? "is-active" : ""}`}>
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
                    className={`mouj-nav-row justify-center ${reportsActive ? "is-active" : ""}`}>
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
              return (
                <Collapsible key={section.label} open={isOpen} onOpenChange={() => toggleSection(idx)}>
                  <CollapsibleTrigger className="mouj-section-label">
                    <span className="flex-1 text-left">{section.label}</span>
                    <ChevronDown className={`h-3 w-3 opacity-70 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu className="mt-0.5 mb-1 gap-0">
                      {section.items.map((item) => {
                        const isActive = matchUrl(item.url);
                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton asChild>
                              <NavLink to={item.url}
                                className={`mouj-sub-row ${isActive ? "is-active" : ""}`}>
                                <item.icon className="h-3.5 w-3.5 opacity-70" />
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

            <div className="mouj-divider mx-3" />

            {/* Reports — single link */}
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink to="/reports"
                    className={`mouj-nav-row ${reportsActive ? "is-active" : ""}`}>
                    <BarChart3 className="h-4 w-4 shrink-0" />
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

      <SidebarFooter className="mouj-footer">
        {!collapsed ? (
          <div className="flex items-center gap-1">
            <div className="mouj-tenant">
              <div className="mouj-avatar">{getInitials()}</div>
              <div className="flex-1 min-w-0">
                <span className="mouj-tenant-name">{tenantName || "My Company"}</span>
                <span className="mouj-tenant-role">{tenantRole === "owner" ? "Admin" : "Staff"}</span>
              </div>
            </div>

            <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
              <PopoverTrigger asChild>
                <button className="mouj-icon-btn" title="Settings">
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
                <div className="my-1 h-px bg-border/60" />
                <button onClick={() => { toggleTheme(); }} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors">
                  {theme === "light" ? <Moon className="h-4 w-4 opacity-70" /> : <Sun className="h-4 w-4 opacity-70" />}
                  {theme === "light" ? "Dark Mode" : "Light Mode"}
                </button>
                <button onClick={() => { setSettingsOpen(false); setShortcutsOpen(true); }} className="flex items-center gap-2.5 w-full px-2.5 py-2 rounded-md text-sm hover:bg-accent text-foreground transition-colors">
                  <Keyboard className="h-4 w-4 opacity-70" /> Keyboard Shortcuts
                  <kbd className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">?</kbd>
                </button>
              </PopoverContent>
            </Popover>

            <button onClick={handleLogout} className="mouj-icon-btn danger" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1 items-center">
            <button onClick={toggleTheme} className="mouj-icon-btn" title={theme === "light" ? "Dark Mode" : "Light Mode"}>
              {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>
            <button onClick={() => navigate("/settings")} className="mouj-icon-btn" title="Settings">
              <Settings className="h-4 w-4" />
            </button>
            <button onClick={handleLogout} className="mouj-icon-btn danger" title="Logout">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </SidebarFooter>

    </Sidebar>
  );
}
