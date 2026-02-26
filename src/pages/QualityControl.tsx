import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { QuarantineCard } from "@/components/quality/QuarantineCard";
import { PulseRipple } from "@/components/quality/PulseRipple";
import { Menu, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface RawMaterial {
  id: string;
  name: string;
  supplier: string;
  lot_number: string;
  quantity: number;
  unit: string;
  status: string;
  released_by: string | null;
  released_at: string | null;
  received_at: string;
  expiry_date: string;
}

export default function QualityControl() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [ripple, setRipple] = useState<{ show: boolean; x: number; y: number }>({
    show: false,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  const fetchMaterials = async () => {
    const { data } = await supabase
      .from("raw_materials")
      .select("*")
      .order("received_at", { ascending: false });
    if (data) setMaterials(data as RawMaterial[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchMaterials();
  }, [user]);

  const handleRelease = async (id: string, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    const { error } = await supabase
      .from("raw_materials")
      .update({
        status: "released",
        released_by: user!.id,
        released_at: new Date().toISOString(),
      } as any)
      .eq("id", id);

    if (error) {
      toast.error(error.message);
    } else {
      setRipple({ show: true, x, y });
      toast.success("Material released from quarantine");
      fetchMaterials();
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const locked = materials.filter((m) => m.status === "locked");
  const released = materials.filter((m) => m.status === "released");
  const rejected = materials.filter((m) => m.status === "rejected");

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
                  Quality Control
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Quarantine Vault — Raw Material Release
                </p>
              </div>
            </div>
            {isAdmin && (
              <span className="status-pill bg-primary/10 text-primary">
                <ShieldCheck className="h-3 w-3 mr-1" /> Admin
              </span>
            )}
          </header>

          <main className="flex-1 p-6 overflow-auto space-y-8">
            {/* Locked materials */}
            {locked.length > 0 && (
              <section>
                <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-warning animate-pulse-glow" />
                  Quarantined ({locked.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {locked.map((m) => (
                    <QuarantineCard
                      key={m.id}
                      material={m}
                      isAdmin={isAdmin}
                      onRelease={handleRelease}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Released */}
            {released.length > 0 && (
              <section>
                <h2 className="font-heading font-semibold text-foreground mb-4">
                  Released ({released.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {released.map((m) => (
                    <QuarantineCard
                      key={m.id}
                      material={m}
                      isAdmin={isAdmin}
                      onRelease={handleRelease}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Rejected */}
            {rejected.length > 0 && (
              <section>
                <h2 className="font-heading font-semibold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-destructive" />
                  Rejected ({rejected.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {rejected.map((m) => (
                    <QuarantineCard
                      key={m.id}
                      material={m}
                      isAdmin={isAdmin}
                      onRelease={handleRelease}
                    />
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>

      <PulseRipple
        show={ripple.show}
        originX={ripple.x}
        originY={ripple.y}
        onComplete={() => setRipple({ show: false, x: 0, y: 0 })}
      />
    </SidebarProvider>
  );
}
