# ADR-001: Enforce multi-tenancy and authorization at the database layer (RLS), not in application middleware

## Status
Accepted (implemented, reconstructed from code — no original ADR existed)

## Context
Soly is a multi-tenant SaaS where multiple businesses ("tenants") share the same Postgres instance and the same Supabase project. A tenant must never be able to read or write another tenant's data, even in the presence of a bug in frontend code or a compromised anon key.

## Decision
Every tenant-scoped table carries a `tenant_id` column, and Row Level Security (RLS) policies enforce isolation directly in Postgres. Role-based permissions (`owner/admin/member/viewer`) are also enforced via RLS policy conditions, not via application-layer checks. Sensitive cross-cutting RPCs (`get_user_session`, `has_active_subscription`) run as `SECURITY DEFINER` to safely read data the calling role couldn't otherwise see directly.

## Evidence this is a deliberate, hardened decision (not incidental)
- A dedicated, from-scratch test suite (`backend/supabase/tests/rls_robustness_test.sql`) asserts 21 specific isolation/role/feature-gating properties, entirely in SQL, self-rolling-back so it never pollutes data.
- Migrations `0015_security_critical_fixes.sql`, `0016_lock_down_rls_and_function_execution.sql`, `0017_set_function_search_path.sql`, `0019_revoke_function_execute_from_anon.sql` show an explicit hardening pass distinct from the original feature migrations — i.e., this was revisited and tightened after initial implementation, not just written once.
- `ai_settings.api_key` uses a column-level Postgres grant (no `SELECT` for `authenticated`) rather than relying on the frontend to simply not query it — the same "push the guarantee as low as possible" philosophy applied to a secret, not just to tenant isolation.

## Consequences
- **Positive:** isolation holds even if the frontend has a bug, since the bad query is rejected by Postgres itself, not merely hidden by app logic.
- **Positive:** the RLS test suite can validate the security boundary without needing to run the full frontend/Edge Function stack.
- **Negative / trade-off:** RLS policy logic (especially role-gating and feature-gating conditions) is harder to unit-test with normal application test tooling and requires SQL fluency to modify safely — evidenced by three separate rollup-trigger bugs (migrations `0022`, `0025`, `0026`/`0027`) that were all subtle interactions between triggers/RLS and specific query shapes (`json_agg ... WITH ORDINALITY`, cascade delete ordering).
- **Negative / trade-off:** performance-sensitive RLS conditions needed a dedicated pass (`0018_rls_perf_fk_indexes_and_private_bucket.sql`) to add supporting indexes — RLS predicates are not free.

## Alternatives considered (inferred, not documented)
- Application-layer tenant scoping (e.g., a middleware that injects `WHERE tenant_id = ?` into every query) — rejected implicitly in favor of RLS, likely because it's weaker against any code path that forgets the filter.
