-- ============================================================================
-- Module 3: Domain CRM
-- customers, appointments, services, inventory_products, inventory_movements
-- Domain functions, triggers, RLS policies
-- ============================================================================

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email citext,
  email_alt text,
  phone text,
  phone_alt_1 text,
  phone_alt_2 text,
  company text,
  address text,
  notes text,
  tags text[] not null default '{}',
  total_spent numeric(12,2) not null default 0,
  total_appointments integer not null default 0,
  last_appointment_at timestamptz,
  next_appointment_at timestamptz,
  tenant_id uuid references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  barber_id uuid references public.profiles(id) on delete set null,
  appointment_date date not null,
  appointment_time time not null,
  service_name text not null,
  cost numeric(12,2) not null default 0,
  status text not null default 'pending',
  comments text,
  booked_at timestamptz,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  staff_name text,
  tenant_id uuid references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_status_check check (status in ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  constraint appointments_cost_non_negative check (cost >= 0)
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null default 0,
  tenant_id uuid references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_price_non_negative check (price >= 0)
);

create table if not exists public.inventory_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  supplier text,
  cost numeric(12,2) not null default 0,
  sale_price numeric(12,2) not null default 0,
  stock integer not null default 0,
  min_stock integer not null default 0,
  safety_stock integer not null default 0,
  purchase_date date,
  tenant_id uuid references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_products_safety_stock_non_negative check (safety_stock >= 0),
  constraint inventory_products_min_stock_above_safety check (min_stock >= safety_stock),
  constraint inventory_products_cost_non_negative check (cost >= 0),
  constraint inventory_products_sale_price_non_negative check (sale_price >= 0),
  constraint inventory_products_stock_non_negative check (stock >= 0)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  type public.inventory_movement_type not null,
  quantity integer not null,
  note text,
  tenant_id uuid references public.tenants(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes (FK + composite for performance)
-- ============================================================================

-- customers
create index if not exists idx_customers_tenant on public.customers (tenant_id);
create index if not exists idx_customers_name on public.customers (name);
create index if not exists idx_customers_email on public.customers (email);
create index if not exists idx_customers_tenant_created on public.customers (tenant_id, created_at desc);
create index if not exists idx_customers_tenant_name on public.customers (tenant_id, name);

-- appointments
create index if not exists idx_appointments_customer on public.appointments (customer_id);
create index if not exists idx_appointments_barber on public.appointments (barber_id);
create index if not exists idx_appointments_date on public.appointments (appointment_date);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_tenant on public.appointments (tenant_id);
create index if not exists idx_appointments_tenant_date on public.appointments (tenant_id, appointment_date);
create index if not exists idx_appointments_tenant_status on public.appointments (tenant_id, status);
create index if not exists idx_appointments_tenant_barber on public.appointments (tenant_id, barber_id);

-- services
create index if not exists idx_services_tenant on public.services (tenant_id);

-- inventory_products
create index if not exists idx_inventory_products_tenant on public.inventory_products (tenant_id);

-- inventory_movements
create index if not exists idx_inventory_movements_product on public.inventory_movements (product_id);
create index if not exists idx_inventory_movements_tenant on public.inventory_movements (tenant_id);
create index if not exists idx_inventory_movements_tenant_created on public.inventory_movements (tenant_id, created_at desc);

-- ============================================================================
-- Domain Functions
-- ============================================================================

-- Customer rollup (aggregate stats) - with tenant verification
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
  -- Get customer's tenant_id
  select tenant_id into v_customer_tenant_id
  from public.customers
  where id = p_customer_id;

  if v_customer_tenant_id is null then
    raise exception 'Customer not found: %', p_customer_id;
  end if;

  -- Verify current user belongs to the customer's tenant
  select array_agg(tenant_id) into v_user_tenant_ids
  from public.memberships
  where user_id = auth.uid();

  if v_customer_tenant_id != all(v_user_tenant_ids) then
    raise exception 'Cross-tenant access denied: customer belongs to tenant %, user belongs to %',
      v_customer_tenant_id, v_user_tenant_ids;
  end if;

  -- Update rollup
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

-- ============================================================================
-- RLS Policies
-- ============================================================================

alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.services enable row level security;
alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;

-- customers
drop policy if exists "customers_tenant_select" on public.customers;
create policy "customers_tenant_select" on public.customers for select
  using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "customers_tenant_insert" on public.customers;
create policy "customers_tenant_insert" on public.customers for insert
  with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin','member'])));

drop policy if exists "customers_tenant_update" on public.customers;
create policy "customers_tenant_update" on public.customers for update
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin','member'])));

drop policy if exists "customers_tenant_delete" on public.customers;
create policy "customers_tenant_delete" on public.customers for delete
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- appointments
drop policy if exists "appointments_tenant_select" on public.appointments;
create policy "appointments_tenant_select" on public.appointments for select
  using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "appointments_tenant_insert" on public.appointments;
create policy "appointments_tenant_insert" on public.appointments for insert
  with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "appointments_tenant_update" on public.appointments;
create policy "appointments_tenant_update" on public.appointments for update
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "appointments_tenant_delete" on public.appointments;
create policy "appointments_tenant_delete" on public.appointments for delete
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- services
drop policy if exists "services_tenant_select" on public.services;
create policy "services_tenant_select" on public.services for select
  using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "services_tenant_insert" on public.services;
create policy "services_tenant_insert" on public.services for insert
  with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "services_tenant_update" on public.services;
create policy "services_tenant_update" on public.services for update
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "services_tenant_delete" on public.services;
create policy "services_tenant_delete" on public.services for delete
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- inventory_products
drop policy if exists "inventory_products_tenant_select" on public.inventory_products;
create policy "inventory_products_tenant_select" on public.inventory_products for select
  using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "inventory_products_tenant_insert" on public.inventory_products;
create policy "inventory_products_tenant_insert" on public.inventory_products for insert
  with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "inventory_products_tenant_update" on public.inventory_products;
create policy "inventory_products_tenant_update" on public.inventory_products for update
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "inventory_products_tenant_delete" on public.inventory_products;
create policy "inventory_products_tenant_delete" on public.inventory_products for delete
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- inventory_movements
drop policy if exists "inventory_movements_tenant_select" on public.inventory_movements;
create policy "inventory_movements_tenant_select" on public.inventory_movements for select
  using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "inventory_movements_tenant_insert" on public.inventory_movements;
create policy "inventory_movements_tenant_insert" on public.inventory_movements for insert
  with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- ============================================================================
-- Triggers
-- ============================================================================

-- updated_at triggers
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
