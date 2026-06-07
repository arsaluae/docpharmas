import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useRoles } from "@/hooks/useRoles";
import type { Action, Resource } from "@/lib/rbac";

interface Props {
  resource: Resource;
  action?: Action;
  /** Where to redirect if denied. Defaults to /dashboard. */
  fallback?: string;
}

/**
 * Route-level capability guard. Use as a wrapping <Route element>:
 *   <Route element={<RequireCap resource="finance" />}>
 *     <Route path="/expenses" element={<Expenses />} />
 *   </Route>
 *
 * Server-side RLS still enforces the same check — this is a UX gate.
 */
export function RequireCap({ resource, action = "read", fallback = "/dashboard" }: Props) {
  const { loading, can, role } = useRoles();
  const location = useLocation();
  const notified = useRef(false);

  const allowed = can(resource, action);

  useEffect(() => {
    if (!loading && !allowed && !notified.current) {
      notified.current = true;
      toast.error(`Your role does not have access to ${resource}.`);
    }
  }, [loading, allowed, resource]);

  if (loading || role === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to={fallback} replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
