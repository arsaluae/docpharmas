import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";
import AdminPanel from "./pages/AdminPanel";
import Customers from "./pages/Customers";
import CustomerLedger from "./pages/CustomerLedger";
import Suppliers from "./pages/Suppliers";
import SupplierLedger from "./pages/SupplierLedger";
import Products from "./pages/Products";
import ProformaInvoices from "./pages/ProformaInvoices";
import SalesReturns from "./pages/SalesReturns";
import WarrantyInvoices from "./pages/WarrantyInvoices";
import PurchaseProforma from "./pages/PurchaseProforma";
import PurchaseReturns from "./pages/PurchaseReturns";
import Payments from "./pages/Payments";
import Expenses from "./pages/Expenses";
import BankAccounts from "./pages/BankAccounts";
import StockMovements from "./pages/StockMovements";
import Printers from "./pages/Printers";
import PrinterLedger from "./pages/PrinterLedger";
import PrintJobs from "./pages/PrintJobs";
import DataImport from "./pages/DataImport";
import Settings from "./pages/Settings";
import DeliveryNotes from "./pages/DeliveryNotes";
import ProfitLoss from "./pages/reports/ProfitLoss";
import BalanceSheet from "./pages/reports/BalanceSheet";
import CashFlow from "./pages/reports/CashFlow";
import ReceivablesAging from "./pages/reports/ReceivablesAging";
import PayablesAging from "./pages/reports/PayablesAging";
import ProductCosting from "./pages/reports/ProductCosting";
import TaxCompliance from "./pages/reports/TaxCompliance";
import ItemWiseReport from "./pages/reports/ItemWiseReport";
import BatchWiseReport from "./pages/reports/BatchWiseReport";
import CustomerWiseReport from "./pages/reports/CustomerWiseReport";
import SupplierWiseReport from "./pages/reports/SupplierWiseReport";
import Reports from "./pages/Reports";
import AIInsights from "./pages/AIInsights";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/landing" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Index />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id/ledger" element={<CustomerLedger />} />
            <Route path="/suppliers" element={<Suppliers />} />
            <Route path="/suppliers/:id/ledger" element={<SupplierLedger />} />
            <Route path="/products" element={<Products />} />
            <Route path="/proforma" element={<ProformaInvoices />} />
            <Route path="/sales-returns" element={<SalesReturns />} />
            <Route path="/warranty-invoices" element={<WarrantyInvoices />} />
            <Route path="/purchase-proforma" element={<PurchaseProforma />} />
            <Route path="/purchase-returns" element={<PurchaseReturns />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/bank" element={<BankAccounts />} />
            <Route path="/stock" element={<StockMovements />} />
            <Route path="/printers" element={<Printers />} />
            <Route path="/printers/:id/ledger" element={<PrinterLedger />} />
            <Route path="/print-jobs" element={<PrintJobs />} />
            <Route path="/import" element={<DataImport />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/delivery-notes" element={<DeliveryNotes />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/reports/pl" element={<ProfitLoss />} />
            <Route path="/reports/balance-sheet" element={<BalanceSheet />} />
            <Route path="/reports/cash-flow" element={<CashFlow />} />
            <Route path="/reports/receivables" element={<ReceivablesAging />} />
            <Route path="/reports/payables" element={<PayablesAging />} />
            <Route path="/reports/product-costing" element={<ProductCosting />} />
            <Route path="/reports/tax" element={<TaxCompliance />} />
            <Route path="/reports/item-wise" element={<ItemWiseReport />} />
            <Route path="/reports/batch-wise" element={<BatchWiseReport />} />
            <Route path="/reports/customer-wise" element={<CustomerWiseReport />} />
            <Route path="/reports/supplier-wise" element={<SupplierWiseReport />} />
            <Route path="/insights" element={<AIInsights />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
