-- ============================================================================
-- Module 7: Security Hardening
-- Fixes: profiles.role enum, FK tenant validation, subscription constraints,
--        dashboard KPI tenant filter, auth trigger race condition,
--        has_active_subscription access control, get_current_tenant ordering
-- ============================================================================

-- ============================================================================
-- 1. Convert profiles.role from text to org_role enum (Audit 2.4)
-- ============================================================================

-- First normalize any freetext values to valid enum members
UPDATE public.profiles SET role = 'member'
WHERE role NOT IN ('owner', 'admin', 'member', 'viewer');

-- Drop policies that depend on the role column before altering type
DROP POLICY IF EXISTS "profiles_self_insert" ON public.profiles;

-- Drop the default first, then change type, then set new default
ALTER TABLE public.profiles
  ALTER COLUMN role DROP DEFAULT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ALTER COLUMN role TYPE org_role USING role::org_role;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'member'::org_role;

-- Recreate the policy with the new enum type
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND role = 'member'::org_role);

-- ============================================================================
-- 2. Unique constraint on active subscriptions (Audit 3.2 / 5.3)
-- ============================================================================

-- Deduplicate: keep only the newest active/trialing subscription per user+product
DELETE FROM public.subscriptions a
USING public.subscriptions b
WHERE a.user_id = b.user_id
  AND a.product = b.product
  AND a.status = b.status
  AND a.status IN ('active', 'trialing')
  AND a.created_at < b.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_active_unique
ON public.subscriptions (user_id, product)
WHERE status IN ('active', 'trialing');

-- ============================================================================
-- 3. Add tenant_id to subscriptions (Audit 5.4)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD COLUMN tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

    -- Backfill from memberships
    UPDATE public.subscriptions s
    SET tenant_id = m.tenant_id
    FROM public.memberships m
    WHERE m.user_id = s.user_id AND m.role = 'owner';

    CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions (tenant_id);
  END IF;
END $$;

-- ============================================================================
-- 4. FK tenant validation triggers (Audit 2.6)
-- Prevent cross-tenant FK references
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_appointment_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_customer_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_customer_tenant
  FROM public.customers WHERE id = NEW.customer_id;

  IF v_customer_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant reference: appointment tenant_id does not match customer tenant_id';
  END IF;

  IF NEW.barber_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.memberships
      WHERE user_id = NEW.barber_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'Cross-tenant reference: barber does not belong to this tenant';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_appointment_tenant ON public.appointments;
CREATE TRIGGER trg_validate_appointment_tenant
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_tenant();

CREATE OR REPLACE FUNCTION public.validate_inventory_movement_tenant()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_product_tenant
  FROM public.inventory_products WHERE id = NEW.product_id;

  IF v_product_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Cross-tenant reference: movement tenant_id does not match product tenant_id';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_inventory_movement_tenant ON public.inventory_movements;
CREATE TRIGGER trg_validate_inventory_movement_tenant
  BEFORE INSERT OR UPDATE ON public.inventory_movements
  FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_movement_tenant();

-- ============================================================================
-- 5. Fix get_dashboard_kpis() — add tenant filter (Audit 2.5 / 5.2)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_profile_id uuid, p_role text)
RETURNS TABLE (
  appointments_today integer,
  appointments_week integer,
  appointments_month integer,
  revenue_month numeric,
  avg_ticket numeric,
  occupancy numeric,
  new_customers integer,
  recurring_customers integer
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_filter_by_barber boolean;
  v_total_revenue numeric(12,2);
  v_total_completed integer;
  v_appointments_week integer;
  v_slots numeric;
  v_tenant_ids uuid[];
BEGIN
  -- Get user's tenant IDs for filtering
  SELECT array_agg(tenant_id) INTO v_tenant_ids
  FROM public.memberships WHERE user_id = auth.uid();

  IF v_tenant_ids IS NULL THEN
    RETURN;
  END IF;

  v_filter_by_barber := lower(p_role) = 'barber';

  SELECT
    count(*) FILTER (WHERE a.appointment_date::date = current_date),
    count(*) FILTER (WHERE a.appointment_date::date >= date_trunc('week', current_date)::date),
    count(*) FILTER (WHERE date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date)),
    coalesce(sum(a.cost) FILTER (
      WHERE date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date)
      AND a.status NOT IN ('cancelled', 'no_show')
    ), 0),
    count(*) FILTER (
      WHERE date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date)
      AND a.status NOT IN ('cancelled', 'no_show')
    )
  INTO appointments_today, appointments_week, appointments_month, v_total_revenue, v_total_completed
  FROM public.appointments a
  WHERE a.tenant_id = ANY(v_tenant_ids)
    AND (NOT v_filter_by_barber OR a.barber_id = p_profile_id);

  revenue_month := v_total_revenue;
  avg_ticket := CASE WHEN v_total_completed > 0 THEN v_total_revenue / v_total_completed ELSE 0 END;

  SELECT count(*)
  INTO v_appointments_week
  FROM public.appointments a
  WHERE a.tenant_id = ANY(v_tenant_ids)
    AND a.appointment_date::date >= date_trunc('week', current_date)::date
    AND (NOT v_filter_by_barber OR a.barber_id = p_profile_id);

  v_slots := CASE
    WHEN v_filter_by_barber THEN 12 * 7
    ELSE greatest(12 * 7 * (
      SELECT count(*) FROM public.profiles
      WHERE tenant_id = ANY(v_tenant_ids) AND role = 'member'::org_role AND is_active
    ), 1)
  END;
  occupancy := round((v_appointments_week::numeric / greatest(v_slots, 1)) * 100, 2);

  SELECT count(*)
  INTO new_customers
  FROM public.customers c
  WHERE c.tenant_id = ANY(v_tenant_ids)
    AND date_trunc('month', c.created_at) = date_trunc('month', current_date)
    AND (NOT v_filter_by_barber OR EXISTS (
      SELECT 1 FROM public.appointments a2
      WHERE a2.customer_id = c.id AND a2.barber_id = p_profile_id
    ));

  SELECT count(*)
  INTO recurring_customers
  FROM public.customers c
  WHERE c.tenant_id = ANY(v_tenant_ids)
    AND c.total_appointments > 1
    AND date_trunc('month', coalesce(c.last_appointment_at, c.created_at)) = date_trunc('month', current_date)
    AND (NOT v_filter_by_barber OR EXISTS (
      SELECT 1 FROM public.appointments a2
      WHERE a2.customer_id = c.id AND a2.barber_id = p_profile_id
    ));

  RETURN NEXT;
END;
$$;

-- ============================================================================
-- 6. Fix has_active_subscription() — enforce auth.uid() (Audit 3.5)
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
  );
$$;

-- ============================================================================
-- 7. Fix get_current_tenant() — deterministic ordering (Audit 5.8)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_current_tenant()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.memberships
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC
  LIMIT 1;
$$;

-- ============================================================================
-- 8. Fix auth trigger race condition — advisory lock (Audit 3.6)
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
-- 9. Add CHECK constraint on subscriptions.provider (Audit 5.10)
-- ============================================================================

DO $$ BEGIN
  ALTER TABLE public.subscriptions
    ADD CONSTRAINT subscriptions_provider_check CHECK (provider IN ('flow', 'manual', 'stripe'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 10. Missing RLS policies for tenant_products and inventory_movements (Audit 5.9)
-- ============================================================================

DROP POLICY IF EXISTS "tenant_products_tenant_insert" ON public.tenant_products;
CREATE POLICY "tenant_products_tenant_insert" ON public.tenant_products FOR INSERT
  WITH CHECK (tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin'])));

DROP POLICY IF EXISTS "tenant_products_tenant_update" ON public.tenant_products;
CREATE POLICY "tenant_products_tenant_update" ON public.tenant_products FOR UPDATE
  USING (tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin'])));

DROP POLICY IF EXISTS "tenant_products_tenant_delete" ON public.tenant_products;
CREATE POLICY "tenant_products_tenant_delete" ON public.tenant_products FOR DELETE
  USING (tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin'])));

-- ============================================================================
-- 11. Add missing indexes for inventory_movements (Audit 5.6)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements (type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_type ON public.inventory_movements (product_id, type);
