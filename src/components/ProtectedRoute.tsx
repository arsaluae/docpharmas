import { useAuth } from "@/hooks/useAuth";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { TenantProvider, useTenant } from "@/hooks/useTenant";
import { Loader2, Clock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import docpharmasLogo from "@/assets/docpharmas-logo.jpg";

function PendingApprovalScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-8">
        <img src={docpharmasLogo} alt="DocPharmas" className="w-16 h-16 rounded-xl object-cover mx-auto mb-4" />
        <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="font-heading text-xl font-bold text-foreground mb-2">Account Pending Approval</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your registration has been received. An administrator will review and approve your account shortly. 
          You'll be able to access the system once approved.
        </p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function DeactivatedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md p-8">
        <Ban className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="font-heading text-xl font-bold text-foreground mb-2">Account Deactivated</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Your account has been deactivated. Please contact your administrator for assistance.
        </p>
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}

function SubscriptionGuard() {
  const { subscriptionStatus, isAdmin, loading, tenantId, isDeactivated, isPending } = useTenant();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admins bypass all checks
  if (isAdmin) return <Outlet />;

  // No tenant link — check if pending signup
  if (!tenantId) {
    if (isPending) return <PendingApprovalScreen />;
    // Orphaned user with no pending signup — show pending screen anyway
    return <PendingApprovalScreen />;
  }

  // Tenant deactivated
  if (isDeactivated) return <DeactivatedScreen />;

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
