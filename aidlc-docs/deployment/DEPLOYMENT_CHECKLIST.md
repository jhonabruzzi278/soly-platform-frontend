# Deployment Checklist

## Pre-Deployment (verified state at analysis time, 2026-07-19)
- [x] Tests passing: `npm run test` → 2 files, 6 tests, all passed (verified by running it in this audit).
- [ ] Coverage measured: **not possible** — `@vitest/coverage-v8` missing. See [testing/TEST_COVERAGE_REPORT.md](../testing/TEST_COVERAGE_REPORT.md).
- [x] CI/CD configured: GitHub Actions, `.github/workflows/ci.yml` — typecheck → lint → test → build, on push/PR to `main`.
- [x] Secrets not committed to git: `.env` is not tracked; `backend/.env.example` and `frontend/.env.example` exist as templates with placeholder values only. `git status` at analysis time showed no `.env` file staged or tracked.
- [~] **Working tree was not clean at analysis time** — see below.
- [x] Security headers + CSP configured: `frontend/vercel.json` sets HSTS, X-Frame-Options, CSP scoped to actual third-party origins, Permissions-Policy, COOP/CORP.
- [x] SPA routing handled: `vercel.json` rewrite `"/(.*)" -> "/index.html"`.

## ⚠️ Uncommitted state observed during this audit (informational — not modified by this analysis)
- Modified: `CLAUDE.md`, `README.md`, `frontend/package.json`, `frontend/package-lock.json`
- Deleted (working tree): `backend/supabase/migrations/0026_fix_paginated_json_agg_with_ordinality.sql`
- Untracked: `backend/supabase/migrations/0027_fix_paginated_json_agg_with_ordinality.sql` (looks like a rename/rewrite of 0026), `es-openApiFlow (1).yaml` (Flow.cl OpenAPI reference doc), root `package.json`/`package-lock.json` (declares only `ecc-universal` — tooling, not app code)

This suggests a migration was renamed/renumbered and the Flow.cl integration work is still an active area — **recommend committing or resolving these before considering the repo deploy-clean.**

## Infraestructura Detectada
- No `Dockerfile` for the app itself (a `Dockerfile` exists only inside `node_modules/sql.js/.devcontainer/`, which is third-party tooling, not project infra).
- No `docker-compose.yml`, `terraform/`, or `k8s/` manifests found for the app — README describes an optional self-hosted Docker path for Supabase (`docker compose up -d` from `backend/`) but no compose file is committed to this repo; it's referenced as an external Supabase self-hosting step.
- Deployment is declarative-config-only: `frontend/vercel.json` (Vercel project config) + `backend/supabase/config.toml` (Supabase project config) + `.github/workflows/ci.yml`.

## Post-Deployment (not verified by this audit — requires live access)
- [ ] Confirm Flow.cl production credentials (`FLOW_API_KEY`, `FLOW_SECRET_KEY`, `FLOW_BUSINESS_PLAN_ID`) are set as Supabase Edge Function secrets — cannot be verified from the repo (see [operations/MONITORING_SETUP.md](../operations/MONITORING_SETUP.md)).
- [ ] Confirm `VITE_SENTRY_DSN` is set in the Vercel production environment (optional — app runs without it, but observability requires it).
- [ ] Confirm the `excel-files` Storage bucket exists and is private in the target Supabase project (migration `0006` sets up RLS for it, but bucket creation itself is a manual Supabase dashboard step per the README).
