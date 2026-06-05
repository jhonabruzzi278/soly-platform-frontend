-- ============================================================================
-- Soly CRM - Consolidated Schema
-- Generated from migrations 20260324170000 through 20260604010000
-- SaaS multi-tenant + Flow.cl retained (organizations → tenants)
-- ============================================================================

-- ============================================================================
-- Extensions
-- ============================================================================
create extension if not exists pgcrypto;
create extension if not exists citext;

-- ============================================================================
-- Enums
-- ============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_movement_type') then
    create type public.inventory_movement_type as enum ('in', 'out', 'adjustment');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_name') then
    create type public.plan_name as enum ('starter', 'pro', 'business', 'enterprise');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
end $$;

-- ============================================================================
-- Tables
-- ============================================================================

-- Tenants – must be created first (FK target)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  business_name text not null,
  business_subtitle text,
  plan public.plan_name not null default 'starter',
  product text not null default 'soly',
  flow_subscription_id text,
  flow_customer_email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email citext not null unique,
  full_name text,
  role text not null default 'member' check (char_length(role) > 0 and char_length(role) <= 50),
  is_active boolean not null default true,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Memberships
create table if not exists public.memberships (
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- Tenant Seats
create table if not exists public.tenant_seats (
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

-- Tenant Products (plan product flags)
create table if not exists public.tenant_products (
  tenant_id uuid references public.tenants(id) on delete cascade,
  product_key text not null,
  enabled_at timestamptz not null default now(),
  primary key (tenant_id, product_key)
);

-- Allowed Emails (invite whitelist)
create table if not exists public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
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
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Appointments
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
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Services
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null default 0,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Inventory Products
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
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_products_safety_stock_non_negative check (safety_stock >= 0),
  constraint inventory_products_min_stock_above_safety check (min_stock >= safety_stock)
);

-- Inventory Movements
create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  type public.inventory_movement_type not null,
  quantity integer not null,
  note text,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================
create index if not exists idx_allowed_emails_email on public.allowed_emails (email);

create index if not exists idx_customers_name on public.customers (name);
create index if not exists idx_customers_email on public.customers (email);

create index if not exists idx_appointments_customer on public.appointments (customer_id);
create index if not exists idx_appointments_barber on public.appointments (barber_id);
create index if not exists idx_appointments_date on public.appointments (appointment_date);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_tenant on public.appointments (tenant_id);

create index if not exists idx_services_tenant on public.services (tenant_id);

create index if not exists idx_inventory_products_tenant on public.inventory_products (tenant_id);

create index if not exists idx_inventory_movements_product on public.inventory_movements (product_id);
create index if not exists idx_inventory_movements_tenant on public.inventory_movements (tenant_id);

create index if not exists idx_customers_tenant on public.customers (tenant_id);

create index if not exists idx_memberships_user on public.memberships (user_id);
create index if not exists idx_memberships_tenant on public.memberships (tenant_id);

create index if not exists idx_tenant_seats_user on public.tenant_seats (user_id);

create index if not exists idx_profiles_tenant on public.profiles (tenant_id);

create index if not exists idx_tenants_slug on public.tenants (slug);


-- ============================================================================
-- Functions (helpers)
-- ============================================================================

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

-- Role checks
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and lower(p.role::text) = 'admin'
      and coalesce(p.is_active, true) = true
  );
$$;

create or replace function public.is_operator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'operator'
      and p.is_active = true
  );
$$;

create or replace function public.is_admin_or_operator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('admin', 'operator')
      and p.is_active = true
  );
$$;

-- Tenant helpers (SaaS multi-tenant)
create or replace function public.get_current_tenant()
returns uuid as $$
  select tenant_id
  from public.memberships
  where user_id = auth.uid()
  limit 1;
$$ language sql stable security definer;

create or replace function public.get_user_tenant_role(org_id uuid)
returns text as $$
  select role::text
  from public.memberships
  where tenant_id = org_id and user_id = auth.uid();
$$ language sql stable security definer;

create or replace function public.is_tenant_admin(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$ language sql stable security definer;

create or replace function public.get_tenant_seats_count(org_id uuid)
returns bigint as $$
  select count(*)
  from public.tenant_seats
  where tenant_id = org_id and is_active = true;
$$ language sql stable;

-- ============================================================================
-- Functions (business logic)
-- ============================================================================

-- Handle new auth user: auto-create profile row
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
  existing_profile_id uuid;
  existing_profile_has_auth boolean;
begin
  select exists(
    select 1
    from public.allowed_emails ae
    where ae.email = new.email
      and ae.is_active = true
  )
  into allowed;

  select p.id
  into existing_profile_id
  from public.profiles p
  where p.email = new.email
    and p.id <> new.id
  limit 1;

  if existing_profile_id is not null then
    select exists(
      select 1
      from auth.users u
      where u.id = existing_profile_id
    )
    into existing_profile_has_auth;

    if existing_profile_has_auth then
      raise exception 'profiles.email already linked to another auth user: %', new.email
        using errcode = '23505';
    else
      delete from public.profiles
      where id = existing_profile_id;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'member',
    allowed
  )
  on conflict (id) do update
    set email = excluded.email,
        is_active = excluded.is_active,
        updated_at = now();

  return new;
end;
$$;

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

-- Auth user auto-profile trigger
drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- Row-Level Security (RLS)
-- ============================================================================

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.tenant_seats enable row level security;
alter table public.tenant_products enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.services enable row level security;
alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;

-- tenants
drop policy if exists "tenants_self_select" on public.tenants;
create policy "tenants_self_select"
  on public.tenants for select
  using (
    id in (
      select tenant_id from public.memberships
      where user_id = auth.uid()
    )
  );

drop policy if exists "tenants_self_insert" on public.tenants;
create policy "tenants_self_insert"
  on public.tenants for insert
  with check (true);

drop policy if exists "tenants_self_update" on public.tenants;
create policy "tenants_self_update"
  on public.tenants for update
  using (
    id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- memberships
drop policy if exists "memberships_self_select" on public.memberships;
create policy "memberships_self_select"
  on public.memberships for select
  using (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid()
  ));

drop policy if exists "memberships_insert" on public.memberships;
create policy "memberships_insert"
  on public.memberships for insert
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "memberships_delete" on public.memberships;
create policy "memberships_delete"
  on public.memberships for delete
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- tenant_seats
drop policy if exists "tenant_seats_self_select" on public.tenant_seats;
create policy "tenant_seats_self_select"
  on public.tenant_seats for select
  using (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid()
  ));

drop policy if exists "tenant_seats_insert" on public.tenant_seats;
create policy "tenant_seats_insert"
  on public.tenant_seats for insert
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "tenant_seats_delete" on public.tenant_seats;
create policy "tenant_seats_delete"
  on public.tenant_seats for delete
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- tenant_products
drop policy if exists "tenant_products_self_select" on public.tenant_products;
create policy "tenant_products_self_select"
  on public.tenant_products for select
  using (tenant_id in (
    select tenant_id from public.memberships where user_id = auth.uid()
  ));

-- allowed_emails (admin only)
drop policy if exists "allowed_emails_admin_select" on public.allowed_emails;
create policy "allowed_emails_admin_select"
  on public.allowed_emails
  for select
  using (public.is_admin(auth.uid()));

drop policy if exists "allowed_emails_admin_write" on public.allowed_emails;
create policy "allowed_emails_admin_write"
  on public.allowed_emails
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- profiles (org-scoped → tenant-scoped)
drop policy if exists "profiles_tenant_select" on public.profiles;
create policy "profiles_tenant_select"
  on public.profiles for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

drop policy if exists "profiles_tenant_update" on public.profiles;
create policy "profiles_tenant_update"
  on public.profiles for update
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert"
  on public.profiles for insert
  with check (id = auth.uid());

-- customers (org-scoped → tenant-scoped)
drop policy if exists "customers_tenant_select" on public.customers;
create policy "customers_tenant_select"
  on public.customers for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

drop policy if exists "customers_tenant_insert" on public.customers;
create policy "customers_tenant_insert"
  on public.customers for insert
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin', 'member')
    )
  );

drop policy if exists "customers_tenant_update" on public.customers;
create policy "customers_tenant_update"
  on public.customers for update
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin', 'member')
    )
  );

drop policy if exists "customers_tenant_delete" on public.customers;
create policy "customers_tenant_delete"
  on public.customers for delete
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- appointments (org-scoped → tenant-scoped)
drop policy if exists "appointments_tenant_select" on public.appointments;
create policy "appointments_tenant_select"
  on public.appointments for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

drop policy if exists "appointments_tenant_insert" on public.appointments;
create policy "appointments_tenant_insert"
  on public.appointments for insert
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "appointments_tenant_update" on public.appointments;
create policy "appointments_tenant_update"
  on public.appointments for update
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- services (org-scoped → tenant-scoped)
drop policy if exists "services_tenant_select" on public.services;
create policy "services_tenant_select"
  on public.services for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

drop policy if exists "services_tenant_insert" on public.services;
create policy "services_tenant_insert"
  on public.services for insert
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "services_tenant_update" on public.services;
create policy "services_tenant_update"
  on public.services for update
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- inventory_products (org-scoped → tenant-scoped)
drop policy if exists "inventory_products_tenant_select" on public.inventory_products;
create policy "inventory_products_tenant_select"
  on public.inventory_products for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

drop policy if exists "inventory_products_tenant_insert" on public.inventory_products;
create policy "inventory_products_tenant_insert"
  on public.inventory_products for insert
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

drop policy if exists "inventory_products_tenant_update" on public.inventory_products;
create policy "inventory_products_tenant_update"
  on public.inventory_products for update
  using (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- inventory_movements (org-scoped → tenant-scoped)
drop policy if exists "inventory_movements_tenant_select" on public.inventory_movements;
create policy "inventory_movements_tenant_select"
  on public.inventory_movements for select
  using (
    tenant_id in (
      select tenant_id from public.memberships where user_id = auth.uid()
    )
  );

drop policy if exists "inventory_movements_tenant_insert" on public.inventory_movements;
create policy "inventory_movements_tenant_insert"
  on public.inventory_movements for insert
  with check (
    tenant_id in (
      select tenant_id from public.memberships
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ============================================================================
-- Views
-- ============================================================================

create or replace view public.vw_appointments_enriched
with (security_invoker = true)
as
select
  a.id,
  a.customer_id,
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

create or replace view public.vw_revenue_by_barber
with (security_invoker = true)
as
select
  coalesce(p.full_name, a.staff_name, 'Sin asignar') as barber_name,
  a.barber_id,
  sum(a.cost) as revenue
from public.appointments a
left join public.profiles p on p.id = a.barber_id
where a.status not in ('cancelled', 'no_show')
group by coalesce(p.full_name, a.staff_name, 'Sin asignar'), a.barber_id;

create or replace view public.vw_revenue_by_service
with (security_invoker = true)
as
select
  a.service_name,
  sum(a.cost) as revenue
from public.appointments a
where a.status not in ('cancelled', 'no_show')
group by a.service_name;

create or replace view public.vw_appointments_per_day
with (security_invoker = true)
as
select
  to_char(a.appointment_date::date, 'YYYY-MM-DD') as day,
  a.appointment_date::date as appointment_date,
  count(*) as total
from public.appointments a
where a.appointment_date::date >= (current_date - interval '30 day')
group by to_char(a.appointment_date::date, 'YYYY-MM-DD'), a.appointment_date::date
order by a.appointment_date::date;

-- ============================================================================
-- Grants
-- ============================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to authenticated;

grant select on public.vw_appointments_enriched to authenticated;
grant select on public.vw_revenue_by_barber to authenticated;

-- RPC grants
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_admin(uuid) to service_role;
grant execute on function public.is_admin(uuid) to anon;

grant execute on function public.is_operator(uuid) to authenticated;
grant execute on function public.is_operator(uuid) to service_role;

grant execute on function public.is_admin_or_operator(uuid) to authenticated;
grant execute on function public.is_admin_or_operator(uuid) to service_role;

grant execute on function public.get_dashboard_kpis(uuid, text) to authenticated;

grant execute on function public.get_current_tenant() to authenticated;
grant execute on function public.get_current_tenant() to service_role;

grant execute on function public.get_user_tenant_role(uuid) to authenticated;
grant execute on function public.get_user_tenant_role(uuid) to service_role;

grant execute on function public.is_tenant_admin(uuid) to authenticated;
grant execute on function public.is_tenant_admin(uuid) to service_role;

grant execute on function public.get_tenant_seats_count(uuid) to authenticated;
grant execute on function public.get_tenant_seats_count(uuid) to service_role;

grant execute on function public.handle_flow_webhook(text, text, public.plan_name) to service_role;

grant execute on function public.cancel_flow_subscription(text) to service_role;

-- ============================================================================
-- Seed data
-- ============================================================================

-- Default tenant (idempotent)
insert into public.tenants (slug, business_name, plan, product)
values ('default', 'Default Tenant', 'starter', 'soly')
on conflict (slug) do nothing;

-- ============================================================================
-- Storage RLS (tenant file isolation)
-- ============================================================================

-- Each tenant sees only their own files (path = {tenant_id}/*)
create policy "tenant_files_select"
on storage.objects for select
using (
  bucket_id = 'excel-files'
  and (storage.foldername(name))[1] = (
    select tenant_id::text from public.memberships
    where user_id = auth.uid() limit 1
  )
);

create policy "tenant_files_insert"
on storage.objects for insert
with check (
  bucket_id = 'excel-files'
  and auth.role() = 'authenticated'
);

create policy "tenant_files_delete"
on storage.objects for delete
using (
  bucket_id = 'excel-files'
  and (storage.foldername(name))[1] = (
    select tenant_id::text from public.memberships
    where user_id = auth.uid() limit 1
  )
);
