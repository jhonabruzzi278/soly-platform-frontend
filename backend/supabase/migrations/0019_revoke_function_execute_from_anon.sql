-- ============================================================================
-- Module 19: Revoke function EXECUTE from anon (and authenticated where unsafe)
-- Supabase default privileges grant EXECUTE directly to anon/authenticated, so
-- migration 0016's REVOKE ... FROM public was not enough. This completes the
-- lockdown by revoking the direct role grants.
--   - RLS helpers keep `authenticated` (RLS evaluates them as that role; they
--     only ever return the caller's own data) but lose `anon`.
--   - Trigger/admin functions lose both (triggers fire as table owner; admin
--     functions are invoked by Edge Functions / cron as service_role).
-- ============================================================================

-- RLS helpers + read RPCs: revoke anon only.
revoke execute on function public.get_my_tenant_ids() from anon;
revoke execute on function public.get_my_tenant_ids_for_role(text[]) from anon;
revoke execute on function public.is_admin(uuid) from anon;
revoke execute on function public.is_tenant_admin(uuid) from anon;
revoke execute on function public.get_user_tenant_role(uuid) from anon;
revoke execute on function public.get_current_tenant() from anon;
revoke execute on function public.get_tenant_seats_count(uuid) from anon;
revoke execute on function public.has_active_subscription(uuid, text) from anon;
revoke execute on function public.tenant_has_feature(uuid, text) from anon;
revoke execute on function public.get_tenant_seat_limit(uuid) from anon;
revoke execute on function public.get_tenant_file_limit(uuid) from anon;
revoke execute on function public.get_user_session() from anon;
revoke execute on function public.get_customers_paginated(uuid, timestamptz, integer) from anon;
revoke execute on function public.get_appointments_paginated(uuid, timestamptz, integer) from anon;
revoke execute on function public.get_dashboard_kpis(uuid, text) from anon;

-- Trigger-only functions: revoke from anon AND authenticated.
revoke execute on function public.handle_new_auth_user() from anon, authenticated;
revoke execute on function public.sync_subscription_to_tenant() from anon, authenticated;
revoke execute on function public.trg_refresh_customer_rollup() from anon, authenticated;
revoke execute on function public.trg_apply_inventory_movement() from anon, authenticated;
revoke execute on function public.validate_appointment_tenant() from anon, authenticated;
revoke execute on function public.validate_inventory_movement_tenant() from anon, authenticated;
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.refresh_customer_rollup(uuid) from anon, authenticated;

-- Admin/maintenance functions: service_role only.
revoke execute on function public.expire_overdue_subscriptions() from anon, authenticated;
revoke execute on function public.cleanup_rate_limits() from anon, authenticated;
revoke execute on function public.cleanup_tenant_data_on_downgrade(uuid, plan_name, plan_name) from anon, authenticated;
revoke execute on function public.disable_rollup_trigger() from anon, authenticated;
revoke execute on function public.enable_rollup_trigger() from anon, authenticated;
revoke execute on function public.refresh_customer_rollup_batch(uuid) from anon, authenticated;
