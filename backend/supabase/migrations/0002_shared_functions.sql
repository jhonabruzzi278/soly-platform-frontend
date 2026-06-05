-- ============================================================================
-- Soly CRM - Shared Functions & Auth Trigger
-- ============================================================================

-- updated_at trigger helper
create or replace function public.set_updated_at()
returns trigger as $$
begin
  NEW.updated_at = now();
  return NEW;
end;
$$ language plpgsql;

-- Role checks
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and lower(p.role::text) = 'admin'
      and coalesce(p.is_active, true) = true
  );
$$;

create or replace function public.is_operator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role = 'operator'
      and p.is_active = true
  );
$$;

create or replace function public.is_admin_or_operator(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = uid
      and p.role in ('admin', 'operator')
      and p.is_active = true
  );
$$;

-- Tenant helpers
create or replace function public.get_current_tenant()
returns uuid as $$
  select tenant_id
  from public.memberships
  where user_id = auth.uid()
  limit 1;
$$ language sql stable security definer;

create or replace function public.get_user_tenant_role(org_id uuid)
returns text as $$
  select role::text
  from public.memberships
  where tenant_id = org_id and user_id = auth.uid();
$$ language sql stable security definer;

create or replace function public.is_tenant_admin(org_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.memberships
    where tenant_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$ language sql stable security definer;

create or replace function public.get_tenant_seats_count(org_id uuid)
returns bigint as $$
  select count(*)
  from public.tenant_seats
  where tenant_id = org_id and is_active = true;
$$ language sql stable;

-- Handle new auth user: auto-create profile row
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
  existing_profile_id uuid;
  existing_profile_has_auth boolean;
begin
  select exists(
    select 1
    from public.allowed_emails ae
    where ae.email = new.email
      and ae.is_active = true
  )
  into allowed;

  select p.id
  into existing_profile_id
  from public.profiles p
  where p.email = new.email
    and p.id <> new.id
  limit 1;

  if existing_profile_id is not null then
    select exists(
      select 1
      from auth.users u
      where u.id = existing_profile_id
    )
    into existing_profile_has_auth;

    if existing_profile_has_auth then
      raise exception 'profiles.email already linked to another auth user: %', new.email
        using errcode = '23505';
    else
      delete from public.profiles
      where id = existing_profile_id;
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'member',
    allowed
  )
  on conflict (id) do update
    set email = excluded.email,
        is_active = excluded.is_active,
        updated_at = now();

  return new;
end;
$$;

-- Auth user auto-profile trigger
drop trigger if exists trg_auth_user_created on auth.users;
create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
