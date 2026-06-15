REVOKE ALL ON FUNCTION public.merge_suppliers(uuid, uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.merge_customers(uuid, uuid[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unmerge_supplier(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unmerge_customer(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.merge_suppliers(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmerge_supplier(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unmerge_customer(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.merge_suppliers(uuid, uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_customers(uuid, uuid[], text) TO service_role;
GRANT EXECUTE ON FUNCTION public.unmerge_supplier(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.unmerge_customer(uuid) TO service_role;