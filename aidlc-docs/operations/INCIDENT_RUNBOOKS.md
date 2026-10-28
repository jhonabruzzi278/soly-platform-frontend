# Incident Runbooks

## Status: ⚠️ No formal runbooks exist. This file reconstructs *de facto* runbooks from real historical incidents (bug-fix commits) — treat as a starting point, not a validated procedure.

## Known-issue playbook (from `README.md`'s own "Bugs conocidos resueltos" table + commit history)

### "Deleting a customer with appointments returns 400"
- **Cause:** the `refresh_customer_rollup` trigger failed when the customer no longer existed mid-cascade-delete.
- **Fix applied:** migration `0025_fix_rollup_on_customer_delete.sql`.
- **If it recurs:** check trigger execution order on cascade deletes before assuming an application-layer bug.

### "`r.id = undefined` in a paginated table once it exceeds ~50 rows, and deletes 400"
- **Cause:** `json_agg(elem) WITH ORDINALITY` was returning `{value, ordinality}` wrapper objects instead of the plain row object once pagination kicked in.
- **Fix applied:** migration `0026`→`0027_fix_paginated_json_agg_with_ordinality.sql` (note: `0026` was deleted and `0027` is its untracked replacement at analysis time — likely a rename/rework still in progress).
- **If it recurs:** check every RPC using `json_agg(... ) WITH ORDINALITY` for the same shape mismatch — this pattern likely repeats across `get_customers_paginated` and `get_appointments_paginated`.

### "Flow.cl billing looked broken / payment gateway didn't appear"
- **History:** this integration was rewritten at least 3 times (`537f6b7` initial → `b51224c` rewrite → `323c235` "complete integration rewrite based on OpenAPI spec" → `40a2ad2` "use /payment/create for direct pay"). If billing issues recur, **do not assume it's a simple config problem** — check which Flow.cl endpoint/flow (subscription vs. one-time payment vs. direct pay) is actually in play, since the API surface is large (subscriptions, customers, plans, refunds — see `_shared/flow.ts` types) and past bugs were about using the wrong endpoint/flow, not just wrong credentials.
- **Related fix:** `flow-cancel-subscription` must not throw when called against a one-time payment that has no underlying Flow subscription (`ee21dda`).
- **Related fix:** Flow's browser POST redirect must be converted to GET by `frontend/api/flow-return.js`, or the SPA router 404s (`eae16b1`, `b12dbc2`).

### "RLS infinite recursion" (historical, from early commits)
- **Cause:** an RLS policy that queried a table protected by another RLS policy referencing back to it, in a way that recursed.
- **Fix pattern used:** `SECURITY DEFINER` helper functions to break the recursion (see `get_user_session`, `has_active_subscription`).
- **If it recurs:** any new RLS policy that needs to check membership/role should call a `SECURITY DEFINER` helper rather than querying `memberships` directly from within another table's policy.

## Genuine gaps (no runbook exists for these)
- **Total Supabase project loss / need to rebuild from scratch** — no tested disaster-recovery runbook; the README's "Setup local" section is the closest thing but has never been validated as a full DR drill (see [deployment/INFRASTRUCTURE_AS_CODE.md](../deployment/INFRASTRUCTURE_AS_CODE.md)).
- **Sentry/alerting is silent** — no documented "if Sentry pages you at 3am, do X" procedure.
- **No on-call rotation** — solo-developer project; if the owner is unavailable, there is no documented fallback.

⚠️ **Pendiente validación humana** for all of the above gaps.
