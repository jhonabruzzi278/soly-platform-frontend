-- Desacoplar billing de tenants
-- subscriptions: quien pago que producto
-- billing_customers: identidad de billing por usuario

-- Tabla de clientes de billing (1 usuario puede tener 1 customer)
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

alter table public.billing_customers enable row level security;
create index if not exists idx_billing_customers_user on public.billing_customers (user_id);

create policy "billing_customers_self" on public.billing_customers for select
using (user_id = auth.uid());

-- Tabla de suscripciones (1 usuario puede tener suscripciones a varios productos)
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
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create index if not exists idx_subscriptions_user_product on public.subscriptions (user_id, product);
create index if not exists idx_subscriptions_status on public.subscriptions (status);
create index if not exists idx_subscriptions_provider_id on public.subscriptions (provider_subscription_id);

create policy "subscriptions_self_select" on public.subscriptions for select
using (user_id = auth.uid());

create policy "subscriptions_self_update" on public.subscriptions for update
using (user_id = auth.uid());

-- Helper: verificar si un usuario tiene suscripcion activa a un producto
create or replace function public.has_active_subscription(p_user_id uuid, p_product text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.subscriptions
    where user_id = p_user_id
      and product = p_product
      and status = 'active'
  );
$$;

grant execute on function public.has_active_subscription(uuid, text) to authenticated;

-- Trigger para updated_at en subscriptions
drop trigger if exists trg_subscriptions_updated_at on public.subscriptions;
create trigger trg_subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Migrar datos existentes: mover flow_subscription_id de tenants a subscriptions
do $$
declare
  t record;
begin
  for t in select id, plan, flow_subscription_id, flow_customer_email from public.tenants
    where flow_subscription_id is not null
  loop
    -- Encontrar el owner del tenant
    insert into public.subscriptions (user_id, product, plan, status, provider_subscription_id, provider_customer_id)
    select m.user_id, t.plan, t.plan, 'active', t.flow_subscription_id, t.flow_customer_email
    from public.memberships m
    where m.tenant_id = t.id and m.role = 'owner'
    limit 1
    on conflict do nothing;
  end loop;
end $$;

-- Quitar columnas de billing de tenants
alter table public.tenants
  drop column if exists flow_subscription_id,
  drop column if exists flow_customer_email;
