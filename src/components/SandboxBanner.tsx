import { useActiveTenant } from "@/hooks/useActiveTenant";
import { Button } from "@/components/ui/button";
import { FlaskConical, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

export function SandboxBanner() {
  const { isSandbox, info, exitSandbox } = useActiveTenant();
  if (!isSandbox || !info?.exists) return null;

  const short = (info.session_id || "").slice(0, 8);
  const created = info.created_at
    ? new Date(info.created_at).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div
      role="alert"
      className="sticky top-0 z-30 w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md print:hidden"
    >
      <div className="px-4 sm:px-6 h-10 flex items-center gap-3 text-[12px] font-semibold tracking-wide">
        <FlaskConical className="h-4 w-4 shrink-0" strokeWidth={2.25} />
        <span className="uppercase tracking-[0.18em]">Sandbox Mode</span>
        <span className="opacity-70">·</span>
        <span className="font-mono text-[11px] opacity-90">Session SBX-{short}</span>
        <span className="opacity-70 hidden sm:inline">·</span>
        <span className="opacity-90 hidden sm:inline text-[11px]">Created {created}</span>
        <span className="flex-1" />
        <Link to="/settings?tab=testing" className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded bg-white/15 hover:bg-white/25 transition text-[11px]">
          Manage session
        </Link>
        <Button
          size="sm"
          variant="secondary"
          onClick={exitSandbox}
          className="h-7 bg-white/95 text-amber-700 hover:bg-white border-0 font-semibold"
        >
          <LogOut className="h-3 w-3 mr-1" /> Exit Sandbox
        </Button>
      </div>
    </div>
  );
}
