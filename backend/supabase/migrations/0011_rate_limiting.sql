-- ============================================================================
-- Module 11: Rate Limiting Infrastructure
-- Table for sliding window rate limiting used by Edge Functions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key_created ON public.rate_limits (key, created_at);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON public.rate_limits (expires_at);

-- Cleanup function (call via pg_cron or Edge Function periodically)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.rate_limits
  WHERE expires_at < now();
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Schedule cleanup every 15 minutes (if pg_cron available)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'cleanup-rate-limits',
      '*/15 * * * *',
      'SELECT public.cleanup_rate_limits()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron not available for rate limit cleanup';
END;
$$;
