# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All frontend commands run from `frontend/`:

```bash
npm run dev          # dev server on port 5111
npm run build        # tsc -b && vite build
npm run check        # tsc --noEmit (type-check only)
npm run lint         # eslint .
npm run test         # vitest run (single pass)
npm run test:watch   # vitest (watch mode)
npm run test:coverage
```

There is no root-level build command. The `package.json` at root only declares `ecc-universal` as a dependency.

## Architecture Overview

**Soly** is a multi-tenant CRM SaaS PWA. The stack is:

- `frontend/` — React 18 + Vite + TailwindCSS, deployed on Vercel
- `backend/supabase/` — PostgreSQL (self-hosted or cloud) with RLS, Edge Functions (Deno), and Storage
- `frontend/api/flow-return.js` — a single Vercel Serverless Function that handles the POST redirect from Flow.cl (Chilean payment gateway) and redirects to `/billing?billing=success`

### Frontend provider tree

```
main.tsx
└── QueryClientProvider (TanStack Query)
    └── ThemeProvider          (light/dark, persisted in localStorage)
        └── AuthProvider       (Supabase auth session + SolyRole)
            └── TenantProvider (fetches membership + tenant row)
                └── WorkspaceProvider (wraps tenant settings)
                    └── AppRoutes
```

`AuthProvider` (`src/app/auth.tsx`) calls the `get_user_session` RPC for the authoritative session (with a 6s timeout, falling back to Supabase JWT metadata). `TenantContext` fetches the `memberships` + `tenants` rows. `WorkspaceProvider` syncs `WorkspaceSettings` from the tenant row and owns `document.title`.

### Route / feature gating

Routes are in `src/app/AppRoutes.tsx`. Protected routes are wrapped by `<RequireAuth>`, which calls the `has_active_subscription` RPC. No subscription → redirect to `/billing`. Feature visibility inside routes uses `<FeatureGate feature="...">`, which checks `src/lib/features.ts`. Currently there is one plan (`business`) with all features enabled; the gate is kept for forward-compatibility.

### Data layer (`src/lib/`)

- `supabase.ts` — creates the Supabase client; exports `invokeEdgeFunction<TBody, TResponse>()`, which handles token refresh and safe error messages before calling `{SUPABASE_URL}/functions/v1/{name}`
- `api.ts` — all Supabase RPC / table / storage calls (customers, appointments, billing, AI settings, import)
- `types.ts` — all shared TypeScript types (`Tenant`, `Customer`, `AppointmentEnriched`, `Subscription`, …)
- `features.ts` — plan definitions and `hasFeature()` helper

### Feature modules (`src/features/`)

Each subdirectory is a self-contained page:

| Directory | Route | Notes |
|-----------|-------|-------|
| `auth/` | `/login`, `/recuperar-password` | Public |
| `dashboard/` | `/dashboard` | KPI cards via `get_dashboard_kpis` RPC |
| `customers/` | `/clientes` | Paginated via `get_customers_paginated` RPC; bulk delete |
| `appointments/` | `/citas` | Reads `vw_appointments_enriched` view |
| `reports/` | `/reportes` | Reads `vw_revenue_by_*` + `vw_appointments_per_day` views |
| `billing/` | `/billing` | Flow.cl subscriptions via `flow-create-subscription` Edge Function |
| `files/` | `/archivos` | Excel/CSV upload to private Storage bucket; smart import via `import-data` Edge Function |
| `settings/` | `/configuracion` | Branding, team members, AI settings (API key is write-only at the DB level) |

### Backend: Edge Functions (`backend/supabase/functions/`)

| Function | Purpose |
|----------|---------|
| `create-organization` | Onboarding: creates tenant + membership + trial subscription |
| `flow-create-subscription` | Initiates a Flow.cl payment/subscription |
| `flow-cancel-subscription` | Cancels a Flow.cl subscription; tolerates non-fatal errors |
| `flow-webhook` | Flow.cl webhook handler; updates `subscriptions` table |
| `invite-member` | Sends invitation email and creates pending membership |
| `import-data` | Parses Excel/CSV, optionally uses AI for column mapping (`dry_run: true` = analyze only) |
| `expire-subscriptions` | Scheduled: marks expired subscriptions |
| `health` | Health check |

Shared utilities in `_shared/`: `cors.ts`, `rate-limit.ts`, `flow.ts` (Flow API client), `utils.ts`.

### Database migrations (`backend/supabase/migrations/`)

Sequential numbered SQL files (`0001_foundation.sql` … `0026_…`). All tenant data is isolated via `tenant_id` + RLS policies. Key tables: `tenants`, `memberships`, `profiles`, `subscriptions`, `customers`, `appointments`, `ai_settings`. Key RPCs: `get_user_session`, `get_dashboard_kpis`, `has_active_subscription`, `get_customers_paginated`, `get_appointments_paginated`.

## Environment Variables

Required in `frontend/.env`:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_BUCKET=excel-files
VITE_PUBLIC_APP_URL=https://tu-dominio.com
```

## Key Conventions

- **Theming**: `data-theme="dark|light"` on `<html>`; CSS custom properties defined in `index.css`; `.theme-shell` is the base background class.
- **Error messages**: user-facing errors are always Spanish. `invokeEdgeFunction` in `supabase.ts` normalizes backend errors and strips internal details (SQL state, constraint names) before throwing.
- **AI settings**: the `api_key` column in `ai_settings` is write-only at the DB level — never `SELECT` it from the frontend. `fetchAiSettings` explicitly excludes it.
- **Flow.cl billing**: Flow redirects via browser POST (Webpay behavior). The Vercel function `api/flow-return.js` converts it to a GET redirect to `/billing?billing=success`. The frontend billing page reads that query param.
- **Tests**: Vitest + jsdom + Testing Library. Setup file: `src/test/setup.ts`. Tests live alongside feature code (e.g., `src/features/files/importData.test.ts`).
