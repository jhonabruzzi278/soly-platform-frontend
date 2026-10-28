# Acceptance Criteria

Reconstructed from actual implemented behavior (RLS test suite, code paths, and bug-fix commits that codified specific expected behavior). These describe **what the system currently does and is verified to do**, not aspirational criteria.

## Multi-tenant isolation (verified — `backend/supabase/tests/rls_robustness_test.sql`)
- Given a user in tenant A, when they query `customers`/`appointments`/`services`/`memberships`/`tenants`/`subscriptions`, then they see **only** tenant A's rows (T1–T7).
- Given a user in tenant A, when they attempt to `INSERT` a row tagged with tenant B's id, then the insert is denied (T8–T9).
- Given a `member` role, when they add a customer, then it succeeds; when they add an appointment, then it is denied (T10–T14 — role differentiation is real, not just UI-hidden).
- Given a `viewer` role, when they attempt any write, then it is denied.
- Given a non-owner/non-admin, when they attempt to delete a customer or appointment, then it is denied.
- Given a plan without a feature enabled, when a tenant on that plan attempts to write data gated by that feature, then it is denied at the DB level (T15) — not just hidden in the UI.
- Given an anonymous (unauthenticated) caller, when they call a privileged RPC or query `rate_limits` directly, then access is denied (T16–T18).

## Import (verified via `frontend/src/features/files/importData.test.ts`)
- Given a CSV with a Chilean-formatted number like `12.000`, when parsed, then it is read as twelve thousand, not twelve (requires `raw: true` in SheetJS — a specific historical bug).
- Given `dry_run: true`, when import runs, then no rows are written to the DB; only the proposed mapping is returned.
- Given an appointment row referencing a customer name not yet in the DB, when imported, then that customer is auto-created (because `appointments.customer_id` is `NOT NULL`).
- Given an AI-mapped column, when the AI returns a column name, then it is rejected unless it exists in the whitelist (structural defense against prompt injection via spreadsheet content).

## Billing (verified via commit history — these were each a real bug that got fixed)
- Given Flow.cl's payment confirmation POST redirect, when it hits `frontend/api/flow-return.js`, then the user is redirected via GET to `/billing?billing=success` (fixed in `eae16b1`).
- Given a subscription in `pending_payment` (direct pay, not trial), when checked, then it's a valid status accepted by the DB constraint (fixed in `79e2c37`).
- Given a one-time payment (no underlying Flow subscription), when `flow-cancel-subscription` is called, then it does not throw (fixed in `ee21dda`).

## Dashboard / customer table rendering (verified via bug-fix commits)
- Given a customer with no appointments, when rendered in the customer table, then "Citas" (appointments count) shows correctly instead of `undefined` (fixed in `abd2ff0`).
- Given a paginated table with more than 50 rows, when a row is targeted for delete, then its `id` resolves correctly (previously broken by `json_agg(...) WITH ORDINALITY` returning `{value, ordinality}` instead of the plain row — fixed in migration `0026`/`0027`).

## ⚠️ Pendiente validación humana
- No acceptance criteria exist for NFRs (performance under load, max import file size, concurrent-user behavior).
- No criteria exist for PWA offline behavior.
