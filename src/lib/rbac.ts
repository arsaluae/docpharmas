// Capability matrix mirrored client-side. Source of truth is public.role_capabilities
// (Postgres); this is for UI gating only — the DB enforces it again via restrictive
// policies and the void_document RPC guard.

export type TenantRole =
  | "owner"
  | "accountant"
  | "sales_mgr"
  | "sales_agent"
  | "staff" // legacy alias for sales_agent
  | "inventory"
  | "purchase_mgr"
  | "viewer";

export type Resource =
  | "sales"
  | "purchase"
  | "inventory"
  | "finance"
  | "accounting"
  | "master"
  | "reports"
  | "settings"
  | "team"
  | "billing";

export type Action = "read" | "write" | "void" | "approve";

type Caps = Partial<Record<Resource, Partial<Record<Action, boolean>>>>;

const MATRIX: Record<TenantRole, Caps> = {
  owner: {}, // owner has everything — handled by isOwner shortcut
  accountant: {
    sales: { read: true },
    purchase: { read: true },
    inventory: { read: true },
    finance: { read: true, write: true, void: true, approve: true },
    accounting: { read: true, write: true, void: true, approve: true },
    master: { read: true },
    reports: { read: true },
    settings: { read: true },
  },
  sales_mgr: {
    sales: { read: true, write: true, void: true, approve: true },
    inventory: { read: true },
    purchase: { read: true },
    master: { read: true, write: true },
    finance: { read: true },
    reports: { read: true },
  },
  sales_agent: {
    sales: { read: true, write: true },
    master: { read: true },
    inventory: { read: true },
    reports: { read: true },
  },
  staff: {
    sales: { read: true, write: true },
    master: { read: true },
    inventory: { read: true },
    reports: { read: true },
  },
  inventory: {
    inventory: { read: true, write: true, void: true },
    purchase: { read: true },
    sales: { read: true },
    master: { read: true, write: true },
    reports: { read: true },
  },
  purchase_mgr: {
    purchase: { read: true, write: true, void: true, approve: true },
    inventory: { read: true },
    sales: { read: true },
    master: { read: true, write: true },
    finance: { read: true },
    reports: { read: true },
  },
  viewer: {
    sales: { read: true },
    purchase: { read: true },
    inventory: { read: true },
    finance: { read: true },
    accounting: { read: true },
    master: { read: true },
    reports: { read: true },
  },
};

export function can(role: TenantRole | null | undefined, resource: Resource, action: Action): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  return !!MATRIX[role]?.[resource]?.[action];
}

export const ROLE_LABEL: Record<TenantRole, string> = {
  owner: "Owner",
  accountant: "Accountant",
  sales_mgr: "Sales Manager",
  sales_agent: "Sales Agent",
  staff: "Sales (legacy)",
  inventory: "Inventory",
  purchase_mgr: "Purchase Manager",
  viewer: "Viewer (read-only)",
};

export const ROLE_DESCRIPTION: Record<TenantRole, string> = {
  owner: "Full access to every module, settings, billing and team.",
  accountant: "Manages finance & accounting (payments, journals, notes, periods). Reads everything else.",
  sales_mgr: "Full Sales hub, customers and sales agents. Reads stock & purchase.",
  sales_agent: "Creates quotations, proformas and sales orders for own assigned customers.",
  staff: "Legacy alias of Sales Agent — kept for backward compatibility.",
  inventory: "Products, stock, GRNs, delivery notes, reorder alerts. Reads purchase & sales.",
  purchase_mgr: "Full Purchase hub, suppliers, printers, landed costs. Reads stock & sales.",
  viewer: "Read-only access across the whole ERP. Cannot make changes.",
};

export const CREATABLE_ROLES: TenantRole[] = [
  "owner",
  "accountant",
  "sales_mgr",
  "sales_agent",
  "inventory",
  "purchase_mgr",
  "viewer",
];
