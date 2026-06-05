-- ============================================================================
-- Soly CRM - RLS for Shared Tables
-- ============================================================================

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;
alter table public.tenant_seats enable row level security;
alter table public.tenant_products enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.profiles enable row level security;

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

-- profiles (tenant-scoped)
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
