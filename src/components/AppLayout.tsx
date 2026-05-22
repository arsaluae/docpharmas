import { ReactNode, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CalendarDays, Search, ChevronRight } from "lucide-react";
import { useGlobalShortcuts } from "@/components/KeyboardShortcuts";

// Tiny inline recent-page tracker so we don't pull in CommandPalette eagerly.
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

// Lazy: cmdk + dialog only loaded on first Ctrl+K
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

export function AppLayout({ title, subtitle, children, headerActions }: AppLayoutProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  useGlobalShortcuts({ onOpenPalette: openPalette });

  // Track recent pages
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
          {/* Pharma gradient accent line with shimmer */}
          <div className="h-[3px] pharma-accent-line shimmer-line" />
          <header className="sticky top-0 z-10 frosted-header px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-4">
            <SidebarTrigger className="hover:bg-primary/10 transition-colors rounded-xl" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground font-heading tracking-tight truncate">{title}</h1>
              {/* Breadcrumb */}
              {crumb && crumb.section && (
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-[11px] text-muted-foreground">{crumb.section}</span>
                  <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/50" />
                  <span className="text-[11px] text-primary font-medium">{crumb.label}</span>
                </div>
              )}
              {!crumb?.section && subtitle && (
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 hidden sm:flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary/40" />
                  {subtitle}
                </p>
              )}
            </div>
            {headerActions}
            {/* Search trigger */}
            <button
              onClick={openPalette}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Search...</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-background text-muted-foreground border border-border">⌘K</kbd>
            </button>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/15 bg-gradient-to-r from-primary/[0.04] to-transparent">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <CalendarDays className="h-3 w-3 text-primary/60" />
              <span className="text-[11px] font-mono text-primary/80 font-medium">
                {new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </header>
          <div className="p-3 sm:p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
      {paletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        </Suspense>
      )}
    </SidebarProvider>
  );
}

