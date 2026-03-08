import { useTenant } from "@/hooks/useTenant";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrialBanner() {
  const { subscriptionStatus, daysRemaining } = useTenant();
  const navigate = useNavigate();

  if (subscriptionStatus !== "trial" && subscriptionStatus !== "expired") return null;

  const isUrgent = daysRemaining <= 2;
  const isExpired = subscriptionStatus === "expired";

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-4 ${
      isExpired ? "bg-destructive/10 border border-destructive/20" :
      isUrgent ? "bg-amber-500/10 border border-amber-500/20" :
      "bg-primary/5 border border-primary/20"
    }`}>
      {isExpired || isUrgent
        ? <AlertTriangle className={`h-4 w-4 ${isExpired ? "text-destructive" : "text-amber-500"}`} />
        : <Clock className="h-4 w-4 text-primary" />}
      <span className="text-sm flex-1">
        {isExpired
          ? "Your subscription has expired. Upload payment to continue."
          : `${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} left in your free trial.`}
      </span>
      <Button size="sm" variant="outline" onClick={() => navigate("/subscription")} className="text-xs h-7">
        {isExpired ? "Renew Now" : "View Plans"}
      </Button>
    </div>
  );
}
