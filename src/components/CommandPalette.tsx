import { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Truck, Package, FileText, ClipboardList, Wallet,
  CreditCard, Landmark, BarChart3, RotateCcw, Upload, Settings, Printer,
  Shield, Plus, Clock,
} from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";

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
  { title: "Admin Panel", url: "/admin", icon: Shield, section: "Settings" },
];

const quickActions = [
  { title: "New Sales Invoice", url: "/proforma?action=new", icon: Plus },
  { title: "New Purchase Order", url: "/purchase-proforma?action=new", icon: Plus },
  { title: "Add Customer", url: "/customers?action=new", icon: Plus },
  { title: "Add Product", url: "/products?action=new", icon: Plus },
  { title: "Record Payment", url: "/payments?action=new", icon: Plus },
  { title: "Record Expense", url: "/expenses?action=new", icon: Plus },
];

function getRecentPages(): { title: string; url: string }[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch { return []; }
}

export function addRecentPage(title: string, url: string) {
  const recent = getRecentPages().filter(r => r.url !== url);
  recent.unshift({ title, url });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const recentPages = useMemo(() => (open ? getRecentPages() : []), [open]);

  const runCommand = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

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
    </CommandDialog>
  );
}
