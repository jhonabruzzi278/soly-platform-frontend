-- ============================================================================
-- Module 1: Foundation
-- Extensions, enums, and base utility functions
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- Enums
create type plan_name as enum ('starter', 'pro', 'business', 'enterprise');
create type org_role as enum ('owner', 'admin', 'member', 'viewer');
create type inventory_movement_type as enum ('in', 'out', 'adjustment');

-- Base utility function: auto-update updated_at timestamp
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$;
