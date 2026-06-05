-- Fix: add tenant_id to vw_appointments_enriched for RLS filtering
drop view if exists public.vw_appointments_enriched;

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

-- Also add tenant_id to revenue views
drop view if exists public.vw_revenue_by_barber;

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

drop view if exists public.vw_revenue_by_service;

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

drop view if exists public.vw_appointments_per_day;

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
