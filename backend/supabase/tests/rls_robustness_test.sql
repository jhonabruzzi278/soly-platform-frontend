-- ============================================================================
-- RLS Robustness Test Suite — Soly Platform
-- ============================================================================
-- Verifies multi-tenant isolation, role gating, feature gating, function
-- lockdown, and the CRIT-1 signup-trigger hardening — entirely in SQL, with no
-- external dependencies (no pgTAP required).
--
-- HOW TO RUN
--   psql "<DATABASE_URL>" -f backend/supabase/tests/rls_robustness_test.sql
--   -- or paste into the Supabase SQL Editor and run.
--
-- SEMANTICS
--   The script sets up two tenants (A and B) with owner/member/viewer users,
--   switches into each user's JWT context (SET LOCAL ROLE + request.jwt.claims),
--   runs 21 assertions, and ALWAYS ends with a RAISE that rolls back the whole
--   transaction — so it NEVER persists test data, even on success.
--
--     SUCCESS  -> message: "RLS_TESTS_RESULT >>> ALL 21 CHECKS PASSED ..."
--     FAILURE  -> message: "RLS_TESTS_RESULT >>> N PASSED, M FAILED: <list>"
--
--   The non-zero exit on success is expected (it is the self-cleaning rollback).
--
-- COVERAGE
--   T1-T7   cross-tenant SELECT isolation (customers, appointments, services,
--           memberships, tenants, subscriptions)
--   T8-T9   cross-tenant INSERT denied
--   T10-T14 role gating (member can add customers but not appointments; viewer
--           is read-only; non-owner/admin cannot delete)
--   T15     feature gating (a plan without the feature cannot write)
--   T16-T18 function/relation lockdown (anon RPC, admin RPC, rate_limits)
--   T19-T21 CRIT-1 signup trigger (slug collision and forged invites grant no
--           membership; a valid invitation token does)
-- ============================================================================

do $$
declare
  TA uuid := '11111111-1111-1111-1111-111111111111';
  TB uuid := '22222222-2222-2222-2222-222222222222';
  UAO uuid := 'a0000000-0000-0000-0000-000000000001';
  UAM uuid := 'a0000000-0000-0000-0000-000000000002';
  UAV uuid := 'a0000000-0000-0000-0000-000000000003';
  UBO uuid := 'b0000000-0000-0000-0000-000000000001';
  USX uuid := 'e0000000-0000-0000-0000-000000000001';
  USY uuid := 'e0000000-0000-0000-0000-000000000002';
  USI uuid := 'e0000000-0000-0000-0000-000000000003';
  CUSTA uuid := 'cccccccc-0000-0000-0000-0000000000aa';
  CUSTB uuid := 'cccccccc-0000-0000-0000-0000000000bb';
  pass int := 0; fail int := 0; fails text := '';
  c int; v_role text; ok boolean;
begin
  ---------------------------------------------------------------- SETUP
  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new) values
   (UAO,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ownera@test.local','x',now(),'{}','{"name":"ownerA"}',now(),now(),'','','',''),
   (UAM,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','membera@test.local','x',now(),'{}','{"name":"memberA"}',now(),now(),'','','',''),
   (UAV,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','viewera@test.local','x',now(),'{}','{"name":"viewerA"}',now(),now(),'','','',''),
   (UBO,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','ownerb@test.local','x',now(),'{}','{"name":"ownerB"}',now(),now(),'','','','');

  insert into public.tenants (id,slug,business_name,plan) values (TA,'testa','Tenant A','business'),(TB,'testb','Tenant B','business');
  insert into public.memberships (user_id,tenant_id,role) values (UAO,TA,'owner'),(UAM,TA,'member'),(UAV,TA,'viewer'),(UBO,TB,'owner');
  update public.profiles set tenant_id = TA where id in (UAO,UAM,UAV);
  update public.profiles set tenant_id = TB where id = UBO;
  insert into public.customers (id,name,tenant_id) values (CUSTA,'Cust A',TA),(CUSTB,'Cust B',TB);
  insert into public.appointments (customer_id,appointment_date,appointment_time,service_name,cost,status,tenant_id) values (CUSTA,current_date,'10:00','S',1000,'completed',TA);
  insert into public.services (name,price,tenant_id) values ('SvcA',1000,TA),('SvcB',1000,TB);
  insert into public.subscriptions (user_id,product,plan,status,provider,tenant_id) values (UAO,'soly','business','active','manual',TA),(UBO,'soly','business','active','manual',TB);
  insert into public.rate_limits (key,expires_at) values ('test:key',now()+interval '1 hour');
  insert into public.invitations (tenant_id,email,role,token) values (TA,'invited@test.local','member','tok_valid_123');

  ---------------------------------------------------------------- ISOLATION (SELECT)
  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into c from public.customers where id = CUSTB; reset role;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T1(ownerA saw B customer)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into c from public.customers; reset role;
  if c=1 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T2(ownerA customer count='||c||')'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UBO,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into c from public.appointments; reset role;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T3(ownerB saw A appts='||c||')'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into c from public.services where tenant_id = TB; reset role;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T4(ownerA saw B services)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into c from public.memberships where tenant_id = TB; reset role;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T5(ownerA saw B membership)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into c from public.tenants where id = TB; reset role;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T6(ownerA saw B tenant)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into c from public.subscriptions where user_id = UBO; reset role;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T7(ownerA saw B sub)'; end if;

  ---------------------------------------------------------------- INSERT cross-tenant denied
  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.customers (name,tenant_id) values ('hack',TB); ok:=true; exception when others then ok:=false; end; reset role;
  if not ok then pass:=pass+1; else fail:=fail+1; fails:=fails||' T8(ownerA inserted into B)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.appointments (customer_id,appointment_date,appointment_time,service_name,cost,status,tenant_id) values (CUSTA,current_date,'10:00','S',1,'completed',TB); ok:=true; exception when others then ok:=false; end; reset role;
  if not ok then pass:=pass+1; else fail:=fail+1; fails:=fails||' T9(ownerA appt into B)'; end if;

  ---------------------------------------------------------------- ROLE gating
  perform set_config('request.jwt.claims', json_build_object('sub',UAM,'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.customers (name,tenant_id) values ('byMember',TA); ok:=true; exception when others then ok:=false; end; reset role;
  if ok then pass:=pass+1; else fail:=fail+1; fails:=fails||' T10(member could not insert customer)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAM,'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.appointments (customer_id,appointment_date,appointment_time,service_name,cost,status,tenant_id) values (CUSTA,current_date,'11:00','S',1,'pending',TA); ok:=true; exception when others then ok:=false; end; reset role;
  if not ok then pass:=pass+1; else fail:=fail+1; fails:=fails||' T11(member inserted appointment)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAV,'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.customers (name,tenant_id) values ('byViewer',TA); ok:=true; exception when others then ok:=false; end; reset role;
  if not ok then pass:=pass+1; else fail:=fail+1; fails:=fails||' T12(viewer inserted customer)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAV,'role','authenticated')::text, true); set local role authenticated;
  select count(*) into c from public.customers where tenant_id = TA; reset role;
  if c>=1 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T13(viewer cannot read)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAM,'role','authenticated')::text, true); set local role authenticated;
  begin delete from public.customers where id = CUSTA; exception when others then null; end; reset role;
  perform 1 from public.customers where id = CUSTA;
  if found then pass:=pass+1; else fail:=fail+1; fails:=fails||' T14(member deleted customer)'; end if;

  ---------------------------------------------------------------- FEATURE gating
  update public.tenants set plan='starter' where id = TA;
  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  begin insert into public.customers (name,tenant_id) values ('noFeature',TA); ok:=true; exception when others then ok:=false; end; reset role;
  update public.tenants set plan='business' where id = TA;
  if not ok then pass:=pass+1; else fail:=fail+1; fails:=fails||' T15(insert allowed without feature)'; end if;

  ---------------------------------------------------------------- FUNCTION / RELATION lockdown
  perform set_config('request.jwt.claims', '{"role":"anon"}', true); set local role anon;
  begin perform public.get_my_tenant_ids(); ok:=true; exception when others then ok:=false; end; reset role;
  if not ok then pass:=pass+1; else fail:=fail+1; fails:=fails||' T16(anon ran get_my_tenant_ids)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  begin perform public.expire_overdue_subscriptions(); ok:=true; exception when others then ok:=false; end; reset role;
  if not ok then pass:=pass+1; else fail:=fail+1; fails:=fails||' T17(authed ran expire_overdue)'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub',UAO,'role','authenticated')::text, true); set local role authenticated;
  begin select count(*) into c from public.rate_limits; exception when others then c:=0; end; reset role;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T18(authed read rate_limits='||c||')'; end if;

  ---------------------------------------------------------------- CRIT-1 signup trigger
  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
  values (USX,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','attacker@test.local','x','{}','{"name":"atk","tenant_id":"testa"}',now(),now(),'','','','');
  select count(*) into c from public.memberships where user_id = USX and tenant_id = TA;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T19(slug collision granted membership!)'; end if;

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
  values (USY,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','forge@test.local','x','{}','{"tenant_id":"testa","invited_by":"a0000000-0000-0000-0000-000000000001","role":"admin","invite_token":"bogus"}',now(),now(),'','','','');
  select count(*) into c from public.memberships where user_id = USY and tenant_id = TA;
  if c=0 then pass:=pass+1; else fail:=fail+1; fails:=fails||' T20(forged invite granted membership!)'; end if;

  insert into auth.users (id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change,email_change_token_new)
  values (USI,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','invited@test.local','x','{}','{"invite_token":"tok_valid_123"}',now(),now(),'','','','');
  select role::text into v_role from public.memberships where user_id = USI and tenant_id = TA;
  if v_role = 'member' then pass:=pass+1; else fail:=fail+1; fails:=fails||' T21(valid invite role='||coalesce(v_role,'NULL')||')'; end if;

  ---------------------------------------------------------------- RESULT (RAISE forces rollback; no data persists)
  if fail = 0 then
    raise exception 'RLS_TESTS_RESULT >>> ALL % CHECKS PASSED (transaction rolled back, no data persisted)', pass;
  else
    raise exception 'RLS_TESTS_RESULT >>> % PASSED, % FAILED:%', pass, fail, fails;
  end if;
end $$;
