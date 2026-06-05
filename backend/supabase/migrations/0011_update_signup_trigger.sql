-- Update handle_new_auth_user: auto-create tenant + membership on signup
-- When user_metadata has tenant_id and tenant_name, create the full organization tree

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
begin
  -- Check email whitelist
  select exists(select 1 from public.allowed_emails ae where ae.email = new.email and ae.is_active = true) into v_allowed;

  -- Create or update profile
  insert into public.profiles (id, email, full_name, role, is_active)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email), 'member', v_allowed)
  on conflict (id) do update
    set email = excluded.email, is_active = excluded.is_active, updated_at = now();

  -- Auto-create tenant if metadata has tenant_id
  v_slug := new.raw_user_meta_data ->> 'tenant_id';
  if v_slug is not null and v_slug != '' then
    v_tenant_id := gen_random_uuid();

    insert into public.tenants (id, slug, business_name, plan)
    values (v_tenant_id, v_slug, coalesce(new.raw_user_meta_data ->> 'tenant_name', v_slug), coalesce(new.raw_user_meta_data ->> 'plan', 'starter'))
    on conflict (slug) do update set updated_at = now();

    select id into v_tenant_id from public.tenants where slug = v_slug;

    -- Link user to tenant as owner
    insert into public.memberships (user_id, tenant_id, role)
    values (new.id, v_tenant_id, 'owner')
    on conflict (user_id, tenant_id) do nothing;

    -- Add seat
    insert into public.tenant_seats (user_id, tenant_id, is_active)
    values (new.id, v_tenant_id, true)
    on conflict (user_id, tenant_id) do nothing;

    -- Link profile to tenant
    update public.profiles set tenant_id = v_tenant_id where id = new.id;
  end if;

  return new;
end;
$$;

-- Recreate the auth trigger
drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
