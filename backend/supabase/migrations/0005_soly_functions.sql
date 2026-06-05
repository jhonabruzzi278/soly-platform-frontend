-- ============================================================================
-- Soly CRM - Domain Functions & Triggers
-- ============================================================================

-- Customer rollup (aggregate stats)
create or replace function public.refresh_customer_rollup(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total_spent numeric(12,2);
  v_total_appointments integer;
  v_last timestamptz;
  v_next timestamptz;
begin
  select
    coalesce(sum(case when a.status not in ('cancelled', 'no_show') then a.cost else 0 end), 0),
    count(*),
    max((a.appointment_date::date + a.appointment_time::time)::timestamptz),
    min((a.appointment_date::date + a.appointment_time::time)::timestamptz) filter (
      where (a.appointment_date::date + a.appointment_time::time)::timestamptz > now()
    )
  into v_total_spent, v_total_appointments, v_last, v_next
  from public.appointments a
  where a.customer_id = p_customer_id;

  update public.customers c
  set total_spent = coalesce(v_total_spent, 0),
      total_appointments = coalesce(v_total_appointments, 0),
      last_appointment_at = v_last,
      next_appointment_at = v_next,
      updated_at = now()
  where c.id = p_customer_id;
end;
$$;

create or replace function public.trg_refresh_customer_rollup()
returns trigger
language plpgsql
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

-- Inventory movement trigger (with safety stock enforcement)
create or replace function public.trg_apply_inventory_movement()
returns trigger
language plpgsql
as $$
declare
  current_stock integer;
  current_safety_stock integer;
  next_stock integer;
begin
  select stock, safety_stock
  into current_stock, current_safety_stock
  from public.inventory_products
  where id = NEW.product_id
  for update;

  if not found then
    raise exception 'No se encontro el producto del movimiento.';
  end if;

  if NEW.quantity < 0 then
    raise exception 'La cantidad del movimiento no puede ser negativa.';
  end if;

  if NEW.type = 'in' then
    next_stock := current_stock + NEW.quantity;
  elsif NEW.type = 'out' then
    next_stock := current_stock - NEW.quantity;
  else
    next_stock := NEW.quantity;
  end if;

  if next_stock < 0 then
    raise exception 'El movimiento dejaria el stock en negativo.';
  end if;

  if NEW.type in ('out', 'adjustment') and next_stock < current_safety_stock then
    raise exception 'El movimiento deja el stock en % y perfora el stock de seguridad (%).', next_stock, current_safety_stock;
  end if;

  update public.inventory_products
  set stock = next_stock,
      updated_at = now()
  where id = NEW.product_id;

  return NEW;
end;
$$;

-- Flow.cl payment webhook handler
create or replace function public.handle_flow_webhook(
  p_flow_subscription_id text,
  p_flow_customer_email text,
  p_plan public.plan_name
)
returns void as $$
begin
  update public.tenants
  set
    flow_subscription_id = p_flow_subscription_id,
    flow_customer_email = p_flow_customer_email,
    plan = p_plan,
    updated_at = now()
  where flow_subscription_id = p_flow_subscription_id;
end;
$$ language plpgsql security definer;

-- Cancel Flow subscription (downgrade to starter)
create or replace function public.cancel_flow_subscription(
  p_flow_subscription_id text
)
returns void as $$
begin
  update public.tenants
  set
    flow_subscription_id = null,
    plan = 'starter',
    updated_at = now()
  where flow_subscription_id = p_flow_subscription_id;
end;
$$ language plpgsql security definer;

-- Dashboard KPI function
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

-- ============================================================================
-- Triggers
-- ============================================================================

-- updated_at triggers
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

drop trigger if exists trg_inventory_products_updated_at on public.inventory_products;
create trigger trg_inventory_products_updated_at
  before update on public.inventory_products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- Customer rollup trigger
drop trigger if exists trg_appointments_rollup on public.appointments;
create trigger trg_appointments_rollup
  after insert or update or delete on public.appointments
  for each row execute function public.trg_refresh_customer_rollup();

-- Inventory movement trigger
drop trigger if exists trg_inventory_movement_apply on public.inventory_movements;
create trigger trg_inventory_movement_apply
  after insert on public.inventory_movements
  for each row execute function public.trg_apply_inventory_movement();
