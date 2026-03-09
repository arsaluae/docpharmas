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
          {/* Pharma gradient accent line */}
          <div className="h-[2px] pharma-accent-line" />
          <header className="sticky top-0 z-10 pharma-gradient-header backdrop-blur-md border-b border-border/60 px-6 py-4 flex items-center gap-4">
            <SidebarTrigger className="hover:bg-primary/10 transition-colors" />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {headerActions}
            <Badge variant="outline" className="text-xs font-mono hidden md:flex border-primary/20 bg-primary/5 text-primary">
              <CalendarDays className="h-3 w-3 mr-1" />
              {new Date().toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
            </Badge>
          </header>
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
