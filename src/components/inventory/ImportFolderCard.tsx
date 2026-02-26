import { cn } from "@/lib/utils";
import { Ship, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

interface Folder {
  id: string;
  shipment_name: string;
  supplier: string;
  status: string;
  lc_number: string;
  duties: number;
  freight: number;
  insurance: number;
  total_landed_cost: number;
  arrival_date: string | null;
}

interface Props {
  folder: Folder;
}

export function ImportFolderCard({ folder }: Props) {
  const [expanded, setExpanded] = useState(false);

  const statusMap: Record<string, { label: string; cls: string }> = {
    in_transit: { label: "In Transit", cls: "bg-primary/10 text-primary" },
    customs: { label: "Customs", cls: "bg-warning/10 text-warning" },
    delivered: { label: "Delivered", cls: "bg-muted text-muted-foreground" },
  };

  const s = statusMap[folder.status] || statusMap.in_transit;

  return (
    <div className="glass-card p-5 rounded-2xl">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Ship className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h4 className="font-heading font-semibold text-foreground text-sm">
              {folder.shipment_name}
            </h4>
            <p className="text-xs text-muted-foreground">{folder.supplier}</p>
          </div>
        </div>
        <span className={cn("status-pill", s.cls)}>{s.label}</span>
      </div>

      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span>L/C: <span className="text-foreground font-mono">{folder.lc_number}</span></span>
        </div>
        <span className="font-heading font-bold text-foreground">
          ${folder.total_landed_cost.toLocaleString()}
        </span>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-primary mt-3 hover:underline"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        {expanded ? "Hide" : "View"} breakdown
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duties</span>
            <span className="text-foreground">${folder.duties.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Freight</span>
            <span className="text-foreground">${folder.freight.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Insurance</span>
            <span className="text-foreground">${folder.insurance.toLocaleString()}</span>
          </div>
          {folder.arrival_date && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Arrived</span>
              <span className="text-foreground">
                {format(new Date(folder.arrival_date), "dd MMM yyyy")}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
