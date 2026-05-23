import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Truck, DollarSign, TrendingUp } from "lucide-react";
import { AllocatedProducts } from "@/components/AllocatedProducts";

interface SupplierProfileDialogProps {
 open: boolean;
 onOpenChange: (open: boolean) => void;
 supplierId: string | null;
 supplierName: string;
}

export function SupplierProfileDialog({ open, onOpenChange, supplierId, supplierName }: SupplierProfileDialogProps) {
 const [totalPurchases, setTotalPurchases] = useState(0);
 const [balance, setBalance] = useState(0);

 useEffect(() => {
 if (open && supplierId) loadProfile();
 }, [open, supplierId]);

 const loadProfile = async () => {
 if (!supplierId) return;
 const { data: supData } = await supabase.from("suppliers").select("balance").eq("id", supplierId).single();
 if (supData) setBalance(Number(supData.balance));

 const { data: purchaseData } = await supabase.from("purchase_invoices").select("total").eq("supplier_id", supplierId);
 if (purchaseData) setTotalPurchases(purchaseData.reduce((s, i) => s + Number(i.total), 0));
 };

 return (
 <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
 <DialogHeader>
 <DialogTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> {supplierName}</DialogTitle>
 <DialogDescription>Supplier profile, purchases summary & allocated products</DialogDescription>
 </DialogHeader>

 <div className="grid grid-cols-2 gap-3">
 <div className="p-3 rounded-lg border border-border bg-card">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><DollarSign className="h-3 w-3" /> Total Purchases</div>
 <p className="text-lg font-bold font-mono">PKR {totalPurchases.toLocaleString()}</p>
 </div>
 <div className="p-3 rounded-lg border border-border bg-card">
 <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1"><TrendingUp className="h-3 w-3" /> Amount Due</div>
 <p className="text-lg font-bold font-mono">PKR {balance.toLocaleString()}</p>
 </div>
 </div>

 {supplierId && <AllocatedProducts partyId={supplierId} partyType="supplier" />}
 </DialogContent>
 </Dialog>
 );
}
