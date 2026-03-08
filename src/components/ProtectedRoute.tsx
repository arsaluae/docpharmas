import { useAuth } from "@/hooks/useAuth";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TenantProvider, useTenant } from "@/hooks/useTenant";
import { Loader2 } from "lucide-react";

function SubscriptionGuard() {
  const { subscriptionStatus, isAdmin, loading } = useTenant();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admins bypass subscription check
  if (isAdmin) return <Outlet />;

  // Allow access to subscription page always
  if (location.pathname === "/subscription") return <Outlet />;

  // If expired, redirect to subscription page
  if (subscriptionStatus === "expired") {
    return <Navigate to="/subscription" replace />;
  }

  return <Outlet />;
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <TenantProvider>
      <SubscriptionGuard />
    </TenantProvider>
  );
}
