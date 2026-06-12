-- ============================================================================
-- Module 21: Single-plan ("Soly Business") model consistency
-- Context: 0014 reduced plan_features to the 'business' plan only, but tenants
-- were still born on 'starter' (which now has zero features) -> every new tenant
-- was unusable. This aligns the model: every tenant is 'business'; access is
-- gated solely by an active subscription (RequireAuth -> /billing), not by plan.
-- Cancellation/expiry no longer downgrades the plan (which stripped features and
-- blocked data access); tenant data and features are preserved.
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
  select exists(
    select 1 from public.allowed_emails ae
    where ae.email = new.email and ae.is_active = true
  ) into v_allowed;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id, new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'member'::org_role, v_allowed
  )
  on conflict (id) do update
    set email = excluded.email, is_active = excluded.is_active, updated_at = now();

  v_token := new.raw_user_meta_data ->> 'invite_token';
  v_slug  := new.raw_user_meta_data ->> 'tenant_id';

  if v_token is not null and v_token <> '' then
    select i.* into v_invite
    from public.invitations i
    where i.token = v_token
      and i.consumed_at is null
      and i.expires_at > now()
    limit 1;

    if v_invite.id is not null and lower(v_invite.email::text) = lower(new.email::text) then
      if not exists (
        select 1 from public.memberships
        where user_id = new.id and tenant_id = v_invite.tenant_id
      ) then
        insert into public.memberships (user_id, tenant_id, role)
        values (new.id, v_invite.tenant_id, v_invite.role);
        insert into public.tenant_seats (user_id, tenant_id, is_active)
        values (new.id, v_invite.tenant_id, true)
        on conflict (user_id, tenant_id) do nothing;
        update public.profiles set tenant_id = v_invite.tenant_id where id = new.id;
      end if;
      update public.invitations set consumed_at = now() where id = v_invite.id;
    end if;

  elsif v_slug is not null and v_slug <> '' then
    perform pg_advisory_xact_lock(hashtext(v_slug));

    -- Single-plan product: new orgs are created on 'business'.
    insert into public.tenants (id, slug, business_name, plan)
    values (
      gen_random_uuid(), v_slug,
      coalesce(new.raw_user_meta_data ->> 'tenant_name', v_slug),
      'business'::plan_name
    )
    on conflict (slug) do nothing;

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
  end if;

  return new;
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
    where m.user_id = NEW.user_id and m.role = 'owner'
    limit 1;

    -- Single-plan: keep tenant on 'business' whenever there is a subscription
    -- signal. Cancellation/expiry does NOT downgrade the plan; access is cut by
    -- has_active_subscription (RequireAuth), and tenant data is preserved.
    if v_tenant_id is not null and NEW.status in ('active', 'trialing') then
      update public.tenants set plan = NEW.plan, updated_at = now() where id = v_tenant_id;
    end if;
  end if;

  return NEW;
end;
$$;

-- CREATE OR REPLACE re-adds Supabase default EXECUTE grants; re-lock both.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.sync_subscription_to_tenant() from public, anon, authenticated;

-- NOTE (one-time data fix, applied directly to the cloud project, not part of
-- this repeatable migration because it targets existing test data):
--   update public.tenants set plan = 'business' where slug = 'aa';
--   + a 'trialing' (provider 'manual') subscription was created for the owner(s)
--     of tenant 'aa' so the app is immediately usable for testing.
