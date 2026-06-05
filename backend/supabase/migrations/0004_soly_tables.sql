-- ============================================================================
-- Soly CRM - Domain Tables
-- customers, appointments, services, inventory_products, inventory_movements
-- ============================================================================

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

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(12,2) not null default 0,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_products_safety_stock_non_negative check (safety_stock >= 0),
  constraint inventory_products_min_stock_above_safety check (min_stock >= safety_stock)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.inventory_products(id) on delete cascade,
  type public.inventory_movement_type not null,
  quantity integer not null,
  note text,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_customers_name on public.customers (name);
create index if not exists idx_customers_email on public.customers (email);
create index if not exists idx_customers_tenant on public.customers (tenant_id);

create index if not exists idx_appointments_customer on public.appointments (customer_id);
create index if not exists idx_appointments_barber on public.appointments (barber_id);
create index if not exists idx_appointments_date on public.appointments (appointment_date);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_tenant on public.appointments (tenant_id);

create index if not exists idx_services_tenant on public.services (tenant_id);

create index if not exists idx_inventory_products_tenant on public.inventory_products (tenant_id);

create index if not exists idx_inventory_movements_product on public.inventory_movements (product_id);
create index if not exists idx_inventory_movements_tenant on public.inventory_movements (tenant_id);
