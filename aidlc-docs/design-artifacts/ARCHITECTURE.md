# Architecture Overview

## Estructura del Proyecto

```
soly/
├── frontend/                    # React SPA/PWA — deployed on Vercel
│   ├── src/
│   │   ├── app/                 # Provider tree, router, auth context
│   │   ├── components/          # Shared UI
│   │   ├── contexts/            # TenantContext
│   │   ├── features/            # auth, dashboard, customers, appointments,
│   │   │                        # reports, billing, files, settings (8 modules)
│   │   ├── hooks/                # useCustomers, useAppointments, useDashboardKpis…
│   │   └── lib/                  # supabase.ts, api.ts, types.ts, features.ts, monitoring.ts
│   ├── api/flow-return.js       # 1 Vercel Serverless Function — Flow.cl POST→GET adapter
│   └── vercel.json               # security headers, CSP, SPA rewrite rule
│
├── backend/
│   └── supabase/
│       ├── migrations/          # 27 sequential SQL files, domain-grouped
│       ├── functions/            # 8 Deno Edge Functions + _shared/ (cors, rate-limit, flow client, utils)
│       ├── tests/rls_robustness_test.sql   # 21-assertion multi-tenant isolation test (self-rolling-back, no pgTAP)
│       └── config.toml
│
├── .github/workflows/ci.yml     # typecheck → lint → test → build, on push/PR to main
├── CLAUDE.md                     # AI-agent-facing architecture guide (very complete, kept in sync with code)
└── README.md                     # Human-facing architecture guide + replication guide (very complete)
```

Note: `backend/.env.example` and `frontend/.env.example` both exist and are the actual source of truth for required environment variables — more reliable than inferring from code.

## Tech Stack

| Layer | Tech | Justification (inferred) | Source |
|---|---|---|---|
| UI | React 18 + Vite + Tailwind | Fast dev loop, small bundle, common in solo/small-team SaaS | package.json |
| State: server | TanStack Query | Cursor pagination via `useInfiniteQuery` fits the RPC pagination pattern | code |
| State: tenant/session | React Context (no external store) | App is small enough that Context suffices; no Redux/Zustand present | code |
| DB + Auth + Storage | Supabase | Gets Postgres, RLS, Auth, Storage, and Edge Functions in one vendor — minimizes infra surface for a solo developer | README, migrations |
| Compute | Supabase Edge Functions (Deno) | Colocated with the DB, no separate server to operate | functions/ |
| Payments | Flow.cl | Chilean-market-specific gateway; README explicitly earmarks it as the one piece to swap for international replication | README |
| Hosting | Vercel | Zero-config Vite deploys + trivial Serverless Function for the Flow POST→GET adapter | vercel.json |
| Observability | Sentry | Recently added (last 5 commits at analysis time) — error boundary + custom business metrics | monitoring.ts |
| CI | GitHub Actions | Single job, four sequential gates, no matrix/parallelism — appropriate for current project size | ci.yml |

## Decisiones Arquitectónicas Detectadas

- **Monolith, not microservices** — one frontend app, one Postgres schema, thin stateless Edge Functions. Appropriate for current scale (solo developer, single product surface).
- **Sync request/response, not event-driven** — no message queue, no pub/sub in use (Supabase Realtime is available but not wired into any feature found). The closest thing to an event is a Postgres trigger (rollup maintenance) or a webhook (`flow-webhook`).
- **Database as the security boundary** — RLS + `SECURITY DEFINER` RPCs do the authorization work that in many stacks would live in an API gateway or middleware layer. See [[ADR-001-database-enforced-multitenancy]].
- **Shared multi-product schema** — the `tenants.product` column and archive tables for `services`/`inventory_*` (unused by Soly's current frontend) indicate this schema was designed to serve more than one product (see [[DOMAIN_MODEL]] "Bounded Context: Schema Present But Unused").
- **Trial-first billing** — every signup gets a 14-day trial automatically (DB-level, migration `0023`), decoupling "can the user use the product" from "is the payment gateway correctly configured" — a deliberate resilience choice given Flow.cl integration went through multiple rewrites (commits `537f6b7` → `323c235` → `b12dbc2` → `40a2ad2`).
- **CSP is real, not a stub** — `frontend/vercel.json`'s CSP explicitly allowlists only the exact third-party origins in use (Supabase, Flow prod+sandbox, Sentry ingest, Google Fonts) rather than a broad `'unsafe-inline'`/wildcard policy — indicates a genuine security pass occurred (matches commit `8901fb3: security: implement Cyber Neo audit fixes`).
