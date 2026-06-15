
ALTER VIEW public.v_supplier_lookup SET (security_invoker = true);
ALTER VIEW public.v_customer_lookup SET (security_invoker = true);

REVOKE EXECUTE ON FUNCTION public.merge_suppliers(uuid, uuid[], text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.merge_customers(uuid, uuid[], text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmerge_supplier(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.unmerge_customer(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.detect_supplier_duplicates() FROM anon;
REVOKE EXECUTE ON FUNCTION public.detect_customer_duplicates() FROM anon;
