-- Fix: infinite recursion in RLS policies
-- Use security definer helper function to break the recursion loop

-- Helper: get all tenant IDs for the current user (bypasses RLS)
create or replace function public.get_my_tenant_ids()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id from memberships where user_id = auth.uid();
$$;

grant execute on function public.get_my_tenant_ids() to authenticated;

-- Helper: get my tenant IDs where I have a specific role
create or replace function public.get_my_tenant_ids_for_role(p_roles text[])
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select tenant_id from memberships
  where user_id = auth.uid() and role = any(p_roles);
$$;

grant execute on function public.get_my_tenant_ids_for_role(text[]) to authenticated;

-- Fix memberships policies
drop policy if exists "memberships_self_select" on public.memberships;
create policy "memberships_self_select" on public.memberships for select
using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "memberships_insert" on public.memberships;
create policy "memberships_insert" on public.memberships for insert
with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "memberships_delete" on public.memberships;
create policy "memberships_delete" on public.memberships for delete
using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner'])));

-- Fix tenant_seats policies
drop policy if exists "tenant_seats_self_select" on public.tenant_seats;
create policy "tenant_seats_self_select" on public.tenant_seats for select
using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "tenant_seats_insert" on public.tenant_seats;
create policy "tenant_seats_insert" on public.tenant_seats for insert
with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "tenant_seats_delete" on public.tenant_seats;
create policy "tenant_seats_delete" on public.tenant_seats for delete
using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- Fix tenants policies
drop policy if exists "tenants_self_select" on public.tenants;
create policy "tenants_self_select" on public.tenants for select
using (id in (select public.get_my_tenant_ids()));

drop policy if exists "tenants_self_update" on public.tenants;
create policy "tenants_self_update" on public.tenants for update
using (id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- Fix profiles policies
drop policy if exists "profiles_tenant_select" on public.profiles;
create policy "profiles_tenant_select" on public.profiles for select
using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "profiles_tenant_update" on public.profiles;
create policy "profiles_tenant_update" on public.profiles for update
using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

-- Fix tenant_products
drop policy if exists "tenant_products_self_select" on public.tenant_products;
create policy "tenant_products_self_select" on public.tenant_products for select
using (tenant_id in (select public.get_my_tenant_ids()));

-- Fix domain tables (customers, appointments, services, inventory)
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

drop policy if exists "appointments_tenant_select" on public.appointments;
create policy "appointments_tenant_select" on public.appointments for select
using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "appointments_tenant_insert" on public.appointments;
create policy "appointments_tenant_insert" on public.appointments for insert
with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "appointments_tenant_update" on public.appointments;
create policy "appointments_tenant_update" on public.appointments for update
using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "services_tenant_select" on public.services;
create policy "services_tenant_select" on public.services for select
using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "services_tenant_insert" on public.services;
create policy "services_tenant_insert" on public.services for insert
with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "services_tenant_update" on public.services;
create policy "services_tenant_update" on public.services for update
using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "inventory_products_tenant_select" on public.inventory_products;
create policy "inventory_products_tenant_select" on public.inventory_products for select
using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "inventory_products_tenant_insert" on public.inventory_products;
create policy "inventory_products_tenant_insert" on public.inventory_products for insert
with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "inventory_products_tenant_update" on public.inventory_products;
create policy "inventory_products_tenant_update" on public.inventory_products for update
using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

drop policy if exists "inventory_movements_tenant_select" on public.inventory_movements;
create policy "inventory_movements_tenant_select" on public.inventory_movements for select
using (tenant_id in (select public.get_my_tenant_ids()));

drop policy if exists "inventory_movements_tenant_insert" on public.inventory_movements;
create policy "inventory_movements_tenant_insert" on public.inventory_movements for insert
with check (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));
