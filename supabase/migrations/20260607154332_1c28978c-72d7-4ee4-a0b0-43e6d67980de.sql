-- ============================================================
-- Phase 3.B: 7-role RBAC with capability matrix + restrictive RLS
-- ============================================================

-- 1. Extend tenant_role enum (owner, staff already exist)
ALTER TYPE tenant_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE tenant_role ADD VALUE IF NOT EXISTS 'sales_mgr';
ALTER TYPE tenant_role ADD VALUE IF NOT EXISTS 'sales_agent';
ALTER TYPE tenant_role ADD VALUE IF NOT EXISTS 'inventory';
ALTER TYPE tenant_role ADD VALUE IF NOT EXISTS 'purchase_mgr';
ALTER TYPE tenant_role ADD VALUE IF NOT EXISTS 'viewer';
