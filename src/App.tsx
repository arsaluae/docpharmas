import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Products from "./pages/Products";
import SalesInvoices from "./pages/SalesInvoices";
import ProformaInvoices from "./pages/ProformaInvoices";
import PurchaseOrders from "./pages/PurchaseOrders";
import GoodsReceivedNotes from "./pages/GoodsReceivedNotes";
import PurchaseInvoicesPage from "./pages/PurchaseInvoicesPage";
import Payments from "./pages/Payments";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/products" element={<Products />} />
          <Route path="/sales-invoices" element={<SalesInvoices />} />
          <Route path="/proforma" element={<ProformaInvoices />} />
          <Route path="/purchase-orders" element={<PurchaseOrders />} />
          <Route path="/grn" element={<GoodsReceivedNotes />} />
          <Route path="/purchase-invoices" element={<PurchaseInvoicesPage />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
