# Test Coverage Report

## Measured (this audit, 2026-07-19)

Ran directly against `frontend/` in this session:

```
npm run test
 Test Files  2 passed (2)
      Tests  6 passed (6)
   Duration  10.90s
```

```
npm run test:coverage
 MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'
```

**Coverage percentage: not measurable in this environment** — the coverage provider dependency is not installed, so no `%` figure is reported here. Per this audit's rules, no number is invented. To get a real figure:
```bash
cd frontend
npm install -D @vitest/coverage-v8
npm run test:coverage
```

## What the 6 passing tests cover
Only 2 test files exist in the entire frontend (`src/features/files/importData.test.ts`, `src/hooks/useDashboardKpis.test.tsx`) against 8 feature modules and a 550-line `lib/api.ts`. Even without a coverage tool, it's safe to say line/branch coverage is low relative to the ECC global rule target of 80% minimum — this is a genuine, large gap, not a measurement artifact.

## Database-side coverage
`backend/supabase/tests/rls_robustness_test.sql` covers 21 specific assertions around multi-tenant isolation, role gating, and feature gating — this is comprehensive *for that specific concern* but is a separate, manually-run suite, not reflected in any frontend coverage number.

## Gaps Identified
See [TEST_STRATEGY.md](./TEST_STRATEGY.md) for the full list. Summary: Edge Functions (0 tests), `lib/api.ts` (0 tests), most `features/` modules (0 tests beyond files/dashboard).
