-- ============================================================================
-- Module 13: Performance Optimization & Data Lifecycle
-- Fixes: PG-01 (batch rollup), PG-02 (composite indexes), ARCH-04 (downgrade cleanup)
-- ============================================================================

-- ============================================================================
-- 1. PG-01: Batch rollup function for efficient bulk updates
-- ============================================================================

-- Create a batch version that updates all customers in one query
CREATE OR REPLACE FUNCTION public.refresh_customer_rollup_batch(p_tenant_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count integer;
  v_user_tenant_ids uuid[];
BEGIN
  -- Verify current user belongs to the tenant
  SELECT array_agg(tenant_id) INTO v_user_tenant_ids
  FROM public.memberships
  WHERE user_id = auth.uid();
  
  IF v_user_tenant_ids IS NULL OR NOT (p_tenant_id = ANY(v_user_tenant_ids)) THEN
    RAISE EXCEPTION 'Access denied to tenant';
  END IF;
  
  -- Update all customers in the tenant with a single query
  UPDATE public.customers c
  SET 
    total_spent = COALESCE(subquery.total_spent, 0),
    total_appointments = COALESCE(subquery.total_appointments, 0),
    last_appointment_at = subquery.last_appointment_at,
    next_appointment_at = subquery.next_appointment_at,
    updated_at = now()
  FROM (
    SELECT 
      c2.id as customer_id,
      SUM(CASE WHEN a.status NOT IN ('cancelled', 'no_show') THEN a.cost ELSE 0 END) as total_spent,
      COUNT(*) as total_appointments,
      MAX((a.appointment_date::date + a.appointment_time::time)::timestamptz) as last_appointment_at,
      MIN(CASE 
        WHEN (a.appointment_date::date + a.appointment_time::time)::timestamptz > now() 
        THEN (a.appointment_date::date + a.appointment_time::time)::timestamptz 
      END) as next_appointment_at
    FROM public.customers c2
    LEFT JOIN public.appointments a ON a.customer_id = c2.id
    WHERE c2.tenant_id = p_tenant_id
    GROUP BY c2.id
  ) subquery
  WHERE c.id = subquery.customer_id;
  
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RETURN v_updated_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_customer_rollup_batch(uuid) TO authenticated;

-- Create a function to temporarily disable rollup trigger (for imports)
CREATE OR REPLACE FUNCTION public.disable_rollup_trigger()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow if user is owner/admin of any tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  ALTER TABLE public.appointments DISABLE TRIGGER trg_appointments_rollup;
END;
$$;

CREATE OR REPLACE FUNCTION public.enable_rollup_trigger()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  ALTER TABLE public.appointments ENABLE TRIGGER trg_appointments_rollup;
END;
$$;

GRANT EXECUTE ON FUNCTION public.disable_rollup_trigger() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enable_rollup_trigger() TO authenticated;

-- ============================================================================
-- 2. PG-02: Composite indexes for multi-tenant queries
-- ============================================================================

-- Drop old single-column indexes
DROP INDEX IF EXISTS public.idx_appointments_customer;
DROP INDEX IF EXISTS public.idx_appointments_barber;
DROP INDEX IF EXISTS public.idx_appointments_date;
DROP INDEX IF EXISTS public.idx_appointments_status;
DROP INDEX IF EXISTS public.idx_customers_name;
DROP INDEX IF EXISTS public.idx_customers_email;
DROP INDEX IF EXISTS public.idx_inventory_movements_product;

-- Create composite indexes with tenant_id as first column
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_customer 
  ON public.appointments (tenant_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_barber_date 
  ON public.appointments (tenant_id, barber_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_date_status 
  ON public.appointments (tenant_id, appointment_date, status);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_name 
  ON public.customers (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_email 
  ON public.customers (tenant_id, email) WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_tenant_product 
  ON public.inventory_movements (tenant_id, product_id);

-- ============================================================================
-- 3. ARCH-04: Data archive tables for downgrade cleanup
-- ============================================================================

-- Create archive tables (same structure + archived_at)
CREATE TABLE IF NOT EXISTS public.customers_archive (
  LIKE public.customers INCLUDING ALL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_plan plan_name NOT NULL
);

CREATE TABLE IF NOT EXISTS public.appointments_archive (
  LIKE public.appointments INCLUDING ALL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_plan plan_name NOT NULL
);

CREATE TABLE IF NOT EXISTS public.services_archive (
  LIKE public.services INCLUDING ALL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_plan plan_name NOT NULL
);

CREATE TABLE IF NOT EXISTS public.inventory_products_archive (
  LIKE public.inventory_products INCLUDING ALL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_plan plan_name NOT NULL
);

CREATE TABLE IF NOT EXISTS public.inventory_movements_archive (
  LIKE public.inventory_movements INCLUDING ALL,
  archived_at timestamptz NOT NULL DEFAULT now(),
  archived_plan plan_name NOT NULL
);

-- Enable RLS on archive tables
ALTER TABLE public.customers_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements_archive ENABLE ROW LEVEL SECURITY;

-- Only service_role can access archives (for potential restore)
GRANT SELECT ON public.customers_archive TO service_role;
GRANT SELECT ON public.appointments_archive TO service_role;
GRANT SELECT ON public.services_archive TO service_role;
GRANT SELECT ON public.inventory_products_archive TO service_role;
GRANT SELECT ON public.inventory_movements_archive TO service_role;

-- ============================================================================
-- 4. ARCH-04: Cleanup function called on downgrade
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_tenant_data_on_downgrade(
  p_tenant_id uuid,
  p_old_plan plan_name,
  p_new_plan plan_name
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_archived_customers integer := 0;
  v_archived_appointments integer := 0;
  v_archived_services integer := 0;
  v_archived_inventory_products integer := 0;
  v_archived_inventory_movements integer := 0;
  v_result json;
BEGIN
  -- Only allow if downgrading
  IF p_new_plan >= p_old_plan THEN
    RETURN json_build_object('success', true, 'message', 'No downgrade detected');
  END IF;
  
  -- Archive and delete based on new plan
  -- Starter: no customers, appointments, inventory
  -- Pro: no customers, appointments, inventory (only reports via appointments view)
  -- Business: has all features
  -- Enterprise: has all features
  
  IF p_new_plan IN ('starter', 'pro') THEN
    -- Archive customers
    INSERT INTO public.customers_archive (SELECT *, p_old_plan FROM public.customers WHERE tenant_id = p_tenant_id);
    GET DIAGNOSTICS v_archived_customers = ROW_COUNT;
    DELETE FROM public.customers WHERE tenant_id = p_tenant_id;
    
    -- Archive appointments
    INSERT INTO public.appointments_archive (SELECT *, p_old_plan FROM public.appointments WHERE tenant_id = p_tenant_id);
    GET DIAGNOSTICS v_archived_appointments = ROW_COUNT;
    DELETE FROM public.appointments WHERE tenant_id = p_tenant_id;
    
    -- Archive inventory movements first (FK constraint)
    INSERT INTO public.inventory_movements_archive (SELECT *, p_old_plan FROM public.inventory_movements WHERE tenant_id = p_tenant_id);
    GET DIAGNOSTICS v_archived_inventory_movements = ROW_COUNT;
    DELETE FROM public.inventory_movements WHERE tenant_id = p_tenant_id;
    
    -- Archive inventory products
    INSERT INTO public.inventory_products_archive (SELECT *, p_old_plan FROM public.inventory_products WHERE tenant_id = p_tenant_id);
    GET DIAGNOSTICS v_archived_inventory_products = ROW_COUNT;
    DELETE FROM public.inventory_products WHERE tenant_id = p_tenant_id;
  END IF;
  
  IF p_new_plan = 'starter' THEN
    -- Starter also loses services
    INSERT INTO public.services_archive (SELECT *, p_old_plan FROM public.services WHERE tenant_id = p_tenant_id);
    GET DIAGNOSTICS v_archived_services = ROW_COUNT;
    DELETE FROM public.services WHERE tenant_id = p_tenant_id;
  END IF;
  
  v_result := json_build_object(
    'success', true,
    'old_plan', p_old_plan,
    'new_plan', p_new_plan,
    'archived', json_build_object(
      'customers', v_archived_customers,
      'appointments', v_archived_appointments,
      'services', v_archived_services,
      'inventory_products', v_archived_inventory_products,
      'inventory_movements', v_archived_inventory_movements
    )
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_tenant_data_on_downgrade(uuid, plan_name, plan_name) TO service_role;

-- ============================================================================
-- 5. Update sync_subscription_to_tenant trigger to call cleanup
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_subscription_to_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_old_plan plan_name;
  v_new_plan plan_name;
BEGIN
  IF (TG_OP = 'UPDATE' AND (NEW.plan != OLD.plan OR NEW.status != OLD.status))
     OR (TG_OP = 'INSERT') THEN
    
    SELECT m.tenant_id INTO v_tenant_id
    FROM public.memberships m
    WHERE m.user_id = NEW.user_id
      AND m.role = 'owner'
    LIMIT 1;
    
    IF v_tenant_id IS NOT NULL THEN
      -- Get current tenant plan before update
      SELECT plan INTO v_old_plan FROM public.tenants WHERE id = v_tenant_id;
      
      IF NEW.status IN ('active', 'trialing') THEN
        v_new_plan := NEW.plan;
        UPDATE public.tenants
        SET plan = NEW.plan,
            updated_at = now()
        WHERE id = v_tenant_id;
      ELSIF NEW.status IN ('cancelled', 'expired') THEN
        v_new_plan := 'starter';
        UPDATE public.tenants
        SET plan = 'starter',
            updated_at = now()
        WHERE id = v_tenant_id;
      END IF;
      
      -- Call cleanup if downgrading
      IF v_old_plan IS NOT NULL AND v_new_plan IS NOT NULL AND v_new_plan < v_old_plan THEN
        PERFORM public.cleanup_tenant_data_on_downgrade(v_tenant_id, v_old_plan, v_new_plan);
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_sync_subscription_to_tenant ON public.subscriptions;
CREATE TRIGGER trg_sync_subscription_to_tenant
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_subscription_to_tenant();
