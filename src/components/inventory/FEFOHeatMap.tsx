import { cn } from "@/lib/utils";
import { differenceInDays } from "date-fns";
import { format } from "date-fns";
import { AlertTriangle } from "lucide-react";

interface Item {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  expiry_date: string;
  location: string;
}

interface Props {
  items: Item[];
}

export function FEFOHeatMap({ items }: Props) {
  const sorted = [...items].sort(
    (a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
  );

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-border">
        <h3 className="font-heading font-semibold text-foreground">
          FEFO Expiry Dashboard
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          First-Expired, First-Out — sorted by expiry date
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Product</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">SKU</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Qty</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Location</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Expiry</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Days Left</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const daysLeft = differenceInDays(new Date(item.expiry_date), new Date());
              const isCritical = daysLeft <= 30;
              const isWarning = daysLeft > 30 && daysLeft <= 90;

              return (
                <tr
                  key={item.id}
                  className={cn(
                    "border-b border-border/60 transition-colors",
                    isCritical && "bg-destructive/[0.04] animate-pulse",
                    isWarning && "bg-warning/[0.04]"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      {isCritical && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                      )}
                      {item.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{item.sku}</td>
                  <td className="px-4 py-3 text-foreground">
                    {item.quantity.toLocaleString()} {item.unit}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.location}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(item.expiry_date), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "status-pill",
                        isCritical && "bg-destructive/10 text-destructive",
                        isWarning && "bg-warning/10 text-warning",
                        !isCritical && !isWarning && "bg-primary/10 text-primary"
                      )}
                    >
                      {daysLeft}d
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
