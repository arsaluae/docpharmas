import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { KPICards } from "@/components/dashboard/KPICards";
import { BatchOrbit } from "@/components/dashboard/BatchOrbit";
import { BatchTable } from "@/components/dashboard/BatchTable";
import { AlertFeed } from "@/components/dashboard/AlertFeed";
import { Bell, Menu } from "lucide-react";

interface Batch {
  id: string;
  name: string;
  product: string;
  status: string;
  progress: number;
  stage: string;
  created_at: string;
  updated_at: string;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  message: string;
  batch_id: string | null;
  created_at: string;
  resolved: boolean;
}

const Index = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const [batchRes, alertRes] = await Promise.all([
        supabase.from("batches").select("*").order("updated_at", { ascending: false }),
        supabase.from("alerts").select("*").order("created_at", { ascending: false }),
      ]);

      if (batchRes.data) setBatches(batchRes.data);
      if (alertRes.data) setAlerts(alertRes.data);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const kpiData = {
    activeBatches: batches.filter(b => b.status === "in_progress").length,
    quarantineItems: batches.filter(b => b.status === "quarantine").length,
    complianceScore: 94,
    pendingQC: batches.filter(b => b.stage === "quality_check").length,
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
            <div className="flex items-center gap-3">
              <SidebarTrigger>
                <Menu className="h-5 w-5 text-muted-foreground" />
              </SidebarTrigger>
              <div>
                <h1 className="font-heading font-semibold text-foreground text-sm">
                  Production Dashboard
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Real-time manufacturing overview
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 rounded-lg hover:bg-accent transition-colors">
                <Bell className="h-4 w-4 text-muted-foreground" />
                {alerts.filter(a => !a.resolved && a.severity === "critical").length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full animate-pulse-glow" />
                )}
              </button>
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6 space-y-6 overflow-auto">
            <KPICards data={kpiData} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1">
                <BatchOrbit batches={batches} />
              </div>
              <div className="lg:col-span-2">
                <AlertFeed alerts={alerts} />
              </div>
            </div>

            <BatchTable batches={batches} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
