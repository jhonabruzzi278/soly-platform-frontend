# Soly Platform — Database Architecture

## Overview

PostgreSQL 15 via Supabase. Multi-tenant SaaS with Row Level Security.

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Multi-tenant isolation** | Every table has `tenant_id` FK to `tenants` |
| **Row Level Security** | All tables enforce `tenant_id` matching via RLS policies |
| **UUID primary keys** | `gen_random_uuid()` — no sequential exposure |
| **Timestamps** | `timestamptz` (UTC) — timezone-aware |
| **Soft deletes** | Not used. Auditable via `created_at`/`updated_at` |
| **Naming** | `snake_case` tables/columns, plural table names |
| **Indexes** | FK columns, search columns, date columns, status |
| **Constraints** | FK with `on delete`, `CHECK`, `UNIQUE`, `NOT NULL` |
| **Migrations** | Declarative SQL, idempotent (`if not exists`) |

---

## Schema Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUTH (Supabase)                               │
│  auth.users ──── handles auth, JWT, sessions                        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ 1:1
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│  profiles                                                             │
│  ┌─────────────┬────────────┬──────────────────────────────────────┐ │
│  │ id          │ uuid PK    │ → auth.users(id) ON DELETE CASCADE   │ │
│  │ email       │ citext UQ  │ login email                          │ │
│  │ full_name   │ text       │ display name                         │ │
│  │ role        │ user_role  │ admin | barber | operator            │ │
│  │ is_active   │ boolean    │ DEFAULT true                         │ │
│  │ tenant_id   │ uuid FK    │ → tenants(id) ON DELETE SET NULL     │ │
│  │ created_at  │ timestamptz│                                      │ │
│  │ updated_at  │ timestamptz│                                      │ │
│  └─────────────┴────────────┴──────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  tenants (root entity)                                                │
│  ┌────────────────────┬───────────┬────────────────────────────────┐ │
│  │ id                 │ uuid PK   │ gen_random_uuid()              │ │
│  │ slug               │ text UQ   │ URL-friendly identifier        │ │
│  │ business_name      │ text NN   │ company name                   │ │
│  │ business_subtitle  │ text      │ tagline                        │ │
│  │ plan               │ plan_name │ starter|pro|business|enterprise│ │
│  │ product            │ text      │ 'soly'|'logify' DEFAULT 'soly' │ │
│  │ flow_subscription_id│ text     │ Flow.cl subscription ID         │ │
│  │ flow_customer_email │ text     │ Flow.cl payer email             │ │
│  │ is_active          │ boolean   │ DEFAULT true                    │ │
│  │ created_at         │ timestamptz│                                │ │
│  │ updated_at         │ timestamptz│ auto via trigger               │ │
│  └────────────────────┴───────────┴────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  memberships (N:M user↔tenant)                                        │
│  ┌──────────────┬──────────┬───────────────────────────────────────┐ │
│  │ tenant_id    │ uuid PK  │ → tenants(id) ON DELETE CASCADE       │ │
│  │ user_id      │ uuid PK  │ → auth.users(id) ON DELETE CASCADE    │ │
│  │ role         │ org_role │ owner|admin|member|viewer             │ │
│  │ created_at   │ timestamptz│                                     │ │
│  └──────────────┴──────────┴───────────────────────────────────────┘ │
│  PK: (tenant_id, user_id)                                             │
│  UNIQUE constraint prevents duplicate membership                      │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  tenant_seats (active seat tracking)                                  │
│  ┌──────────────┬──────────┬───────────────────────────────────────┐ │
│  │ tenant_id    │ uuid PK  │ → tenants(id) ON DELETE CASCADE       │ │
│  │ user_id      │ uuid PK  │ → auth.users(id) ON DELETE CASCADE    │ │
│  │ is_active    │ boolean  │ DEFAULT true                           │ │
│  │ assigned_at  │ timestamptz│ DEFAULT now()                       │ │
│  └──────────────┴──────────┴───────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  tenant_products (product enablement per tenant)                      │
│  ┌──────────────┬──────────┬───────────────────────────────────────┐ │
│  │ tenant_id    │ uuid PK  │ → tenants(id) ON DELETE CASCADE       │ │
│  │ product_key  │ text PK  │ 'soly'|'logify'                        │ │
│  │ enabled_at   │ timestamptz│                                     │ │
│  └──────────────┴──────────┴───────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  customers                                                            │
│  ┌──────────────────┬──────────┬───────────────────────────────────┐ │
│  │ id               │ uuid PK  │                                    │ │
│  │ name             │ text NN  │ full name                          │ │
│  │ email            │ text     │ primary email                      │ │
│  │ phone            │ text     │ primary phone                      │ │
│  │ company          │ text     │ company/employer                   │ │
│  │ notes            │ text     │ internal notes                     │ │
│  │ tags             │ text[]   │ labels DEFAULT '{}'                │ │
│  │ total_spent      │ numeric  │ rollup from appointments           │ │
│  │ total_appts      │ integer  │ rollup from appointments           │ │
│  │ last_appointment │ timestamptz│ computed                         │ │
│  │ next_appointment │ timestamptz│ computed                         │ │
│  │ tenant_id        │ uuid FK  │ → tenants(id) ON DELETE SET NULL  │ │
│  │ created_at       │ timestamptz│                                  │ │
│  │ updated_at       │ timestamptz│                                  │ │
│  └──────────────────┴──────────┴───────────────────────────────────┘ │
│  Indexes: name, email, tenant_id                                      │
│  Metrics (total_spent, total_appts) computed via trigger              │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  appointments                                                         │
│  ┌──────────────────┬──────────┬───────────────────────────────────┐ │
│  │ id               │ uuid PK  │                                    │ │
│  │ customer_id      │ uuid FK  │ → customers(id) ON DELETE CASCADE │ │
│  │ barber_id        │ uuid FK  │ → profiles(id) ON DELETE SET NULL │ │
│  │ appointment_date │ date NN  │ YYYY-MM-DD                         │ │
│  │ appointment_time │ time NN  │ HH:MM:SS                           │ │
│  │ service_name     │ text NN  │ service description                │ │
│  │ cost             │ numeric  │ DEFAULT 0                          │ │
│  │ status           │ text NN  │ pending|confirmed|cancelled|...    │ │
│  │ comments         │ text     │                                    │ │
│  │ tenant_id        │ uuid FK  │ → tenants(id) ON DELETE SET NULL  │ │
│  │ created_at       │ timestamptz│                                  │ │
│  │ updated_at       │ timestamptz│                                  │ │
│  └──────────────────┴──────────┴───────────────────────────────────┘ │
│  Indexes: customer_id, barber_id, date, status, tenant_id            │
│  Trigger: after insert/update/delete → refresh_customer_rollup()    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  services                                                             │
│  ┌──────────┬──────────┬───────────────────────────────────────────┐ │
│  │ id       │ uuid PK  │                                           │ │
│  │ name     │ text NN  │ service name                              │ │
│  │ price    │ numeric  │ DEFAULT 0                                 │ │
│  │ tenant_id│ uuid FK  │ → tenants(id) ON DELETE SET NULL         │ │
│  │ created_at│timestamptz│                                         │ │
│  │ updated_at│timestamptz│                                         │ │
│  └──────────┴──────────┴───────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  inventory_products (for Logify product)                              │
│  ┌──────────────┬──────────┬───────────────────────────────────────┐ │
│  │ id           │ uuid PK  │                                        │ │
│  │ name         │ text NN  │ product name                           │ │
│  │ supplier     │ text     │ supplier name                          │ │
│  │ cost         │ numeric  │ purchase cost                           │ │
│  │ sale_price   │ numeric  │ selling price                           │ │
│  │ stock        │ integer  │ current quantity                        │ │
│  │ min_stock    │ integer  │ reorder threshold                       │ │
│  │ tenant_id    │ uuid FK  │ → tenants(id) ON DELETE SET NULL      │ │
│  │ created_at   │ timestamptz│                                       │ │
│  │ updated_at   │ timestamptz│                                       │ │
│  └──────────────┴──────────┴───────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  inventory_movements (audit trail for inventory)                      │
│  ┌──────────┬──────────────────┬───────────────────────────────────┐ │
│  │ id       │ uuid PK          │                                    │ │
│  │ product_id│ uuid FK          │ → inventory_products(id) CASCADE  │ │
│  │ type     │ movement_type    │ in|out|adjustment                  │ │
│  │ quantity │ integer NN       │                                    │ │
│  │ note     │ text             │                                    │ │
│  │ tenant_id│ uuid FK          │ → tenants(id) ON DELETE SET NULL  │ │
│  │ created_at│ timestamptz     │                                    │ │
│  └──────────┴──────────────────┴───────────────────────────────────┘ │
│  Trigger: after insert → updates product stock automatically         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Enums

| Enum | Values | Usage |
|------|--------|-------|
| `user_role` | `admin`, `barber`, `operator` | profiles.role |
| `org_role` | `owner`, `admin`, `member`, `viewer` | memberships.role |
| `plan_name` | `starter`, `pro`, `business`, `enterprise` | tenants.plan |
| `inventory_movement_type` | `in`, `out`, `adjustment` | inventory_movements.type |

---

## Views

| View | Purpose | Security |
|------|---------|----------|
| `vw_appointments_enriched` | appointments + customer_name + barber_name | `security_invoker = true` |
| `vw_revenue_by_barber` | SUM(cost) grouped by barber | `security_invoker = true` |
| `vw_revenue_by_service` | SUM(cost) grouped by service_name | `security_invoker = true` |
| `vw_appointments_per_day` | COUNT(*) per day, last 30 days | `security_invoker = true` |

---

## RPC Functions

| Function | Returns | Purpose |
|----------|---------|---------|
| `get_dashboard_kpis(profile_id, role)` | TABLE | Appointments today/week/month, revenue, occupancy, new/recurring customers |
| `get_current_tenant()` | uuid | Returns auth user's tenant_id |
| `get_user_tenant_role(tenant_id)` | text | Returns user's role in given tenant |
| `is_tenant_admin(tenant_id)` | boolean | Check if user is owner or admin |
| `get_tenant_seats_count(tenant_id)` | bigint | Count active seats |
| `handle_flow_webhook(sub_id, email, plan)` | void | Process Flow.cl payment confirmation |
| `cancel_flow_subscription(sub_id)` | void | Remove subscription, downgrade to starter |
| `refresh_customer_rollup(customer_id)` | void | Recompute total_spent, total_appointments, last/next |
| `is_admin(uid)` | boolean | Legacy: check if profile.role = 'admin' |

---

## Triggers

| Trigger | Table | Action |
|---------|-------|--------|
| `trg_appointments_rollup` | appointments | AFTER INSERT/UPDATE/DELETE → `refresh_customer_rollup()` |
| `trg_inventory_movement_apply` | inventory_movements | AFTER INSERT → updates inventory_products.stock |
| `trg_tenants_updated_at` | tenants | BEFORE UPDATE → `set_updated_at()` |
| `trg_customers_updated_at` | customers | BEFORE UPDATE → `set_updated_at()` |
| `trg_appointments_updated_at` | appointments | BEFORE UPDATE → `set_updated_at()` |
| `trg_services_updated_at` | services | BEFORE UPDATE → `set_updated_at()` |
| `trg_inventory_products_updated_at` | inventory_products | BEFORE UPDATE → `set_updated_at()` |
| `trg_auth_user_created` | auth.users | AFTER INSERT → creates profile |

---

## Row Level Security (RLS)

All tables have RLS enabled. Core pattern:

```sql
-- Tenant tables: users can only see rows for their own tenant
CREATE POLICY "table_tenant_select" ON table
FOR SELECT USING (
  tenant_id IN (
    SELECT tenant_id FROM memberships WHERE user_id = auth.uid()
  )
);

-- Write policies restrict to admin/owner roles
CREATE POLICY "table_tenant_insert" ON table
FOR INSERT WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  )
);
```

### RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `tenants` | members only | any (signup) | admin/owner | — |
| `profiles` | same tenant | own profile | admin/owner | — |
| `memberships` | same tenant | admin/owner | — | owner only |
| `tenant_seats` | same tenant | admin/owner | — | admin/owner |
| `tenant_products` | same tenant | — | — | — |
| `customers` | same tenant | admin/owner/member | admin/owner/member | admin/owner |
| `appointments` | same tenant | admin/owner | admin/owner | — |
| `services` | same tenant | admin/owner | admin/owner | — |
| `inventory_products` | same tenant | admin/owner | admin/owner | — |
| `inventory_movements` | same tenant | admin/owner | — | — |
| `allowed_emails` | admin only | admin only | admin only | admin only |

### Storage RLS

| Policy | Bucket | Access |
|--------|--------|--------|
| `tenant_files_select` | excel-files | Only files in `{tenant_id}/` folder |
| `tenant_files_insert` | excel-files | Any authenticated |
| `tenant_files_delete` | excel-files | Only files in own tenant folder |

---

## Indexes

| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| customers | `idx_customers_name` | name | Search |
| customers | `idx_customers_email` | email | Search |
| customers | `idx_customers_tenant` | tenant_id | Tenant isolation |
| appointments | `idx_appointments_customer` | customer_id | JOIN |
| appointments | `idx_appointments_barber` | barber_id | JOIN |
| appointments | `idx_appointments_date` | appointment_date | Range queries |
| appointments | `idx_appointments_status` | status | Filtering |
| appointments | `idx_appointments_tenant` | tenant_id | Tenant isolation |
| inventory_movements | `idx_inventory_movements_product` | product_id | JOIN |
| services | `idx_services_tenant` | tenant_id | Tenant isolation |
| inventory_products | `idx_inventory_products_tenant` | tenant_id | Tenant isolation |

---

## Data Flow

```
User Signup
  ↓
create-organization (Edge Function)
  ├── auth.admin.createUser() → auth.users
  ├── INSERT INTO tenants
  ├── INSERT INTO memberships (role: owner)
  └── INSERT INTO tenant_seats

User Login
  ↓
supabase.auth.signInWithPassword() → JWT
  ↓
TenantContext queries memberships JOIN tenants
  ├── Returns tenant + membership
  └── WorkspaceProvider derives branding from tenant

File Upload
  ↓
uploadExcelFile(tenantId, file)
  ├── Path: {tenant_id}/{timestamp}-{filename}
  └── Storage RLS restricts to tenant folder

Data Import
  ↓
import-data (Edge Function)
  ├── Download from {tenant_id}/{file_path}
  ├── Parse CSV → rows
  ├── Auto-map columns → DB fields
  └── INSERT INTO {table} WITH tenant_id

Payment (Flow.cl)
  ↓
flow-create-subscription → Flow API → redirect URL
  ↓ (user pays on Flow page)
flow-webhook ← Flow.cl POST
  ├── Verify payment
  └── UPDATE tenants SET plan = 'business', flow_subscription_id = ...
```

---

## Security Considerations

1. **JWT claims**: RLS uses `auth.uid()` which is extracted from the JWT — cannot be spoofed
2. **Service role bypass**: Edge functions use `service_role` key; RLS does NOT apply to service_role
3. **No direct table access**: Frontend goes through Supabase client SDK with anon key; RLS enforced
4. **Storage isolation**: Files are in tenant-named folders with RLS policies
5. **Edge function auth**: All edge functions verify JWT (`verify_jwt = true`) except `create-organization` and `flow-webhook` which use their own auth

---

## Migration Strategy

- Single consolidated migration: `backend/supabase/migrations/0000_consolidated.sql`
- All operations idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS`)
- Can be run multiple times safely on the same database
- Produces an identical result regardless of run count
