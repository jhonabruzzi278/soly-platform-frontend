# Test Strategy

## Frameworks Detected
- **Frontend:** Vitest ^4.1.8 + `@testing-library/react` + `@testing-library/user-event` + jsdom. Setup file: `frontend/src/test/setup.ts`. Tests live alongside the code they test (e.g., `src/features/files/importData.test.ts`, `src/hooks/useDashboardKpis.test.tsx`), per the convention documented in `CLAUDE.md`.
- **Database:** a hand-written SQL test suite (`backend/supabase/tests/rls_robustness_test.sql`) — no pgTAP dependency. It sets up two tenants with owner/member/viewer users, switches JWT context per-user via `SET LOCAL ROLE` + `request.jwt.claims`, runs 21 assertions, and always rolls back so it never persists test data even on success. Run via `psql "<DATABASE_URL>" -f backend/supabase/tests/rls_robustness_test.sql` or pasted into the Supabase SQL Editor.
- **E2E:** none found (no Playwright/Cypress config, no `e2e/` directory).

## What's actually tested today
- Import logic (`importData.test.ts`): Chilean number parsing (`raw: true` in SheetJS), dry-run behavior, dedup, AI-mapping whitelist validation.
- Dashboard KPI hook (`useDashboardKpis.test.tsx`).
- Multi-tenant RLS isolation, role gating, feature gating, and function/relation lockdown — 21 assertions, run manually against a real Postgres instance (not part of the automated CI pipeline based on `ci.yml`, which only runs the frontend job).

## Gaps Identified (genuine, not just unmeasured)
- **No E2E tests** for the golden paths this session's environment rules call out as mandatory to verify manually (login, customer CRUD, appointment booking, billing flow, import flow).
- **No unit tests** for `frontend/src/lib/api.ts` (550 lines — the entire RPC/table/storage call surface) or `frontend/src/lib/supabase.ts` (`invokeEdgeFunction` error normalization).
- **No tests for any Edge Function** (`create-organization`, `flow-create-subscription`, `flow-cancel-subscription`, `flow-webhook`, `invite-member`, `expire-subscriptions`, `health`) — the Flow.cl integration in particular has been rewritten multiple times (see commit history) with no regression test protecting it.
- **RLS test suite is not wired into CI** — `ci.yml` only runs the frontend job (`npm run test`), which cannot reach `rls_robustness_test.sql`. It must currently be run manually against a live DB.
- **Coverage tool not installed** — `npm run test:coverage` fails with `MISSING DEPENDENCY '@vitest/coverage-v8'` (verified by running it in this audit). See [TEST_COVERAGE_REPORT.md](./TEST_COVERAGE_REPORT.md).

## Recommendation (not yet actioned — pendiente)
1. Install `@vitest/coverage-v8` and set a real coverage baseline before adding a coverage gate to CI.
2. Add a CI job (or step) that spins up a disposable Postgres/Supabase instance and runs `rls_robustness_test.sql` automatically — this is the highest-value test in the repo and currently the least protected by automation.
3. Prioritize Edge Function tests for `flow-*` given its rewrite history — a regression here breaks the entire billing flow silently.
