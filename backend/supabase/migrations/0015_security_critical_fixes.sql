-- ============================================================================
-- Module 15: Critical Security Fixes
-- Fixes:
--   CRIT-1  Tenant/account takeover via forged signup metadata
--           -> token-backed invitations + slug-collision cannot grant ownership
--   CRIT-2  Subscription expiry/cancel destroying all tenant CRM data
--           -> downgrade is a soft feature-lock (plan flips), NO data deletion
--   CRIT-3  Storage bucket marked private (signed URLs enforced in app layer)
-- ============================================================================

-- ============================================================================
-- 1. CRIT-1: Token-backed invitations table (server-side source of truth)
-- ============================================================================

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email citext not null,
  role org_role not null default 'member',
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_role_not_owner check (role <> 'owner')
);

create index if not exists idx_invitations_token on public.invitations (token);
create index if not exists idx_invitations_tenant on public.invitations (tenant_id);
create index if not exists idx_invitations_email on public.invitations (email);

alter table public.invitations enable row level security;

-- Tenant admins/owners may view invitations for their own tenant.
-- Writes happen exclusively through the invite-member Edge Function (service_role).
drop policy if exists "invitations_admin_select" on public.invitations;
create policy "invitations_admin_select" on public.invitations for select
  using (tenant_id in (select public.get_my_tenant_ids_for_role(array['owner','admin'])));

grant select on public.invitations to authenticated;
grant select, insert, update, delete on public.invitations to service_role;

-- ============================================================================
-- 2. CRIT-1: Harden handle_new_auth_user
--    - Never trust invited_by/role from client metadata.
--    - Invitation acceptance is validated against the invitations table by token.
--    - New-org branch can ONLY claim a slug that did not previously exist;
--      a slug collision can never grant membership/ownership of another tenant.
-- ============================================================================

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_slug text;
  v_allowed boolean;
  v_token text;
  v_invite record;
  v_inserted boolean := false;
begin
  -- Email whitelist (controls profile activation only)
  select exists(
    select 1 from public.allowed_emails ae
    where ae.email = new.email and ae.is_active = true
  ) into v_allowed;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'member'::org_role,
    v_allowed
  )
  on conflict (id) do update
    set email = excluded.email, is_active = excluded.is_active, updated_at = now();

  v_token := new.raw_user_meta_data ->> 'invite_token';
  v_slug  := new.raw_user_meta_data ->> 'tenant_id';

  -- ---- Path A: invitation acceptance (token validated server-side) ----------
  if v_token is not null and v_token <> '' then
    select i.* into v_invite
    from public.invitations i
    where i.token = v_token
      and i.consumed_at is null
      and i.expires_at > now()
    limit 1;

    -- Token must exist AND match the email the invite was issued for.
    if v_invite.id is not null and lower(v_invite.email::text) = lower(new.email::text) then
      if not exists (
        select 1 from public.memberships
        where user_id = new.id and tenant_id = v_invite.tenant_id
      ) then
        -- Role comes from the DB invitation row, never from client metadata.
        insert into public.memberships (user_id, tenant_id, role)
        values (new.id, v_invite.tenant_id, v_invite.role);

        insert into public.tenant_seats (user_id, tenant_id, is_active)
        values (new.id, v_invite.tenant_id, true)
        on conflict (user_id, tenant_id) do nothing;

        update public.profiles set tenant_id = v_invite.tenant_id where id = new.id;
      end if;

      update public.invitations set consumed_at = now() where id = v_invite.id;
    end if;
    -- Invalid/expired/mismatched token: user gets a profile but no membership.

  -- ---- Path B: brand-new organization ---------------------------------------
  elsif v_slug is not null and v_slug <> '' then
    perform pg_advisory_xact_lock(hashtext(v_slug));

    -- Always 'starter'; ignore any plan supplied in metadata.
    insert into public.tenants (id, slug, business_name, plan)
    values (
      gen_random_uuid(),
      v_slug,
      coalesce(new.raw_user_meta_data ->> 'tenant_name', v_slug),
      'starter'::plan_name
    )
    on conflict (slug) do nothing;

    -- Capture whether WE inserted the tenant. If the slug already existed,
    -- FOUND is false and we MUST NOT join the pre-existing tenant.
    v_inserted := found;

    if v_inserted then
      select id into v_tenant_id from public.tenants where slug = v_slug;

      insert into public.memberships (user_id, tenant_id, role)
      values (new.id, v_tenant_id, 'owner')
      on conflict (user_id, tenant_id) do nothing;

      insert into public.tenant_seats (user_id, tenant_id, is_active)
      values (new.id, v_tenant_id, true)
      on conflict (user_id, tenant_id) do nothing;

      update public.profiles set tenant_id = v_tenant_id where id = new.id;
    end if;
    -- Slug collision: profile created, but no membership/ownership granted.
  end if;

  return new;
end;
$$;

drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- 3. CRIT-2: Make downgrade a soft feature-lock, NOT a data wipe.
--    sync_subscription_to_tenant still flips plan -> 'starter' on expiry
--    (which disables write features via plan_features RLS) but never deletes.
--    cleanup_tenant_data_on_downgrade is neutralized to a safe no-op so that
--    any lingering caller (cron, manual) cannot destroy tenant data.
-- ============================================================================

create or replace function public.cleanup_tenant_data_on_downgrade(
  p_tenant_id uuid,
  p_old_plan plan_name,
  p_new_plan plan_name
)
returns json
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Intentionally non-destructive. Access is gated by plan_features (RLS);
  -- tenant data is preserved across downgrades and re-enabled on re-upgrade.
  return json_build_object(
    'success', true,
    'message', 'downgrade is a soft feature-lock; tenant data preserved',
    'old_plan', p_old_plan,
    'new_plan', p_new_plan
  );
end;
$$;

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
        set plan = NEW.plan, updated_at = now()
        where id = v_tenant_id;
      elsif NEW.status in ('cancelled', 'expired') then
        -- Soft-lock: flip plan so feature RLS blocks writes. NO data deletion.
        update public.tenants
        set plan = 'starter', updated_at = now()
        where id = v_tenant_id;
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_sync_subscription_to_tenant on public.subscriptions;
create trigger trg_sync_subscription_to_tenant
  after insert or update on public.subscriptions
  for each row execute function public.sync_subscription_to_tenant();

-- Note: CRIT-3 (private excel-files bucket) is handled in migration 0018,
-- alongside the storage.buckets update applied to the cloud project.
