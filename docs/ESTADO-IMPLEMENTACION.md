# Estado de implementación para continuar Soly

Revisión: 10/09/2026. Referencia Git: `c5a3f31` **más cambios locales**, por lo que el commit por sí solo no reproduce este estado. Complementa el [roadmap](ROADMAP.md); no reemplaza sus criterios de cierre.

## Alcance y evidencia

Inspección de rutas, componentes, hooks, API frontend, funciones backend, migraciones, CI y pruebas existentes. En esta revisión se ejecutaron `npm run check` y `npm run test`: ambos terminaron correctamente; Vitest aprobó dos archivos y seis pruebas. El build completo terminó correctamente en el turno anterior después del cambio de precio. ESLint, ejecutado en la revisión inicial de esta conversación, tuvo cero errores y diez advertencias; no se volvió a ejecutar en esta revisión documental.

No se ejecutaron pruebas en navegador autenticado, migraciones desde cero, suite SQL RLS, callbacks Flow, restauración, carga o verificación de producción. **Implementado significa encontrado en código; listo para producción requiere pruebas de integración y operación.** No hay una certificación de producción en esta entrega.

Estados usados:

- **Implementado localmente:** comportamiento concreto presente, sin afirmar integración real verificada.
- **Parcial:** existe base reutilizable, pero faltan partes del criterio del roadmap.
- **Pendiente:** no se encontró flujo completo en los archivos y rutas revisados.
- **No verificado:** depende de configuración externa, operación o una prueba que no se ejecutó.

Los enlaces siguientes son relativos a este documento. Revisar siempre el contenido actual antes de editar; no tratar este inventario como una instrucción para reconstruir lo que ya existe.

## Inventario: qué conservar y qué completar

| Módulo | Implementación existente | Falta para cerrar | Evidencia / entrada principal | Roadmap |
|---|---|---|---|---|
| Estructura de app | React/Vite, proveedores de auth/tenant/workspace, rutas protegidas, lazy loading de módulos | Verificación real de navegación, errores y cambio de sesión | [main.tsx](../frontend/src/main.tsx), [AppRoutes](../frontend/src/app/AppRoutes.tsx) | F0.4, F6.5 |
| Registro y login | LoginPage llama `signup`; AuthProvider usa `supabase.auth.signUp`; trigger crea negocio/membresía/trial | Onboarding por rubro/zona horaria, ensayo de recuperación/invitaciones y política de roles | [auth.tsx](../frontend/src/app/auth.tsx), [LoginPage](../frontend/src/features/auth/LoginPage.tsx), [migración 0023](../backend/supabase/migrations/0023_signup_unique_slug_and_auto_trial.sql) | F1.2, F2.4 |
| Recuperación de contraseña | Formulario, email de recuperación, actualización de contraseña y redirección de hash recovery | Verificar correo recibido, enlace y expiración contra entorno de ensayo | [PasswordRecoveryPage](../frontend/src/features/auth/PasswordRecoveryPage.tsx), [api.ts](../frontend/src/lib/api.ts) | F1.2 |
| Aislamiento y roles | Tenants/memberships, políticas RLS, vistas con `security_invoker`, hardening de RPCs | Aplicación real de migraciones y prueba con dos tenants, roles y storage | [migraciones](../backend/supabase/migrations), [suite SQL](../backend/supabase/tests/rls_robustness_test.sql) | F1.1, F1.2 |
| Plan y precio | Business, 20 cuentas, cuatro features; precio local de $23.000 IVA incluido en frontend, landing y creación de pagos | Despliegue coordinado y verificación del importe real; validar límites efectivos y costos | [features.ts](../frontend/src/lib/features.ts), [Flow create](../backend/supabase/functions/flow-create-subscription/index.ts) | F1.3, F5.3, F6.6 |
| Pago | Checkout de pago individual, pantalla billing, retorno de Flow, trial y cancelación | Callback, atomicidad, correspondencia orden/tenant, lifecycle y modalidad de renovación; ver hallazgos abajo | [BillingPage](../frontend/src/features/billing/BillingPage.tsx), [Flow webhook](../backend/supabase/functions/flow-webhook/index.ts), [flow-return](../frontend/api/flow-return.js) | F1.3–F1.6 |
| Clientes | Listar paginado, crear, editar, eliminar y eliminación múltiple; nombre/email/teléfono/notas; rollups de historial en DB | Búsqueda global, ficha con historial navegable, deduplicación manual, exportación y política de eliminación verificadas | [CustomersPage](../frontend/src/features/customers/CustomersPage.tsx), [useCustomers](../frontend/src/hooks/useCustomers.ts), [api.ts](../frontend/src/lib/api.ts) | F3.1, F3.6 |
| Citas | Lista paginada, alta/edición, fecha/hora, servicio libre, importe y estados pending/confirmed/cancelled/completed/no_show | Calendario, selector de servicio/profesional, duración, disponibilidad, concurrencia e historial de cambios | [AppointmentsPage](../frontend/src/features/appointments/AppointmentsPage.tsx), [useAppointments](../frontend/src/hooks/useAppointments.ts) | F4.1–F4.5 |
| Servicios | Tabla `services` con nombre/precio y tenant; mapeo de importación en backend | Pantalla CRUD, duración/categoría/activo, asignación a profesionales y snapshot histórico en citas | [migración 0003](../backend/supabase/migrations/0003_domain_crm.sql), [import logic](../backend/supabase/functions/import-data/logic.ts) | F3.2 |
| Equipo | Lista de membresías, invitación por email, eliminación, conteo de cuentas; backend valida permisos al invitar | Profesional independiente del login, roles configurables en UI, horarios, servicios y desactivación con historial | [TeamSection](../frontend/src/features/settings/TeamSection.tsx), [invite-member](../backend/supabase/functions/invite-member/index.ts) | F1.2, F3.3 |
| Horarios/recursos | Citas tienen fecha/hora y referencia opcional `barber_id` | Jornadas, bloqueos, duración, cabinas/equipos y disponibilidad compartida | [migración 0003](../backend/supabase/migrations/0003_domain_crm.sql), [AppointmentsPage](../frontend/src/features/appointments/AppointmentsPage.tsx) | F3.4, F4.2, F4.3 |
| Archivos e importación | Upload/listado/borrado, URLs firmadas, dry-run, mapeo manual/heurístico/IA, errores y deduplicación de clientes/citas | Pruebas de integración/reimportación/volumen, datos homónimos, plantillas por rubro y límites sostenibles | [ExcelUploadPage](../frontend/src/features/files/ExcelUploadPage.tsx), [import-data](../backend/supabase/functions/import-data/index.ts), [importadores](../backend/supabase/functions/import-data/importers) | F3.5 |
| Dashboard/reportes | KPI RPC, ingresos por profesional/servicio, citas por día, loading/error; cálculos SQL | Definiciones verificadas, filtros por período/profesional/servicio, ocupación real y separación entre importe y cobro | [DashboardPage](../frontend/src/features/dashboard/DashboardPage.tsx), [ReportsPage](../frontend/src/features/reports/ReportsPage.tsx), [useReports](../frontend/src/hooks/useReports.ts) | F5.1, F5.2 |
| Configuración de marca | Edición de nombre/subtítulo, título de documento dinámico | Logo editable real, nueva identidad aplicada, rubro y textos comunes | [BrandingSection](../frontend/src/features/settings/BrandingSection.tsx), [WorkspaceProvider](../frontend/src/app/WorkspaceProvider.tsx) | F2.1, F2.3–F2.5 |
| Propuesta de rebranding | Dirección HTML, estrategia y precio aprobados | Aplicación al producto y portada conectada | [propuesta](soly-direccion-de-marca.html), [estrategia](ESTRATEGIA-PRODUCCION-2026-09.md) | F2.1–F2.5 |
| PWA y tema | Configuración PWA, iconos, botón de instalación y tema claro/oscuro | Actualizar marca en assets y probar instalación/actualización en dispositivos; no asumir operación offline del CRM | [vite.config](../frontend/vite.config.ts), [ThemeProvider](../frontend/src/app/ThemeProvider.tsx), [InstallPwaButton](../frontend/src/components/common/InstallPwaButton.tsx) | F2.3, F6.5 |
| IA | Guardar configuración por tenant y mapeo opcional de columnas durante importación; frontend no solicita api_key | Probar permisos y consumo; no hay asistente de negocio completo | [AiSection](../frontend/src/features/settings/AiSection.tsx), [mapping.ts](../backend/supabase/functions/import-data/mapping.ts), [migración 0024](../backend/supabase/migrations/0024_ai_settings.sql) | F3.5, F7.6 |
| Inventario | Tablas de productos/movimientos, restricciones y trigger de stock | Módulo de usuario, integración funcional, pruebas de concurrencia y trazabilidad | [migración 0003](../backend/supabase/migrations/0003_domain_crm.sql) | F7.1 |
| Monitoreo/operación | Sentry condicionado a configuración, eventos de actividad, health, función de vencimiento, cron en migraciones y documentos operativos | DSN/env reales, alertas recibidas, jobs activos, respaldo/restauración y costos por negocio verificados | [monitoring.ts](../frontend/src/lib/monitoring.ts), [main.tsx](../frontend/src/main.tsx), [expire-subscriptions](../backend/supabase/functions/expire-subscriptions/index.ts), [operación](../aidlc-docs/operations) | F1.7, F5.3, F6.4–F6.6 |
| CI/tests | Workflow frontend de typecheck/lint/test/build; dos archivos Vitest y suite SQL independiente | Backend en CI, integración, E2E, carga y reconstrucción DB | [CI](../.github/workflows/ci.yml), [test import](../frontend/src/features/files/importData.test.ts), [test KPI](../frontend/src/hooks/useDashboardKpis.test.tsx) | F0.3, F6.5 |
| Reservas públicas/recordatorios | No se encontró recorrido conectado ni función de envío de recordatorios de citas | Implementación de F6.1–F6.3 sobre disponibilidad segura; invitaciones de equipo no equivalen a recordatorios | [rutas actuales](../frontend/src/app/AppRoutes.tsx), [funciones](../backend/supabase/functions) | F6.1–F6.3 |
| Exportación/paquetes/comisiones/WhatsApp/retención/sucursales | No se encontró módulo operativo completo | Implementar según roadmap; confirmar demanda y costos primero | [rutas](../frontend/src/app/AppRoutes.tsx), [API actual](../frontend/src/lib/api.ts) | F3.6, F7.2–F7.5, F7.7 |

## Hallazgos concretos que no se deben perder

Inspección estática, salvo pruebas expresamente indicadas. Estos puntos requieren reproducción dirigida; no afirmar incidentes reales ni vulnerabilidades explotadas.

1. **Callback Flow e idempotencia — F1.3/F1.4.** `flow-webhook/index.ts` exige `s`, busca duplicados por `flowOrder`, pero el índice de `0008_billing_hardening.sql` usa `raw_payload.id`. Varias actualizaciones no comprueban el error devuelto; el evento puede marcarse procesado y el catch responde 200. Corregir contrato y recuperación antes de cobros reales. La referencia oficial y el análisis del contrato están en la estrategia.
2. **Suscripción por usuario frente a negocio — F1.3/F1.5.** `fetchUserSubscription` y `hasActiveSubscription` consultan usuario/producto; la creación también usa usuario/producto, y el webhook puede resolver por correo y primera membresía owner. Revisar coherencia con el plan por negocio y con los miembros invitados; probar propietario con dos organizaciones y acceso de miembro sin suscripción personal.
3. **Trial y cancelación — F1.5/F1.6.** Creación de prueba no comprueba un historial completo de pruebas consumidas; la cancelación local cambia estado inmediatamente y, para identificadores recurrentes, captura error del proveedor sin bloquear la cancelación DB. Ensayar repetición de trial, conservación del período pagado y fallo de cancelación remota.
4. **Registro duplicado/desconectado — F2.4.** El recorrido conectado es `LoginPage → AuthProvider.signup → supabase.auth.signUp → trigger`. `OnboardingPage.tsx` existe pero no está en `AppRoutes`; envía `plan: starter`, tiene validación de seis caracteres y muestra “Redirigiendo” sin navegación en el componente inspeccionado. No conectarlo tal cual ni asumir que `create-organization` es el flujo usado actualmente.
5. **Portada desconectada — F2.2.** `/` va a `/login`; `LandingPage.tsx` no está montada y existe `landing/index.html` independiente. Su despliegue externo no se verificó. Hay promesas de inventario sin UI disponible.
6. **Clientes para agendar — F3.1/F4.1.** `useCustomers` pagina de 50 en 50. `AppointmentsPage` usa `customers` pero no expone carga de más clientes ni búsqueda remota en el selector. Revisar con más de 50 clientes. La pantalla de clientes sí tiene carga de siguientes páginas.
7. **Servicio y profesional de la cita — F3.2/F3.3/F4.1.** El formulario guarda `service_name` libre y no incluye `barber_id` en su payload de guardado. Mostrar una columna “Barbero” no equivale a poder asignarlo. No hay duración o fin del intervalo en el modelo base inspeccionado.
8. **Membresías no son agenda de profesionales — F3.3.** TeamSection invita con `inviteRole = member` fijo. Backend acepta más roles bajo permisos, pero no existe en esta UI un editor completo de roles, horarios o servicios.
9. **Logo no está completo — F2.3.** WorkspaceProvider conserva nombre/subtítulo; fija logo, imagen de login y soporte en null y solo persiste los dos textos. No marcar carga de logo o branding completo como terminado por ver esos campos en los tipos.
10. **Ocupación estimada — F5.1.** Última definición encontrada de `get_dashboard_kpis`, en `0017_set_function_search_path.sql`, usa `12 * 7` como capacidad base, ajustada por perfiles. No usa horarios configurados. ReportsPage muestra ingresos de todos los tiempos; faltan filtros del roadmap.
11. **Ámbito de analítica — F1.1/F5.2.** `useReports` tiene claves de caché sin tenant; consultas de reportes no reciben tenant explícito y dependen de RLS. Verificar caché al cambiar sesión/espacio y agregación de varias membresías; no concluir filtración sin reproducción.
12. **Importación con límites — F3.5.** Resolución de clientes de citas usa nombre normalizado y un Map; dos clientes homónimos pueden resultar ambiguos. Consultas de existentes usan `.limit(20000)`, lo que no garantiza recuperar todos los registros frente a límites del servidor. Probar reimportación y volumen antes de afirmar deduplicación completa.
13. **Pruebas limitadas — F0.3.** Los seis tests actuales validan normalización de importación y hook KPI con mocks; no prueban cobros, concurrencia o RLS. La suite SQL anuncia 21 aserciones y rollback deliberado; está sin ejecutar en esta revisión.
14. **Historial de trabajo no cerrado — F0.1.** Hay cambios previos en README/CLAUDE/package files, eliminación local de `0026_fix_paginated_json_agg_with_ordinality.sql` y `0027_fix_paginated_json_agg_with_ordinality.sql` sin seguimiento. No revertirlos ni asumir historial remoto resuelto. No se leyó ni expuso contenido de secretos.

## Guía de continuidad con varios agentes

Si se organiza trabajo con varios agentes, dividir por IDs y área, manteniendo una persona/agente integrador para archivos compartidos. Propuesta de áreas, no asignaciones activas:

| Área | IDs | Archivos propios habituales | Dependencias a coordinar |
|---|---|---|---|
| Backend y cobros | F0.1–F0.3, F1.1–F1.7 | Funciones backend, pruebas SQL y nuevas migraciones | Contratos de sesión, tenant, estados de pago |
| Marca y entrada | F2.1–F2.5 | Landing, auth UI, layout, assets | Rutas, configuración del negocio y componentes comunes |
| Operación y agenda | F3.1–F4.5 | Customers, appointments, nuevos módulos de servicios/equipo | Modelo de datos, RLS y API |
| Verificación y analítica | F0.4, F5.1–F6.6 | Pruebas, reportes y evidencia de operación | Entregables funcionales de los otros bloques |

`frontend/src/lib/api.ts`, `types.ts`, `features.ts`, `AppRoutes.tsx`, migraciones y ROADMAP son superficies compartidas: acordar un único editor por archivo durante cada entrega. Diseñar contratos antes de desarrollar cambios dependientes. Crear migraciones solo después de resolver F0.1 y seguir la skill Supabase al implementarlas.

Antes de editar: leer este inventario y la tarea del roadmap, inspeccionar código actual y cambios locales, identificar qué reutilizar, indicar archivos y contrato afectados. Al cerrar: registrar tarea, verificación, limitaciones y publicación; actualizar inventario si cambió el comportamiento. El integrador actualiza el roadmap para evitar estados contradictorios.

## Primeros pasos sugeridos

1. F0.1: cerrar referencia de código e historial de migraciones, sin descartar trabajo existente.
2. F0.2/F0.3: reproducir DB de ensayo y suite de seguridad; establecer evidencia de integración.
3. F1.3/F1.4: recuperar y aplicar cobros correctamente; resolver relación de suscripción con negocio.
4. F2: aplicar la identidad aprobada aprovechando componentes y formularios existentes.

No volver a diseñar nombre/precio/rubros en cada análisis: las decisiones vigentes son Soly, belleza y cuidado personal, y $23.000 CLP IVA incluido. Su implementación comercial está descrita en el roadmap; producción sigue sin verificar.
