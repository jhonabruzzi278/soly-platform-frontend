# Domain Model (DDD-ish)

Extracted directly from `backend/supabase/migrations/000{1..5,9,24}*.sql` and `frontend/src/lib/types.ts`. This is a **relational** domain model (no application-layer DDD framework), but the tables map cleanly onto aggregates.

## Bounded Context: Multi-Tenant Platform Core

This context exists in every product built on this schema (Soly and, per commit history, a sibling "Logify" product).

- **Aggregate Root: Tenant** (`tenants`) — id, slug, business_name, business_subtitle, plan, product, is_active. The `product` column is the tell: this schema is intentionally shared across more than one product line.
- **Entity: Membership** (`memberships`) — composite identity (`tenant_id`, `user_id`); Value Object `org_role` enum (`owner`, `admin`, `member`, `viewer`) reused everywhere as the authorization primitive.
- **Entity: Profile** (`profiles`) — public user data (name/email), 1:1 with Supabase `auth.users`.
- **Value Objects:** `tenant_seats` (seat count/limit per tenant), `tenant_products` (which products a tenant has provisioned), `allowed_emails` (invite/allowlist gate).

## Bounded Context: CRM Domain (Soly's active feature set)

- **Aggregate Root: Customer** (`customers`) — id, name, email, phone, company, notes, tags[], plus **derived rollup fields** `total_spent`, `total_appointments`, `last_appointment_at`, `next_appointment_at` maintained by DB triggers (not computed at read time — see `LOGICAL_DESIGN.md`).
- **Entity: Appointment** (`appointments`) — references `customer_id` (NOT NULL — an appointment cannot exist without a customer, which is why import auto-creates missing customers), optional `barber_id`.
- **Repository pattern (SQL views, not code):** `vw_appointments_enriched` denormalizes customer/staff names into the appointment row for read paths — the "repository" here is a Postgres view, not an application-layer class.
- **Domain Events:** none in the application-event-bus sense. The closest equivalent is DB triggers (e.g., the customer rollup trigger fires on appointment insert/update/delete) — implicit, not explicit, events.

## Bounded Context: Schema Present But Unused by Soly's Frontend

Found in migration `0003_domain_crm.sql` but **no corresponding `frontend/src/features/` module exists** for these — likely built for the sibling product or a planned-but-not-shipped feature:

- `services` (a catalog entity — service name/price/duration, referenced by `appointments.service_name` conceptually but not FK'd based on `AppointmentEnriched.service_name` being a plain string)
- `inventory_products`, `inventory_movements` (stock tracking — no `src/features/inventory/` exists)

⚠️ **Pendiente validación humana:** confirm whether `services`/`inventory_*` are (a) dead schema kept for the sibling "Logify" product, (b) a planned Soly feature not yet built, or (c) genuinely dead and safe to drop from Soly's copy of the schema.

## Bounded Context: Billing

- **Aggregate Root: Subscription** (`subscriptions`) — status lifecycle `trialing → active → cancelled | expired | pending_payment`, tied to `product` + `plan`, `provider` (Flow.cl today), `provider_subscription_id`.
- **Entity: BillingCustomer** (`billing_customers`) — the tenant's representation in the payment provider's system (Flow.cl `customerId`).
- **Entity: BillingWebhookEvent** (`billing_webhook_events`) — audit log of inbound webhook deliveries from the payment provider (idempotency/replay defense).

## Bounded Context: Platform Configuration

- **Entity: AiSettings** (`ai_settings`) — per-tenant AI provider config (`provider`, `base_url`, `model`, write-only `api_key`). See [[soly-smart-import-architecture]] pattern: AI is a fallback mapper, never given tool access or DB access directly.
- **Entity: PlanFeatures** (`plan_features`) — feature flags per plan; currently trivial (one plan, all features on) but structurally ready for multi-plan.
- **Entity: RateLimits** (`rate_limits`) — sliding-window throttle state per key, enforced in Edge Functions.
