
REVOKE ALL ON public.mv_trial_balance FROM anon, authenticated;
GRANT SELECT ON public.mv_trial_balance TO service_role;

REVOKE ALL ON FUNCTION public.recompute_party_balance(text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompute_bank_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompute_product_stock(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompute_account_balance(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recompute_tenant_all(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.refresh_trial_balance() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.run_reconciliation(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.recompute_party_balance(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_bank_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_product_stock(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_account_balance(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_tenant_all(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_trial_balance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_reconciliation(uuid, boolean) TO authenticated;
