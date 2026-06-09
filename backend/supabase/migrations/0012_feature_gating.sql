-- ============================================================================
-- Module 12: Feature Gating (Backend Enforcement)
-- Single source of truth for plan features, enforced at DB level via RLS
-- ============================================================================

-- ============================================================================
-- 1. Plan features table — single source of truth
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plan_features (
  plan plan_name NOT NULL,
  feature_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (plan, feature_key)
);

-- Seed plan features (matches frontend PLAN_LIMITS)
INSERT INTO public.plan_features (plan, feature_key, enabled) VALUES
  ('starter', 'excel_files', true),
  ('starter', 'customers', false),
  ('starter', 'appointments', false),
  ('starter', 'reports', false),
  ('pro', 'excel_files', true),
  ('pro', 'customers', false),
  ('pro', 'appointments', false),
  ('pro', 'reports', true),
  ('business', 'excel_files', true),
  ('business', 'customers', true),
  ('business', 'appointments', true),
  ('business', 'reports', true),
  ('enterprise', 'excel_files', true),
  ('enterprise', 'customers', true),
  ('enterprise', 'appointments', true),
  ('enterprise', 'reports', true)
ON CONFLICT (plan, feature_key) DO NOTHING;

-- Only service_role can modify plan features
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plan_features_select" ON public.plan_features;
CREATE POLICY "plan_features_select" ON public.plan_features FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================================
-- 2. Helper function: check if tenant has feature
-- ============================================================================

CREATE OR REPLACE FUNCTION public.tenant_has_feature(p_tenant_id uuid, p_feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT pf.enabled
     FROM public.plan_features pf
     JOIN public.tenants t ON t.plan = pf.plan
     WHERE t.id = p_tenant_id AND pf.feature_key = p_feature_key),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.tenant_has_feature(uuid, text) TO authenticated;

-- ============================================================================
-- 3. Helper function: get tenant's seat limit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenant_seat_limit(p_tenant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE t.plan
    WHEN 'starter' THEN 1
    WHEN 'pro' THEN 5
    WHEN 'business' THEN 20
    WHEN 'enterprise' THEN 2147483647  -- max int
    ELSE 1
  END
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_seat_limit(uuid) TO authenticated;

-- ============================================================================
-- 4. Helper function: get tenant's file limit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenant_file_limit(p_tenant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE t.plan
    WHEN 'starter' THEN 100
    WHEN 'pro' THEN 1000
    WHEN 'business' THEN 10000
    WHEN 'enterprise' THEN 2147483647
    ELSE 100
  END
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_file_limit(uuid) TO authenticated;

-- ============================================================================
-- 5. Update RLS policies — enforce feature gating on INSERT
-- ============================================================================

-- Customers: only tenants with 'customers' feature can INSERT
DROP POLICY IF EXISTS "customers_tenant_insert" ON public.customers;
CREATE POLICY "customers_tenant_insert" ON public.customers FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin','member']))
    AND public.tenant_has_feature(tenant_id, 'customers')
  );

-- Appointments: only tenants with 'appointments' feature can INSERT
DROP POLICY IF EXISTS "appointments_tenant_insert" ON public.appointments;
CREATE POLICY "appointments_tenant_insert" ON public.appointments FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

-- Services: only tenants with 'appointments' feature can INSERT (services go with appointments)
DROP POLICY IF EXISTS "services_tenant_insert" ON public.services;
CREATE POLICY "services_tenant_insert" ON public.services FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

-- Inventory: only tenants with 'appointments' feature can INSERT (inventory goes with business)
DROP POLICY IF EXISTS "inventory_products_tenant_insert" ON public.inventory_products;
CREATE POLICY "inventory_products_tenant_insert" ON public.inventory_products FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

DROP POLICY IF EXISTS "inventory_movements_tenant_insert" ON public.inventory_movements;
CREATE POLICY "inventory_movements_tenant_insert" ON public.inventory_movements FOR INSERT
  WITH CHECK (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

-- ============================================================================
-- 6. Update RLS policies — enforce feature gating on UPDATE
-- ============================================================================

DROP POLICY IF EXISTS "customers_tenant_update" ON public.customers;
CREATE POLICY "customers_tenant_update" ON public.customers FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin','member']))
    AND public.tenant_has_feature(tenant_id, 'customers')
  );

DROP POLICY IF EXISTS "appointments_tenant_update" ON public.appointments;
CREATE POLICY "appointments_tenant_update" ON public.appointments FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

DROP POLICY IF EXISTS "services_tenant_update" ON public.services;
CREATE POLICY "services_tenant_update" ON public.services FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

DROP POLICY IF EXISTS "inventory_products_tenant_update" ON public.inventory_products;
CREATE POLICY "inventory_products_tenant_update" ON public.inventory_products FOR UPDATE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

-- ============================================================================
-- 7. Update RLS policies — enforce feature gating on DELETE
-- ============================================================================

DROP POLICY IF EXISTS "customers_tenant_delete" ON public.customers;
CREATE POLICY "customers_tenant_delete" ON public.customers FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'customers')
  );

DROP POLICY IF EXISTS "appointments_tenant_delete" ON public.appointments;
CREATE POLICY "appointments_tenant_delete" ON public.appointments FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

DROP POLICY IF EXISTS "services_tenant_delete" ON public.services;
CREATE POLICY "services_tenant_delete" ON public.services FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );

DROP POLICY IF EXISTS "inventory_products_tenant_delete" ON public.inventory_products;
CREATE POLICY "inventory_products_tenant_delete" ON public.inventory_products FOR DELETE
  USING (
    tenant_id IN (SELECT public.get_my_tenant_ids_for_role(ARRAY['owner','admin']))
    AND public.tenant_has_feature(tenant_id, 'appointments')
  );
