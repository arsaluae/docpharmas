import { lazy as reactLazy, Suspense, ComponentType } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { RequireCap } from "@/components/RequireCap";
import { ThemeProvider } from "@/components/theme-provider";
import { Loader2 } from "lucide-react";

// Lazy with auto-reload on stale chunk (post-deploy hash mismatch).
const RELOAD_KEY = "__chunk_reload_attempt__";
function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>) {
  return reactLazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem(RELOAD_KEY);
      return mod;
    } catch (err: any) {
      const msg = String(err?.message || "");
      const isChunkErr =
        msg.includes("dynamically imported module") ||
        msg.includes("Failed to fetch") ||
        msg.includes("Importing a module script failed");
      if (isChunkErr && !sessionStorage.getItem(RELOAD_KEY)) {
        sessionStorage.setItem(RELOAD_KEY, "1");
        window.location.reload();
        // Return a never-resolving promise so Suspense keeps fallback during reload.
        return new Promise<{ default: T }>(() => {});
      }
      throw err;
    }
  });
}

// Eager: auth + initial paint
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Index from "./pages/Index";

// Lazy: every other route — code-split per page
const Customers = lazy(() => import("./pages/Customers"));
const CustomerLedger = lazy(() => import("./pages/CustomerLedger"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const SupplierLedger = lazy(() => import("./pages/SupplierLedger"));
const Products = lazy(() => import("./pages/Products"));
const ProformaInvoices = lazy(() => import("./pages/ProformaInvoices"));
const SalesReturns = lazy(() => import("./pages/SalesReturns"));
const WarrantyInvoices = lazy(() => import("./pages/WarrantyInvoices"));
const PurchaseProforma = lazy(() => import("./pages/PurchaseProforma"));
const PurchaseReturns = lazy(() => import("./pages/PurchaseReturns"));
const Payments = lazy(() => import("./pages/Payments"));
const Expenses = lazy(() => import("./pages/Expenses"));
const BankAccounts = lazy(() => import("./pages/BankAccounts"));
const StockMovements = lazy(() => import("./pages/StockMovements"));
const LandedCosts = lazy(() => import("./pages/LandedCosts"));
const Printers = lazy(() => import("./pages/Printers"));
const PrinterLedger = lazy(() => import("./pages/PrinterLedger"));
const PrintJobs = lazy(() => import("./pages/PrintJobs"));
const DataImport = lazy(() => import("./pages/DataImport"));
const ImportHistory = lazy(() => import("./pages/ImportHistory"));
const MigrationWizard = lazy(() => import("./pages/MigrationWizard"));
const Settings = lazy(() => import("./pages/Settings"));
const SystemHealth = lazy(() => import("./pages/SystemHealth"));
const Backups = lazy(() => import("./pages/Backups"));

const ProfitLoss = lazy(() => import("./pages/reports/ProfitLoss"));
const BalanceSheet = lazy(() => import("./pages/reports/BalanceSheet"));
const CashFlow = lazy(() => import("./pages/reports/CashFlow"));
const ReceivablesAging = lazy(() => import("./pages/reports/ReceivablesAging"));
const PayablesAging = lazy(() => import("./pages/reports/PayablesAging"));
const ProductCosting = lazy(() => import("./pages/reports/ProductCosting"));
const TaxCompliance = lazy(() => import("./pages/reports/TaxCompliance"));
const ItemWiseReport = lazy(() => import("./pages/reports/ItemWiseReport"));
const BatchWiseReport = lazy(() => import("./pages/reports/BatchWiseReport"));
const CustomerWiseReport = lazy(() => import("./pages/reports/CustomerWiseReport"));
const SupplierWiseReport = lazy(() => import("./pages/reports/SupplierWiseReport"));
const ProductAllocationReport = lazy(() => import("./pages/reports/ProductAllocationReport"));
const VacantAreas = lazy(() => import("./pages/reports/VacantAreas"));
const Reports = lazy(() => import("./pages/Reports"));
const AIInsights = lazy(() => import("./pages/AIInsights"));
const CreditNotes = lazy(() => import("./pages/CreditNotes"));
const DebitNotes = lazy(() => import("./pages/DebitNotes"));
const SalesTrend = lazy(() => import("./pages/reports/SalesTrend"));
const ProductPerformance = lazy(() => import("./pages/reports/ProductPerformance"));
const SupplierPerformance = lazy(() => import("./pages/reports/SupplierPerformance"));
const SlowDeadStock = lazy(() => import("./pages/reports/SlowDeadStock"));
const CitywiseSales = lazy(() => import("./pages/reports/CitywiseSales"));
const AreaWiseSales = lazy(() => import("./pages/reports/AreaWiseSales"));
const DailyCashPosition = lazy(() => import("./pages/reports/DailyCashPosition"));
const StockAudit = lazy(() => import("./pages/StockAudit"));
const Salaries = lazy(() => import("./pages/Salaries"));
const SalesAgents = lazy(() => import("./pages/SalesAgents"));
const DeliveryNotes = lazy(() => import("./pages/DeliveryNotes"));
const Couriers = lazy(() => import("./pages/Couriers"));
const AccountingPeriods = lazy(() => import("./pages/AccountingPeriods"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Expose for sign-out cache invalidation (avoids prop drilling through hooks)
if (typeof window !== "undefined") {
  (window as any).__queryClient = queryClient;
}

const RouteFallback = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Index />} />

                {/* Master data — customers always readable; supplier/product/printer scoped tighter */}
                <Route element={<RequireCap resource="master" />}>
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:id/ledger" element={<CustomerLedger />} />
                </Route>
                {/* Suppliers + their ledger live in the purchase scope (sales agents can't see) */}
                <Route element={<RequireCap resource="purchase" />}>
                  <Route path="/suppliers" element={<Suppliers />} />
                  <Route path="/suppliers/:id/ledger" element={<SupplierLedger />} />
                </Route>
                {/* Products + printers + sales-agents admin live in inventory/finance scope */}
                <Route element={<RequireCap resource="inventory" />}>
                  <Route path="/products" element={<Products />} />
                  <Route path="/printers" element={<Printers />} />
                  <Route path="/printers/:id/ledger" element={<PrinterLedger />} />
                </Route>
                <Route element={<RequireCap resource="finance" />}>
                  <Route path="/sales-agents" element={<SalesAgents />} />
                </Route>

                {/* Sales */}
                <Route element={<RequireCap resource="sales" />}>
                  <Route path="/proforma" element={<ProformaInvoices />} />
                  <Route path="/sales-returns" element={<SalesReturns />} />
                  <Route path="/warranty-invoices" element={<WarrantyInvoices />} />
                  <Route path="/delivery-notes" element={<DeliveryNotes />} />
                </Route>

                {/* Purchase */}
                <Route element={<RequireCap resource="purchase" />}>
                  <Route path="/purchase-proforma" element={<PurchaseProforma />} />
                  <Route path="/purchase-returns" element={<PurchaseReturns />} />
                  <Route path="/landed-costs" element={<LandedCosts />} />
                  <Route path="/print-jobs" element={<PrintJobs />} />
                  <Route path="/couriers" element={<Couriers />} />
                </Route>

                {/* Finance */}
                <Route element={<RequireCap resource="finance" />}>
                  <Route path="/payments" element={<Payments />} />
                  <Route path="/expenses" element={<Expenses />} />
                  <Route path="/bank" element={<BankAccounts />} />
                  <Route path="/salaries" element={<Salaries />} />
                  <Route path="/credit-notes" element={<CreditNotes />} />
                  <Route path="/debit-notes" element={<DebitNotes />} />
                </Route>

                {/* Inventory */}
                <Route element={<RequireCap resource="inventory" />}>
                  <Route path="/stock" element={<StockMovements />} />
                  <Route path="/stock-audit" element={<StockAudit />} />
                </Route>

                {/* Accounting */}
                <Route element={<RequireCap resource="accounting" />}>
                  <Route path="/accounting/periods" element={<AccountingPeriods />} />
                </Route>

                {/* Settings & admin (owner-only sub-routes guard internally) */}
                <Route element={<RequireCap resource="settings" />}>
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/import" element={<DataImport />} />
                  <Route path="/import/wizard" element={<MigrationWizard />} />
                  <Route path="/import/history" element={<ImportHistory />} />
                  <Route path="/system-health" element={<SystemHealth />} />
                  <Route path="/settings/backups" element={<Backups />} />
                  <Route path="/audit-log" element={<AuditLog />} />
                </Route>

                {/* Reports */}
                <Route element={<RequireCap resource="reports" />}>
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
                  <Route path="/reports/allocations" element={<ProductAllocationReport />} />
                  <Route path="/reports/vacant-areas" element={<VacantAreas />} />
                  <Route path="/reports/sales-trend" element={<SalesTrend />} />
                  <Route path="/reports/product-performance" element={<ProductPerformance />} />
                  <Route path="/reports/supplier-performance" element={<SupplierPerformance />} />
                  <Route path="/reports/slow-dead-stock" element={<SlowDeadStock />} />
                  <Route path="/reports/citywise-sales" element={<CitywiseSales />} />
                  <Route path="/reports/area-sales" element={<AreaWiseSales />} />
                  <Route path="/reports/daily-cash" element={<DailyCashPosition />} />
                  <Route path="/insights" element={<AIInsights />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
