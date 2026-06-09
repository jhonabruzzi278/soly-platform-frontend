-- Migration 0010: Pagination and Session Functions
-- Adds cursor-based pagination for customers and appointments
-- Adds get_user_session function for auth state from DB

-- ============================================================================
-- 1. Paginated customers function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_customers_paginated(
  p_tenant_id UUID,
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_customers JSON;
  v_has_more BOOLEAN;
  v_next_cursor TIMESTAMPTZ;
  v_tenant_ids UUID[];
BEGIN
  -- Verify user has access to this tenant
  SELECT array_agg(tenant_id) INTO v_tenant_ids
  FROM memberships
  WHERE user_id = auth.uid();
  
  IF v_tenant_ids IS NULL OR NOT (p_tenant_id = ANY(v_tenant_ids)) THEN
    RAISE EXCEPTION 'Access denied to tenant';
  END IF;
  
  -- Fetch customers with cursor
  SELECT json_agg(row_to_json(c))
  INTO v_customers
  FROM (
    SELECT 
      id, name, email, phone, company, notes, tags,
      total_spent, total_appointments, last_appointment_at,
      created_at, updated_at
    FROM customers
    WHERE tenant_id = p_tenant_id
      AND (p_cursor IS NULL OR created_at < p_cursor)
    ORDER BY created_at DESC
    LIMIT p_limit + 1
  ) c;
  
  -- Check if there are more results
  IF v_customers IS NOT NULL AND json_array_length(v_customers) > p_limit THEN
    v_has_more := true;
    v_customers := (
      SELECT json_agg(elem)
      FROM json_array_elements(v_customers) WITH ORDINALITY AS elem
      WHERE ordinality <= p_limit
    );
    -- Get cursor for next page
    SELECT (v_customers->p_limit-1->>'created_at')::TIMESTAMPTZ INTO v_next_cursor;
  ELSE
    v_has_more := false;
    IF v_customers IS NOT NULL AND json_array_length(v_customers) > 0 THEN
      SELECT (v_customers->(json_array_length(v_customers)-1)->>'created_at')::TIMESTAMPTZ INTO v_next_cursor;
    END IF;
  END IF;
  
  v_result := json_build_object(
    'data', COALESCE(v_customers, '[]'::JSON),
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_customers_paginated(UUID, TIMESTAMPTZ, INTEGER) TO authenticated;

-- ============================================================================
-- 2. Paginated appointments function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_appointments_paginated(
  p_tenant_id UUID,
  p_cursor TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_appointments JSON;
  v_has_more BOOLEAN;
  v_next_cursor TIMESTAMPTZ;
  v_tenant_ids UUID[];
BEGIN
  -- Verify user has access to this tenant
  SELECT array_agg(tenant_id) INTO v_tenant_ids
  FROM memberships
  WHERE user_id = auth.uid();
  
  IF v_tenant_ids IS NULL OR NOT (p_tenant_id = ANY(v_tenant_ids)) THEN
    RAISE EXCEPTION 'Access denied to tenant';
  END IF;
  
  -- Fetch appointments with cursor
  SELECT json_agg(row_to_json(a))
  INTO v_appointments
  FROM (
    SELECT 
      a.id, a.customer_id, a.barber_id, a.appointment_date, a.appointment_time,
      a.service_name, a.cost, a.status, a.comments, a.created_at, a.updated_at,
      c.name as customer_name,
      COALESCE(p.full_name, a.barber_name) as barber_name
    FROM appointments a
    LEFT JOIN customers c ON c.id = a.customer_id
    LEFT JOIN profiles p ON p.id = a.barber_id
    WHERE a.tenant_id = p_tenant_id
      AND (p_cursor IS NULL OR a.created_at < p_cursor)
    ORDER BY a.created_at DESC
    LIMIT p_limit + 1
  ) a;
  
  -- Check if there are more results
  IF v_appointments IS NOT NULL AND json_array_length(v_appointments) > p_limit THEN
    v_has_more := true;
    v_appointments := (
      SELECT json_agg(elem)
      FROM json_array_elements(v_appointments) WITH ORDINALITY AS elem
      WHERE ordinality <= p_limit
    );
    SELECT (v_appointments->p_limit-1->>'created_at')::TIMESTAMPTZ INTO v_next_cursor;
  ELSE
    v_has_more := false;
    IF v_appointments IS NOT NULL AND json_array_length(v_appointments) > 0 THEN
      SELECT (v_appointments->(json_array_length(v_appointments)-1)->>'created_at')::TIMESTAMPTZ INTO v_next_cursor;
    END IF;
  END IF;
  
  v_result := json_build_object(
    'data', COALESCE(v_appointments, '[]'::JSON),
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_appointments_paginated(UUID, TIMESTAMPTZ, INTEGER) TO authenticated;

-- ============================================================================
-- 3. Get user session from DB (source of truth)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_session()
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
  v_profile RECORD;
  v_tenant RECORD;
  v_membership RECORD;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get profile
  SELECT id, email, full_name, role, tenant_id
  INTO v_profile
  FROM profiles
  WHERE id = v_user_id;
  
  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Get primary tenant (first membership)
  SELECT m.tenant_id, m.role as membership_role
  INTO v_membership
  FROM memberships m
  WHERE m.user_id = v_user_id
  ORDER BY m.created_at ASC
  LIMIT 1;
  
  -- Get tenant details
  IF v_membership.tenant_id IS NOT NULL THEN
    SELECT id, slug, business_name, plan, product, is_active
    INTO v_tenant
    FROM tenants
    WHERE id = v_membership.tenant_id;
  END IF;
  
  v_result := json_build_object(
    'user_id', v_user_id,
    'email', v_profile.email,
    'full_name', v_profile.full_name,
    'role', v_profile.role,
    'tenant_id', v_membership.tenant_id,
    'tenant_slug', v_tenant.slug,
    'tenant_name', v_tenant.business_name,
    'tenant_plan', v_tenant.plan,
    'membership_role', v_membership.membership_role
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_session() TO authenticated;
