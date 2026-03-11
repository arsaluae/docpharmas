
-- Add code columns + license for suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS supplier_code text;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS license_number text;

-- Add code column for customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_code text;

-- Add code column for products
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_code text;

-- Seed document counters for existing tenants
INSERT INTO document_counters (tenant_id, document_type, prefix, current_value)
SELECT DISTINCT dc.tenant_id, 'supplier', 'SUP-', 0 FROM document_counters dc
WHERE NOT EXISTS (SELECT 1 FROM document_counters dc2 WHERE dc2.tenant_id = dc.tenant_id AND dc2.document_type = 'supplier');

INSERT INTO document_counters (tenant_id, document_type, prefix, current_value)
SELECT DISTINCT dc.tenant_id, 'customer', 'CUS-', 0 FROM document_counters dc
WHERE NOT EXISTS (SELECT 1 FROM document_counters dc2 WHERE dc2.tenant_id = dc.tenant_id AND dc2.document_type = 'customer');

INSERT INTO document_counters (tenant_id, document_type, prefix, current_value)
SELECT DISTINCT dc.tenant_id, 'product', 'PRD-', 0 FROM document_counters dc
WHERE NOT EXISTS (SELECT 1 FROM document_counters dc2 WHERE dc2.tenant_id = dc.tenant_id AND dc2.document_type = 'product');
