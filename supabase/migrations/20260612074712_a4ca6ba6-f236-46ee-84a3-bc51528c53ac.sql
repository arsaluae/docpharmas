
-- A) Backfill sales_agents.user_id from tenant_users for matching emails
UPDATE public.sales_agents sa
SET user_id = tu.user_id
FROM public.tenant_users tu
JOIN auth.users au ON au.id = tu.user_id
WHERE sa.user_id IS NULL
  AND sa.tenant_id = tu.tenant_id
  AND tu.is_active = true
  AND tu.role IN ('sales_agent','staff')
  AND lower(sa.email) = lower(au.email);

-- B) Insert missing sales_agents rows for agent tenant_users that still lack one
INSERT INTO public.sales_agents (tenant_id, user_id, name, email, status, is_active, commission_type, commission_rate)
SELECT tu.tenant_id,
       tu.user_id,
       COALESCE(split_part(au.email, '@', 1), 'Sales Agent'),
       au.email,
       'active',
       true,
       'percentage',
       0
FROM public.tenant_users tu
JOIN auth.users au ON au.id = tu.user_id
WHERE tu.is_active = true
  AND tu.role IN ('sales_agent','staff')
  AND NOT EXISTS (
    SELECT 1 FROM public.sales_agents sa
    WHERE sa.tenant_id = tu.tenant_id AND sa.user_id = tu.user_id
  );

-- C) Default sales_agent_scope to 'all' for tenants with no assignments yet
UPDATE public.company_settings cs
SET sales_agent_scope = 'all'
WHERE cs.sales_agent_scope = 'assigned'
  AND NOT EXISTS (
    SELECT 1 FROM public.agent_customers ac WHERE ac.tenant_id = cs.tenant_id
  );
