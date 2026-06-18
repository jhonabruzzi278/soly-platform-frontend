-- ============================================================================
-- Module 26: Fix json_agg(elem) bug in paginated RPC functions
--
-- json_array_elements(...) WITH ORDINALITY AS elem
-- When used as json_agg(elem), PostgreSQL aggregates the composite row
-- {value: {...}, ordinality: N} instead of the plain JSON object.
-- This caused r.id to be undefined in JS when >50 rows triggered the
-- trim branch, making delete calls send id=eq.undefined → 400.
--
-- Fix: use explicit column aliases (val, ord) and aggregate json_agg(val).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_customers_paginated(
  p_tenant_id uuid,
  p_cursor timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSON;
  v_customers JSON;
  v_has_more BOOLEAN;
  v_next_cursor TIMESTAMPTZ;
  v_tenant_ids UUID[];
BEGIN
  SELECT array_agg(tenant_id) INTO v_tenant_ids
  FROM memberships
  WHERE user_id = auth.uid();

  IF v_tenant_ids IS NULL OR NOT (p_tenant_id = ANY(v_tenant_ids)) THEN
    RAISE EXCEPTION 'Access denied to tenant';
  END IF;

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

  IF v_customers IS NOT NULL AND json_array_length(v_customers) > p_limit THEN
    v_has_more := true;
    v_customers := (
      SELECT json_agg(val)
      FROM json_array_elements(v_customers) WITH ORDINALITY AS t(val, ord)
      WHERE ord <= p_limit
    );
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

CREATE OR REPLACE FUNCTION public.get_appointments_paginated(
  p_tenant_id uuid,
  p_cursor timestamp with time zone DEFAULT NULL,
  p_limit integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
  v_appointments json;
  v_has_more boolean;
  v_next_cursor timestamptz;
  v_tenant_ids uuid[];
BEGIN
  SELECT array_agg(tenant_id) INTO v_tenant_ids
  FROM memberships WHERE user_id = auth.uid();

  IF v_tenant_ids IS NULL OR NOT (p_tenant_id = ANY(v_tenant_ids)) THEN
    RAISE EXCEPTION 'Access denied to tenant';
  END IF;

  SELECT json_agg(row_to_json(a))
  INTO v_appointments
  FROM (
    SELECT
      a.id, a.customer_id, a.barber_id, a.appointment_date, a.appointment_time,
      a.service_name, a.cost, a.status, a.comments, a.created_at, a.updated_at,
      c.name AS customer_name,
      COALESCE(p.full_name, a.staff_name) AS barber_name
    FROM appointments a
    LEFT JOIN customers c ON c.id = a.customer_id
    LEFT JOIN profiles p ON p.id = a.barber_id
    WHERE a.tenant_id = p_tenant_id
      AND (p_cursor IS NULL OR a.created_at < p_cursor)
    ORDER BY a.created_at DESC
    LIMIT p_limit + 1
  ) a;

  IF v_appointments IS NOT NULL AND json_array_length(v_appointments) > p_limit THEN
    v_has_more := true;
    v_appointments := (
      SELECT json_agg(val)
      FROM json_array_elements(v_appointments) WITH ORDINALITY AS t(val, ord)
      WHERE ord <= p_limit
    );
    SELECT (v_appointments->p_limit-1->>'created_at')::timestamptz INTO v_next_cursor;
  ELSE
    v_has_more := false;
    IF v_appointments IS NOT NULL AND json_array_length(v_appointments) > 0 THEN
      SELECT (v_appointments->(json_array_length(v_appointments)-1)->>'created_at')::timestamptz INTO v_next_cursor;
    END IF;
  END IF;

  v_result := json_build_object(
    'data', COALESCE(v_appointments, '[]'::json),
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );

  RETURN v_result;
END;
$$;
