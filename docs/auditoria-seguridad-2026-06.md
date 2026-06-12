# Auditoría de Seguridad y Correcciones — Soly Platform

**Fecha:** 2026-06-12
**Proyecto Supabase (producción):** `soly` (`mkoqatywbfxtcwyttkjm`, región us-west-2, Postgres 17)
**Alcance:** auditoría técnica completa + corrección de hallazgos críticos en backend
(SQL/RLS/Edge Functions) y frontend, aplicada y verificada en vivo contra la base de
datos de producción mediante los *advisors* de Supabase.

---

## 1. Resumen ejecutivo

Se detectaron y corrigieron **5 problemas críticos** (2 de ellos solo visibles
inspeccionando la base de datos en vivo) y un conjunto de hardening de seguridad y
performance. Tras las correcciones, los *advisors* de Supabase reportan **0 errores**
de seguridad y **0 advertencias de exposición a `anon`**.

| Severidad | Estado |
|-----------|--------|
| 🔴 Crítico (5) | ✅ Corregidos |
| 🟠 Hardening seguridad (search_path, RPC lockdown) | ✅ Aplicado |
| 🟡 Performance (RLS initplan, índices FK) | ✅ Aplicado |
| ⚪ Pendientes (requieren dashboard / deploy) | Ver §5 |

---

## 2. Hallazgos críticos corregidos

### CRIT-1 — Takeover de tenant vía metadata de signup forjada
**Categoría:** Seguridad / Multi-Tenant
**Antes:** el trigger `handle_new_auth_user` leía `tenant_id` (slug), `invited_by` y
`role` directamente desde `raw_user_meta_data` (100 % controlado por el cliente vía
`supabase.auth.signUp`). Un atacante podía:
1. Registrarse con `tenant_id = "<slug-de-la-víctima>"` y volverse **`owner`** del
   tenant ajeno (el `ON CONFLICT (slug) DO UPDATE` recuperaba el tenant existente).
2. Registrarse con `invited_by` + `role: admin` forjados y unirse como **admin**.

**Después:**
- Nueva tabla `public.invitations` con **token de un solo uso** server-side
  (`expires_at` 7 días, constraint `role <> 'owner'`).
- El trigger valida invitaciones **por token + email coincidente**; el rol proviene
  de la fila de DB, nunca de la metadata.
- La rama de "nueva organización" usa `ON CONFLICT (slug) DO NOTHING` y solo concede
  `owner` **si el slug estaba libre** (`v_inserted := found`). Una colisión de slug ya
  no puede otorgar membresía/propiedad de un tenant ajeno.

**Archivos:** `migrations/0015_security_critical_fixes.sql`,
`functions/invite-member/index.ts` (genera el token e inserta la invitación).

### CRIT-2 — Expiración/cancelación de suscripción borraba todos los datos del CRM
**Categoría:** Billing / Integridad de datos
**Antes:** `sync_subscription_to_tenant` → `cleanup_tenant_data_on_downgrade`
ejecutaba `DELETE FROM customers/appointments/inventory...` cuando una suscripción
pasaba a `cancelled`/`expired`. Con plan único `business`, **cualquier** pago fallido
o expiración borraba la base de datos del cliente.

**Después:** `cleanup_tenant_data_on_downgrade` es ahora un **no-op** y el downgrade
es un *soft feature-lock*: el plan baja a `starter` (lo que deshabilita escrituras vía
`plan_features` RLS) pero **los datos se conservan** y se reactivan al re-suscribir.

**Archivo:** `migrations/0015_security_critical_fixes.sql`.

### CRIT-3 — Bucket de Storage `excel-files` público (PII expuesta)
**Categoría:** Seguridad / Infraestructura
**Antes:** `storage.buckets.public = true`; el frontend usaba `getPublicUrl`, saltándose
la RLS de `storage.objects`. Los Excel con datos de clientes eran accesibles por URL.

**Después:** bucket marcado **privado** (`public = false`); el frontend usa
`createSignedUrl` / `createSignedUrls` con TTL de 10 minutos.

**Archivos:** `migrations/0018_rls_perf_fk_indexes_and_private_bucket.sql`,
`frontend/src/lib/api.ts`.

### CRIT-4 — `expire-subscriptions` ejecutable por cualquier usuario autenticado
**Categoría:** Seguridad / Billing
**Antes:** la condición `isInternalCall` era lógicamente imposible; el único filtro
real aceptaba cualquier JWT de usuario válido → cualquier cliente logueado podía
disparar la expiración global (y, con CRIT-2, borrados masivos).

**Después:** exige `CRON_SECRET` con **comparación timing-safe**; se eliminó el
passthrough de usuario.

**Archivo:** `functions/expire-subscriptions/index.ts`.

### CRIT-5 — `rate_limits` con RLS deshabilitado + RPC público de `SECURITY DEFINER`
**Categoría:** Seguridad (detectado en vivo por los advisors)
**Antes:**
- `public.rate_limits` tenía **RLS deshabilitado** → totalmente expuesta a `anon`
  (lectura/escritura con la anon key). Único **ERROR** del linter.
- ~30 funciones `SECURITY DEFINER` eran invocables por `anon` vía
  `/rest/v1/rpc/*` (incluidas `handle_new_auth_user`, `sync_subscription_to_tenant`,
  `expire_overdue_subscriptions`, `disable_rollup_trigger`, etc.).

**Después:**
- RLS activado en `rate_limits` (solo `service_role`, que la usan las Edge Functions,
  accede; bypassa RLS).
- `EXECUTE` revocado de `anon` en todas las funciones; de `authenticated` también en
  las de trigger/admin. Los helpers de RLS mantienen `authenticated` (necesario para
  evaluar las políticas; solo devuelven datos del propio usuario).

**Archivos:** `migrations/0016_lock_down_rls_and_function_execution.sql`,
`migrations/0019_revoke_function_execute_from_anon.sql`.
> Nota técnica: Supabase otorga `EXECUTE` directamente a `anon`/`authenticated` vía
> *default privileges*, por lo que `REVOKE ... FROM public` (migración 0016) no basta;
> la migración 0019 completa el lockdown revocando los grants directos de rol.

---

## 3. Hardening adicional de seguridad

- **`function_search_path_mutable` (7 funciones):** `search_path = public` fijado en
  `set_updated_at`, `get_tenant_seats_count`, `trg_refresh_customer_rollup`,
  `trg_apply_inventory_movement`, `validate_appointment_tenant`,
  `validate_inventory_movement_tenant`, `get_dashboard_kpis`.
  (`migrations/0017_set_function_search_path.sql`)

---

## 4. Optimizaciones de performance

- **`auth_rls_initplan` (6 políticas):** `auth.uid()` envuelto en `(select auth.uid())`
  para evaluarse una vez por consulta y no por fila — en `subscriptions` (select,
  delete), `billing_customers`, `profiles` (insert) y `allowed_emails`.
- **`multiple_permissive_policies`:** políticas SELECT solapadas de `allowed_emails`
  consolidadas (una SELECT + INSERT/UPDATE/DELETE separadas).
- **`unindexed_foreign_keys`:** índices de cobertura añadidos —
  `idx_appointments_customer_id`, `idx_appointments_barber_id`,
  `idx_invitations_invited_by`.
  (`migrations/0018...` y `migrations/0020_invitations_fk_index.sql`)

> Las advertencias `unused_index` que reporta el linter se deben a que las tablas están
> vacías (sin tráfico de consultas todavía); **no** son un problema y los índices deben
> conservarse para cuando haya datos.

---

## 5. Pendientes (no aplicables por SQL — requieren tu acción)

1. **Desplegar las Edge Functions** actualizadas:
   `supabase functions deploy invite-member expire-subscriptions`
   (el código está parcheado en el repo; producción aún corre las versiones previas).
2. **Configurar `CRON_SECRET`** en las variables de entorno de las funciones y en el
   scheduler que invoca `expire-subscriptions`.
3. **Habilitar "Leaked Password Protection"** en Auth → Settings (advisor
   `auth_leaked_password_protection`).
4. *(Opcional, bajo)* Mover las extensiones `pgcrypto` y `citext` fuera del esquema
   `public` (advisor `extension_in_public`; cambio riesgoso, bajo valor).

---

## 6. Pendientes de la auditoría general (no críticos, recomendados)

- **Tests de RLS multi-tenant** (pgTAP): es la ausencia que permitió que CRIT-1 y
  CRIT-5 pasaran desapercibidos. Prioridad alta.
- **Rate limiting atómico** (hoy check-then-insert, TOCTOU) y sin `DELETE` por request.
- **Import sin DDL global** (`disable_rollup_trigger` toma lock platform-wide) y parser
  CSV/Excel robusto.
- **Observabilidad/alerting** en webhooks de pago fallidos.
- **Validación de monto** en el webhook de Flow y compensación de suscripciones
  huérfanas en `flow-create-subscription`.

---

## 6.b. Pasada de funcionalidad (build + consistencia DB↔código)

Estado del pipeline del frontend tras las correcciones:

| Gate | Resultado |
|------|-----------|
| `tsc --noEmit` (typecheck) | ✅ |
| `eslint .` (lint) | ✅ 0 errores (8 warnings no bloqueantes) |
| `vitest run` (tests) | ✅ 2/2 |
| `vite build` | ✅ |

**Lint:** se corrigieron 24 errores preexistentes que tenían el CI en rojo —
tipados `any` en `supabase.ts`/`api.ts` reemplazados por helpers tipados, variables
sin usar eliminadas (`BillingPage`, `navLinks`, `auth.tsx`), y el flat config de
ESLint ahora ignora los artefactos generados de PWA (`dev-dist`, `sw.js`, `workbox-*`).

**Consistencia DB↔código:** verificado que todas las RPCs que invoca el frontend
(`get_user_session`, `has_active_subscription`, `get_dashboard_kpis`,
`get_customers_paginated`, `get_appointments_paginated`, `tenant_has_feature`,
`get_my_tenant_ids*`) mantienen `EXECUTE` para `authenticated` y lo perdieron para
`anon`. El lockdown de funciones no rompe la aplicación.

**Bug funcional corregido — tenants inutilizables (modelo de plan):**
tras `0014_single_plan`, `plan_features` solo define el plan `business`, pero el
trigger de signup creaba los tenants en `starter` (0 features) → cada tenant nuevo
nacía sin poder usar ninguna función. `0021_single_business_plan_model` alinea el
modelo: los tenants nacen `business` y el acceso se controla por suscripción activa
(no por plan); la cancelación/expiración ya no degrada el plan. El tenant de prueba
`aa` se migró a `business` + suscripción `trialing` para quedar operativo.

**Observación (no corregido, requiere decisión):** el tenant `aa` tenía **2
membresías `owner`** — huella del bug CRIT-1. Es data de prueba; se dejó intacta.

## 7. Mapa de migraciones aplicadas

| Migración | Contenido |
|-----------|-----------|
| `0015_security_critical_fixes` | CRIT-1 (invitaciones + trigger), CRIT-2 (downgrade no destructivo) |
| `0016_lock_down_rls_and_function_execution` | RLS en `rate_limits`, REVOKE FROM public |
| `0017_set_function_search_path` | `search_path` fijo en 7 funciones |
| `0018_rls_perf_fk_indexes_and_private_bucket` | CRIT-3 (bucket privado), RLS initplan, índices FK |
| `0019_revoke_function_execute_from_anon` | REVOKE EXECUTE de `anon`/`authenticated` |
| `0020_invitations_fk_index` | índice FK `invitations.invited_by` |
| `0021_single_business_plan_model` | tenants nacen `business`; sin downgrade de plan; app usable |

> En la nube estas migraciones quedaron registradas con timestamps
> (`20260612142620` … `20260612143454`). Los archivos del repo usan la numeración
> `0015`–`0020` con contenido idéntico.
