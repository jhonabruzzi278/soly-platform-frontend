-- ============================================================================
-- Module 18: RLS performance, FK indexes, and private storage bucket
-- Fixes:
--   - CRIT-3: excel-files bucket was public -> tenant PII exposed.
--   - auth_rls_initplan: auth.uid() re-evaluated per row in several policies.
--   - multiple_permissive_policies: allowed_emails had overlapping SELECT.
--   - unindexed_foreign_keys: appointments.customer_id / barber_id.
-- ============================================================================

-- CRIT-3: make the excel-files bucket private (signed URLs enforced in app).
update storage.buckets set public = false where id = 'excel-files';

-- Perf: wrap auth.uid() in a scalar subquery so RLS evaluates it once per query
-- instead of once per row. Also de-duplicate allowed_emails SELECT policies.

drop policy if exists "allowed_emails_admin_select" on public.allowed_emails;
drop policy if exists "allowed_emails_admin_write" on public.allowed_emails;
create policy "allowed_emails_admin_select" on public.allowed_emails for select
  using (public.is_admin((select auth.uid())));
create policy "allowed_emails_admin_insert" on public.allowed_emails for insert
  with check (public.is_admin((select auth.uid())));
create policy "allowed_emails_admin_update" on public.allowed_emails for update
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));
create policy "allowed_emails_admin_delete" on public.allowed_emails for delete
  using (public.is_admin((select auth.uid())));

drop policy if exists "subscriptions_self_select" on public.subscriptions;
create policy "subscriptions_self_select" on public.subscriptions for select
  using (user_id = (select auth.uid()));

drop policy if exists "subscriptions_self_delete" on public.subscriptions;
create policy "subscriptions_self_delete" on public.subscriptions for delete
  using (user_id = (select auth.uid()) and status = 'cancelled');

drop policy if exists "billing_customers_self" on public.billing_customers;
create policy "billing_customers_self" on public.billing_customers for select
  using (user_id = (select auth.uid()));

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles for insert
  with check (id = (select auth.uid()) and role = 'member'::org_role);

-- Perf: covering indexes for appointments FKs (cascade deletes + joins on
-- customer_id / barber_id; the composite indexes lead with tenant_id).
create index if not exists idx_appointments_customer_id on public.appointments (customer_id);
create index if not exists idx_appointments_barber_id on public.appointments (barber_id);
