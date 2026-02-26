import { cn } from "@/lib/utils";
import { Lock, Unlock, XCircle, Calendar, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface Props {
  material: {
    id: string;
    name: string;
    supplier: string;
    lot_number: string;
    quantity: number;
    unit: string;
    status: string;
    received_at: string;
    expiry_date: string;
  };
  isAdmin: boolean;
  onRelease: (id: string, e: React.MouseEvent) => void;
}

export function QuarantineCard({ material, isAdmin, onRelease }: Props) {
  const isLocked = material.status === "locked";
  const isReleased = material.status === "released";
  const isRejected = material.status === "rejected";

  return (
    <div
      className={cn(
        "glass-card p-5 rounded-2xl transition-all duration-300",
        isLocked && "border-warning/40 shadow-[0_0_16px_hsl(var(--warning)/0.12)]",
        isReleased && "border-primary/30",
        isRejected && "border-destructive/40 shadow-[0_0_16px_hsl(var(--destructive)/0.1)]"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-heading font-semibold text-foreground text-sm">
            {material.name}
          </h3>
        </div>
        <span
          className={cn(
            "status-pill",
            isLocked && "bg-warning/10 text-warning",
            isReleased && "bg-primary/10 text-primary",
            isRejected && "bg-destructive/10 text-destructive"
          )}
        >
          {isLocked && <Lock className="h-3 w-3 mr-1" />}
          {isReleased && <Unlock className="h-3 w-3 mr-1" />}
          {isRejected && <XCircle className="h-3 w-3 mr-1" />}
          {material.status.charAt(0).toUpperCase() + material.status.slice(1)}
        </span>
      </div>

      <div className="space-y-1.5 text-xs text-muted-foreground">
        <p>Supplier: <span className="text-foreground">{material.supplier}</span></p>
        <p>Lot #: <span className="text-foreground font-mono">{material.lot_number}</span></p>
        <p>Qty: <span className="text-foreground">{material.quantity} {material.unit}</span></p>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Received: {format(new Date(material.received_at), "dd MMM yyyy")}</span>
        </div>
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          <span>Expires: {format(new Date(material.expiry_date), "dd MMM yyyy")}</span>
        </div>
      </div>

      {isLocked && isAdmin && (
        <Button
          onClick={(e) => onRelease(material.id, e)}
          className="w-full mt-4"
          size="sm"
        >
          <Unlock className="h-4 w-4 mr-2" />
          Release Material
        </Button>
      )}
    </div>
  );
}
