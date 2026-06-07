import { useRoles } from "@/hooks/useRoles";

/**
 * Legacy hook — kept for backward compatibility. `isAdmin` now means
 * "tenant owner". Prefer `useRoles()` for fine-grained capability checks.
 */
export function useUserRole() {
  const { role, loading } = useRoles();
  return { isAdmin: role === "owner", loading };
}
