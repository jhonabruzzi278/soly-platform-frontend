# Infrastructure as Code

## What exists
| Artifact | Scope | Notes |
|---|---|---|
| `backend/supabase/migrations/*.sql` (27 files) | Database schema, RLS, triggers, functions | This *is* the IaC for the data layer — applied via `supabase db push` or manually. Fully version-controlled and sequential. |
| `backend/supabase/config.toml` | Supabase project config | Local Supabase CLI project settings. |
| `frontend/vercel.json` | Vercel project config (build command, rewrites, security headers) | Declarative, version-controlled — this is real IaC for the frontend hosting layer. |
| `.github/workflows/ci.yml` | CI pipeline | Version-controlled, single job. |
| `backend/.env.example`, `frontend/.env.example` | Required environment variables | Templates only — actual secrets are not and should not be in the repo. |

## What does NOT exist
- No Terraform/Pulumi/CloudFormation — infra provisioning (creating the Supabase project itself, the Storage bucket, Vercel project linking) is a **manual, one-time, dashboard-driven process** per the README's setup instructions, not codified.
- No Dockerfile/docker-compose for the app's own runtime (only a third-party one inside `node_modules/sql.js/`, irrelevant to this project). The README documents an *optional* self-hosted Postgres path via Supabase's own Docker tooling, but that compose file isn't part of this repo.
- No infra-level monitoring/alerting-as-code (e.g., no Terraform-managed Sentry alert rules, no Vercel monitoring config beyond what the dashboard provides by default).

## Assessment
This project's "IaC" is deliberately minimal and vendor-native: Supabase migrations + `vercel.json` + a single CI file cover the reproducible parts, while project *creation* (new Supabase project, new Vercel project, Storage bucket, secrets) remains a manual runbook (the README's "Setup local" section functions as that runbook today). This is a reasonable trade-off for a solo-developer project at this stage, but it means **disaster recovery (rebuilding the whole stack from scratch) has never been automated or tested end-to-end** — flagged in [operations/INCIDENT_RUNBOOKS.md](../operations/INCIDENT_RUNBOOKS.md) as a gap.
