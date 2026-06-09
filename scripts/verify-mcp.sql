-- ============================================================================
-- Script de Verificación Post-Auditoría para MCP
-- Ejecutar este script para verificar que todas las mejoras están implementadas
-- ============================================================================

-- 1. Verificar que las migraciones se aplicaron correctamente
SELECT 'Migraciones aplicadas:' as check_type, count(*) as total_migrations
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('rate_limits', 'plan_features', 'customers_archive', 'appointments_archive');

-- 2. Verificar función has_active_subscription con validación de período
SELECT 'has_active_subscription check:' as check_type, 
       proname, 
       prosrc LIKE '%current_period_end%' as has_period_check
FROM pg_proc 
WHERE proname = 'has_active_subscription';

-- 3. Verificar función get_user_session existe
SELECT 'get_user_session exists:' as check_type, 
       proname 
FROM pg_proc 
WHERE proname = 'get_user_session';

-- 4. Verificar funciones de paginación
SELECT 'Pagination functions:' as check_type, 
       proname 
FROM pg_proc 
WHERE proname IN ('get_customers_paginated', 'get_appointments_paginated');

-- 5. Verificar función tenant_has_feature
SELECT 'tenant_has_feature exists:' as check_type, 
       proname 
FROM pg_proc 
WHERE proname = 'tenant_has_feature';

-- 6. Verificar tabla plan_features con datos seed
SELECT 'Plan features seeded:' as check_type, 
       count(*) as total_features 
FROM plan_features;

-- 7. Verificar índices compuestos tenant-aware
SELECT 'Composite indexes:' as check_type, 
       indexname 
FROM pg_indexes 
WHERE tablename IN ('appointments', 'customers', 'inventory_movements')
  AND indexname LIKE '%tenant%';

-- 8. Verificar función batch rollup
SELECT 'Batch rollup function:' as check_type, 
       proname 
FROM pg_proc 
WHERE proname = 'refresh_customer_rollup_batch';

-- 9. Verificar funciones de control de trigger rollup
SELECT 'Rollup trigger controls:' as check_type, 
       proname 
FROM pg_proc 
WHERE proname IN ('disable_rollup_trigger', 'enable_rollup_trigger');

-- 10. Verificar función cleanup_tenant_data_on_downgrade
SELECT 'Downgrade cleanup function:' as check_type, 
       proname 
FROM pg_proc 
WHERE proname = 'cleanup_tenant_data_on_downgrade';

-- 11. Verificar tablas archive
SELECT 'Archive tables:' as check_type, 
       tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename LIKE '%_archive';

-- 12. Verificar RLS policies con feature gating
SELECT 'RLS policies with feature gating:' as check_type, 
       count(*) as policies_with_feature_check
FROM pg_policies 
WHERE schemaname = 'public'
  AND (policyname LIKE '%insert%' OR policyname LIKE '%update%' OR policyname LIKE '%delete%')
  AND tablename IN ('customers', 'appointments', 'services', 'inventory_products');

-- 13. Verificar unique index para idempotencia de webhooks
SELECT 'Webhook idempotency index:' as check_type, 
       indexname 
FROM pg_indexes 
WHERE tablename = 'billing_webhook_events' 
  AND indexname = 'idx_webhook_idempotency';

-- 14. Verificar trigger handle_new_auth_user actualizado
SELECT 'Auth trigger function:' as check_type, 
       proname,
       prosrc LIKE '%invited_by%' as handles_invitations
FROM pg_proc 
WHERE proname = 'handle_new_auth_user';

-- 15. Verificar trigger sync_subscription_to_tenant con cleanup
SELECT 'Subscription sync trigger:' as check_type, 
       proname,
       prosrc LIKE '%cleanup_tenant_data_on_downgrade%' as calls_cleanup
FROM pg_proc 
WHERE proname = 'sync_subscription_to_tenant';

-- 16. Resumen de verificación
SELECT 
  'VERIFICACIÓN COMPLETA' as status,
  (SELECT count(*) FROM pg_proc WHERE proname IN (
    'has_active_subscription', 'get_user_session', 'get_customers_paginated', 
    'get_appointments_paginated', 'tenant_has_feature', 'refresh_customer_rollup_batch',
    'disable_rollup_trigger', 'enable_rollup_trigger', 'cleanup_tenant_data_on_downgrade'
  )) as functions_verified,
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE '%_archive') as archive_tables,
  (SELECT count(*) FROM plan_features) as plan_features_configured,
  (SELECT count(*) FROM pg_indexes WHERE indexname = 'idx_webhook_idempotency') as idempotency_index;
