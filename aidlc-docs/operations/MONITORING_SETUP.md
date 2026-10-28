# Monitoring Setup

## What's real and verified in code (2026-07-19)

- **Error tracking:** `@sentry/react` ^10.58.0, initialized in `frontend/src/main.tsx`, gated by `VITE_SENTRY_DSN` (optional — app works without it, per `CLAUDE.md` convention: "omit disables the SDK").
- **Error boundary:** wired per commit `2d27495: feat(monitoring): complete Sentry setup — error boundary, user context, CSP fix`.
- **User context attached to errors:** referenced in `frontend/src/app/auth.tsx` (Sentry import present) — so errors can be correlated to a tenant/user, not just anonymous stack traces.
- **Custom business metrics** (`frontend/src/lib/monitoring.ts`): a `track` object wrapping `Sentry.metrics.count`/`distribution` for:
  - Auth: `auth.login.{ok|fail}`, `auth.signup`
  - Session load time: `session.load_ms.{db|metadata}`
  - Customers: created, deleted, bulk-deleted (+ bulk size distribution)
  - Appointments: created, updated
  - Import: completed (rows imported/skipped distributions), failed
  - Edge functions: `edge_fn.{name}.{ok|fail}_ms` duration distribution
  - Billing: subscription started/cancelled
- **Manual verification tool:** a Sentry test button exists in Settings for admins (commit `6d70c4d`) to confirm error reporting actually reaches Sentry in a given deployed environment.
- **CSP allows Sentry ingest:** `frontend/vercel.json` CSP `connect-src` includes `https://o4511588385882112.ingest.us.sentry.io` — without this the SDK would silently fail to report in production (this was itself a bug that got fixed, per commit `1be304b: fix(csp): allow Sentry ingest in connect-src`).

## What's NOT verified (requires access this audit doesn't have)
- ⚠️ Whether `VITE_SENTRY_DSN` is actually set in the live Vercel production environment (env vars are not in the repo).
- ⚠️ Whether Sentry alert rules (who gets paged, on what threshold) are configured on the Sentry dashboard side — none of that is code, so it can't be audited from the repo.
- ⚠️ Whether `FLOW_API_KEY`/`FLOW_SECRET_KEY`/`FLOW_BUSINESS_PLAN_ID` are set as live Supabase Edge Function secrets. A 37-day-old note from a prior analysis session claimed they were NOT set as of that date (app usable only via trial). The Flow.cl integration code itself has since been substantially rewritten to match the real API (HMAC-SHA256 signing, correct `flow.cl`/`sandbox.flow.cl` endpoints — verified in this audit by reading `backend/supabase/functions/_shared/flow.ts`), so the code is no longer "non-functional scaffolding," but **whether real credentials are configured is still unverifiable from the repo** and needs direct confirmation from whoever manages the Supabase project secrets.
- No structured/centralized **log aggregation** beyond whatever Vercel's and Supabase's own dashboards provide by default — no log shipping to a third party found.
- No uptime/synthetic monitoring (no Pingdom/UptimeRobot/Checkly config or reference found).

## Recommendation
Confirm the two items above directly (Vercel env var presence, Supabase Edge Function secrets) rather than assuming either state — this is the single highest-value fact to nail down for Operations maturity, since it determines whether real payments can currently succeed in production.
