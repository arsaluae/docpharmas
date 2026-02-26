import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { FEFOHeatMap } from "@/components/inventory/FEFOHeatMap";
import { ImportFolderCard } from "@/components/inventory/ImportFolderCard";
import { Menu } from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  expiry_date: string;
  location: string;
}

interface ImportFolder {
  id: string;
  shipment_name: string;
  supplier: string;
  status: string;
  lc_number: string;
  duties: number;
  freight: number;
  insurance: number;
  total_landed_cost: number;
  arrival_date: string | null;
}

export default function Inventory() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [folders, setFolders] = useState<ImportFolder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("inventory_items").select("*").order("expiry_date"),
      supabase.from("import_folders").select("*").order("created_at", { ascending: false }),
    ]).then(([itemRes, folderRes]) => {
      if (itemRes.data) setItems(itemRes.data as InventoryItem[]);
      if (folderRes.data) setFolders(folderRes.data as ImportFolder[]);
      setLoading(false);
    });
  }, [user]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center px-4 bg-card">
            <div className="flex items-center gap-3">
              <SidebarTrigger>
                <Menu className="h-5 w-5 text-muted-foreground" />
              </SidebarTrigger>
              <div>
                <h1 className="font-heading font-semibold text-foreground text-sm">
                  Inventory
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  FEFO Dashboard & Import Tracking
                </p>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto space-y-8">
            <FEFOHeatMap items={items} />

            <section>
              <h2 className="font-heading font-semibold text-foreground mb-4">
                Import Folders — Landed Costing
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {folders.map((f) => (
                  <ImportFolderCard key={f.id} folder={f} />
                ))}
              </div>
            </section>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
