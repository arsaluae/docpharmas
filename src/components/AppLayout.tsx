import { ReactNode, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CalendarDays, Search, ChevronRight, Sparkles, Bell } from "lucide-react";
import { useGlobalShortcuts } from "@/components/KeyboardShortcuts";

const RECENT_KEY = "lovable:recent-pages";
const MAX_RECENT = 5;
function addRecentPage(title: string, url: string) {
  try {
    const recent = (JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as { title: string; url: string }[])
      .filter(r => r.url !== url);
    recent.unshift({ title, url });
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* ignore */ }
}

const CommandPalette = lazy(() =>
  import("@/components/CommandPalette").then(m => ({ default: m.CommandPalette }))
);

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
}

const BREADCRUMB_MAP: Record<string, { section?: string; label: string }> = {
  "/dashboard": { label: "Dashboard" },
  "/customers": { section: "Sales", label: "Customers" },
  "/proforma": { section: "Sales", label: "Sales Invoices" },
  "/delivery-notes": { section: "Sales", label: "Delivery Notes" },
  "/warranty-invoices": { section: "Sales", label: "Warranty Invoices" },
  "/sales-returns": { section: "Sales", label: "Returns" },
  "/suppliers": { section: "Purchase", label: "Suppliers" },
  "/purchase-proforma": { section: "Purchase", label: "Purchase Orders" },
  "/purchase-returns": { section: "Purchase", label: "Returns" },
  "/products": { section: "Inventory", label: "Products & Stock" },
  "/stock": { section: "Inventory", label: "Stock Movements" },
  "/printers": { section: "Printing", label: "Printers" },
  "/print-jobs": { section: "Printing", label: "Print Jobs" },
  "/payments": { section: "Finance", label: "Payments" },
  "/credit-notes": { section: "Finance", label: "Credit Notes" },
  "/expenses": { section: "Finance", label: "Expenses" },
  "/salaries": { section: "Finance", label: "Staff & Salaries" },
  "/bank": { section: "Finance", label: "Bank Accounts" },
  "/reports": { section: "Reports", label: "Reports" },
  "/insights": { section: "Reports", label: "AI Insights" },
  "/settings": { section: "Settings", label: "Company Settings" },
  "/import": { section: "Settings", label: "Data Import" },
};

type Tab = "jump" | "ask" | "alerts";

export function AppLayout({ title, subtitle, children, headerActions }: AppLayoutProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteTab, setPaletteTab] = useState<Tab>("jump");
  const location = useLocation();

  const openPalette = useCallback((tab: Tab = "jump") => {
    setPaletteTab(tab);
    setPaletteOpen(true);
  }, []);
  useGlobalShortcuts({ onOpenPalette: () => openPalette("jump") });

  useEffect(() => {
    const crumb = BREADCRUMB_MAP[location.pathname];
    if (crumb) addRecentPage(crumb.label, location.pathname);
  }, [location.pathname]);

  const crumb = BREADCRUMB_MAP[location.pathname];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          {/* Top bar — premium light chrome */}
          <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 sm:px-6 h-14 flex items-center gap-3">
            <SidebarTrigger className="hover:bg-muted transition-colors rounded-md text-muted-foreground h-8 w-8 inline-flex items-center justify-center" />

            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-1.5 min-w-0">
              {crumb?.section && (
                <>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                    {crumb.section}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" strokeWidth={1.5} />
                </>
              )}
              <span className="text-[12px] font-semibold text-foreground truncate">
                {crumb?.label ?? title}
              </span>
            </div>

            {/* AI Command Center launcher — centered, the marquee element */}
            <div className="flex-1 flex justify-center px-2">
              <button onClick={() => openPalette("jump")} className="ai-launcher group" aria-label="Open command center">
                <Sparkles className="ai-launcher-icon" strokeWidth={2} />
                <span className="ai-launcher-text">Ask, search, or jump to anything…</span>
                <kbd>⌘K</kbd>
              </button>
            </div>

            {/* Right cluster */}
            <button
              onClick={() => openPalette("alerts")}
              className="relative h-9 w-9 rounded-md border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-colors inline-flex items-center justify-center text-muted-foreground"
              aria-label="Open alerts"
              title="Alerts"
            >
              <Bell className="h-4 w-4" strokeWidth={1.75} />
              <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-danger" />
            </button>

            <span className="hidden lg:inline-flex items-center text-[11px] font-mono text-muted-foreground tabular-nums tracking-wider uppercase h-9 px-2.5 rounded-md border border-border bg-card">
              <CalendarDays className="h-3.5 w-3.5 mr-1.5 opacity-60" strokeWidth={1.5} />
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </header>

          {/* Page header band — premium title */}
          {(title || headerActions) && (
            <div className="px-4 sm:px-6 lg:px-8 pt-7 pb-5 flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                {title && (
                  <h1 className="text-[26px] sm:text-[30px] font-semibold tracking-[-0.022em] text-foreground leading-tight">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-[13px] text-muted-foreground mt-1.5">{subtitle}</p>
                )}
              </div>
              {headerActions && <div className="flex items-center gap-2 flex-wrap">{headerActions}</div>}
            </div>
          )}

          <div className="px-4 sm:px-6 lg:px-8 pb-10 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} initialTab={paletteTab} />
        </Suspense>
      )}
    </SidebarProvider>
  );
}


