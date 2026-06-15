
-- Supplier duplicate prevention: block inserts/updates of suppliers with the
-- same normalized name OR same supplier_code within a tenant. Existing
-- duplicate rows are left alone (will only fire on new inserts/edits).

CREATE OR REPLACE FUNCTION public.normalize_supplier_name(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(regexp_replace(coalesce(trim(s), ''), '[^[:alnum:]]+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.prevent_duplicate_supplier()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
  v_existing uuid;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Normalized name check
  v_norm := public.normalize_supplier_name(NEW.name);
  IF v_norm IS NOT NULL AND v_norm <> '' THEN
    SELECT id INTO v_existing
    FROM public.suppliers
    WHERE tenant_id = NEW.tenant_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND public.normalize_supplier_name(name) = v_norm
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RAISE EXCEPTION 'Supplier "%" already exists (id %). Use the existing record instead of creating a duplicate.', NEW.name, v_existing
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Supplier code check
  IF NEW.supplier_code IS NOT NULL AND trim(NEW.supplier_code) <> '' THEN
    SELECT id INTO v_existing
    FROM public.suppliers
    WHERE tenant_id = NEW.tenant_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND lower(trim(supplier_code)) = lower(trim(NEW.supplier_code))
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      RAISE EXCEPTION 'Supplier code "%" is already in use (id %).', NEW.supplier_code, v_existing
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_supplier ON public.suppliers;
CREATE TRIGGER trg_prevent_duplicate_supplier
BEFORE INSERT OR UPDATE OF name, supplier_code, tenant_id ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_supplier();
