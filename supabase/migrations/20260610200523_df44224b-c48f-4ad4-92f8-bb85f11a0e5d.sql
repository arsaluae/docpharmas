
REVOKE EXECUTE ON FUNCTION public.report_profit_loss(date, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_sales_summary(date, date, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_receivables_aging(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_payables_aging(date) FROM PUBLIC;
