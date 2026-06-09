-- ============================================================================
-- Module 9: Invite Flow Hardening
-- Fixes: invite-member no longer paginates all users.
--        Instead, always invite by email. When user accepts and signs up,
--        this trigger auto-creates membership from invitation metadata.
-- ============================================================================

-- ============================================================================
-- 1. Enhanced auth trigger — detect invitation metadata and create membership
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_slug text;
  v_allowed boolean;
  v_invited_by uuid;
  v_invite_role text;
BEGIN
  -- Check email whitelist
  SELECT EXISTS(
    SELECT 1 FROM public.allowed_emails ae
    WHERE ae.email = new.email AND ae.is_active = true
  ) INTO v_allowed;

  -- Create or update profile
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'member'::org_role,
    v_allowed
  )
  ON CONFLICT (id) DO UPDATE
    SET email = excluded.email, is_active = excluded.is_active, updated_at = now();

  -- Check if this is an invitation acceptance (has invited_by in metadata)
  v_invited_by := (new.raw_user_meta_data ->> 'invited_by')::uuid;
  v_invite_role := new.raw_user_meta_data ->> 'role';
  v_slug := new.raw_user_meta_data ->> 'tenant_id';

  IF v_invited_by IS NOT NULL AND v_slug IS NOT NULL AND v_slug != '' THEN
    -- This is an invited user joining an existing tenant
    SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_slug;

    IF v_tenant_id IS NOT NULL THEN
      -- Check not already a member
      IF NOT EXISTS (
        SELECT 1 FROM public.memberships
        WHERE user_id = new.id AND tenant_id = v_tenant_id
      ) THEN
        -- Create membership with invited role (default to 'member')
        INSERT INTO public.memberships (user_id, tenant_id, role)
        VALUES (
          new.id,
          v_tenant_id,
          CASE
            WHEN v_invite_role IN ('admin', 'member', 'viewer') THEN v_invite_role::org_role
            ELSE 'member'::org_role
          END
        );

        -- Add seat
        INSERT INTO public.tenant_seats (user_id, tenant_id, is_active)
        VALUES (new.id, v_tenant_id, true);

        -- Link profile to tenant
        UPDATE public.profiles SET tenant_id = v_tenant_id WHERE id = new.id;
      END IF;
    END IF;

  ELSIF v_slug IS NOT NULL AND v_slug != '' THEN
    -- This is a new organization creation (not an invitation)
    -- Advisory lock on slug hash to prevent race conditions
    PERFORM pg_advisory_xact_lock(hashtext(v_slug));

    v_tenant_id := gen_random_uuid();

    -- ALWAYS use 'starter' plan regardless of metadata (prevents plan escalation)
    INSERT INTO public.tenants (id, slug, business_name, plan)
    VALUES (
      v_tenant_id,
      v_slug,
      coalesce(new.raw_user_meta_data ->> 'tenant_name', v_slug),
      'starter'::plan_name
    )
    ON CONFLICT (slug) DO UPDATE SET updated_at = now();

    SELECT id INTO v_tenant_id FROM public.tenants WHERE slug = v_slug;

    INSERT INTO public.memberships (user_id, tenant_id, role)
    VALUES (new.id, v_tenant_id, 'owner')
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    INSERT INTO public.tenant_seats (user_id, tenant_id, is_active)
    VALUES (new.id, v_tenant_id, true)
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    UPDATE public.profiles SET tenant_id = v_tenant_id WHERE id = new.id;
  END IF;

  RETURN new;
END;
$$;

-- Recreate trigger with updated function
DROP TRIGGER IF EXISTS trg_auth_user_created ON auth.users;
CREATE TRIGGER trg_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
