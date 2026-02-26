import { useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Step {
  id: string;
  step_name: string;
  step_order: number;
  yield_expected: number;
  yield_actual: number | null;
}

interface Props {
  steps: Step[];
  onUpdate: () => void;
}

export function YieldVarianceSidebar({ steps, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const overallExpected = steps.reduce((s, st) => s + Number(st.yield_expected), 0) / (steps.length || 1);
  const stepsWithActual = steps.filter((s) => s.yield_actual != null);
  const overallActual = stepsWithActual.length
    ? stepsWithActual.reduce((s, st) => s + Number(st.yield_actual!), 0) / stepsWithActual.length
    : null;

  const handleSave = async (stepId: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error("Enter a valid yield % (0-100)");
      return;
    }
    const { error } = await supabase
      .from("bmr_steps")
      .update({ yield_actual: val } as any)
      .eq("id", stepId);
    if (error) toast.error(error.message);
    else {
      toast.success("Yield updated");
      onUpdate();
    }
    setEditingId(null);
  };

  return (
    <div className="glass-card p-5 space-y-5">
      <div>
        <h3 className="font-heading font-semibold text-foreground text-base">
          Yield Variance
        </h3>
        <div className="flex items-baseline gap-3 mt-2">
          <span className="text-2xl font-heading font-bold text-foreground">
            {overallActual != null ? `${overallActual.toFixed(1)}%` : "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            / {overallExpected.toFixed(1)}% expected
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step) => {
          const variance =
            step.yield_actual != null
              ? step.yield_actual - step.yield_expected
              : null;
          const pct =
            step.yield_actual != null
              ? (Number(step.yield_actual) / Number(step.yield_expected)) * 100
              : 0;

          return (
            <div key={step.id} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-foreground font-medium">
                  {step.step_name}
                </span>
                {variance != null && (
                  <span
                    className={cn(
                      "font-medium",
                      variance >= 0 ? "text-primary" : "text-destructive"
                    )}
                  >
                    {variance >= 0 ? "+" : ""}
                    {variance.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    variance != null && variance < -3
                      ? "bg-destructive"
                      : "bg-primary"
                  )}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-muted-foreground">
                  Expected: {step.yield_expected}%
                </span>
                {editingId === step.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="w-14 h-6 text-[11px] rounded border border-border bg-card px-1 text-foreground"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && handleSave(step.id)
                      }
                      autoFocus
                    />
                    <button
                      onClick={() => handleSave(step.id)}
                      className="text-[10px] text-primary font-medium"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditingId(step.id);
                      setEditValue(
                        step.yield_actual != null
                          ? String(step.yield_actual)
                          : ""
                      );
                    }}
                    className="text-[10px] text-primary hover:underline"
                  >
                    {step.yield_actual != null
                      ? `${step.yield_actual}%`
                      : "Set actual"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
