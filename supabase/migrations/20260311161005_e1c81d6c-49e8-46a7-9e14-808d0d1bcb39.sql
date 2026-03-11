
-- Drop and recreate all triggers to ensure they're properly attached
DROP TRIGGER IF EXISTS trg_sales_invoice_balance ON public.sales_invoices;
DROP TRIGGER IF EXISTS trg_purchase_invoice_balance ON public.purchase_invoices;
DROP TRIGGER IF EXISTS trg_sales_return_balance ON public.sales_returns;
DROP TRIGGER IF EXISTS trg_purchase_return_balance ON public.purchase_returns;
DROP TRIGGER IF EXISTS trg_payment_balance ON public.payments;
DROP TRIGGER IF EXISTS trg_payment_invoice_status ON public.payments;
DROP TRIGGER IF EXISTS trg_stock_movement ON public.stock_movements;
DROP TRIGGER IF EXISTS trg_expense_bank_balance ON public.expenses;
DROP TRIGGER IF EXISTS trg_salary_bank_balance ON public.salary_payments;
DROP TRIGGER IF EXISTS trg_credit_note_balance ON public.credit_notes;
DROP TRIGGER IF EXISTS trg_print_job_balance ON public.print_jobs;

CREATE TRIGGER trg_sales_invoice_balance AFTER INSERT OR DELETE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION public.handle_sales_invoice_balance();
CREATE TRIGGER trg_purchase_invoice_balance AFTER INSERT OR DELETE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_invoice_balance();
CREATE TRIGGER trg_sales_return_balance AFTER INSERT OR DELETE ON public.sales_returns FOR EACH ROW EXECUTE FUNCTION public.handle_sales_return_balance();
CREATE TRIGGER trg_purchase_return_balance AFTER INSERT OR DELETE ON public.purchase_returns FOR EACH ROW EXECUTE FUNCTION public.handle_purchase_return_balance();
CREATE TRIGGER trg_payment_balance AFTER INSERT OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.handle_payment_balance();
CREATE TRIGGER trg_payment_invoice_status AFTER INSERT OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.handle_payment_invoice_status();
CREATE TRIGGER trg_stock_movement AFTER INSERT OR DELETE ON public.stock_movements FOR EACH ROW EXECUTE FUNCTION public.handle_stock_movement();
CREATE TRIGGER trg_expense_bank_balance AFTER INSERT OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.handle_expense_bank_balance();
CREATE TRIGGER trg_salary_bank_balance AFTER INSERT OR DELETE ON public.salary_payments FOR EACH ROW EXECUTE FUNCTION public.handle_salary_bank_balance();
CREATE TRIGGER trg_credit_note_balance AFTER INSERT OR DELETE ON public.credit_notes FOR EACH ROW EXECUTE FUNCTION public.handle_credit_note_balance();
CREATE TRIGGER trg_print_job_balance AFTER INSERT OR UPDATE OR DELETE ON public.print_jobs FOR EACH ROW EXECUTE FUNCTION public.handle_print_job_balance();
