# Requirements

Extracted from the implemented feature set (`frontend/src/features/`, `backend/supabase/functions/`, migrations) — these are **implemented** requirements reverse-engineered from working code, not a forward-looking backlog.

## Functional Requirements

### Authentication & Onboarding
- FR-1: Users can sign up with just email (magic link) or email+password; signup auto-creates a tenant, an `owner` membership, and a 14-day trial subscription (`create-organization` Edge Function, migration `0023`).
- FR-2: Users can recover a forgotten password (`/recuperar-password`).
- FR-3: Existing members can be invited by email into a tenant with a specific role (`invite-member` Edge Function).
- FR-4: Session is resolved via a single RPC (`get_user_session`) with a 6s timeout, falling back to Supabase JWT metadata — not per-request Supabase Auth calls.

### Multi-tenancy & Access Control
- FR-5: Every tenant's data is isolated at the database level via `tenant_id` + Postgres RLS — no cross-tenant read/write is possible even with a valid but wrong-tenant JWT (verified by `backend/supabase/tests/rls_robustness_test.sql`, 21 assertions).
- FR-6: Four roles exist (`owner`, `admin`, `member`, `viewer`) with differentiated write permissions (e.g., a `member` can add customers but not appointments; a `viewer` is read-only; only `owner`/`admin` can delete).
- FR-7: Route access requires an active subscription (`<RequireAuth>` → `has_active_subscription` RPC); feature visibility is additionally gated per-plan via `<FeatureGate>` (currently a no-op since there is one plan with all features enabled).

### Customer & Appointment Management (core CRM)
- FR-8: CRUD for customers, paginated cursor-based (`get_customers_paginated`), with bulk-select delete.
- FR-9: CRUD for appointments, read via `vw_appointments_enriched` (joins customer + staff names), paginated the same way.
- FR-10: Customer rollup fields (`total_spent`, `total_appointments`) are maintained by DB triggers, not computed client-side.
- FR-11: Deleting a customer cascades to their appointments without breaking the rollup trigger (fixed in migrations `0025`, `0022`).

### Smart Import
- FR-12: Users can upload Excel/CSV files to a private Storage bucket and import customers/appointments via the `import-data` Edge Function.
- FR-13: Column mapping is heuristic first (ES/EN alias dictionary); if the tenant has configured `ai_settings`, an LLM is used as a fallback mapper for unresolved columns only (not for data itself), with its output validated against a column whitelist.
- FR-14: Import supports a `dry_run: true` mode that returns the proposed mapping without writing to the DB (propose/validate UX split).
- FR-15: Import deduplicates customers by email/phone and appointments by `customer_id | date | time`; appointments with an unrecognized customer name auto-create that customer (because `appointments.customer_id` is `NOT NULL`).

### Reporting
- FR-16: Dashboard shows KPIs via `get_dashboard_kpis` RPC.
- FR-17: Reports page shows revenue-by-staff, revenue-by-service, and appointments-per-day (last 30 days) via dedicated views.

### Billing
- FR-18: Subscriptions are managed through Flow.cl (`flow-create-subscription`, `flow-cancel-subscription`, `flow-webhook` for async confirmation).
- FR-19: Subscription status lifecycle: `trialing → active → cancelled/expired/pending_payment`; a scheduled function (`expire-subscriptions`) marks lapsed trials/subscriptions as `expired`.
- FR-20: Flow.cl's browser POST redirect is converted to a GET (`frontend/api/flow-return.js`) so the SPA router can handle it, then the billing page reads a `?billing=success` query param.

### Settings
- FR-21: Tenant owners can configure branding, invite/manage team members, and configure an optional AI provider (`ai_settings`: provider, base_url, model, api_key) for the smart-import feature. The `api_key` column has no `SELECT` grant for the `authenticated` role — it is write-only from the frontend's perspective.
- FR-22: Admins have a "Sentry test button" to manually verify error reporting is wired up correctly in a given environment (commit `6d70c4d`).

## Non-Functional Requirements

- NFR-1 (Security): RLS on every table; `SECURITY DEFINER` for sensitive RPCs; rate limiting on Edge Functions (`rate_limits` table + `_shared/rate-limit.ts`); CSP + standard security headers on every response (`frontend/vercel.json`); a documented security audit pass ("Cyber Neo") already applied (commit `8901fb3`).
- NFR-2 (Error UX): user-facing errors are always Spanish and stripped of internal detail (SQL state, constraint names) by `invokeEdgeFunction` before reaching the UI.
- NFR-3 (Observability): Sentry error boundary + custom metrics across auth, CRUD, import, and edge-function-duration events (`frontend/src/lib/monitoring.ts`); optional via `VITE_SENTRY_DSN` — the app must run fine without it configured.
- NFR-4 (Availability): CI must pass (typecheck, lint, test, build) on every push/PR to `main` before merge — no explicit uptime SLA defined beyond that gate.
- NFR-5 (PWA): the frontend is built as an installable PWA (`vite-plugin-pwa` dependency) — offline behavior/service worker scope not verified in this audit.

## ⚠️ Pendiente validación humana
- No formal acceptance criteria document existed prior to this audit (see [story-artifacts/ACCEPTANCE_CRITERIA.md](../story-artifacts/ACCEPTANCE_CRITERIA.md) for the reconstructed version).
- No documented non-functional targets for latency, uptime, or import file size limits.
