import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { BMRStepCard } from "@/components/production/BMRStepCard";
import { YieldVarianceSidebar } from "@/components/production/YieldVarianceSidebar";
import { Menu } from "lucide-react";
import { toast } from "sonner";

interface Batch {
  id: string;
  name: string;
  product: string;
}

interface BMRStep {
  id: string;
  batch_id: string;
  step_name: string;
  step_order: number;
  status: string;
  completed_by: string | null;
  completed_at: string | null;
  yield_expected: number;
  yield_actual: number | null;
}

export default function ProductionFloor() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>("");
  const [steps, setSteps] = useState<BMRStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasedMaterials, setReleasedMaterials] = useState<string[]>([]);
  const [lockedCount, setLockedCount] = useState(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("batches")
      .select("id, name, product")
      .order("name")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setBatches(data);
          setSelectedBatch(data[0].id);
        }
        setLoading(false);
      });
  }, [user]);

  // Fetch released materials for quarantine hard-lock
  useEffect(() => {
    if (!user) return;
    supabase
      .from("raw_materials")
      .select("id, name, status")
      .then(({ data }) => {
        if (data) {
          setReleasedMaterials(data.filter((m) => m.status === "released").map((m) => m.name));
          setLockedCount(data.filter((m) => m.status !== "released").length);
        }
      });
  }, [user]);

  const fetchSteps = useCallback(async () => {
    if (!selectedBatch) return;
    const { data } = await supabase
      .from("bmr_steps")
      .select("*")
      .eq("batch_id", selectedBatch)
      .order("step_order");
    if (data) setSteps(data as BMRStep[]);
  }, [selectedBatch]);

  useEffect(() => {
    fetchSteps();
  }, [fetchSteps]);

  const handleToggle = async (step: BMRStep) => {
    const newStatus = step.status === "completed" ? "pending" : "completed";
    const updates: any = {
      status: newStatus,
      completed_by: newStatus === "completed" ? user!.id : null,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from("bmr_steps")
      .update(updates)
      .eq("id", step.id);
    if (error) toast.error(error.message);
    else fetchSteps();
  };

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
              <SidebarTrigger>
                <Menu className="h-5 w-5 text-muted-foreground" />
              </SidebarTrigger>
              <div>
                <h1 className="font-heading font-semibold text-foreground text-sm">
                  Production Floor
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Batch Manufacturing Records
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            {/* Batch Selector */}
            <div className="mb-6">
              <select
                value={selectedBatch}
                onChange={(e) => setSelectedBatch(e.target.value)}
                className="h-10 rounded-lg border border-border bg-card px-3 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — {b.product}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* BMR Steps */}
              <div className="xl:col-span-2 space-y-4">
                {batch && (
                  <p className="text-xs text-muted-foreground">
                    Batch <span className="font-mono text-foreground">{batch.name}</span> · {batch.product}
                  </p>
                )}
                {steps.map((step) => {
                  // Hard-lock weighing step if no released materials
                  const isWeighing = step.step_name.toLowerCase().includes("weigh");
                  const locked = isWeighing && releasedMaterials.length === 0 && lockedCount > 0;
                  return (
                    <BMRStepCard
                      key={step.id}
                      stepName={step.step_name}
                      stepOrder={step.step_order}
                      status={step.status}
                      completedAt={step.completed_at}
                      yieldExpected={step.yield_expected}
                      yieldActual={step.yield_actual}
                      onToggle={() => handleToggle(step)}
                      disabled={locked}
                      lockReason={locked ? `${lockedCount} material(s) pending QC release` : undefined}
                    />
                  );
                })}
                {steps.length === 0 && (
                  <div className="glass-card p-10 text-center text-muted-foreground text-sm">
                    No BMR steps found for this batch.
                  </div>
                )}
              </div>

              {/* Yield Sidebar */}
              <div>
                <YieldVarianceSidebar steps={steps} onUpdate={fetchSteps} />
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
