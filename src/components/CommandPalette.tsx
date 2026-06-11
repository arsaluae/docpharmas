import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, Truck, Package, FileText, ClipboardList, Wallet,
  CreditCard, Landmark, BarChart3, RotateCcw, Upload, Settings, Printer,
  Plus, Clock, Sparkles, Search, Bell, AlertTriangle, Send, Loader2,
  ArrowRight,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const RECENT_KEY = "docpharmas_recent_pages";
const MAX_RECENT = 6;

const navigationItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, section: "Navigation" },
  { title: "Customers", url: "/customers", icon: Users, section: "Sales" },
  { title: "Sales Invoices", url: "/proforma", icon: FileText, section: "Sales" },
  { title: "Delivery Notes", url: "/delivery-notes", icon: Truck, section: "Sales" },
  { title: "Warranty Invoices", url: "/warranty-invoices", icon: ClipboardList, section: "Sales" },
  { title: "Sales Returns", url: "/sales-returns", icon: RotateCcw, section: "Sales" },
  { title: "Suppliers", url: "/suppliers", icon: Truck, section: "Purchase" },
  { title: "Purchase Orders", url: "/purchase-proforma", icon: FileText, section: "Purchase" },
  { title: "Purchase Returns", url: "/purchase-returns", icon: RotateCcw, section: "Purchase" },
  { title: "Products & Stock", url: "/products", icon: Package, section: "Inventory" },
  { title: "Stock Movements", url: "/stock", icon: RotateCcw, section: "Inventory" },
  { title: "Printers", url: "/printers", icon: Printer, section: "Printing" },
  { title: "Print Jobs", url: "/print-jobs", icon: ClipboardList, section: "Printing" },
  { title: "Payments", url: "/payments", icon: Wallet, section: "Finance" },
  { title: "Credit Notes", url: "/credit-notes", icon: FileText, section: "Finance" },
  { title: "Expenses", url: "/expenses", icon: CreditCard, section: "Finance" },
  { title: "Staff & Salaries", url: "/salaries", icon: Users, section: "Finance" },
  { title: "Bank Accounts", url: "/bank", icon: Landmark, section: "Finance" },
  { title: "Reports", url: "/reports", icon: BarChart3, section: "Reports" },
  { title: "AI Insights", url: "/insights", icon: BarChart3, section: "Reports" },
  { title: "Company Settings", url: "/settings", icon: Settings, section: "Settings" },
  { title: "Data Import", url: "/import", icon: Upload, section: "Settings" },
];

const quickActions = [
  { title: "New Sales Invoice", url: "/proforma?action=new", icon: Plus },
  { title: "New Purchase Order", url: "/purchase-proforma?action=new", icon: Plus },
  { title: "Add Customer", url: "/customers?action=new", icon: Plus },
  { title: "Add Product", url: "/products?action=new", icon: Plus },
  { title: "Record Payment", url: "/payments?action=new", icon: Plus },
  { title: "Record Expense", url: "/expenses?action=new", icon: Plus },
];

const SUGGESTED_PROMPTS = [
  "Top 5 customers by outstanding balance",
  "Which products are about to run out?",
  "How is this month's revenue trending vs last month?",
  "Which invoices are most overdue?",
];

function getRecentPages(): { title: string; url: string }[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}

export function addRecentPage(title: string, url: string) {
  const recent = getRecentPages().filter(r => r.url !== url);
  recent.unshift({ title, url });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

type Tab = "jump" | "ask" | "alerts";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: Tab;
}

export function CommandPalette({ open, onOpenChange, initialTab = "jump" }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>(initialTab);
  const recentPages = useMemo(() => (open ? getRecentPages() : []), [open]);

  useEffect(() => { if (open) setTab(initialTab); }, [open, initialTab]);

  const runCommand = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* Tab strip */}
      <div className="flex items-center gap-1 border-b border-border px-2 pt-2 pb-1 bg-card">
        {([
          { id: "jump", label: "Jump to", icon: Search },
          { id: "ask", label: "Ask AI", icon: Sparkles },
          { id: "alerts", label: "Alerts", icon: Bell },
        ] as { id: Tab; label: string; icon: any }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-[12.5px] font-medium transition-colors",
              tab === t.id
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "jump" && (
        <>
          <CommandInput placeholder="Search pages, actions, jump to…" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            {recentPages.length > 0 && (
              <CommandGroup heading="Recent">
                {recentPages.map((item) => (
                  <CommandItem key={item.url} onSelect={() => runCommand(item.url)}>
                    <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
            <CommandGroup heading="Quick Actions">
              {quickActions.map((item) => (
                <CommandItem key={item.title} onSelect={() => runCommand(item.url)}>
                  <item.icon className="mr-2 h-4 w-4 text-primary" />
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Pages">
              {navigationItems.map((item) => (
                <CommandItem key={item.url} onSelect={() => runCommand(item.url)} keywords={[item.section]}>
                  <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{item.title}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{item.section}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </>
      )}

      {tab === "ask" && <AskPanel />}
      {tab === "alerts" && <AlertsPanel onNavigate={runCommand} />}
    </CommandDialog>
  );
}

/* ─────────── Ask AI panel ─────────── */
function AskPanel() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;
    setLoading(true); setErr(null); setAnswer(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-command", { body: { question: trimmed } });
      if (error) throw error;
      setAnswer(data?.answer ?? "No answer returned.");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to reach AI.");
    } finally { setLoading(false); }
  };

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); ask(q); };

  return (
    <div className="flex flex-col h-[480px]">
      <form onSubmit={onSubmit} className="border-b border-border p-3 flex gap-2 items-start bg-card">
        <Sparkles className="h-5 w-5 text-primary mt-2 shrink-0" />
        <textarea
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(q); } }}
          placeholder="Ask anything about your business — sales, stock, receivables…"
          rows={2}
          className="flex-1 bg-transparent border-0 outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground py-1.5"
        />
        <button
          type="submit"
          disabled={loading || !q.trim()}
          className="inline-flex items-center justify-center h-9 w-9 rounded-md bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>

      <div className="flex-1 overflow-y-auto p-4">
        {!answer && !loading && !err && (
          <div className="space-y-3">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Suggested</div>
            {SUGGESTED_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => { setQ(p); ask(p); }}
                className="w-full text-left px-3 py-2.5 rounded-md border border-border bg-card hover:border-primary/40 hover:bg-primary/[0.03] transition-colors text-[13px] text-foreground flex items-center justify-between group"
              >
                <span>{p}</span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}

        {err && (
          <div className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md p-3">
            {err}
          </div>
        )}

        {answer && (
          <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed text-[13.5px]">
            {answer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────── Proactive Alerts panel ─────────── */
type AlertRow = {
  id: string;
  kind: "reorder" | "overdue" | "expiring" | "credit";
  title: string;
  detail: string;
  severity: "danger" | "warning" | "info";
  url: string;
};

function AlertsPanel({ onNavigate }: { onNavigate: (url: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AlertRow[]>([]);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const sixtyDays = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
    const thirtyAgo = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);

    const [reorder, overdue, expiring, credit] = await Promise.all([
      supabase.from("reorder_alerts").select("*").order("days_until_stockout", { ascending: true }).limit(5),
      supabase.from("sales_invoices").select("id, invoice_number, total, amount_paid, date, customers(name)").neq("status", "voided").lt("date", thirtyAgo).order("date").limit(5),
      supabase.from("grn_items").select("product_id, batch_number, expiry_date, quantity_received, products(name)").not("expiry_date", "is", null).lte("expiry_date", sixtyDays).gt("expiry_date", today).order("expiry_date").limit(5),
      supabase.from("customers").select("id, name, balance, credit_limit").gt("credit_limit", 0).limit(50),
    ]);

    const out: AlertRow[] = [];
    (reorder.data || []).forEach((r: any) => out.push({
      id: `r-${r.id}`, kind: "reorder",
      title: r.product_name ?? "Product",
      detail: `Stockout in ${r.days_until_stockout ?? "?"}d · stock ${r.current_stock ?? 0}`,
      severity: (r.days_until_stockout ?? 99) <= 7 ? "danger" : "warning",
      url: "/products",
    }));
    (overdue.data || []).forEach((r: any) => {
      const bal = Number(r.total) - Number(r.amount_paid);
      if (bal > 0) out.push({
        id: `o-${r.id}`, kind: "overdue",
        title: r.customers?.name ?? "Customer",
        detail: `${r.invoice_number} · PKR ${Math.round(bal).toLocaleString()} · ${r.date}`,
        severity: "danger",
        url: "/proforma",
      });
    });
    (expiring.data || []).forEach((r: any, i: number) => out.push({
      id: `e-${i}-${r.batch_number}`, kind: "expiring",
      title: r.products?.name ?? "Product",
      detail: `Batch ${r.batch_number} · exp ${r.expiry_date} · qty ${r.quantity_received}`,
      severity: "warning",
      url: "/stock",
    }));
    (credit.data || []).filter((c: any) => Number(c.balance) > Number(c.credit_limit)).slice(0, 5).forEach((c: any) => out.push({
      id: `c-${c.id}`, kind: "credit",
      title: c.name,
      detail: `Balance PKR ${Math.round(c.balance).toLocaleString()} > limit ${Math.round(c.credit_limit).toLocaleString()}`,
      severity: "danger",
      url: `/customers`,
    }));

    setRows(out);
    setLoading(false);
  };

  const tone = (s: AlertRow["severity"]) =>
    s === "danger" ? "text-danger border-danger/30 bg-danger/5"
      : s === "warning" ? "text-warning border-warning/30 bg-warning/5"
        : "text-info border-info/30 bg-info/5";

  return (
    <div className="max-h-[480px] overflow-y-auto p-3">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading alerts…
        </div>
      )}
      {!loading && rows.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">All clear. No alerts right now.</div>
      )}
      {!loading && rows.length > 0 && (
        <div className="space-y-1.5">
          {rows.map(r => (
            <button
              key={r.id}
              onClick={() => onNavigate(r.url)}
              className="w-full text-left px-3 py-2.5 rounded-md border border-border bg-card hover:border-primary/40 hover:bg-muted/40 transition-colors flex items-center gap-3"
            >
              <span className={cn("h-7 w-7 rounded-md border inline-flex items-center justify-center shrink-0", tone(r.severity))}>
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-foreground truncate">{r.title}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">{r.detail}</div>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{r.kind}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
