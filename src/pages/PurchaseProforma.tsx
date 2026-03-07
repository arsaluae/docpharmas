import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Trash2, Download, CheckCircle, Pencil, DollarSign, PackageCheck } from "lucide-react";
import { SearchableSelect } from "@/components/SearchableSelect";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useCompanySettings } from "@/hooks/useCompanySettings";
import { generatePdf } from "@/lib/pdf-generator";
import { useDocumentTemplates } from "@/hooks/useDocumentTemplates";

interface Supplier { id: string; name: string; wht_rate: number; }
interface Product { id: string; name: string; cost_price: number; }

interface PPItem { product_id: string; product_name: string; quantity_requested: number; rate: number; amount: number; }
interface AdditionalCost { cost_type: string; description: string; amount: number; vendor_id: string; }

interface PurchaseDoc {
  id: string; doc_number: string; supplier_id: string | null; date: string;
  validity_days: number; subtotal: number; gst: number; total: number;
  status: string; notes: string | null; created_at: string;
  source: "proforma" | "po" | "grn" | "bill";
  converted_po_id?: string | null;
  po_number?: string; grn_number?: string; bill_number?: string;
  suppliers?: { name: string } | null;
}

export default function PurchaseProforma() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<PurchaseDoc[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [costOpen, setCostOpen] = useState(false);
  const [selectedProformaId, setSelectedProformaId] = useState("");

  const [supplierId, setSupplierId] = useState("");
  const [ppDate, setPpDate] = useState(new Date().toISOString().split("T")[0]);
  const [validityDays, setValidityDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PPItem[]>([]);

  const [costs, setCosts] = useState<AdditionalCost[]>([]);
  const [costType, setCostType] = useState("printing");
  const [costDesc, setCostDesc] = useState("");
  const [costAmount, setCostAmount] = useState("");
  const [costVendorId, setCostVendorId] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const { settings } = useCompanySettings();
  const { getTemplate } = useDocumentTemplates();

  // Detail/Edit
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPP, setDetailPP] = useState<PurchaseDoc | null>(null);
  const [detailItems, setDetailItems] = useState<any[]>([]);
  const [detailCosts, setDetailCosts] = useState<any[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editSupplierId, setEditSupplierId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editValidity, setEditValidity] = useState("30");
  const [editNotes, setEditNotes] = useState("");
  const [editItems, setEditItems] = useState<PPItem[]>([]);

  // Receive dialog (GRN)
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receivePO, setReceivePO] = useState<PurchaseDoc | null>(null);
  const [receiveItems, setReceiveItems] = useState<any[]>([]);
  const [receivedBy, setReceivedBy] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    check(); load();
  }, [navigate]);

  const load = async () => {
    setLoading(true);
    const [pp, po, grn, bills, sup, prod] = await Promise.all([
      supabase.from("purchase_proformas").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("goods_received_notes").select("*, suppliers(name), purchase_orders(po_number)").order("created_at", { ascending: false }),
      supabase.from("purchase_invoices").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id, name, wht_rate"),
      supabase.from("products").select("id, name, cost_price"),
    ]);

    const combined: PurchaseDoc[] = [];
    const linkedPOIds = new Set<string>();
    const linkedGRNPOIds = new Set<string>();

    // Proformas as primary docs
    if (pp.data) {
      pp.data.forEach((p: any) => {
        let status = p.status;
        let poNum: string | undefined;
        let grnNum: string | undefined;
        let billNum: string | undefined;

        if (p.converted_po_id && po.data) {
          const linkedPO = po.data.find((o: any) => o.id === p.converted_po_id);
          if (linkedPO) {
            linkedPOIds.add(linkedPO.id);
            poNum = linkedPO.po_number;
            status = "ordered";
            if (linkedPO.status === "confirmed") status = "confirmed";
            if (linkedPO.status === "received") {
              status = "received";
              // Find GRN
              const linkedGRN = grn.data?.find((g: any) => g.po_id === linkedPO.id);
              if (linkedGRN) {
                grnNum = linkedGRN.grn_number;
                linkedGRNPOIds.add(linkedPO.id);
              }
              // Find Bill
              const linkedBill = bills.data?.find((b: any) => b.grn_id === linkedGRN?.id);
              if (linkedBill) billNum = linkedBill.bill_number;
            }
          }
        }

        combined.push({
          id: p.id, doc_number: p.proforma_number, supplier_id: p.supplier_id, date: p.date,
          validity_days: p.validity_days, subtotal: p.subtotal, gst: p.gst, total: p.total,
          status, notes: p.notes, created_at: p.created_at, source: "proforma",
          converted_po_id: p.converted_po_id, po_number: poNum, grn_number: grnNum,
          bill_number: billNum, suppliers: p.suppliers,
        });
      });
    }

    // Standalone POs (not from proforma)
    if (po.data) {
      po.data.forEach((o: any) => {
        if (!linkedPOIds.has(o.id)) {
          combined.push({
            id: o.id, doc_number: o.po_number, supplier_id: o.supplier_id, date: o.date,
            validity_days: 0, subtotal: o.subtotal, gst: o.gst, total: o.total,
            status: o.status === "received" ? "received" : "ordered",
            notes: o.notes, created_at: o.created_at, source: "po",
            suppliers: o.suppliers, po_number: o.po_number,
          });
        }
      });
    }

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setDocs(combined);
    if (sup.data) setSuppliers(sup.data as any);
    if (prod.data) setProducts(prod.data);
    setLoading(false);
  };

  const addItem = () => setItems([...items, { product_id: "", product_name: "", quantity_requested: 1, rate: 0, amount: 0 }]);

  const updateItem = (idx: number, field: string, value: any) => {
    const u = [...items];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.cost_price); }
    }
    u[idx].amount = Number(u[idx].quantity_requested) * Number(u[idx].rate);
    setItems(u);
  };

  const calcTotals = () => {
    const subtotal = items.reduce((s, i) => s + i.amount, 0);
    const gst = settings?.gst_enabled ? subtotal * (Number(settings.default_gst_rate) / 100) : 0;
    return { subtotal, gst, total: subtotal + gst };
  };

  const handleSave = async () => {
    if (!supplierId || items.length === 0) { toast.error("Supplier and items required"); return; }
    const { subtotal, gst, total } = calcTotals();
    const { data: ppNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_proforma" });
    if (!ppNumber) { toast.error("Failed to generate number"); return; }

    const { data: pp } = await supabase.from("purchase_proformas").insert({
      proforma_number: ppNumber, supplier_id: supplierId, date: ppDate,
      validity_days: Number(validityDays), subtotal, gst, total, status: "draft", notes: notes || null,
    }).select().single();

    if (pp) {
      await supabase.from("purchase_proforma_items").insert(
        items.map(i => ({
          proforma_id: pp.id, product_id: i.product_id || null,
          quantity_requested: Number(i.quantity_requested), rate: Number(i.rate), amount: i.amount,
        }))
      );
      if (costs.length > 0) {
        await supabase.from("additional_costs").insert(
          costs.map(c => ({
            reference_type: "purchase_proforma", reference_id: pp.id,
            cost_type: c.cost_type, description: c.description, amount: Number(c.amount),
            vendor_id: c.vendor_id || null,
          }))
        );
      }
      toast.success(`Draft ${ppNumber} created`);
      setOpen(false); setSupplierId(""); setItems([]); setNotes(""); setCosts([]); load();
    }
  };

  const addCostLine = () => {
    if (!costAmount) return;
    setCosts([...costs, { cost_type: costType, description: costDesc, amount: Number(costAmount), vendor_id: costVendorId }]);
    setCostDesc(""); setCostAmount(""); setCostVendorId("");
  };

  // Approve = auto-create PO
  const handleApprove = async (doc: PurchaseDoc) => {
    if (doc.source !== "proforma") return;
    const { data: poNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_order" });
    if (!poNumber) { toast.error("Failed to generate PO number"); return; }
    const { data: po } = await supabase.from("purchase_orders").insert({
      po_number: poNumber, supplier_id: doc.supplier_id, date: new Date().toISOString().split("T")[0],
      subtotal: doc.subtotal, gst: doc.gst, total: doc.total, status: "confirmed", proforma_id: doc.id,
    }).select().single();
    if (po) {
      const { data: ppItems } = await supabase.from("purchase_proforma_items").select("*").eq("proforma_id", doc.id);
      if (ppItems && ppItems.length > 0) {
        await supabase.from("purchase_order_items").insert(
          ppItems.map((i: any) => ({
            po_id: po.id, product_id: i.product_id, description: null,
            quantity: Number(i.quantity_requested), quantity_confirmed: Number(i.quantity_requested),
            rate: Number(i.rate), amount: Number(i.amount),
          }))
        );
      }
      // Copy additional costs
      const { data: ppCosts } = await supabase.from("additional_costs").select("*").eq("reference_type", "purchase_proforma").eq("reference_id", doc.id);
      if (ppCosts && ppCosts.length > 0) {
        await supabase.from("additional_costs").insert(
          ppCosts.map((c: any) => ({
            reference_type: "purchase_order", reference_id: po.id,
            cost_type: c.cost_type, description: c.description, amount: Number(c.amount), vendor_id: c.vendor_id,
          }))
        );
      }
      await supabase.from("purchase_proformas").update({ status: "ordered", converted_po_id: po.id }).eq("id", doc.id);
      toast.success(`✓ PO ${poNumber} created — ready to receive goods`);

      // Auto-download PO PDF
      const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", po.id);
      generatePdf({
        title: "PURCHASE ORDER", documentNumber: poNumber, date: po.date,
        partyLabel: "Supplier", partyName: (doc.suppliers as any)?.name || "—",
        columns: [
          { header: "#", key: "idx" }, { header: "Product", key: "name" },
          { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
          { header: "Amount", key: "amount", align: "right" },
        ],
        rows: (poItems || []).map((i: any, idx: number) => ({
          idx: idx + 1, name: i.products?.name || "Item",
          quantity: i.quantity, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
        })),
        totals: [
          { label: "Subtotal", value: `PKR ${Number(po.subtotal).toLocaleString()}` },
          { label: "GST", value: `PKR ${Number(po.gst).toLocaleString()}` },
          { label: "Total", value: `PKR ${Number(po.total).toLocaleString()}` },
        ],
        settings, template: getTemplate("purchase_order"),
      });
      load();
    }
  };

  // Mark Received = create GRN + Bill
  const openReceiveDialog = async (doc: PurchaseDoc) => {
    const poId = doc.converted_po_id || doc.id;
    const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", poId);
    if (poItems) {
      setReceiveItems(poItems.map((i: any) => ({
        ...i, item_name: i.products?.name || i.description || "Item",
        batch_number: "", expiry_date: "", quantity_received: Number(i.quantity_confirmed) || Number(i.quantity),
        quantity_confirmed: Number(i.quantity_confirmed) || Number(i.quantity),
      })));
    }
    setReceivePO(doc);
    setReceiveOpen(true);
  };

  const handleReceive = async () => {
    if (!receivePO) return;
    if (!receiveItems.every(i => i.batch_number)) { toast.error("Batch number required for all items"); return; }
    if (!receiveItems.every(i => i.expiry_date)) { toast.error("Expiry date required for all items"); return; }

    const poId = receivePO.converted_po_id || receivePO.id;
    const { data: grnNumber } = await supabase.rpc("generate_document_number", { p_document_type: "goods_received_note" });
    if (!grnNumber) { toast.error("Failed to generate GRN number"); return; }

    const { data: grn } = await supabase.from("goods_received_notes").insert({
      grn_number: grnNumber, po_id: poId, supplier_id: receivePO.supplier_id,
      date: new Date().toISOString().split("T")[0], received_by: receivedBy || null, notes: receiveNotes || null,
    }).select().single();

    if (grn) {
      await supabase.from("grn_items").insert(
        receiveItems.map(i => ({
          grn_id: grn.id, item_name: i.item_name, product_id: i.product_id || null,
          batch_number: i.batch_number || null,
          quantity_ordered: Number(i.quantity), quantity_received: Number(i.quantity_received),
          expiry_date: i.expiry_date || null, rate: Number(i.rate), amount: Number(i.quantity_received) * Number(i.rate),
        }))
      );

      // Stock movements
      for (const item of receiveItems) {
        if (item.product_id) {
          await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: Number(item.quantity_received),
            movement_type: "purchase_in", batch_number: item.batch_number || null,
            reference_type: "grn", reference_id: grn.id, date: grn.date,
            notes: `GRN ${grnNumber}`,
          });
        }
      }

      await supabase.from("purchase_orders").update({ status: "received" }).eq("id", poId);

      // Auto-create Purchase Bill
      try {
        const { data: billNumber } = await supabase.rpc("generate_document_number", { p_document_type: "purchase_invoice" });
        if (billNumber) {
          const { data: poData } = await supabase.from("purchase_orders").select("subtotal, gst, total, supplier_id").eq("id", poId).single();
          if (poData) {
            const supplier = suppliers.find(s => s.id === poData.supplier_id);
            const whtRate = settings?.wht_enabled && supplier ? Number(supplier.wht_rate) : 0;
            const whtAmount = settings?.wht_enabled ? Number(poData.subtotal) * whtRate / 100 : 0;
            const netTotal = Number(poData.subtotal) + Number(poData.gst) - whtAmount;

            await supabase.from("purchase_invoices").insert({
              bill_number: billNumber, supplier_id: poData.supplier_id, grn_id: grn.id,
              date: grn.date, subtotal: Number(poData.subtotal), gst: Number(poData.gst),
              wht_amount: whtAmount, total: netTotal, status: "unpaid",
            });
            toast.success(`✓ GRN ${grnNumber} + Bill ${billNumber} created — stock updated`);
          }
        }
      } catch {
        toast.success(`✓ GRN ${grnNumber} created — stock updated`);
      }

      // Auto-download GRN PDF
      generatePdf({
        title: "GOODS RECEIVED NOTE", documentNumber: grnNumber, date: grn.date,
        partyLabel: "Supplier", partyName: (receivePO.suppliers as any)?.name || "—",
        columns: [
          { header: "#", key: "idx" }, { header: "Item", key: "item_name" },
          { header: "Batch", key: "batch_number" }, { header: "Expiry", key: "expiry_date" },
          { header: "Qty Received", key: "quantity_received", align: "right" },
        ],
        rows: receiveItems.map((i: any, idx: number) => ({
          idx: idx + 1, item_name: i.item_name, batch_number: i.batch_number || "—",
          expiry_date: i.expiry_date || "—", quantity_received: i.quantity_received,
        })),
        settings, template: getTemplate("grn"),
      });

      setReceiveOpen(false); setReceivedBy(""); setReceiveNotes(""); load();
    }
  };

  const { subtotal, gst, total } = calcTotals();
  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));
  const getDateFilter = () => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    if (dateRange === "today") return todayStr;
    if (dateRange === "week") {
      const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.toISOString().split("T")[0];
    }
    if (dateRange === "month") return todayStr.slice(0, 7) + "-01";
    return null;
  };

  const filtered = docs.filter(p => {
    const matchSearch = p.doc_number.toLowerCase().includes(search.toLowerCase()) ||
      ((p.suppliers as any)?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (p.po_number || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchSupplier = !supplierFilter || p.supplier_id === supplierFilter;
    const dateStart = getDateFilter();
    const matchDate = !dateStart || p.date >= dateStart;
    return matchSearch && matchStatus && matchSupplier && matchDate;
  });

  // Summary stats
  const statsByStatus = (status: string) => {
    const items = docs.filter(d => d.status === status);
    return { count: items.length, value: items.reduce((s, d) => s + Number(d.total), 0) };
  };
  const draftStats = statsByStatus("draft");
  const orderedStats = statsByStatus("ordered");
  const confirmedStats = statsByStatus("confirmed");
  const receivedStats = statsByStatus("received");

  const toggleSelect = (id: string) => { const s = new Set(selected); s.has(id) ? s.delete(id) : s.add(id); setSelected(s); };
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)));

  const promptDelete = (ids: string[]) => { setDeleteIds(ids); setDeleteConfirmOpen(true); };

  const handleBulkDelete = async () => {
    const ids = deleteIds;
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      await supabase.from("purchase_proforma_items").delete().in("proforma_id", chunk);
      await supabase.from("additional_costs").delete().eq("reference_type", "purchase_proforma").in("reference_id", chunk);
      await supabase.from("purchase_proformas").delete().in("id", chunk);
    }
    toast.success(`${ids.length} deleted`);
    setSelected(new Set()); setDeleteConfirmOpen(false); setDeleteIds([]); load();
  };

  const addCostToExisting = async () => {
    if (!selectedProformaId || !costAmount) return;
    await supabase.from("additional_costs").insert({
      reference_type: "purchase_proforma", reference_id: selectedProformaId,
      cost_type: costType, description: costDesc, amount: Number(costAmount),
      vendor_id: costVendorId || null,
    });
    toast.success("Additional cost added");
    setCostOpen(false); setCostDesc(""); setCostAmount(""); setCostVendorId("");
  };

  // Detail
  const openDetail = async (doc: PurchaseDoc) => {
    setDetailPP(doc);
    if (doc.source === "proforma") {
      const [itemsRes, costsRes] = await Promise.all([
        supabase.from("purchase_proforma_items").select("*, products(name)").eq("proforma_id", doc.id),
        supabase.from("additional_costs").select("*").eq("reference_type", "purchase_proforma").eq("reference_id", doc.id),
      ]);
      setDetailItems(itemsRes.data || []);
      setDetailCosts(costsRes.data || []);
    } else {
      const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", doc.id);
      setDetailItems(poItems || []);
      setDetailCosts([]);
    }
    setEditMode(false);
    setDetailOpen(true);
  };

  const enterEditMode = () => {
    if (!detailPP || detailPP.source !== "proforma") return;
    setEditSupplierId(detailPP.supplier_id || "");
    setEditDate(detailPP.date);
    setEditValidity(String(detailPP.validity_days));
    setEditNotes(detailPP.notes || "");
    setEditItems(detailItems.map((i: any) => ({
      product_id: i.product_id || "", product_name: i.products?.name || "Item",
      quantity_requested: i.quantity_requested, rate: Number(i.rate), amount: Number(i.amount),
    })));
    setEditMode(true);
  };

  const updateEditItem = (idx: number, field: string, value: any) => {
    const u = [...editItems];
    (u[idx] as any)[field] = value;
    if (field === "product_id") {
      const p = products.find(pr => pr.id === value);
      if (p) { u[idx].product_name = p.name; u[idx].rate = Number(p.cost_price); }
    }
    u[idx].amount = Number(u[idx].quantity_requested) * Number(u[idx].rate);
    setEditItems(u);
  };

  const handleEditSave = async () => {
    if (!detailPP) return;
    const subtotal = editItems.reduce((s, i) => s + i.amount, 0);
    const gst = settings?.gst_enabled ? subtotal * (Number(settings.default_gst_rate) / 100) : 0;
    const total = subtotal + gst;
    await supabase.from("purchase_proformas").update({
      supplier_id: editSupplierId || null, date: editDate, validity_days: Number(editValidity),
      notes: editNotes || null, subtotal, gst, total,
    }).eq("id", detailPP.id);
    await supabase.from("purchase_proforma_items").delete().eq("proforma_id", detailPP.id);
    if (editItems.length > 0) {
      await supabase.from("purchase_proforma_items").insert(editItems.map(i => ({
        proforma_id: detailPP.id, product_id: i.product_id || null,
        quantity_requested: Number(i.quantity_requested), rate: Number(i.rate), amount: i.amount,
      })));
    }
    toast.success("Draft updated");
    setDetailOpen(false); setEditMode(false); load();
  };

  const statusColor = (s: string) => {
    if (s === "received") return "bg-chart-2/20 text-chart-2 font-semibold";
    if (s === "ordered" || s === "confirmed") return "bg-primary/20 text-primary font-semibold";
    if (s === "draft") return "bg-warning/10 text-warning";
    return "bg-muted text-muted-foreground";
  };

  const statusLabel = (s: string) => {
    if (s === "draft") return "Draft";
    if (s === "ordered") return "Ordered";
    if (s === "confirmed") return "Confirmed";
    if (s === "received") return "Received";
    return s;
  };

  const STATUS_OPTIONS = ["all", "draft", "ordered", "confirmed", "received"];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <div className="flex-1">
              <h1 className="text-xl font-bold text-foreground font-heading">Purchases</h1>
              <p className="text-sm text-muted-foreground">Draft → Order → Receive (auto GRN + Bill) — all in one place</p>
            </div>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New Draft</Button></DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>New Purchase Draft</DialogTitle></DialogHeader>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <Label>Supplier *</Label>
                    <SearchableSelect options={supplierOptions} value={supplierId} onChange={setSupplierId} placeholder="Search supplier..." />
                  </div>
                  <div><Label>Date</Label><Input type="date" value={ppDate} onChange={e => setPpDate(e.target.value)} /></div>
                  <div><Label>Validity (days)</Label><Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} /></div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Items</Label>
                    <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                      <div className="col-span-4">
                        <SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" />
                      </div>
                      <div className="col-span-2"><Input type="number" value={item.quantity_requested} onChange={e => updateItem(idx, "quantity_requested", e.target.value)} className="text-xs" placeholder="Qty" /></div>
                      <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateItem(idx, "rate", e.target.value)} className="text-xs" placeholder="Rate" /></div>
                      <div className="col-span-3 text-right text-sm font-mono pt-2">{item.amount.toLocaleString()}</div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setItems(items.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <Label className="text-sm font-semibold">Additional Costs</Label>
                  {costs.map((c, idx) => (
                    <div key={idx} className="flex items-center gap-2 mb-1 text-xs">
                      <span className="bg-muted px-2 py-1 rounded capitalize">{c.cost_type}</span>
                      <span className="flex-1">{c.description}</span>
                      <span className="font-mono">PKR {Number(c.amount).toLocaleString()}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCosts(costs.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                    </div>
                  ))}
                  <div className="grid grid-cols-12 gap-2 mt-2 items-end">
                    <div className="col-span-2">
                      <Select value={costType} onValueChange={setCostType}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="printing">Printing</SelectItem><SelectItem value="packaging">Packaging</SelectItem>
                          <SelectItem value="freight_in">Freight In</SelectItem><SelectItem value="freight_out">Freight Out</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3"><Input className="text-xs" placeholder="Description" value={costDesc} onChange={e => setCostDesc(e.target.value)} /></div>
                    <div className="col-span-2"><Input className="text-xs" type="number" placeholder="Amount" value={costAmount} onChange={e => setCostAmount(e.target.value)} /></div>
                    <div className="col-span-3">
                      <Select value={costVendorId} onValueChange={setCostVendorId}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="Vendor" /></SelectTrigger>
                        <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Button variant="outline" size="sm" onClick={addCostLine} className="text-xs w-full">+ Add</Button></div>
                  </div>
                </div>
                <div className="mt-4 border-t border-border pt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{subtotal.toLocaleString()}</span></div>
                  {settings?.gst_enabled && <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">{gst.toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {total.toLocaleString()}</span></div>
                </div>
                <div className="mt-3"><Label>Notes</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></div>
                <Button onClick={handleSave} className="w-full mt-4">Create Draft</Button>
              </DialogContent>
            </Dialog>
          </header>

          <div className="p-6">
            {/* Summary Stats Strip */}
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Drafts", ...draftStats, onClick: () => setStatusFilter("draft") },
                { label: "Ordered", ...orderedStats, onClick: () => setStatusFilter("ordered") },
                { label: "Confirmed", ...confirmedStats, onClick: () => setStatusFilter("confirmed") },
                { label: "Received", ...receivedStats, onClick: () => setStatusFilter("received") },
              ].map(s => (
                <button key={s.label} onClick={s.onClick} className="text-left p-3 rounded-lg border border-border hover:bg-accent/50 transition-all">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{s.label}</p>
                  <p className="text-lg font-bold font-heading text-foreground">{s.count}</p>
                  <p className="text-xs font-mono text-muted-foreground">PKR {s.value.toLocaleString()}</p>
                </button>
              ))}
            </div>

            {/* Status flow */}
            <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2.5 border border-border">
              <span className="px-2 py-1 rounded bg-warning/10 text-warning font-semibold">Draft</span>
              <span>→</span>
              <span className="px-2 py-1 rounded bg-primary/20 text-primary font-semibold">Ordered (PO)</span>
              <span>→</span>
              <span className="px-2 py-1 rounded bg-chart-2/20 text-chart-2 font-semibold">Received (GRN + Bill)</span>
              <span className="ml-auto italic">One click at each step</span>
            </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by number, supplier..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="flex items-center gap-1">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-accent"}`}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="w-48">
                <SearchableSelect options={[{ value: "", label: "All Suppliers" }, ...supplierOptions]} value={supplierFilter} onChange={setSupplierFilter} placeholder="Filter supplier..." />
              </div>
              <div className="flex items-center gap-1">
                {[{ label: "All", value: "all" }, { label: "Today", value: "today" }, { label: "Week", value: "week" }, { label: "Month", value: "month" }].map(d => (
                  <button key={d.value} onClick={() => setDateRange(d.value)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${dateRange === d.value ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:bg-muted"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
              </div>
            </div>
            <Card className="glass-card">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead>Doc #</TableHead><TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
                      <TableHead>Status</TableHead><TableHead>GRN</TableHead><TableHead className="text-right">Total</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                        <p>No purchase documents yet.</p>
                        <p className="text-xs mt-1">Click "New Draft" to start a purchase.</p>
                      </TableCell></TableRow>
                    ) : filtered.map(doc => (
                      <TableRow key={`${doc.source}-${doc.id}`} className="cursor-pointer" data-state={selected.has(doc.id) ? "selected" : undefined}>
                        <TableCell><Checkbox checked={selected.has(doc.id)} onCheckedChange={() => toggleSelect(doc.id)} /></TableCell>
                        <TableCell className="font-medium font-mono" onClick={() => openDetail(doc)}>{doc.doc_number}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground" onClick={() => openDetail(doc)}>{doc.po_number || "—"}</TableCell>
                        <TableCell onClick={() => openDetail(doc)}>{(doc.suppliers as any)?.name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground" onClick={() => openDetail(doc)}>{doc.date}</TableCell>
                        <TableCell onClick={() => openDetail(doc)}>
                          <span className={`status-pill ${statusColor(doc.status)}`}>{statusLabel(doc.status)}</span>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{doc.grn_number || "—"}</TableCell>
                        <TableCell className="text-right font-mono font-medium" onClick={() => openDetail(doc)}>{Number(doc.total).toLocaleString()}</TableCell>
                        <TableCell className="space-x-1">
                          {doc.status === "draft" && doc.source === "proforma" && (
                            <Button variant="outline" size="sm" onClick={() => handleApprove(doc)} className="text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" /> Confirm Order
                            </Button>
                          )}
                          {(doc.status === "ordered" || doc.status === "confirmed") && (
                            <Button variant="outline" size="sm" onClick={() => openReceiveDialog(doc)} className="text-xs">
                              <PackageCheck className="h-3 w-3 mr-1" /> Mark Received
                            </Button>
                          )}
                          {doc.source === "proforma" && doc.status === "draft" && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedProformaId(doc.id); setCostOpen(true); }} className="text-xs">
                                <DollarSign className="h-3 w-3 mr-1" /> Costs
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => promptDelete([doc.id])}>
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </>
                          )}
                          <Button variant="outline" size="sm" onClick={async () => {
                            if (doc.source === "proforma" && !doc.converted_po_id) {
                              const { data: ppItems } = await supabase.from("purchase_proforma_items").select("*, products(name)").eq("proforma_id", doc.id);
                              generatePdf({
                                title: "PURCHASE PROFORMA", documentNumber: doc.doc_number, date: doc.date,
                                partyLabel: "Supplier", partyName: (doc.suppliers as any)?.name || "—",
                                columns: [
                                  { header: "#", key: "idx" }, { header: "Product", key: "name" },
                                  { header: "Qty", key: "quantity_requested", align: "right" }, { header: "Rate", key: "rate", align: "right" },
                                  { header: "Amount", key: "amount", align: "right" },
                                ],
                                rows: (ppItems || []).map((i: any, idx: number) => ({
                                  idx: idx + 1, name: i.products?.name || "Item",
                                  quantity_requested: i.quantity_requested, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
                                })),
                                totals: [
                                  { label: "Subtotal", value: `PKR ${Number(doc.subtotal).toLocaleString()}` },
                                  { label: "GST", value: `PKR ${Number(doc.gst).toLocaleString()}` },
                                  { label: "Total", value: `PKR ${Number(doc.total).toLocaleString()}` },
                                ],
                                notes: doc.notes || undefined, settings,
                              });
                            } else {
                              const poId = doc.converted_po_id || doc.id;
                              const { data: po } = await supabase.from("purchase_orders").select("*").eq("id", poId).single();
                              const { data: poItems } = await supabase.from("purchase_order_items").select("*, products(name)").eq("po_id", poId);
                              if (po) {
                                generatePdf({
                                  title: "PURCHASE ORDER", documentNumber: po.po_number, date: po.date,
                                  partyLabel: "Supplier", partyName: (doc.suppliers as any)?.name || "—",
                                  columns: [
                                    { header: "#", key: "idx" }, { header: "Product", key: "name" },
                                    { header: "Qty", key: "quantity", align: "right" }, { header: "Rate", key: "rate", align: "right" },
                                    { header: "Amount", key: "amount", align: "right" },
                                  ],
                                  rows: (poItems || []).map((i: any, idx: number) => ({
                                    idx: idx + 1, name: i.products?.name || "Item",
                                    quantity: i.quantity, rate: Number(i.rate).toLocaleString(), amount: Number(i.amount).toLocaleString(),
                                  })),
                                  totals: [
                                    { label: "Subtotal", value: `PKR ${Number(po.subtotal).toLocaleString()}` },
                                    { label: "GST", value: `PKR ${Number(po.gst).toLocaleString()}` },
                                    { label: "Total", value: `PKR ${Number(po.total).toLocaleString()}` },
                                  ],
                                  settings, template: getTemplate("purchase_order"),
                                });
                              }
                            }
                          }} className="text-xs"><Download className="h-3 w-3 mr-1" />PDF</Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {selected.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-destructive text-destructive-foreground px-6 py-3 rounded-full shadow-lg flex items-center gap-3 z-50">
              <span className="text-sm font-medium">{selected.size} selected</span>
              <Button size="sm" variant="secondary" onClick={() => promptDelete(Array.from(selected))}>
                <Trash2 className="h-3 w-3 mr-1" /> Delete
              </Button>
            </div>
          )}

          {/* Detail/Edit Dialog */}
          <Dialog open={detailOpen} onOpenChange={o => { if (!o) { setDetailOpen(false); setEditMode(false); } }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{detailPP?.doc_number} — {statusLabel(detailPP?.status || "")}</span>
                  {!editMode && detailPP?.source === "proforma" && detailPP?.status === "draft" && (
                    <Button variant="outline" size="sm" onClick={enterEditMode}><Pencil className="h-3 w-3 mr-1" /> Edit</Button>
                  )}
                </DialogTitle>
              </DialogHeader>

              {!editMode ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Supplier:</span> <strong>{(detailPP?.suppliers as any)?.name || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Date:</span> {detailPP?.date}</div>
                    <div><span className="text-muted-foreground">Status:</span> <span className={`status-pill ${statusColor(detailPP?.status || "")}`}>{statusLabel(detailPP?.status || "")}</span></div>
                    {detailPP?.po_number && <div><span className="text-muted-foreground">PO #:</span> <strong className="font-mono">{detailPP.po_number}</strong></div>}
                    {detailPP?.grn_number && <div><span className="text-muted-foreground">GRN #:</span> <strong className="font-mono">{detailPP.grn_number}</strong></div>}
                    {detailPP?.bill_number && <div><span className="text-muted-foreground">Bill #:</span> <strong className="font-mono">{detailPP.bill_number}</strong></div>}
                  </div>
                  {detailPP?.notes && <p className="text-sm text-muted-foreground mt-2">Notes: {detailPP.notes}</p>}
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>#</TableHead><TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Rate</TableHead><TableHead className="text-right">Amount</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {detailItems.map((i: any, idx: number) => (
                        <TableRow key={i.id}>
                          <TableCell>{idx + 1}</TableCell>
                          <TableCell>{i.products?.name || "Item"}</TableCell>
                          <TableCell className="text-right">{i.quantity_requested || i.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.rate).toLocaleString()}</TableCell>
                          <TableCell className="text-right font-mono">{Number(i.amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {detailCosts.length > 0 && (
                    <div className="mt-3">
                      <Label className="text-sm font-semibold">Additional Costs</Label>
                      {detailCosts.map((c: any) => (
                        <div key={c.id} className="flex justify-between text-xs py-1">
                          <span className="capitalize">{c.cost_type}: {c.description}</span>
                          <span className="font-mono">PKR {Number(c.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="border-t border-border pt-3 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">PKR {Number(detailPP?.subtotal || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">GST</span><span className="font-mono">PKR {Number(detailPP?.gst || 0).toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold"><span>Total</span><span className="font-mono">PKR {Number(detailPP?.total || 0).toLocaleString()}</span></div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label>Supplier</Label>
                      <SearchableSelect options={supplierOptions} value={editSupplierId} onChange={setEditSupplierId} placeholder="Search supplier..." />
                    </div>
                    <div><Label>Date</Label><Input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} /></div>
                    <div><Label>Validity (days)</Label><Input type="number" value={editValidity} onChange={e => setEditValidity(e.target.value)} /></div>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Items</Label>
                      <Button variant="outline" size="sm" onClick={() => setEditItems([...editItems, { product_id: "", product_name: "", quantity_requested: 1, rate: 0, amount: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                    </div>
                    {editItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                        <div className="col-span-4">
                          <SearchableSelect options={productOptions} value={item.product_id} onChange={v => updateEditItem(idx, "product_id", v)} placeholder="Product" triggerClassName="text-xs h-9" />
                        </div>
                        <div className="col-span-2"><Input type="number" value={item.quantity_requested} onChange={e => updateEditItem(idx, "quantity_requested", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-2"><Input type="number" value={item.rate} onChange={e => updateEditItem(idx, "rate", e.target.value)} className="text-xs" /></div>
                        <div className="col-span-3 text-right text-sm font-mono pt-2">{item.amount.toLocaleString()}</div>
                        <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3 text-destructive" /></Button></div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3"><Label>Notes</Label><Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} /></div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleEditSave} className="flex-1">Save Changes</Button>
                    <Button variant="outline" onClick={() => setEditMode(false)}>Cancel</Button>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Delete confirmation */}
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Delete {deleteIds.length} item(s)? This will also remove items and additional costs.</p>
              <div className="flex gap-2 mt-4">
                <Button variant="destructive" onClick={handleBulkDelete} className="flex-1">Delete</Button>
                <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} className="flex-1">Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add cost to existing */}
          <Dialog open={costOpen} onOpenChange={setCostOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Additional Cost</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Cost Type</Label>
                  <Select value={costType} onValueChange={setCostType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="printing">Printing</SelectItem><SelectItem value="packaging">Packaging</SelectItem>
                      <SelectItem value="freight_in">Freight In</SelectItem><SelectItem value="freight_out">Freight Out</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Description</Label><Input value={costDesc} onChange={e => setCostDesc(e.target.value)} /></div>
                <div><Label>Amount</Label><Input type="number" value={costAmount} onChange={e => setCostAmount(e.target.value)} /></div>
                <div>
                  <Label>Vendor</Label>
                  <SearchableSelect options={supplierOptions} value={costVendorId} onChange={setCostVendorId} placeholder="Select vendor..." />
                </div>
                <Button onClick={addCostToExisting} className="w-full">Add Cost</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Receive Dialog (GRN) */}
          <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Receive Goods — Create GRN + Bill</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground mb-3">Enter batch numbers & expiry dates for each item. This will create a GRN, update stock, and auto-generate a Purchase Bill.</p>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div><Label>Received By</Label><Input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Name" /></div>
                <div><Label>Notes</Label><Input value={receiveNotes} onChange={e => setReceiveNotes(e.target.value)} placeholder="Optional notes" /></div>
              </div>
              <div className="text-xs text-muted-foreground grid grid-cols-12 gap-2 mb-1 px-1">
                <span className="col-span-3">Item</span>
                <span className="col-span-2">Batch # *</span>
                <span className="col-span-2">Expiry *</span>
                <span className="col-span-1">Ordered</span>
                <span className="col-span-2">Received</span>
                <span className="col-span-2">Rate</span>
              </div>
              {receiveItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 mb-2 items-end">
                  <div className="col-span-3"><Input value={item.item_name} disabled className="text-xs bg-muted" /></div>
                  <div className="col-span-2"><Input value={item.batch_number} onChange={e => { const u = [...receiveItems]; u[idx].batch_number = e.target.value; setReceiveItems(u); }} className="text-xs" placeholder="Batch #" /></div>
                  <div className="col-span-2"><Input type="date" value={item.expiry_date} onChange={e => { const u = [...receiveItems]; u[idx].expiry_date = e.target.value; setReceiveItems(u); }} className="text-xs" /></div>
                  <div className="col-span-1"><Input type="number" value={item.quantity} className="text-xs" disabled /></div>
                  <div className="col-span-2"><Input type="number" value={item.quantity_received} onChange={e => { const u = [...receiveItems]; u[idx].quantity_received = e.target.value; setReceiveItems(u); }} className="text-xs" /></div>
                  <div className="col-span-2"><Input type="number" value={item.rate} className="text-xs" disabled /></div>
                </div>
              ))}
              <Button onClick={handleReceive} className="w-full mt-3">Confirm Receipt — Create GRN + Bill</Button>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </SidebarProvider>
  );
}
