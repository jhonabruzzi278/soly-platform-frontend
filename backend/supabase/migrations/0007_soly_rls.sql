-- ============================================================================
-- Soly CRM - RLS for Domain Tables
-- ============================================================================

alter table public.customers enable row level security;
alter table public.appointments enable row level security;
alter table public.services enable row level security;
alter table public.inventory_products enable row level security;
alter table public.inventory_movements enable row level security;

-- customers (tenant-scoped)
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

-- appointments (tenant-scoped)
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

-- services (tenant-scoped)
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

-- inventory_products (tenant-scoped)
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

-- inventory_movements (tenant-scoped)
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
