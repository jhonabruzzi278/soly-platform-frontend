-- Add trial_ends_at to subscriptions
alter table public.subscriptions add column if not exists trial_ends_at timestamptz;

-- Drop obsolete RPCs (replaced by direct table access in edge functions)
drop function if exists public.handle_flow_webhook(text, text, public.plan_name);
drop function if exists public.cancel_flow_subscription(text);
