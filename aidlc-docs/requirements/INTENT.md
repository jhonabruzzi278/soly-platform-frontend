# Project Intent

## High-Level Purpose

Soly is a multi-tenant CRM SaaS PWA built for service businesses (barbershops, spas, salons — see `README.md`: *"CRM SaaS PWA multi-tenant para negocios de servicios (barberías, spas, salones)"*). It manages customers and appointments, gives owners revenue/occupancy reporting, and is explicitly designed to be **a replicable template for building other B2B SaaS products** (README section "Adaptarlo a otro SaaS" — swap the domain entities, payment gateway, and branding to spin up a new product on the same multi-tenant foundation).

This dual purpose — a working CRM product AND a reusable SaaS starter kit — is a real, extracted intent, not an inference: it's the entire final third of the README.

## Business Objectives

Extracted from the codebase and commit history:
- Let a service business (barbershop/spa/salon) manage customers and appointments without spreadsheets, including bulk-importing existing customer/appointment data from Excel/CSV (`import-data` Edge Function, AI-assisted column mapping).
- Give the business owner visibility into revenue and appointment volume (`vw_revenue_by_barber`, `vw_revenue_by_service`, `vw_appointments_per_day`, dashboard KPIs).
- Monetize via recurring subscription billing through Flow.cl (Chilean payment gateway), with a 14-day free trial to keep the product usable while billing is validated (migration `0023_signup_unique_slug_and_auto_trial.sql`).
- Support team collaboration per business via role-based membership (`owner/admin/member/viewer`) and email invitations.
- ⚠️ No documented long-term business objective (target market size, revenue goal, exit criteria) — requires input from the product owner.

## Success Metrics

⚠️ Not documented anywhere in the repo — no analytics dashboard, no OKR file, no growth targets. Sentry custom metrics (`frontend/src/lib/monitoring.ts`) track *product usage events* (logins, signups, customers created, imports completed, subscriptions started/cancelled) which could become the basis for success metrics, but no targets or thresholds are defined against them. **Pendiente validación humana.**

## Constraints

### Technical
- Frontend: React 18 + Vite + TailwindCSS, deployed as a PWA on Vercel.
- Backend: Supabase (PostgreSQL 17, self-hostable or cloud) with Row Level Security as the sole tenant-isolation mechanism — every table carries `tenant_id` and RLS policies; there is no separate authorization layer.
- Edge Functions run on Deno (Supabase's runtime), not Node — shared code in `_shared/` must be Deno-compatible (`npm:` specifier imports).
- Payment gateway is Chilean-specific (Flow.cl, CLP currency) — the README explicitly flags this as the one piece to swap for international replication ("reemplazable por Stripe").
- Single Vercel Serverless Function (`frontend/api/flow-return.js`) exists solely to convert Flow.cl's POST-based redirect into a GET, because Vercel/SPA routing can't otherwise handle a payment gateway's server-side POST callback.

### Business
- Single pricing plan today ("Soly Business", flat CLP/month — see commit `63ef1aa: simplify to single Soly Business plan`). The multi-plan `FeatureGate`/`plan_features` machinery exists in code but is currently unused — built for forward compatibility, not because multiple plans exist yet.
- User-facing language is Spanish only (error messages, UI copy) — this is a hard convention documented in `CLAUDE.md`, not just an inference.
- ⚠️ No documented compliance requirements (data residency, PCI scope beyond what Flow.cl's hosted redirect already offloads) — pendiente validación humana.
