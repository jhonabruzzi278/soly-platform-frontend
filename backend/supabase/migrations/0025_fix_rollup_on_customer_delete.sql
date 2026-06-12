-- ============================================================================
-- Module 25: Deleting a customer with appointments was impossible
--
-- appointments.customer_id has ON DELETE CASCADE: deleting a customer cascades
-- to their appointments, whose AFTER DELETE trigger calls
-- refresh_customer_rollup(customer_id) — but the customer row is already gone,
-- so the function raised 'Customer not found' and aborted the whole delete.
--
-- Fix: when the customer no longer exists there is nothing to roll up; return
-- silently instead of raising. The cross-tenant check for live customers is
-- unchanged.
-- ============================================================================

create or replace function public.refresh_customer_rollup(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_tenant_id uuid;
  v_user_tenant_ids uuid[];
begin
  select tenant_id into v_customer_tenant_id
  from public.customers
  where id = p_customer_id;

  -- Customer already deleted (e.g. cascade from a customer DELETE): no-op.
  if v_customer_tenant_id is null then
    return;
  end if;

  select array_agg(tenant_id) into v_user_tenant_ids
  from public.memberships
  where user_id = auth.uid();

  if auth.uid() is not null and v_customer_tenant_id != all(v_user_tenant_ids) then
    raise exception 'Cross-tenant access denied: customer belongs to tenant %, user belongs to %',
      v_customer_tenant_id, v_user_tenant_ids;
  end if;

  update public.customers c
  set total_spent = coalesce(
        (select sum(case when a.status not in ('cancelled', 'no_show') then a.cost else 0 end)
         from public.appointments a
         where a.customer_id = p_customer_id), 0),
      total_appointments = coalesce(
        (select count(*)
         from public.appointments a
         where a.customer_id = p_customer_id), 0),
      last_appointment_at = (
        select max((a.appointment_date::date + a.appointment_time::time)::timestamptz)
        from public.appointments a
        where a.customer_id = p_customer_id
      ),
      next_appointment_at = (
        select min((a.appointment_date::date + a.appointment_time::time)::timestamptz)
        from public.appointments a
        where a.customer_id = p_customer_id
          and (a.appointment_date::date + a.appointment_time::time)::timestamptz > now()
      ),
      updated_at = now()
  where c.id = p_customer_id;
end;
$$;

revoke execute on function public.refresh_customer_rollup(uuid) from public, anon, authenticated;
