# Soly Platform

CRM SaaS PWA multi-tenant para negocios de servicios (barberías, spas, salones). Diseñado como plantilla replicable para construir productos SaaS B2B.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + TailwindCSS + PWA |
| Auth / DB / Storage | Supabase (PostgreSQL 17 + RLS + Storage) |
| Backend functions | Supabase Edge Functions (Deno) |
| Deploy frontend | Vercel |
| Pagos | Flow.cl (gateway chileno, reemplazable por Stripe) |
| CI | GitHub Actions |

---

## Modelo SaaS

```
1 organización = 1 tenant (workspace aislado)
1 plan         = límites de features y seats
1 despliegue   = todos los tenants comparten infraestructura
```

Multi-tenancy implementado con `tenant_id` en todas las tablas + Row Level Security (RLS) a nivel de PostgreSQL. Ningún dato de un tenant es accesible desde otro.

---

## Estructura del repositorio

```
soly/
├── frontend/                    # React SPA / PWA
│   ├── src/
│   │   ├── app/                 # Providers, router, auth
│   │   ├── components/          # UI compartidos
│   │   ├── contexts/            # TenantContext
│   │   ├── features/            # Páginas (auth, dashboard, clientes…)
│   │   ├── hooks/               # Custom hooks (useCustomers, useAppointments…)
│   │   └── lib/                 # api.ts, supabase.ts, types.ts, features.ts
│   ├── api/
│   │   └── flow-return.js       # Vercel Serverless Function (redirección Flow.cl)
│   └── public/                  # Assets estáticos, plantillas CSV
│
├── backend/
│   └── supabase/
│       ├── migrations/          # 0001…0026 SQL secuenciales
│       ├── functions/           # Edge Functions (Deno)
│       │   ├── _shared/         # cors.ts, rate-limit.ts, flow.ts, utils.ts
│       │   ├── create-organization/
│       │   ├── flow-create-subscription/
│       │   ├── flow-cancel-subscription/
│       │   ├── flow-webhook/
│       │   ├── invite-member/
│       │   ├── import-data/
│       │   ├── expire-subscriptions/
│       │   └── health/
│       └── config.toml
│
├── .github/workflows/ci.yml     # Typecheck + lint + test + build
├── CLAUDE.md                    # Guía para Claude Code
└── README.md
```

---

## Arquitectura frontend

### Provider tree

```
main.tsx
└── QueryClientProvider        (TanStack Query v5)
    └── ThemeProvider          (light/dark → localStorage)
        └── AuthProvider       (sesión Supabase + rol)
            └── TenantProvider (membership + fila tenant)
                └── WorkspaceProvider  (settings del tenant, document.title)
                    └── AppRoutes
```

### Feature modules (`src/features/`)

| Directorio | Ruta | Descripción |
|-----------|------|-------------|
| `auth/` | `/login`, `/recuperar-password` | Login + recuperación (pública) |
| `dashboard/` | `/dashboard` | KPIs via RPC `get_dashboard_kpis` |
| `customers/` | `/clientes` | CRUD paginado; selección bulk; import CSV/Excel |
| `appointments/` | `/citas` | Vista paginada de citas enriquecida |
| `reports/` | `/reportes` | Gráficas de ingresos y ocupación |
| `billing/` | `/billing` | Suscripciones Flow.cl; trial gratuito |
| `files/` | `/archivos` | Upload Excel/CSV + smart import con IA opcional |
| `settings/` | `/configuracion` | Branding, equipo, AI settings |

### Gating de rutas y features

- `<RequireAuth>` llama al RPC `has_active_subscription`. Sin suscripción activa → `/billing`.
- `<FeatureGate feature="...">` verifica `src/lib/features.ts`. Plan único `business` con todas las features habilitadas; el gate existe para extensibilidad futura.

### Data layer (`src/lib/`)

- **`supabase.ts`** — cliente Supabase; exporta `invokeEdgeFunction<Body, Response>()` que refresca el token y normaliza errores antes de llamar al Edge Function.
- **`api.ts`** — todas las llamadas RPC / tabla / storage.
- **`types.ts`** — tipos TypeScript compartidos (`Tenant`, `Customer`, `AppointmentEnriched`, `Subscription`, …).
- **`features.ts`** — definición de planes y helper `hasFeature()`.

---

## Arquitectura backend

### Esquema de base de datos

Todas las tablas tienen `tenant_id uuid NOT NULL REFERENCES tenants(id)` y políticas RLS activas.

**Tablas core:**

| Tabla | Propósito |
|-------|-----------|
| `tenants` | Una fila por organización (slug, plan, branding) |
| `memberships` | Users ↔ tenants con roles `owner/admin/member/viewer` |
| `profiles` | Datos públicos del usuario (nombre, email) |
| `subscriptions` | Suscripciones por producto/plan (status: `trialing/active/cancelled/expired`) |
| `customers` | Clientes del tenant; con rollup `total_spent`, `total_appointments` |
| `appointments` | Citas; cascade delete desde customers |
| `ai_settings` | API key de IA (write-only a nivel DB), provider, modelo |
| `plan_features` | Qué features están habilitadas por plan |
| `rate_limits` | Throttling de Edge Functions |

**Vistas:**

| Vista | Propósito |
|-------|-----------|
| `vw_appointments_enriched` | Citas con nombre de cliente y atendedor |
| `vw_revenue_by_barber` | Ingresos agrupados por atendedor |
| `vw_revenue_by_service` | Ingresos agrupados por servicio |
| `vw_appointments_per_day` | Conteo diario de citas (últimos 30 días) |

**RPCs expuestos a clientes:**

| RPC | Descripción |
|-----|-------------|
| `get_user_session` | Fuente de verdad de sesión (user, rol, tenant) |
| `has_active_subscription` | Gate de suscripción activa |
| `get_dashboard_kpis` | KPIs del dashboard |
| `get_customers_paginated` | Paginación cursor-based de clientes |
| `get_appointments_paginated` | Paginación cursor-based de citas |

### Migraciones (`backend/supabase/migrations/`)

Archivos SQL numerados secuencialmente. Aplicar en orden con `supabase db push` o manualmente:

| Módulo | Contenido |
|--------|-----------|
| `0001` | Extensiones, enums, función `set_updated_at` |
| `0002` | Multi-tenant: tenants, memberships, profiles |
| `0003` | CRM: customers, appointments, triggers de rollup |
| `0004` | Vistas de analítica |
| `0005` | Billing: subscriptions, tabla Flow.cl |
| `0006` | RLS en Storage (bucket privado) |
| `0007–0008` | Hardening de seguridad y billing |
| `0009` | Flujo de invitaciones |
| `0010` | RPCs de paginación y sesión |
| `0011` | Rate limiting |
| `0012` | Feature gating por plan |
| `0013` | Índices de performance y lifecycle |
| `0014–0021` | Plan único `business`, ajustes de RLS, permisos de funciones |
| `0022–0023` | Fix trigger rollup, slugs únicos, auto-trial |
| `0024` | Tabla `ai_settings` |
| `0025` | Fix: cascade delete de clientes con citas |
| `0026` | Fix: `json_agg` con `WITH ORDINALITY` en RPCs paginados |

### Edge Functions (`backend/supabase/functions/`)

Todas corren en Deno. Comparten utilidades en `_shared/`.

| Función | Trigger | Propósito |
|---------|---------|-----------|
| `create-organization` | POST (onboarding) | Crea tenant + membership + suscripción trial |
| `flow-create-subscription` | POST | Inicia pago/suscripción en Flow.cl |
| `flow-cancel-subscription` | POST | Cancela suscripción Flow.cl |
| `flow-webhook` | POST (webhook Flow) | Actualiza `subscriptions` al recibir confirmación |
| `invite-member` | POST | Envía email de invitación y crea membership pendiente |
| `import-data` | POST | Parsea Excel/CSV; mapeo IA opcional; `dry_run: true` = análisis sin insertar |
| `expire-subscriptions` | Cron | Marca suscripciones vencidas como `expired` |
| `health` | GET | Health check |

**Shared utilities:**
- `cors.ts` — headers CORS.
- `rate-limit.ts` — throttling por key en tabla `rate_limits`.
- `flow.ts` — cliente Flow.cl API (firma HMAC, llamadas REST).
- `utils.ts` — helpers de respuesta y error.

---

## Patrones clave

### Seguridad

- **RLS** en todas las tablas: los usuarios solo ven y modifican registros de sus tenants.
- **SECURITY DEFINER** en RPCs sensibles para ejecutar con privilegios del owner y no del caller.
- **API key de IA write-only**: la columna `ai_settings.api_key` no tiene `SELECT` grant para `authenticated`. El frontend nunca la lee.
- **Errores normalizados**: `invokeEdgeFunction` en el frontend borra detalles internos (SQL state, constraint names) antes de mostrar al usuario.
- **Rate limiting** en Edge Functions con ventana deslizante.

### Paginación cursor-based

Los RPCs `get_customers_paginated` y `get_appointments_paginated` usan `created_at` como cursor:

```sql
WHERE tenant_id = p_tenant_id
  AND (p_cursor IS NULL OR created_at < p_cursor)
ORDER BY created_at DESC
LIMIT p_limit + 1   -- +1 para detectar si hay más páginas
```

El cliente usa TanStack Query `useInfiniteQuery` con `getNextPageParam`.

### Import inteligente

El Edge Function `import-data` implementa un pipeline de 3 fases:

1. **Parseo** — SheetJS lee Excel/CSV → filas crudas.
2. **Mapeo de columnas** — heurístico primero (aliases predefinidos); si hay `ai_settings` configurado, IA como fallback.
3. **Deduplicación** — customers por email/teléfono; appointments por `customer_id|fecha|hora`.

Con `dry_run: true` solo analiza y devuelve el mapping propuesto sin insertar nada.

### Billing Flow.cl

Flow.cl redirige al browser via POST (comportamiento Webpay). La Vercel Serverless Function `api/flow-return.js` convierte ese POST en un GET redirect a `/billing?billing=success`. El frontend lee ese query param.

### Theming

`data-theme="dark|light"` en `<html>`. Variables CSS definidas en `index.css`. La clase `.theme-shell` es el fondo base. Persistido en `localStorage`.

---

## Setup local

### Requisitos

- Node.js 20+
- Supabase CLI (`npm install -g supabase`)
- Cuenta Supabase (o self-hosted)

### 1. Clonar y configurar

```bash
git clone <repo>
cd soly
```

### 2. Backend — Supabase

#### Opción A: Supabase Cloud (recomendado)

1. Crear proyecto en [supabase.com](https://supabase.com).
2. Aplicar todas las migraciones:
   ```bash
   cd backend
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```
3. Deployar Edge Functions:
   ```bash
   supabase functions deploy create-organization
   supabase functions deploy flow-create-subscription
   supabase functions deploy flow-cancel-subscription
   supabase functions deploy flow-webhook
   supabase functions deploy invite-member
   supabase functions deploy import-data
   supabase functions deploy expire-subscriptions
   supabase functions deploy health
   ```
4. Configurar secrets de Edge Functions:
   ```bash
   supabase secrets set FLOW_API_KEY=xxx FLOW_SECRET_KEY=xxx FLOW_BUSINESS_PLAN_ID=xxx
   supabase secrets set CRON_SECRET=xxx
   supabase secrets set SMTP_HOST=xxx SMTP_USER=xxx SMTP_PASS=xxx SMTP_FROM="Soly <no-reply@soly.app>"
   ```
5. Crear el bucket de Storage:
   - Nombre: `excel-files`
   - Tipo: **Privado**
   - Aplicar migración `0006_storage_rls.sql` (ya incluida).

#### Opción B: Self-hosted (Docker)

```bash
cd backend
cp .env.example .env
# Editar .env con tus valores
docker compose up -d
```

Luego aplicar migraciones manualmente contra el contenedor PostgreSQL.

### 3. Frontend

```bash
cd frontend
cp .env.example .env
```

Editar `frontend/.env`:

```env
VITE_SUPABASE_URL=https://<tu-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SUPABASE_BUCKET=excel-files
VITE_PUBLIC_APP_URL=https://tu-dominio.com
```

```bash
npm install
npm run dev          # http://localhost:5111
```

### 4. Comandos útiles

```bash
# Desde frontend/
npm run dev          # servidor de desarrollo (puerto 5111)
npm run build        # build de producción
npm run check        # type-check sin emitir
npm run lint         # ESLint
npm run test         # Vitest (una pasada)
npm run test:watch   # Vitest en modo watch
npm run test:coverage
```

---

## Variables de entorno

### Frontend (`frontend/.env`)

| Variable | Descripción |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon/public key de Supabase |
| `VITE_SUPABASE_BUCKET` | Nombre del bucket Storage (`excel-files`) |
| `VITE_PUBLIC_APP_URL` | URL pública de la app |

### Backend (Edge Functions secrets)

| Secret | Descripción |
|--------|-------------|
| `FLOW_API_KEY` | API key de Flow.cl |
| `FLOW_SECRET_KEY` | Secret key de Flow.cl |
| `FLOW_BUSINESS_PLAN_ID` | ID del plan en Flow.cl |
| `CRON_SECRET` | Token para autenticar cron de expire-subscriptions |
| `SMTP_HOST` | Host SMTP para emails de invitación |
| `SMTP_USER` | Usuario SMTP |
| `SMTP_PASS` | Contraseña SMTP |
| `SMTP_FROM` | From address (ej. `Soly <no-reply@soly.app>`) |

---

## Despliegue en producción

### Frontend → Vercel

1. Conectar el repositorio en [vercel.com](https://vercel.com).
2. Configurar root directory: `frontend`.
3. Agregar las variables de entorno (`VITE_*`).
4. Vercel detecta Vite automáticamente.
5. La función `api/flow-return.js` se despliega automáticamente como Serverless Function.

### CI/CD (GitHub Actions)

`.github/workflows/ci.yml` ejecuta en cada push/PR a `main`:

1. `npm ci`
2. Typecheck (`tsc --noEmit`)
3. Lint (`eslint .`)
4. Test (`vitest run`)
5. Build (`tsc -b && vite build`)

---

## Adaptarlo a otro SaaS

Este proyecto es una base replicable. Lo que necesitas cambiar:

### 1. Dominio de negocio

Reemplazar `customers` + `appointments` con tus entidades:
- Añadir tablas en una nueva migration.
- Crear vistas y RPCs de paginación siguiendo el patrón cursor-based existente.
- Añadir el feature module en `src/features/`.

### 2. Plan y features

Editar `src/lib/features.ts` y la tabla `plan_features` en el DB para definir tus planes y sus capacidades.

### 3. Pasarela de pago

Reemplazar Flow.cl por Stripe u otro gateway:
- Editar/reemplazar las Edge Functions `flow-*`.
- Actualizar la tabla `subscriptions` si el modelo de datos difiere.
- El Vercel Serverless Function `api/flow-return.js` puede eliminarse si el gateway redirige via GET.

### 4. Branding y textos

- Colores: variables CSS en `frontend/src/index.css`.
- Logo y nombre: `WorkspaceProvider` gestiona `document.title` desde `tenant.business_name`.
- Idioma: todos los textos usuario-visible están en español; cambiarlos directamente en los componentes.

### 5. Import inteligente

El Edge Function `import-data` es genérico:
- Añadir aliases de columnas en `importers/customers.ts` o `importers/appointments.ts`.
- Para nuevas entidades, crear un importer siguiendo el mismo patrón.

### 6. AI settings

La arquitectura de `ai_settings` es agnóstica al proveedor:
- `provider`: `anthropic` | `openai`.
- `base_url`: para proxies o endpoints personalizados.
- La `api_key` nunca se retorna al cliente (write-only a nivel DB).

---

## Tests

Vitest + jsdom + Testing Library. Tests junto al código que prueban:

```
src/features/files/importData.test.ts   # lógica de import
src/hooks/useDashboardKpis.test.tsx     # hook de KPIs
```

```bash
cd frontend
npm run test            # una pasada
npm run test:watch      # modo watch
npm run test:coverage   # con reporte de cobertura
```

---

## Bugs conocidos resueltos (referencia)

| Bug | Causa | Migration |
|-----|-------|-----------|
| DELETE de customer con citas → 400 | Trigger `refresh_customer_rollup` fallaba cuando el customer ya no existía en cascade | `0025` |
| `r.id = undefined` en tabla con >50 registros → DELETE 400 | `json_agg(elem)` con `WITH ORDINALITY` agregaba `{value, ordinality}` en vez del objeto plano | `0026` |

---

## Licencia

Privado — uso interno.
