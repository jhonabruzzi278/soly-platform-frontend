-- ============================================================================
-- Module 23: Make signup always succeed (without reintroducing CRIT-1)
--
-- Problem found in production: a user who deleted their account and signed up
-- again with the same business name ended up tenant-less, because:
--   * deleting the auth user does NOT delete their tenant (orphaned tenant), and
--   * the CRIT-1 hardening (0021) correctly refuses to join an existing tenant
--     on a slug collision -> the re-signup created no membership.
-- Additionally, every new tenant was created without a subscription, so the
-- owner was immediately bounced to /billing and could not use the app.
--
-- Fix:
--   * On slug collision, create a NEW tenant with a short random suffix
--     ("vinstudio-a1b2c3"). The user always gets their OWN workspace and can
--     never join or take over someone else's tenant -> CRIT-1 stays closed.
--   * Grant a 14-day trial subscription to the new owner so the app is usable
--     immediately (access remains gated by has_active_subscription).
--   * Invitation acceptance (token-validated) is unchanged.
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
  v_final_slug text;
  v_allowed boolean;
  v_token text;
  v_invite record;
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
    -- Invitation acceptance: validate the token server-side.
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

    -- Always create a NEW tenant for this owner. If the desired slug is taken,
    -- append a short random suffix so the user gets their own workspace and can
    -- never join (or take over) someone else's tenant.
    v_final_slug := v_slug;
    if exists (select 1 from public.tenants where slug = v_final_slug) then
      v_final_slug := left(v_slug, 24) || '-' || substr(md5(random()::text || new.id::text), 1, 6);
    end if;

    v_tenant_id := gen_random_uuid();
    insert into public.tenants (id, slug, business_name, plan)
    values (
      v_tenant_id, v_final_slug,
      coalesce(new.raw_user_meta_data ->> 'tenant_name', v_slug),
      'business'::plan_name
    );

    insert into public.memberships (user_id, tenant_id, role)
    values (new.id, v_tenant_id, 'owner');
    insert into public.tenant_seats (user_id, tenant_id, is_active)
    values (new.id, v_tenant_id, true);
    update public.profiles set tenant_id = v_tenant_id where id = new.id;

    -- Grant a 14-day trial so the new org can use the app immediately.
    insert into public.subscriptions
      (user_id, product, plan, status, provider, tenant_id,
       current_period_start, current_period_end, trial_ends_at)
    values
      (new.id, 'soly', 'business', 'trialing', 'manual', v_tenant_id,
       now(), now() + interval '14 days', now() + interval '14 days')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
