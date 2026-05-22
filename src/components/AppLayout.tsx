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
          {/* Top bar — borderless, blends into page */}
          <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm px-4 sm:px-8 h-12 flex items-center gap-3">
            <SidebarTrigger className="hover:bg-foreground/[0.05] transition-colors rounded text-muted-foreground" />

            {/* Breadcrumb only — title moves into the page header so it can be 32px */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {crumb?.section && (
                <>
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
                    {crumb.section}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" strokeWidth={1.5} />
                </>
              )}
              <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-foreground/80 truncate">
                {crumb?.label ?? title}
              </span>
            </div>

            {/* CMD+K trigger — Raycast-style */}
            <button
              onClick={openPalette}
              className="hidden sm:flex items-center gap-2 h-7 px-2.5 rounded border border-border bg-foreground/[0.03] hover:bg-foreground/[0.06] hover:border-foreground/15 transition-colors duration-150 group"
              aria-label="Open command palette"
            >
              <Search className="h-3 w-3 text-muted-foreground/70" strokeWidth={1.5} />
              <span className="text-[11px] text-muted-foreground/80">Search or jump to…</span>
              <kbd className="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-foreground/[0.05] text-muted-foreground border border-border/60 tracking-wider">
                ⌘K
              </kbd>
            </button>

            {/* Date — small, mono, never decorative */}
            <span className="hidden md:inline-flex items-center text-[10.5px] font-mono text-muted-foreground/70 tabular-nums tracking-wider uppercase">
              <CalendarDays className="h-3 w-3 mr-1.5 opacity-60" strokeWidth={1.5} />
              {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </span>
          </header>

          {/* Page header band — title + actions */}
          <div className="px-4 sm:px-8 pt-6 pb-4 flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-[28px] sm:text-[32px] font-light tracking-[-0.022em] text-foreground leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[12.5px] text-muted-foreground mt-1">{subtitle}</p>
              )}
            </div>
            {headerActions && <div className="flex items-center gap-2 flex-wrap">{headerActions}</div>}
          </div>

          <div className="px-4 sm:px-8 pb-8 animate-fade-in">
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

