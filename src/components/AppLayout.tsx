import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
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
          <header className="sticky top-0 z-10 pharma-gradient-header backdrop-blur-md border-b border-border/60 px-3 sm:px-6 py-3 sm:py-4 flex items-center gap-2 sm:gap-4">
            <SidebarTrigger className="hover:bg-primary/10 transition-colors" />
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-foreground font-heading tracking-tight truncate">{title}</h1>
              {subtitle && <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{subtitle}</p>}
            </div>
            {headerActions}
            <Badge variant="outline" className="text-xs font-mono hidden md:flex border-primary/20 bg-primary/5 text-primary items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary/40"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              <CalendarDays className="h-3 w-3" />
              {new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
            </Badge>
          </header>
          <div className="p-3 sm:p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
