import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { CalendarDays } from "lucide-react";

interface AppLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
}

export function AppLayout({ title, subtitle, children, headerActions }: AppLayoutProps) {
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
              {subtitle && (
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 hidden sm:flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary/40" />
                  {subtitle}
                </p>
              )}
            </div>
            {headerActions}
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
    </SidebarProvider>
  );
}
