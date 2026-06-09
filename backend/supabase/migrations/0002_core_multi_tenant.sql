-- ============================================================================
-- Module 2: Core Multi-Tenant
-- tenants, profiles, memberships, tenant_seats, tenant_products, allowed_emails
-- Helper functions, auth trigger, RLS policies
-- ============================================================================

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  business_name text not null,
  business_subtitle text,
  plan plan_name not null default 'starter',
  product text not null default 'soly',
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
  role org_role not null default 'member',
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

-- ============================================================================
-- Indexes (all FK columns indexed per best practices)
-- ============================================================================

create index if not exists idx_tenants_slug on public.tenants (slug);
create index if not exists idx_profiles_tenant on public.profiles (tenant_id);
create index if not exists idx_memberships_user on public.memberships (user_id);
create index if not exists idx_memberships_tenant on public.memberships (tenant_id);
create index if not exists idx_tenant_seats_user on public.tenant_seats (user_id);
create index if not exists idx_tenant_seats_tenant on public.tenant_seats (tenant_id);
create index if not exists idx_tenant_products_tenant on public.tenant_products (tenant_id);
create index if not exists idx_allowed_emails_email on public.allowed_emails (email);

-- ============================================================================
-- Helper Functions (SECURITY DEFINER to avoid RLS recursion)
-- ============================================================================

create or replace function public.get_my_tenant_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id from memberships where user_id = auth.uid();
$$;

grant execute on function public.get_my_tenant_ids() to authenticated;

create or replace function public.get_my_tenant_ids_for_role(p_roles text[])
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id from memberships
  where user_id = auth.uid() and role::text = any(p_roles);
$$;

grant execute on function public.get_my_tenant_ids_for_role(text[]) to authenticated;

create or replace function public.is_admin(uid uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and lower(p.role::text) = 'admin'
      and coalesce(p.is_active, true) = true
  );
$$;

grant execute on function public.is_admin(uuid) to authenticated;

create or replace function public.get_current_tenant()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id
  from public.memberships
  where user_id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_current_tenant() to authenticated;
grant execute on function public.get_current_tenant() to service_role;

create or replace function public.get_user_tenant_role(org_id uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select role::text
  from public.memberships
  where tenant_id = org_id and user_id = auth.uid();
$$;

grant execute on function public.get_user_tenant_role(uuid) to authenticated;
grant execute on function public.get_user_tenant_role(uuid) to service_role;

create or replace function public.is_tenant_admin(org_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

grant execute on function public.is_tenant_admin(uuid) to authenticated;
grant execute on function public.is_tenant_admin(uuid) to service_role;

create or replace function public.get_tenant_seats_count(org_id uuid)
returns bigint
language sql stable
as $$
  select count(*)
  from public.tenant_seats
  where tenant_id = org_id and is_active = true;
$$;

grant execute on function public.get_tenant_seats_count(uuid) to authenticated;
grant execute on function public.get_tenant_seats_count(uuid) to service_role;

-- ============================================================================
-- Auth Trigger: auto-create profile + tenant on signup
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_slug text;
  v_allowed boolean;
begin
  -- Check email whitelist
  select exists(select 1 from public.allowed_emails ae where ae.email = new.email and ae.is_active = true) into v_allowed;

  -- Create or update profile
  insert into public.profiles (id, email, full_name, role, is_active)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email), 'member', v_allowed)
  on conflict (id) do update
    set email = excluded.email, is_active = excluded.is_active, updated_at = now();

  -- Auto-create tenant if metadata has tenant_id
  v_slug := new.raw_user_meta_data ->> 'tenant_id';
  if v_slug is not null and v_slug != '' then
    v_tenant_id := gen_random_uuid();

    insert into public.tenants (id, slug, business_name, plan)
    values (v_tenant_id, v_slug, coalesce(new.raw_user_meta_data ->> 'tenant_name', v_slug), coalesce(new.raw_user_meta_data ->> 'plan', 'starter'))
    on conflict (slug) do update set updated_at = now();

    select id into v_tenant_id from public.tenants where slug = v_slug;

    -- Link user to tenant as owner
    insert into public.memberships (user_id, tenant_id, role)
    values (new.id, v_tenant_id, 'owner')
    on conflict (user_id, tenant_id) do nothing;

    -- Add seat
    insert into public.tenant_seats (user_id, tenant_id, is_active)
    values (new.id, v_tenant_id, true)
    on conflict (user_id, tenant_id) do nothing;

    -- Link profile to tenant
    update public.profiles set tenant_id = v_tenant_id where id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS on all tables
alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.tenant_seats enable row level security;
alter table public.tenant_products enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.profiles enable row level security;

-- tenants
drop policy if exists "tenants_self_select" on public.tenants;
create policy "tenants_self_select" on public.tenants for select
  using (id in (select public.get_my_tenant_ids()));

drop policy if exists "tenants_service_role_insert" on public.tenants;
create policy "tenants_service_role_insert" on public.tenants for insert
  to service_role
  with check (true);

drop policy if exists "tenants_self_update" on public.tenants;
create policy "tenants_self_update" on public.tenants for update
  using (id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- memberships
drop policy if exists "memberships_self_select" on public.memberships;
create policy "memberships_self_select" on public.memberships for select
  using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "memberships_insert" on public.memberships;
create policy "memberships_insert" on public.memberships for insert
  with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "memberships_delete" on public.memberships;
create policy "memberships_delete" on public.memberships for delete
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner'])));

-- tenant_seats
drop policy if exists "tenant_seats_self_select" on public.tenant_seats;
create policy "tenant_seats_self_select" on public.tenant_seats for select
  using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "tenant_seats_insert" on public.tenant_seats;
create policy "tenant_seats_insert" on public.tenant_seats for insert
  with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "tenant_seats_delete" on public.tenant_seats;
create policy "tenant_seats_delete" on public.tenant_seats for delete
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- tenant_products
drop policy if exists "tenant_products_self_select" on public.tenant_products;
create policy "tenant_products_self_select" on public.tenant_products for select
  using (tenant_id in (select public.get_my_tenant_ids()));

-- allowed_emails (admin only)
drop policy if exists "allowed_emails_admin_select" on public.allowed_emails;
create policy "allowed_emails_admin_select" on public.allowed_emails
  for select
  using (public.is_admin(auth.uid()));

drop policy if exists "allowed_emails_admin_write" on public.allowed_emails;
create policy "allowed_emails_admin_write" on public.allowed_emails
  for all
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- profiles
drop policy if exists "profiles_tenant_select" on public.profiles;
create policy "profiles_tenant_select" on public.profiles for select
  using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles for insert
  with check (id = auth.uid() and role = 'member');

drop policy if exists "profiles_tenant_update" on public.profiles;
create policy "profiles_tenant_update" on public.profiles for update
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- ============================================================================
-- updated_at triggers
-- ============================================================================

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_tenants_updated_at on public.tenants;
create trigger trg_tenants_updated_at
  before update on public.tenants
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Schema grants
-- ============================================================================

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
