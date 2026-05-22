
REVOKE EXECUTE ON FUNCTION public.dashboard_kpis(date,date,date,date,date,date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.dashboard_charts(date,date,date,date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dashboard_kpis(date,date,date,date,date,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_charts(date,date,date,date) TO authenticated;
