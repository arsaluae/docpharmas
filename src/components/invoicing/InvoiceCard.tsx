import { FBRQRCode } from "./FBRQRCode";
import { BadgeCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InvoiceItem {
  name: string;
  qty: number;
  rate: number;
}

interface InvoiceCardProps {
  invoiceNumber: string;
  customerName: string;
  customerNtn: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: string;
  fbrQrData: string | null;
  onFinalize?: () => void;
  finalizing?: boolean;
}

export function InvoiceCard({
  invoiceNumber,
  customerName,
  customerNtn,
  items,
  subtotal,
  tax,
  total,
  status,
  fbrQrData,
  onFinalize,
  finalizing,
}: InvoiceCardProps) {
  const isFinalized = status === "finalized";

  return (
    <Card className={cn("transition-all duration-300", isFinalized && "border-primary/30")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-heading">{invoiceNumber}</CardTitle>
          <span
            className={cn(
              "status-pill",
              isFinalized ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            {isFinalized ? "FBR Finalized" : "Draft"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {customerName} {customerNtn && `· NTN: ${customerNtn}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Line items */}
        <div className="space-y-1">
          {(items as InvoiceItem[]).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.name} × {item.qty}</span>
              <span className="font-mono text-foreground">
                {(item.qty * item.rate).toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-2 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span className="font-mono">{Number(subtotal).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Tax (17%)</span>
            <span className="font-mono">{Number(tax).toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm font-semibold text-foreground">
            <span>Total</span>
            <span className="font-mono">PKR {Number(total).toLocaleString()}</span>
          </div>
        </div>

        {isFinalized && fbrQrData ? (
          <div className="flex items-center gap-4 pt-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <FBRQRCode data={fbrQrData} size={80} />
            <div>
              <div className="flex items-center gap-1.5 text-primary font-heading font-semibold text-sm">
                <BadgeCheck className="h-4 w-4" />
                FBR Verified
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 font-mono break-all">
                {fbrQrData.slice(0, 40)}…
              </p>
            </div>
          </div>
        ) : (
          <Button
            onClick={onFinalize}
            disabled={finalizing}
            className="w-full gap-2"
            size="sm"
          >
            <Send className="h-3.5 w-3.5" />
            {finalizing ? "Sending to FBR…" : "Direct-to-FBR"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
