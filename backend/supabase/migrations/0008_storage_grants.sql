-- ============================================================================
-- Soly CRM - Storage RLS Policies, Grants & Seed Data
-- ============================================================================

-- Storage RLS (tenant file isolation on excel-files bucket)
drop policy if exists "tenant_files_select" on storage.objects;
create policy "tenant_files_select"
on storage.objects for select
using (
  bucket_id = 'excel-files'
  and (storage.foldername(name))[1] = (
    select tenant_id::text from public.memberships
    where user_id = auth.uid() limit 1
  )
);

drop policy if exists "tenant_files_insert" on storage.objects;
create policy "tenant_files_insert"
on storage.objects for insert
with check (
  bucket_id = 'excel-files'
  and auth.role() = 'authenticated'
);

drop policy if exists "tenant_files_delete" on storage.objects;
create policy "tenant_files_delete"
on storage.objects for delete
using (
  bucket_id = 'excel-files'
  and (storage.foldername(name))[1] = (
    select tenant_id::text from public.memberships
    where user_id = auth.uid() limit 1
  )
);

-- Schema grants
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

-- Seed data (idempotent)
insert into public.tenants (slug, business_name, plan, product)
values ('default', 'Default Tenant', 'starter', 'soly')
on conflict (slug) do nothing;
