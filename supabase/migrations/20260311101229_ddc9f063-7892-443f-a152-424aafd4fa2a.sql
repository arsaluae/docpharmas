ALTER TABLE customer_products ADD COLUMN rate numeric NOT NULL DEFAULT 0;
ALTER TABLE supplier_products ADD COLUMN rate numeric NOT NULL DEFAULT 0;