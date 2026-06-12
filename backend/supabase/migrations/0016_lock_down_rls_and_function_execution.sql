-- ============================================================================
-- Module 16: Lock down RLS + SECURITY DEFINER function execution
-- Fixes (found via live Supabase advisors on project mkoqatywbfxtcwyttkjm):
--   - rate_limits had RLS disabled -> fully exposed to anon/authenticated.
--   - ~30 SECURITY DEFINER functions were callable via /rest/v1/rpc/* by anon.
-- NOTE: Supabase grants EXECUTE directly to anon/authenticated via default
--       privileges, so REVOKE ... FROM public is not sufficient on its own.
--       Migration 0019 completes the lockdown by revoking from anon directly.
-- ============================================================================

-- 1. CRITICAL: rate_limits was fully exposed to anon/authenticated (RLS off).
-- Only the Edge Functions (service_role, which bypasses RLS) touch this table.
alter table public.rate_limits enable row level security;
-- No policy = no access for anon/authenticated. service_role bypasses RLS.

-- 2. Remove the implicit PUBLIC EXECUTE grant from SECURITY DEFINER helpers.
revoke execute on function public.get_my_tenant_ids() from public;
revoke execute on function public.get_my_tenant_ids_for_role(text[]) from public;
revoke execute on function public.is_admin(uuid) from public;
revoke execute on function public.is_tenant_admin(uuid) from public;
revoke execute on function public.get_user_tenant_role(uuid) from public;
revoke execute on function public.get_current_tenant() from public;
revoke execute on function public.get_tenant_seats_count(uuid) from public;
revoke execute on function public.has_active_subscription(uuid, text) from public;
revoke execute on function public.tenant_has_feature(uuid, text) from public;
revoke execute on function public.get_tenant_seat_limit(uuid) from public;
revoke execute on function public.get_tenant_file_limit(uuid) from public;
revoke execute on function public.get_user_session() from public;
revoke execute on function public.get_customers_paginated(uuid, timestamptz, integer) from public;
revoke execute on function public.get_appointments_paginated(uuid, timestamptz, integer) from public;
revoke execute on function public.get_dashboard_kpis(uuid, text) from public;

-- 3. Trigger-only functions: no role should call them via RPC at all.
revoke execute on function public.handle_new_auth_user() from public;
revoke execute on function public.sync_subscription_to_tenant() from public;
revoke execute on function public.trg_refresh_customer_rollup() from public;
revoke execute on function public.trg_apply_inventory_movement() from public;
revoke execute on function public.validate_appointment_tenant() from public;
revoke execute on function public.validate_inventory_movement_tenant() from public;
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.refresh_customer_rollup(uuid) from public;

-- 4. Admin/maintenance functions: service_role only (Edge Functions / cron).
revoke execute on function public.expire_overdue_subscriptions() from public;
grant execute on function public.expire_overdue_subscriptions() to service_role;

revoke execute on function public.cleanup_rate_limits() from public;
grant execute on function public.cleanup_rate_limits() to service_role;

revoke execute on function public.cleanup_tenant_data_on_downgrade(uuid, plan_name, plan_name) from public;

revoke execute on function public.disable_rollup_trigger() from public, authenticated;
grant execute on function public.disable_rollup_trigger() to service_role;

revoke execute on function public.enable_rollup_trigger() from public, authenticated;
grant execute on function public.enable_rollup_trigger() to service_role;

revoke execute on function public.refresh_customer_rollup_batch(uuid) from public, authenticated;
grant execute on function public.refresh_customer_rollup_batch(uuid) to service_role;
