-- ============================================================================
-- Soly Platform — Integration Test Suite
-- Run in Supabase SQL Editor to validate schema, RLS, RPCs, triggers, constraints
-- ============================================================================

begin;
  raise notice '══════════════════════════════════';
  raise notice 'SOLY INTEGRATION TEST SUITE';
  raise notice '══════════════════════════════════';
rollback;

-- ============================================================================
-- 1. SCHEMA VALIDATION
-- ============================================================================
do $$
declare
  v_count integer;
  tables text[] := array[
    'tenants','profiles','memberships','tenant_seats','tenant_products',
    'allowed_emails','customers','appointments','services',
    'inventory_products','inventory_movements'
  ];
  t text;
begin
  raise notice '--- 1. SCHEMA VALIDATION ---';
  foreach t in array tables loop
    select count(*) into v_count from information_schema.tables
    where table_schema = 'public' and table_name = t;
    if v_count = 1 then
      raise notice '  ✓ Table % exists', t;
    else
      raise warning '  ✗ Table % MISSING', t;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 2. ENUM VALIDATION
-- ============================================================================
do $$
declare
  enums text[] := array['user_role','org_role','plan_name','inventory_movement_type'];
  e text;
  v_count integer;
begin
  raise notice '--- 2. ENUM VALIDATION ---';
  foreach e in array enums loop
    select count(*) into v_count from pg_type where typname = e;
    if v_count = 1 then
      raise notice '  ✓ Enum % exists', e;
    else
      raise warning '  ✗ Enum % MISSING', e;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 3. RLS ENABLED ON ALL TABLES
-- ============================================================================
do $$
declare
  r record;
  v_count integer;
begin
  raise notice '--- 3. RLS VALIDATION ---';
  for r in select tablename from pg_tables where schemaname = 'public'
  loop
    select count(*) into v_count from pg_tables
    where schemaname = 'public' and tablename = r.tablename and rowsecurity = true;
    if v_count = 1 then
      raise notice '  ✓ RLS enabled on %', r.tablename;
    else
      raise warning '  ✗ RLS NOT enabled on %', r.tablename;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 4. FOREIGN KEY CONSTRAINTS
-- ============================================================================
do $$
declare
  r record;
  v_count integer;
begin
  raise notice '--- 4. FOREIGN KEY VALIDATION ---';
  for r in
    select tc.table_name, kcu.column_name, ccu.table_name as foreign_table
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
  loop
    raise notice '  ✓ FK: %.% → %.%', r.table_name, r.column_name, r.foreign_table, r.column_name;
  end loop;
end $$;

-- ============================================================================
-- 5. VIEWS EXIST AND ARE QUERYABLE
-- ============================================================================
do $$
declare
  views text[] := array['vw_appointments_enriched','vw_revenue_by_barber','vw_revenue_by_service','vw_appointments_per_day'];
  v text;
begin
  raise notice '--- 5. VIEWS VALIDATION ---';
  foreach v in array views loop
    begin
      execute format('select count(*) from public.%I limit 0', v);
      raise notice '  ✓ View % is queryable', v;
    exception when others then
      raise warning '  ✗ View % FAILED: %', v, sqlerrm;
    end;
  end loop;
end $$;

-- ============================================================================
-- 6. RPC FUNCTIONS EXIST
-- ============================================================================
do $$
declare
  procs text[] := array[
    'get_dashboard_kpis','get_current_tenant','get_user_tenant_role',
    'is_tenant_admin','get_tenant_seats_count','handle_flow_webhook',
    'cancel_flow_subscription','refresh_customer_rollup','is_admin','set_updated_at'
  ];
  p text;
  v_count integer;
begin
  raise notice '--- 6. RPC VALIDATION ---';
  foreach p in array procs loop
    select count(*) into v_count from pg_proc where proname = p;
    if v_count > 0 then
      raise notice '  ✓ RPC %() exists', p;
    else
      raise warning '  ✗ RPC %() MISSING', p;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 7. TRIGGERS EXIST
-- ============================================================================
do $$
declare
  triggers text[] := array[
    'trg_appointments_rollup','trg_inventory_movement_apply',
    'trg_tenants_updated_at','trg_customers_updated_at',
    'trg_appointments_updated_at','trg_services_updated_at',
    'trg_inventory_products_updated_at','trg_auth_user_created'
  ];
  t text;
  v_count integer;
begin
  raise notice '--- 7. TRIGGERS VALIDATION ---';
  foreach t in array triggers loop
    select count(*) into v_count from pg_trigger where tgname = t;
    if v_count > 0 then
      raise notice '  ✓ Trigger % exists', t;
    else
      raise warning '  ✗ Trigger % MISSING', t;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 8. INDEXES ON CRITICAL COLUMNS
-- ============================================================================
do $$
declare
  expected text[][] := array[
    array['customers','name'], array['customers','email'],
    array['appointments','customer_id'], array['appointments','barber_id'],
    array['appointments','appointment_date'], array['appointments','status'],
    array['inventory_movements','product_id']
  ];
  idx text[];
  v_count integer;
begin
  raise notice '--- 8. INDEX VALIDATION ---';
  foreach idx slice 1 in array expected loop
    select count(*) into v_count from pg_indexes
    where schemaname = 'public' and tablename = idx[1] and indexdef ilike ('%' || idx[2] || '%');
    if v_count > 0 then
      raise notice '  ✓ Index on %.% exists', idx[1], idx[2];
    else
      raise warning '  ✗ Index on %.% MISSING', idx[1], idx[2];
    end if;
  end loop;
end $$;

-- ============================================================================
-- 9. NOT NULL CONSTRAINTS
-- ============================================================================
do $$
declare
  r record;
begin
  raise notice '--- 9. NOT NULL CONSTRAINTS ---';
  for r in
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and is_nullable = 'NO'
      and column_name in ('name','email','slug','business_name','appointment_date','appointment_time','service_name','customer_id','user_id','tenant_id','type','quantity')
    order by table_name, column_name
  loop
    raise notice '  ✓ NOT NULL: %.%', r.table_name, r.column_name;
  end loop;
end $$;

-- ============================================================================
-- 10. UNIQUE CONSTRAINTS
-- ============================================================================
do $$
declare
  r record;
begin
  raise notice '--- 10. UNIQUE CONSTRAINTS ---';
  for r in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
    where tc.constraint_type = 'UNIQUE' and tc.table_schema = 'public'
  loop
    raise notice '  ✓ UNIQUE: %.%', r.table_name, r.column_name;
  end loop;
end $$;

-- ============================================================================
-- 11. TIMESTAMP COLUMNS (AUDIT TRAIL)
-- ============================================================================
do $$
declare
  audit_tables text[] := array['tenants','customers','appointments','services','inventory_products'];
  t text;
  v_count integer;
begin
  raise notice '--- 11. AUDIT COLUMNS ---';
  foreach t in array audit_tables loop
    select count(*) into v_count from information_schema.columns
    where table_schema = 'public' and table_name = t and column_name = 'created_at';
    if v_count = 1 then
      raise notice '  ✓ %.created_at exists', t;
    else
      raise warning '  ✗ %.created_at MISSING', t;
    end if;
    select count(*) into v_count from information_schema.columns
    where table_schema = 'public' and table_name = t and column_name = 'updated_at';
    if v_count = 1 then
      raise notice '  ✓ %.updated_at exists', t;
    else
      raise warning '  ✗ %.updated_at MISSING', t;
    end if;
  end loop;
end $$;

-- ============================================================================
-- 12. FUNCTIONAL TEST: TRIGGERS
-- ============================================================================

-- We need a test tenant and test data
-- This creates test data, validates trigger behavior, then rolls back
do $$
declare
  v_tenant_id uuid;
  v_product_id uuid;
  v_customer_id uuid;
  v_appointment_id uuid;
  v_old_stock integer;
  v_new_stock integer;
  v_total_appts integer;
begin
  raise notice '--- 12. FUNCTIONAL TESTS ---';

  -- Create test tenant
  insert into tenants (slug, business_name, plan, product)
  values ('test-' || gen_random_uuid()::text, 'Test Co', 'business', 'soly')
  returning id into v_tenant_id;

  raise notice '  Created test tenant: %', v_tenant_id;

  -- Test inventory trigger (movement → stock update)
  insert into inventory_products (name, cost, sale_price, stock, min_stock, tenant_id)
  values ('Test Product', 100, 200, 50, 10, v_tenant_id)
  returning id into v_product_id;

  select stock into v_old_stock from inventory_products where id = v_product_id;
  raise notice '  Initial stock: %', v_old_stock;
  assert v_old_stock = 50, 'Initial stock should be 50';

  -- Insert "in" movement → stock +5
  insert into inventory_movements (product_id, type, quantity, tenant_id)
  values (v_product_id, 'in', 5, v_tenant_id);

  select stock into v_new_stock from inventory_products where id = v_product_id;
  raise notice '  Stock after +5 in: %', v_new_stock;
  assert v_new_stock = 55, format('Stock should be 55, got %s', v_new_stock);

  -- Insert "out" movement → stock -3
  insert into inventory_movements (product_id, type, quantity, tenant_id)
  values (v_product_id, 'out', 3, v_tenant_id);

  select stock into v_new_stock from inventory_products where id = v_product_id;
  raise notice '  Stock after -3 out: %', v_new_stock;
  assert v_new_stock = 52, format('Stock should be 52, got %s', v_new_stock);

  -- Test customer rollup trigger
  insert into customers (name, email, tenant_id)
  values ('Test Customer', 'test@test.com', v_tenant_id)
  returning id into v_customer_id;

  select total_appointments into v_total_appts from customers where id = v_customer_id;
  assert v_total_appts = 0, 'New customer should have 0 appointments';

  -- Insert appointment → should trigger rollup
  insert into appointments (customer_id, appointment_date, appointment_time, service_name, cost, status, tenant_id)
  values (v_customer_id, current_date, '10:00', 'Haircut', 100, 'completed', v_tenant_id);

  select total_appointments into v_total_appts from customers where id = v_customer_id;
  raise notice '  Customer appointments after insert: %', v_total_appts;
  assert v_total_appts = 1, format('Customer should have 1 appointment, got %s', v_total_appts);

  select total_spent into v_new_stock from customers where id = v_customer_id;
  raise notice '  Customer total spent: %', v_new_stock;
  assert v_new_stock = 100, format('Total spent should be 100, got %s', v_new_stock);

  -- Cleanup test data
  delete from inventory_movements where tenant_id = v_tenant_id;
  delete from appointments where tenant_id = v_tenant_id;
  delete from customers where tenant_id = v_tenant_id;
  delete from inventory_products where tenant_id = v_tenant_id;
  delete from tenants where id = v_tenant_id;

  raise notice '  ✓ All functional tests PASSED';
end $$;

-- ============================================================================
-- 13. CONSTRAINT TEST: duplicate slug
-- ============================================================================
do $$
declare
  v_tenant_id uuid;
begin
  raise notice '--- 13. CONSTRAINT TESTS ---';

  insert into tenants (slug, business_name, plan) values ('dupe-test', 'Dupe A', 'starter');
  begin
    insert into tenants (slug, business_name, plan) values ('dupe-test', 'Dupe B', 'starter');
    raise warning '  ✗ Duplicate slug should have been rejected!';
  exception when unique_violation then
    raise notice '  ✓ Duplicate slug correctly rejected';
  end;

  delete from tenants where slug = 'dupe-test';
end $$;

-- ============================================================================
-- 14. CONSTRAINT TEST: FK cascade
-- ============================================================================
do $$
declare
  v_tenant_id uuid;
  v_product_id uuid;
  v_count integer;
begin
  raise notice '--- 14. CASCADE TESTS ---';

  insert into tenants (slug, business_name) values ('cascade-test', 'Cascade Co')
  returning id into v_tenant_id;

  insert into inventory_products (name, cost, sale_price, stock, min_stock, tenant_id)
  values ('Cascade Product', 10, 20, 5, 1, v_tenant_id)
  returning id into v_product_id;

  insert into inventory_movements (product_id, type, quantity, tenant_id)
  values (v_product_id, 'in', 10, v_tenant_id);

  select count(*) into v_count from inventory_movements where product_id = v_product_id;
  raise notice '  Movements before cascade: %', v_count;
  assert v_count > 0;

  -- Delete product → movements should cascade
  delete from inventory_products where id = v_product_id;

  select count(*) into v_count from inventory_movements where product_id = v_product_id;
  raise notice '  Movements after cascade: %', v_count;
  assert v_count = 0, format('Movements should be 0 after cascade, got %s', v_count);

  delete from tenants where id = v_tenant_id;
  raise notice '  ✓ Cascade tests PASSED';
end $$;

-- ============================================================================
-- 15. RPC FUNCTION: get_dashboard_kpis
-- ============================================================================
do $$
declare
  v_result record;
begin
  raise notice '--- 15. RPC OUTPUT TESTS ---';

  begin
    for v_result in select * from get_dashboard_kpis(gen_random_uuid(), 'admin') loop
      raise notice '  appointments_today: %', v_result.appointments_today;
      raise notice '  appointments_week: %', v_result.appointments_week;
      raise notice '  appointments_month: %', v_result.appointments_month;
      raise notice '  revenue_month: %', v_result.revenue_month;
      raise notice '  avg_ticket: %', v_result.avg_ticket;
      raise notice '  occupancy: %', v_result.occupancy;
      raise notice '  new_customers: %', v_result.new_customers;
      raise notice '  recurring_customers: %', v_result.recurring_customers;
    end loop;
    raise notice '  ✓ get_dashboard_kpis() returns expected columns';
  exception when others then
    raise warning '  ✗ get_dashboard_kpis() FAILED: %', sqlerrm;
  end;
end $$;

-- ============================================================================
-- 16. VIEW: vw_appointments_enriched
-- ============================================================================
do $$
declare
  v_count integer;
begin
  raise notice '--- 16. VIEW OUTPUT TESTS ---';
  select count(*) into v_count from vw_appointments_enriched limit 0;
  raise notice '  ✓ vw_appointments_enriched is queryable (row count ignored)';
  select count(*) into v_count from vw_revenue_by_barber limit 0;
  raise notice '  ✓ vw_revenue_by_barber is queryable';
  select count(*) into v_count from vw_revenue_by_service limit 0;
  raise notice '  ✓ vw_revenue_by_service is queryable';
  select count(*) into v_count from vw_appointments_per_day limit 0;
  raise notice '  ✓ vw_appointments_per_day is queryable';
end $$;

-- ============================================================================
-- 17. CHECK CONSTRAINT: inventory_movements type
-- ============================================================================
do $$
begin
  raise notice '--- 17. CHECK CONSTRAINT TESTS ---';
  begin
    -- This should fail because 'invalid_type' is not a valid enum value
    perform 'invalid_type'::inventory_movement_type;
    raise warning '  ✗ Invalid enum type should have been rejected';
  exception when invalid_text_representation then
    raise notice '  ✓ Invalid enum type correctly rejected';
  end;
end $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================
do $$
begin
  raise notice '';
  raise notice '══════════════════════════════════';
  raise notice 'TEST SUITE COMPLETE';
  raise notice 'Check warnings above for failures.';
  raise notice 'No warnings = all tests passed.';
  raise notice '══════════════════════════════════';
end $$;
