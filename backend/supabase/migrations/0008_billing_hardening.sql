-- ============================================================================
-- Module 8: Billing Hardening
-- Fixes: has_active_subscription period check, webhook idempotency index,
--        handle_new_auth_user plan hardcode
-- ============================================================================

-- ============================================================================
-- 1. Fix has_active_subscription — check current_period_end and trial_ends_at
-- ============================================================================

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id uuid, p_product text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid()
      AND user_id = p_user_id
      AND product = p_product
      AND status IN ('active', 'trialing')
      AND (
        current_period_end IS NULL
        OR current_period_end > now()
      )
      AND (
        trial_ends_at IS NULL
        OR trial_ends_at > now()
        OR status = 'active'
      )
  );
$$;

-- ============================================================================
-- 2. Webhook idempotency — unique index to prevent duplicate processing
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_idempotency
ON public.billing_webhook_events (provider, event_type, ((raw_payload->>'id')))
WHERE raw_payload->>'id' IS NOT NULL;

-- ============================================================================
-- 3. Ensure handle_new_auth_user always uses 'starter' plan (ignore metadata)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_slug text;
  v_allowed boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.allowed_emails ae
    WHERE ae.email = new.email AND ae.is_active = true
  ) INTO v_allowed;

  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'member'::org_role,
    v_allowed
  )
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email, is_active = excluded.is_active, updated_at = now();

  v_slug := new.raw_user_meta_data ->> 'tenant_id';
  IF v_slug IS NOT NULL AND v_slug != '' THEN
    -- Advisory lock on slug hash to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(v_slug));

    v_tenant_id := gen_random_uuid();

    -- ALWAYS use 'starter' plan regardless of metadata (prevents plan escalation)
    INSERT INTO public.tenants (id, slug, business_name, plan)
    VALUES (
      v_tenant_id,
      v_slug,
      coalesce(new.raw_user_meta_data ->> 'tenant_name', v_slug),
      'starter'::plan_name
    )
    ON CONFLICT (slug) DO UPDATE SET updated_at = now();

    SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_slug;

    INSERT INTO public.memberships (user_id, tenant_id, role)
    VALUES (new.id, v_tenant_id, 'owner')
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    INSERT INTO public.tenant_seats (user_id, tenant_id, is_active)
    VALUES (new.id, v_tenant_id, true)
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    UPDATE public.profiles SET tenant_id = v_tenant_id WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$;

-- ============================================================================
-- 4. Enable pg_cron for subscription expiration (if available)
-- ============================================================================

DO $$
BEGIN
  -- Try to create the cron extension (available on Supabase Pro+)
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- Schedule hourly expiration check
  PERFORM cron.schedule(
    'expire-subscriptions',
    '0 * * * *',
    'SELECT public.expire_overdue_subscriptions()'
  );
EXCEPTION WHEN OTHERS THEN
  -- pg_cron not available on this plan, skip silently
  RAISE NOTICE 'pg_cron not available — configure scheduled Edge Function for subscription expiration';
END;
$$;
