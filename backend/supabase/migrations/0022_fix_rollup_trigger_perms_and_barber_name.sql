-- ============================================================================
-- Module 22: Fix appointment writes + appointments list
-- Two bugs surfaced while testing the Citas (appointments) flow:
--
--   1) REGRESSION from 0019: the AFTER trigger trg_refresh_customer_rollup runs
--      in the invoking user's context and calls refresh_customer_rollup(), whose
--      EXECUTE was revoked from `authenticated` in 0019. Every appointment
--      INSERT/UPDATE/DELETE failed with 42501 -> PostgREST 403
--      ("permission denied for function refresh_customer_rollup").
--      Fix: make the trigger SECURITY DEFINER so it calls the (still RPC-locked)
--      helper as its owner. refresh_customer_rollup's internal auth.uid() tenant
--      check still evaluates against the real caller, so isolation is preserved.
--
--   2) PRE-EXISTING bug from 0010: get_appointments_paginated selected
--      `a.barber_name`, but the appointments table column is `staff_name`.
--      Every list load failed with "column a.barber_name does not exist" (400).
-- ============================================================================

create or replace function public.trg_refresh_customer_rollup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_customer_rollup(OLD.customer_id);
    return OLD;
  end if;
  perform public.refresh_customer_rollup(NEW.customer_id);
  return NEW;
end;
$$;

revoke execute on function public.trg_refresh_customer_rollup() from public, anon, authenticated;

create or replace function public.get_appointments_paginated(
  p_tenant_id uuid,
  p_cursor timestamptz default null,
  p_limit integer default 50
)
returns json
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_result json;
  v_appointments json;
  v_has_more boolean;
  v_next_cursor timestamptz;
  v_tenant_ids uuid[];
begin
  select array_agg(tenant_id) into v_tenant_ids
  from memberships where user_id = auth.uid();

  if v_tenant_ids is null or not (p_tenant_id = any(v_tenant_ids)) then
    raise exception 'Access denied to tenant';
  end if;

  select json_agg(row_to_json(a))
  into v_appointments
  from (
    select
      a.id, a.customer_id, a.barber_id, a.appointment_date, a.appointment_time,
      a.service_name, a.cost, a.status, a.comments, a.created_at, a.updated_at,
      c.name as customer_name,
      coalesce(p.full_name, a.staff_name) as barber_name
    from appointments a
    left join customers c on c.id = a.customer_id
    left join profiles p on p.id = a.barber_id
    where a.tenant_id = p_tenant_id
      and (p_cursor is null or a.created_at < p_cursor)
    order by a.created_at desc
    limit p_limit + 1
  ) a;

  if v_appointments is not null and json_array_length(v_appointments) > p_limit then
    v_has_more := true;
    v_appointments := (
      select json_agg(elem)
      from json_array_elements(v_appointments) with ordinality as elem
      where ordinality <= p_limit
    );
    select (v_appointments->p_limit-1->>'created_at')::timestamptz into v_next_cursor;
  else
    v_has_more := false;
    if v_appointments is not null and json_array_length(v_appointments) > 0 then
      select (v_appointments->(json_array_length(v_appointments)-1)->>'created_at')::timestamptz into v_next_cursor;
    end if;
  end if;

  v_result := json_build_object(
    'data', coalesce(v_appointments, '[]'::json),
    'has_more', v_has_more,
    'next_cursor', v_next_cursor
  );

  return v_result;
end;
$$;

revoke execute on function public.get_appointments_paginated(uuid, timestamptz, integer) from anon;
grant execute on function public.get_appointments_paginated(uuid, timestamptz, integer) to authenticated;
