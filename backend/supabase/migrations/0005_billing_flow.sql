-- ============================================================================
-- Module 5: Billing + Flow.cl
-- billing_customers, subscriptions, billing_webhook_events
-- Subscription lifecycle functions and RLS policies
-- ============================================================================

-- ============================================================================
-- Tables
-- ============================================================================

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  provider text default 'flow',
  provider_customer_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product text not null check (product in ('soly', 'logify')),
  plan plan_name not null default 'starter',
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'trialing')),
  provider text default 'flow',
  provider_subscription_id text,
  provider_customer_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'flow',
  event_type text not null,
  raw_payload jsonb not null,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  processed boolean not null default false,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

create index if not exists idx_billing_customers_user on public.billing_customers (user_id);
create index if not exists idx_billing_customers_provider_id on public.billing_customers (provider_customer_id);

create index if not exists idx_subscriptions_user_product on public.subscriptions (user_id, product);
create index if not exists idx_subscriptions_status on public.subscriptions (status);
create index if not exists idx_subscriptions_provider_id on public.subscriptions (provider_subscription_id);
create index if not exists idx_subscriptions_user_product_status on public.subscriptions (user_id, product, status);

create index if not exists idx_billing_webhook_events_subscription on public.billing_webhook_events (subscription_id);
create index if not exists idx_billing_webhook_events_processed on public.billing_webhook_events (processed) where processed = false;
create index if not exists idx_billing_webhook_events_created on public.billing_webhook_events (created_at desc);

-- ============================================================================
-- Functions
-- ============================================================================

-- Helper: check if user has active subscription (supports 'trialing' status)
create or replace function public.has_active_subscription(p_user_id uuid, p_product text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = p_user_id
      and product = p_product
      and status in ('active', 'trialing')
  );
$$;

grant execute on function public.has_active_subscription(uuid, text) to authenticated;

-- Sync subscription.plan -> tenants.plan when subscription changes
create or replace function public.sync_subscription_to_tenant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
begin
  if (TG_OP = 'UPDATE' and (NEW.plan != OLD.plan or NEW.status != OLD.status))
     or (TG_OP = 'INSERT') then

    select m.tenant_id into v_tenant_id
    from public.memberships m
    where m.user_id = NEW.user_id
      and m.role = 'owner'
    limit 1;

    if v_tenant_id is not null then
      if NEW.status in ('active', 'trialing') then
        update public.tenants
        set plan = NEW.plan,
            updated_at = now()
        where id = v_tenant_id;
      elsif NEW.status in ('cancelled', 'expired') then
        update public.tenants
        set plan = 'starter',
            updated_at = now()
        where id = v_tenant_id;
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

-- Expire overdue subscriptions (call via pg_cron or Edge Function)
create or replace function public.expire_overdue_subscriptions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expired_count integer;
begin
  update public.subscriptions
  set status = 'expired',
      updated_at = now()
  where status = 'active'
    and current_period_end is not null
    and current_period_end < now();

  get diagnostics v_expired_count = row_count;

  update public.subscriptions
  set status = 'expired',
      updated_at = now()
  where status = 'trialing'
    and trial_ends_at is not null
    and trial_ends_at < now();

  get diagnostics v_expired_count = v_expired_count + row_count;

  return v_expired_count;
end;
$$;

-- ============================================================================
-- RLS Policies
-- ============================================================================

alter table public.billing_customers enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

-- billing_customers
drop policy if exists "billing_customers_self" on public.billing_customers;
create policy "billing_customers_self" on public.billing_customers for select
  using (user_id = auth.uid());

-- subscriptions
drop policy if exists "subscriptions_self_select" on public.subscriptions;
create policy "subscriptions_self_select" on public.subscriptions for select
  using (user_id = auth.uid());

drop policy if exists "subscriptions_service_role_insert" on public.subscriptions;
create policy "subscriptions_service_role_insert" on public.subscriptions for insert
  to service_role
  with check (true);

drop policy if exists "subscriptions_service_role_update" on public.subscriptions;
create policy "subscriptions_service_role_update" on public.subscriptions for update
  to service_role
  using (true)
  with check (true);

drop policy if exists "subscriptions_self_delete" on public.subscriptions;
create policy "subscriptions_self_delete" on public.subscriptions for delete
  using (user_id = auth.uid() and status = 'cancelled');

-- billing_webhook_events (service_role only)
drop policy if exists "billing_webhook_events_service_role_all" on public.billing_webhook_events;
create policy "billing_webhook_events_service_role_all" on public.billing_webhook_events
  for all
  to service_role
  using (true)
  with check (true);

-- ============================================================================
-- Triggers
-- ============================================================================

drop trigger if exists trg_billing_customers_updated_at on public.billing_customers;
create trigger trg_billing_customers_updated_at
  before update on public.billing_customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

drop trigger if exists trg_sync_subscription_to_tenant on public.subscriptions;
create trigger trg_sync_subscription_to_tenant
  after insert or update on public.subscriptions
  for each row execute function public.sync_subscription_to_tenant();
