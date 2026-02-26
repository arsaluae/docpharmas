import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { DNATimeline } from "@/components/audit/DNATimeline";
import { Menu } from "lucide-react";

interface Batch {
  id: string;
  name: string;
  product: string;
}

interface AuditEvent {
  id: string;
  event_type: string;
  event_label: string;
  actor_name: string | null;
  entity_name: string | null;
  occurred_at: string;
}

export default function AuditVault() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState("");
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("batches").select("id, name, product").order("name").then(({ data }) => {
      if (data && data.length > 0) {
        setBatches(data);
        setSelectedBatch(data[0].id);
      }
      setLoading(false);
    });
  }, [user]);

  const fetchEvents = useCallback(async () => {
    if (!selectedBatch) return;
    const { data } = await supabase
      .from("audit_events")
      .select("*")
      .eq("batch_id", selectedBatch)
      .order("occurred_at");
    if (data) setEvents(data as AuditEvent[]);
  }, [selectedBatch]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const batch = batches.find((b) => b.id === selectedBatch);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
            <div className="flex items-center gap-3">
              <SidebarTrigger><Menu className="h-5 w-5 text-muted-foreground" /></SidebarTrigger>
              <div>
                <h1 className="font-heading font-semibold text-foreground text-sm">Audit Vault</h1>
                <p className="text-[11px] text-muted-foreground">One-Click DRAP Audit Trail</p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <div className="mb-6 flex items-center gap-4">
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} — {b.product}</option>
                ))}
              </select>
              {batch && (
                <p className="text-xs text-muted-foreground">
                  Showing DNA strand for <span className="font-mono text-foreground">{batch.name}</span>
                </p>
              )}
            </div>

            <div className="max-w-3xl mx-auto">
              <DNATimeline events={events} />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
