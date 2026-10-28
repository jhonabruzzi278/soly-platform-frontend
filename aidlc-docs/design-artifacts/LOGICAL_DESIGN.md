# Logical Design

## Patterns Detected in the Code

| Pattern | Where | Notes |
|---|---|---|
| Provider-tree composition (React Context) | `frontend/src/main.tsx`, `src/app/` | `QueryClientProvider → ThemeProvider → AuthProvider → TenantProvider → WorkspaceProvider → AppRoutes`. Strict nesting order — each layer depends on the one above. |
| Repository-via-SQL-view | `vw_appointments_enriched`, `vw_revenue_by_*` | Denormalization happens in Postgres, not in a frontend repository class. |
| Cursor-based pagination | `get_customers_paginated`, `get_appointments_paginated` RPCs + TanStack Query `useInfiniteQuery` | `WHERE created_at < cursor ORDER BY created_at DESC LIMIT n+1` — the `+1` row detects "has more" without a `COUNT(*)`. |
| SECURITY DEFINER RPC gate | `has_active_subscription`, `get_user_session` | RPCs run with elevated privilege so RLS doesn't need to expose subscription/session internals directly to `authenticated`. |
| Column-level write-only secret | `ai_settings.api_key` | No `SELECT` grant for `authenticated` at the Postgres grant level — not an application-layer convention, an actual DB permission. This is a notably strong pattern versus the common (weaker) approach of just "not selecting it in application code." |
| Propose/validate two-phase mutation | `import-data` Edge Function `dry_run` flag | Same endpoint, different side effects, driven by a boolean — avoids a separate preview endpoint. |
| Structural AI output validation | `import-data` AI column-mapping fallback | AI response is validated against a whitelist of real column names before use — defends against the spreadsheet content itself containing a prompt injection payload. |
| CQRS-ish read model | Analytics views (`vw_revenue_by_barber`, etc.) | Read-optimized views separate from the write-side `customers`/`appointments` tables. |
| Trigger-maintained rollups | `customers.total_spent`, `total_appointments`, etc. | Eventually-consistent-at-write-time denormalization; this is also where two real bugs originated (migrations `0022`, `0025`) — trigger logic broke on cascade delete and on barber name resolution. |
| Vercel Function as protocol adapter | `frontend/api/flow-return.js` | Exists purely to convert a POST callback (Flow.cl/Webpay behavior) into a GET the SPA router can consume — a single-purpose adapter, not a general backend. |

## Tech Stack (detected)

| Layer | Technology | Version (from lockfiles) | Source |
|---|---|---|---|
| Frontend framework | React | ^18.3.1 | `frontend/package.json` |
| Build tool | Vite | ^7.0.0 | `frontend/package.json` |
| Styling | TailwindCSS | ^3.4.15 | `frontend/package.json` |
| Data fetching/cache | TanStack Query | ^5.62.0 | `frontend/package.json` |
| Routing | react-router-dom | ^6.28.0 | `frontend/package.json` |
| Backend / DB | Supabase (PostgreSQL 17) | — | README, migrations use `create table if not exists` Postgres syntax |
| Edge runtime | Deno (Supabase Edge Functions) | — | `npm:@supabase/supabase-js` specifier convention in functions |
| Payments | Flow.cl REST API | OpenAPI spec `es-openApiFlow (1).yaml` (present, untracked, in repo root at analysis time) | `backend/supabase/functions/_shared/flow.ts` |
| Observability | Sentry (`@sentry/react`) | ^10.58.0 | `frontend/package.json` |
| Testing | Vitest + Testing Library + jsdom | vitest ^4.1.8 | `frontend/package.json` |
| Linting/types | ESLint 9 (flat config) + TypeScript 5.6 | — | `frontend/package.json` |
| Deployment | Vercel | — | `frontend/vercel.json`, README deploy section |
| CI | GitHub Actions | — | `.github/workflows/ci.yml` |

## Servicios Externos Detectados

- **Supabase** — Postgres DB, Auth, Storage (private `excel-files` bucket), Edge Functions runtime. Connection via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- **Flow.cl** — payment gateway. Base URLs `https://www.flow.cl/api` (prod) / `https://sandbox.flow.cl/api` (sandbox, toggled by `FLOW_SANDBOX` env var). Auth: HMAC-SHA256 over alphabetically-sorted params, not Bearer tokens.
- **Sentry** — error tracking + custom metrics ingest, allowlisted in CSP `connect-src` (`o4511588385882112.ingest.us.sentry.io`).
- **SMTP** (host unspecified, generic) — used by Supabase Auth / `invite-member` for transactional email (magic link, invitations).
- **Google Fonts** — allowlisted in CSP `style-src`/`font-src` (`fonts.googleapis.com`, `fonts.gstatic.com`).

## Architecture Style

Monolithic SPA + BaaS (Backend-as-a-Service), not microservices. All backend logic lives in Postgres (RLS, triggers, RPCs, views) or thin Deno Edge Functions — there is no separate application server. Cross-cutting concerns (auth, tenant scoping, rate limiting) are pushed down into the database layer rather than a middleware layer, which is a deliberate and consistent choice across the whole backend (see [[ADR-001]]).
