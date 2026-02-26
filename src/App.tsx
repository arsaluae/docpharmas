import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AmbientGlow } from "@/components/notifications/AmbientGlow";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProductionFloor from "./pages/ProductionFloor";
import QualityControl from "./pages/QualityControl";
import Inventory from "./pages/Inventory";
import Invoicing from "./pages/Invoicing";
import AuditVault from "./pages/AuditVault";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AmbientGlow>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/production" element={<ProductionFloor />} />
            <Route path="/quality" element={<QualityControl />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/invoicing" element={<Invoicing />} />
            <Route path="/audit" element={<AuditVault />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AmbientGlow>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
