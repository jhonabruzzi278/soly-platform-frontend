-- ============================================================================
-- Soly CRM - Extensions & ENUMs
-- ============================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'inventory_movement_type') then
    create type public.inventory_movement_type as enum ('in', 'out', 'adjustment');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_name') then
    create type public.plan_name as enum ('starter', 'pro', 'business', 'enterprise');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'org_role') then
    create type public.org_role as enum ('owner', 'admin', 'member', 'viewer');
  end if;
end $$;
