-- ============================================================================
-- Module 17: Pin search_path on remaining functions
-- Fixes advisor `function_search_path_mutable` (search_path hijack vector).
-- Recreating with CREATE OR REPLACE preserves the existing ACL, but re-adds the
-- implicit PUBLIC grant, so least-privilege is re-applied at the end.
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin NEW.updated_at = now(); return NEW; end;
$$;

create or replace function public.get_tenant_seats_count(org_id uuid)
returns bigint language sql stable set search_path = public as $$
  select count(*) from public.tenant_seats where tenant_id = org_id and is_active = true;
$$;

create or replace function public.trg_refresh_customer_rollup()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform public.refresh_customer_rollup(OLD.customer_id); return OLD; end if;
  perform public.refresh_customer_rollup(NEW.customer_id); return NEW;
end;
$$;

create or replace function public.trg_apply_inventory_movement()
returns trigger language plpgsql set search_path = public as $$
declare
  current_stock integer;
  current_safety_stock integer;
  next_stock integer;
begin
  select stock, safety_stock into current_stock, current_safety_stock
  from public.inventory_products where id = NEW.product_id for update;
  if not found then raise exception 'No se encontro el producto del movimiento.'; end if;
  if NEW.quantity < 0 then raise exception 'La cantidad del movimiento no puede ser negativa.'; end if;
  if NEW.type = 'in' then next_stock := current_stock + NEW.quantity;
  elsif NEW.type = 'out' then next_stock := current_stock - NEW.quantity;
  else next_stock := NEW.quantity; end if;
  if next_stock < 0 then raise exception 'El movimiento dejaria el stock en negativo.'; end if;
  if NEW.type in ('out', 'adjustment') and next_stock < current_safety_stock then
    raise exception 'El movimiento deja el stock en % y perfora el stock de seguridad (%).', next_stock, current_safety_stock;
  end if;
  update public.inventory_products set stock = next_stock, updated_at = now() where id = NEW.product_id;
  return NEW;
end;
$$;

create or replace function public.validate_appointment_tenant()
returns trigger language plpgsql set search_path = public as $$
declare v_customer_tenant uuid;
begin
  select tenant_id into v_customer_tenant from public.customers where id = NEW.customer_id;
  if v_customer_tenant is distinct from NEW.tenant_id then
    raise exception 'Cross-tenant reference: appointment tenant_id does not match customer tenant_id';
  end if;
  if NEW.barber_id is not null then
    if not exists (select 1 from public.memberships where user_id = NEW.barber_id and tenant_id = NEW.tenant_id) then
      raise exception 'Cross-tenant reference: barber does not belong to this tenant';
    end if;
  end if;
  return NEW;
end;
$$;

create or replace function public.validate_inventory_movement_tenant()
returns trigger language plpgsql set search_path = public as $$
declare v_product_tenant uuid;
begin
  select tenant_id into v_product_tenant from public.inventory_products where id = NEW.product_id;
  if v_product_tenant is distinct from NEW.tenant_id then
    raise exception 'Cross-tenant reference: movement tenant_id does not match product tenant_id';
  end if;
  return NEW;
end;
$$;

create or replace function public.get_dashboard_kpis(p_profile_id uuid, p_role text)
returns table (
  appointments_today integer, appointments_week integer, appointments_month integer,
  revenue_month numeric, avg_ticket numeric, occupancy numeric,
  new_customers integer, recurring_customers integer
)
language plpgsql security invoker set search_path = public as $$
declare
  v_filter_by_barber boolean;
  v_total_revenue numeric(12,2);
  v_total_completed integer;
  v_appointments_week integer;
  v_slots numeric;
  v_tenant_ids uuid[];
begin
  select array_agg(tenant_id) into v_tenant_ids from public.memberships where user_id = auth.uid();
  if v_tenant_ids is null then return; end if;
  v_filter_by_barber := lower(p_role) = 'barber';
  select
    count(*) filter (where a.appointment_date::date = current_date),
    count(*) filter (where a.appointment_date::date >= date_trunc('week', current_date)::date),
    count(*) filter (where date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date)),
    coalesce(sum(a.cost) filter (where date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date) and a.status not in ('cancelled', 'no_show')), 0),
    count(*) filter (where date_trunc('month', a.appointment_date::date) = date_trunc('month', current_date) and a.status not in ('cancelled', 'no_show'))
  into appointments_today, appointments_week, appointments_month, v_total_revenue, v_total_completed
  from public.appointments a
  where a.tenant_id = any(v_tenant_ids) and (not v_filter_by_barber or a.barber_id = p_profile_id);
  revenue_month := v_total_revenue;
  avg_ticket := case when v_total_completed > 0 then v_total_revenue / v_total_completed else 0 end;
  select count(*) into v_appointments_week from public.appointments a
  where a.tenant_id = any(v_tenant_ids) and a.appointment_date::date >= date_trunc('week', current_date)::date
    and (not v_filter_by_barber or a.barber_id = p_profile_id);
  v_slots := case when v_filter_by_barber then 12 * 7
    else greatest(12 * 7 * (select count(*) from public.profiles where tenant_id = any(v_tenant_ids) and role = 'member'::org_role and is_active), 1) end;
  occupancy := round((v_appointments_week::numeric / greatest(v_slots, 1)) * 100, 2);
  select count(*) into new_customers from public.customers c
  where c.tenant_id = any(v_tenant_ids) and date_trunc('month', c.created_at) = date_trunc('month', current_date)
    and (not v_filter_by_barber or exists (select 1 from public.appointments a2 where a2.customer_id = c.id and a2.barber_id = p_profile_id));
  select count(*) into recurring_customers from public.customers c
  where c.tenant_id = any(v_tenant_ids) and c.total_appointments > 1
    and date_trunc('month', coalesce(c.last_appointment_at, c.created_at)) = date_trunc('month', current_date)
    and (not v_filter_by_barber or exists (select 1 from public.appointments a2 where a2.customer_id = c.id and a2.barber_id = p_profile_id));
  return next;
end;
$$;

-- create-or-replace re-adds the implicit PUBLIC grant; re-apply least privilege.
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.trg_refresh_customer_rollup() from public;
revoke execute on function public.trg_apply_inventory_movement() from public;
revoke execute on function public.validate_appointment_tenant() from public;
revoke execute on function public.validate_inventory_movement_tenant() from public;
revoke execute on function public.get_tenant_seats_count(uuid) from public;
revoke execute on function public.get_dashboard_kpis(uuid, text) from public;
grant execute on function public.get_tenant_seats_count(uuid) to authenticated, service_role;
grant execute on function public.get_dashboard_kpis(uuid, text) to authenticated;
