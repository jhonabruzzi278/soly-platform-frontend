-- ============================================================================
-- Soly CRM - Shared Tables
-- tenants, profiles, memberships, tenant_seats, tenant_products, allowed_emails
-- ============================================================================

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

create table if not exists public.memberships (
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.org_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.tenant_seats (
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  is_active boolean not null default true,
  assigned_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.tenant_products (
  tenant_id uuid references public.tenants(id) on delete cascade,
  product_key text not null,
  enabled_at timestamptz not null default now(),
  primary key (tenant_id, product_key)
);

create table if not exists public.allowed_emails (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------
create index if not exists idx_tenants_slug on public.tenants (slug);
create index if not exists idx_profiles_tenant on public.profiles (tenant_id);
create index if not exists idx_memberships_user on public.memberships (user_id);
create index if not exists idx_memberships_tenant on public.memberships (tenant_id);
create index if not exists idx_tenant_seats_user on public.tenant_seats (user_id);
create index if not exists idx_allowed_emails_email on public.allowed_emails (email);
