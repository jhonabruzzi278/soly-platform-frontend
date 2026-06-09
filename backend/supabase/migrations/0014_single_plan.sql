-- ============================================================================
-- Module 14: Single Plan Simplification
-- Simplify to only "business" plan with all features enabled
-- ============================================================================

-- Update plan_features to only have business plan with all features enabled
DELETE FROM public.plan_features;

INSERT INTO public.plan_features (plan, feature_key, enabled) VALUES
  ('business', 'excel_files', true),
  ('business', 'customers', true),
  ('business', 'appointments', true),
  ('business', 'reports', true);

-- Update seat limit function for single plan
CREATE OR REPLACE FUNCTION public.get_tenant_seat_limit(p_tenant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 20  -- Business plan: 20 seats
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
$$;

-- Update file limit function for single plan
CREATE OR REPLACE FUNCTION public.get_tenant_file_limit(p_tenant_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 10000  -- Business plan: 10,000 files
  FROM public.tenants t
  WHERE t.id = p_tenant_id;
$$;
