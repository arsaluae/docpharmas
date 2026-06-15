REVOKE EXECUTE ON FUNCTION public.unmerge_supplier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmerge_customer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmerge_supplier(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unmerge_customer(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.unmerge_supplier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmerge_customer(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmerge_supplier(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.unmerge_customer(uuid) TO service_role;