
-- Helper: returns the backup cron secret from vault, or empty string.
CREATE OR REPLACE FUNCTION public._backup_cron_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE v text;
BEGIN
  SELECT decrypted_secret INTO v
    FROM vault.decrypted_secrets
   WHERE name = 'cron_backup_secret'
   LIMIT 1;
  RETURN COALESCE(v, '');
END $$;

REVOKE ALL ON FUNCTION public._backup_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._backup_cron_secret() TO service_role;
