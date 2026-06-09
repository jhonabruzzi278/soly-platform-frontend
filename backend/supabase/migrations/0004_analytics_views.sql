-- ============================================================================
-- Module 4: Analytics and Views
-- Views for enriched data and dashboard KPIs
-- ============================================================================

-- ============================================================================
-- Views (all with security_invoker = true to apply RLS)
-- ============================================================================

create or replace view public.vw_appointments_enriched
with (security_invoker = true)
as
select
  a.id,
  a.customer_id,
  a.tenant_id,
  a.appointment_date::date as appointment_date,
  to_char(a.appointment_time::time, 'HH24:MI') as appointment_time,
  c.name as customer_name,
  c.email as customer_email,
  c.phone as customer_phone,
  a.service_name,
  coalesce(p.full_name, a.staff_name, 'Sin asignar') as barber_name,
  a.barber_id,
  a.cost,
  a.status,
  a.booked_at,
  a.comments,
  a.created_at
from public.appointments a
join public.customers c on c.id = a.customer_id
left join public.profiles p on p.id = a.barber_id;

grant select on public.vw_appointments_enriched to authenticated;

create or replace view public.vw_revenue_by_barber
with (security_invoker = true)
as
select
  a.tenant_id,
  coalesce(p.full_name, a.staff_name, 'Sin asignar') as barber_name,
  a.barber_id,
  sum(a.cost) as revenue
from public.appointments a
left join public.profiles p on p.id = a.barber_id
where a.status not in ('cancelled', 'no_show')
group by a.tenant_id, coalesce(p.full_name, a.staff_name, 'Sin asignar'), a.barber_id;

grant select on public.vw_revenue_by_barber to authenticated;

create or replace view public.vw_revenue_by_service
with (security_invoker = true)
as
select
  a.tenant_id,
  a.service_name,
  sum(a.cost) as revenue
from public.appointments a
where a.status not in ('cancelled', 'no_show')
group by a.tenant_id, a.service_name;

grant select on public.vw_revenue_by_service to authenticated;

create or replace view public.vw_appointments_per_day
with (security_invoker = true)
as
select
  a.tenant_id,
  to_char(a.appointment_date::date, 'YYYY-MM-DD') as day,
  a.appointment_date::date as appointment_date,
  count(*) as total
from public.appointments a
where a.appointment_date::date >= (current_date - interval '30 day')
group by a.tenant_id, to_char(a.appointment_date::date, 'YYYY-MM-DD'), a.appointment_date::date
order by a.appointment_date::date;

grant select on public.vw_appointments_per_day to authenticated;

-- ============================================================================
-- Dashboard KPI Function
-- ============================================================================

create or replace function public.get_dashboard_kpis(p_profile_id uuid, p_role text)
returns table (
  appointments_today integer,
  appointments_week integer,
  appointments_month integer,
  revenue_month numeric,
  avg_ticket numeric,
  occupancy numeric,
  new_customers integer,
  recurring_customers integer
)
language plpgsql
security invoker
as $$
declare
  v_filter_by_barber boolean;
  v_total_revenue numeric(12,2);
  v_total_completed integer;
  v_appointments_week integer;
  v_slots numeric;
begin
  v_filter_by_barber := lower(p_role) = 'barber';

  select
    count(*) filter (where a.appointment_date::date = current_date),
    count(*) filter (where a.appointment_date::date >= date_trunc('week', current_date)::date),
    count(*) filter (where date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date)),
    coalesce(sum(a.cost) filter (
      where date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date)
      and a.status not in ('cancelled', 'no_show')
    ), 0),
    count(*) filter (
      where date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date)
      and a.status not in ('cancelled', 'no_show')
    )
  into appointments_today, appointments_week, appointments_month, v_total_revenue, v_total_completed
  from public.appointments a
  where not v_filter_by_barber or a.barber_id = p_profile_id;

  revenue_month := v_total_revenue;
  avg_ticket := case when v_total_completed > 0 then v_total_revenue / v_total_completed else 0 end;

  select count(*)
  into v_appointments_week
  from public.appointments a
  where a.appointment_date::date >= date_trunc('week', current_date)::date
    and (not v_filter_by_barber or a.barber_id = p_profile_id);

  v_slots := case when v_filter_by_barber then 12 * 7 else greatest(12 * 7 * (select count(*) from public.profiles where role = 'barber' and is_active), 1) end;
  occupancy := round((v_appointments_week::numeric / greatest(v_slots, 1)) * 100, 2);

  select count(*)
  into new_customers
  from public.customers c
  where date_trunc('month', c.created_at) = date_trunc('month', current_date)
    and (not v_filter_by_barber or exists (
      select 1 from public.appointments a2
      where a2.customer_id = c.id and a2.barber_id = p_profile_id
    ));

  select count(*)
  into recurring_customers
  from public.customers c
  where c.total_appointments > 1
    and date_trunc('month', coalesce(c.last_appointment_at, c.created_at)) = date_trunc('month', current_date)
    and (not v_filter_by_barber or exists (
      select 1 from public.appointments a2
      where a2.customer_id = c.id and a2.barber_id = p_profile_id
    ));

  return next;
end;
$$;

grant execute on function public.get_dashboard_kpis(uuid, text) to authenticated;
