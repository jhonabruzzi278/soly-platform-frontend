# Post-Mortems

No formal post-mortem documents exist yet. ⚠️ Pendiente — genuinely absent, not dispersed elsewhere.

Several real production incidents are reconstructable from commit history (see [../INCIDENT_RUNBOOKS.md](../INCIDENT_RUNBOOKS.md) for the list — customer-delete 400s, paginated-table row-id bugs, multiple Flow.cl billing breakages, RLS infinite recursion). None of these have a written post-mortem (root cause, timeline, prevention follow-up) — they exist only as terse fix commits. Writing retroactive post-mortems for the highest-impact ones (especially the repeated Flow.cl billing breakages) would be a reasonable next step once the product owner has bandwidth.

When the first real post-mortem is written, name it `POST_MORTEM_<YYYY-MM-DD>_<short-slug>.md` in this directory.
