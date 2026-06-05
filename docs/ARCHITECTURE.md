# Soly Platform — Multi-Product Architecture

## Shared Infrastructure (Supabase Pro)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Supabase Pro                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Auth (GoTrue)                                                │  │
│  │  auth.users, auth.sessions, JWT                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Shared Schema (public)                                       │  │
│  │  tenants, profiles, memberships, tenant_seats,                │  │
│  │  tenant_products, allowed_emails                              │  │
│  │                                                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐                    │  │
│  │  │  Soly Domain    │  │  Logify Domain  │                    │  │
│  │  │  customers      │  │  products       │                    │  │
│  │  │  appointments   │  │  movements      │                    │  │
│  │  │  services       │  │  suppliers      │                    │  │
│  │  │                 │  │  locations      │                    │  │
│  │  │  Views:         │  │  orders         │                    │  │
│  │  │  vw_appointments│  │  View:          │                    │  │
│  │  │  vw_revenue_*   │  │  vw_stock_*     │                    │  │
│  │  └─────────────────┘  └─────────────────┘                    │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Storage                                                      │  │
│  │  excel-files/{tenant_id}/ (shared, RLS per tenant)            │  │
│  │  logos/{tenant_id}/ (shared)                                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Edge Functions                                               │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐│  │
│  │  │ Shared       │  │ Soly         │  │ Logify               ││  │
│  │  │ create-tenant│  │ flow-*       │  │ import-inventory     ││  │
│  │  │ invite-member│  │ import-data  │  │ stock-alert          ││  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘│  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Complete Database Schema

### SHARED TABLES (used by both products)

```sql
-- ═══════════════════════════════════════════════════
-- TENANTS (root entity)
-- ═══════════════════════════════════════════════════
tenants
  id              uuid PK DEFAULT gen_random_uuid()
  slug            text UNIQUE NOT NULL         -- soly.app/t/{slug}
  business_name   text NOT NULL
  business_subtitle text
  plan            plan_name DEFAULT 'starter'
  product         text DEFAULT 'soly'          -- 'soly' | 'logify'
  flow_subscription_id text                    -- Flow.cl (only Soly uses this today)
  flow_customer_email  text
  is_active       boolean DEFAULT true
  created_at      timestamptz
  updated_at      timestamptz

-- ═══════════════════════════════════════════════════
-- PROFILES (user accounts)
-- ═══════════════════════════════════════════════════
profiles
  id              uuid PK → auth.users(id) CASCADE
  email           citext UNIQUE NOT NULL
  full_name       text
  role            text DEFAULT 'member'        -- free text, validated at app level
  is_active       boolean DEFAULT true
  tenant_id       uuid FK → tenants(id) SET NULL
  created_at      timestamptz
  updated_at      timestamptz

-- ═══════════════════════════════════════════════════
-- MEMBERSHIPS (user ↔ tenant)
-- ═══════════════════════════════════════════════════
memberships
  tenant_id       uuid FK → tenants(id) CASCADE
  user_id         uuid FK → auth.users(id) CASCADE
  role            org_role DEFAULT 'member'    -- owner | admin | member | viewer
  created_at      timestamptz
  PK              (tenant_id, user_id)

-- ═══════════════════════════════════════════════════
-- TENANT SEATS (license tracking)
-- ═══════════════════════════════════════════════════
tenant_seats
  tenant_id       uuid FK → tenants(id) CASCADE
  user_id         uuid FK → auth.users(id) CASCADE
  is_active       boolean DEFAULT true
  assigned_at     timestamptz
  PK              (tenant_id, user_id)

-- ═══════════════════════════════════════════════════
-- TENANT PRODUCTS (which products enabled)
-- ═══════════════════════════════════════════════════
tenant_products
  tenant_id       uuid FK → tenants(id) CASCADE
  product_key     text                         -- 'soly' | 'logify'
  enabled_at      timestamptz
  PK              (tenant_id, product_key)

-- ═══════════════════════════════════════════════════
-- ALLOWED EMAILS (whitelist)
-- ═══════════════════════════════════════════════════
allowed_emails
  id              uuid PK
  email           citext UNIQUE NOT NULL
  is_active       boolean DEFAULT true
  created_at      timestamptz
```

---

### SOLY DOMAIN TABLES (CRM)

```sql
-- ═══════════════════════════════════════════════════
-- CUSTOMERS
-- ═══════════════════════════════════════════════════
customers
  id                  uuid PK
  name                text NOT NULL
  email               text
  phone               text
  company             text
  address             text
  notes               text
  tags                text[] DEFAULT '{}'
  total_spent         numeric(12,2) DEFAULT 0    -- computed via trigger
  total_appointments  integer DEFAULT 0           -- computed via trigger
  last_appointment_at timestamptz
  next_appointment_at timestamptz
  tenant_id           uuid FK → tenants(id) SET NULL
  created_at          timestamptz
  updated_at          timestamptz

-- ═══════════════════════════════════════════════════
-- APPOINTMENTS
-- ═══════════════════════════════════════════════════
appointments
  id                uuid PK
  customer_id       uuid FK → customers(id) CASCADE
  barber_id         uuid FK → profiles(id) SET NULL
  appointment_date  date NOT NULL
  appointment_time  time NOT NULL
  service_name      text NOT NULL
  cost              numeric(12,2) DEFAULT 0
  status            text DEFAULT 'pending'     -- pending|confirmed|completed|cancelled|no_show
  comments          text
  tenant_id         uuid FK → tenants(id) SET NULL
  created_at        timestamptz
  updated_at        timestamptz

-- ═══════════════════════════════════════════════════
-- SERVICES (catalog)
-- ═══════════════════════════════════════════════════
services
  id          uuid PK
  name        text NOT NULL
  price       numeric(12,2) DEFAULT 0
  tenant_id   uuid FK → tenants(id) SET NULL
  created_at  timestamptz
  updated_at  timestamptz
```

---

### LOGIFY DOMAIN TABLES (Inventory & Logistics)

```sql
-- ═══════════════════════════════════════════════════
-- PRODUCTS (inventory catalog)
-- ═══════════════════════════════════════════════════
products
  id          uuid PK
  sku         text UNIQUE NOT NULL            -- internal product code
  name        text NOT NULL
  description text
  category    text
  unit        text DEFAULT 'unit'             -- unit | kg | lt | box | pack
  cost        numeric(12,2) DEFAULT 0
  price       numeric(12,2) DEFAULT 0
  min_stock   integer DEFAULT 0               -- reorder threshold
  tenant_id   uuid FK → tenants(id) SET NULL
  created_at  timestamptz
  updated_at  timestamptz

-- ═══════════════════════════════════════════════════
-- LOCATIONS (warehouses, shelves, bins)
-- ═══════════════════════════════════════════════════
locations
  id          uuid PK
  name        text NOT NULL                   -- 'Bodega A', 'Estante 3'
  code        text UNIQUE                     -- 'WH-A', 'SH-3'
  address     text
  type        text DEFAULT 'warehouse'        -- warehouse | store | transit
  tenant_id   uuid FK → tenants(id) SET NULL
  created_at  timestamptz
  updated_at  timestamptz

-- ═══════════════════════════════════════════════════
-- STOCK (current stock per product per location)
-- ═══════════════════════════════════════════════════
stock
  id          uuid PK
  product_id  uuid FK → products(id) CASCADE
  location_id uuid FK → locations(id) CASCADE
  quantity    integer NOT NULL DEFAULT 0
  tenant_id   uuid FK → tenants(id) SET NULL
  updated_at  timestamptz
  UNIQUE      (product_id, location_id)

-- ═══════════════════════════════════════════════════
-- MOVEMENTS (audit trail)
-- ═══════════════════════════════════════════════════
movements
  id            uuid PK
  product_id    uuid FK → products(id) CASCADE
  location_id   uuid FK → locations(id) SET NULL
  type          movement_type NOT NULL        -- in | out | transfer | adjustment
  quantity      integer NOT NULL CHECK (quantity > 0)
  reference     text                          -- order number, invoice, reason
  note          text
  user_id       uuid FK → profiles(id) SET NULL
  tenant_id     uuid FK → tenants(id) SET NULL
  created_at    timestamptz

-- ═══════════════════════════════════════════════════
-- SUPPLIERS
-- ═══════════════════════════════════════════════════
suppliers
  id          uuid PK
  name        text NOT NULL
  contact     text
  email       text
  phone       text
  address     text
  notes       text
  tenant_id   uuid FK → tenants(id) SET NULL
  created_at  timestamptz
  updated_at  timestamptz

-- ═══════════════════════════════════════════════════
-- PURCHASE ORDERS
-- ═══════════════════════════════════════════════════
purchase_orders
  id            uuid PK
  supplier_id   uuid FK → suppliers(id) SET NULL
  order_number  text UNIQUE
  status        text DEFAULT 'draft'          -- draft | sent | received | cancelled
  notes         text
  total         numeric(12,2) DEFAULT 0
  tenant_id     uuid FK → tenants(id) SET NULL
  created_at    timestamptz
  updated_at    timestamptz

-- ═══════════════════════════════════════════════════
-- PURCHASE ORDER ITEMS
-- ═══════════════════════════════════════════════════
purchase_order_items
  id            uuid PK
  order_id      uuid FK → purchase_orders(id) CASCADE
  product_id    uuid FK → products(id) SET NULL
  quantity      integer NOT NULL CHECK (quantity > 0)
  unit_cost     numeric(12,2) DEFAULT 0
  total         numeric(12,2) DEFAULT 0
  tenant_id     uuid FK → tenants(id) SET NULL
```

---

### LOGIFY VIEWS

```sql
-- Current stock with product info
vw_stock_summary
  product_name, sku, category, location_name, quantity, min_stock,
  (quantity <= min_stock) as low_stock

-- Movement history by product
vw_movement_history
  date, product_name, type, quantity, location_name, reference, user_name

-- Stock value by location
vw_stock_value
  location_name, total_items, total_cost, total_price, margin

-- Low stock alerts
vw_low_stock_alerts
  product_name, sku, current_stock, min_stock, location_name, days_since_last_movement

-- Purchase order status
vw_purchase_orders
  order_number, supplier, status, items_count, total, created_at
```

---

### LOGIFY RPC FUNCTIONS

```sql
-- KPIs for dashboard
get_inventory_kpis(tenant_id uuid)
  RETURNS (total_products, total_locations, low_stock_count,
            stock_value, movements_today, movements_month, pending_orders)

-- Transfer stock between locations
transfer_stock(product_id, from_location, to_location, quantity)

-- Auto-reorder suggestion
get_reorder_suggestions(tenant_id uuid)
  RETURNS (product_id, sku, name, current_stock, min_stock, suggested_order)
```

---

### LOGIFY TRIGGERS

```sql
-- Update stock.updated_at on change
trg_stock_updated_at     → BEFORE UPDATE ON stock

-- Create movement record on stock change
trg_stock_movement       → AFTER INSERT OR UPDATE ON stock

-- Validate stock doesn't go negative
trg_stock_non_negative   → BEFORE UPDATE ON stock

-- Update purchase_order.updated_at
trg_purchase_orders_updated_at → BEFORE UPDATE ON purchase_orders

-- Auto-update stock on purchase order received
trg_purchase_order_received → AFTER UPDATE ON purchase_orders
```

---

## Edge Functions

### SHARED

| Function | Input | Output | Auth |
|----------|-------|--------|------|
| `create-tenant` | email, password, business_name, slug, plan, **product** | tenant_id | anon |
| `invite-member` | tenant_id, email, role | ok | JWT (owner/admin) |

### SOLY-ONLY

| Function | Input | Output | Auth |
|----------|-------|--------|------|
| `import-crm-data` | tenant_id, file_path, table | imported, errors | JWT |
| `flow-create-subscription` | tenant_id, plan | url | JWT |
| `flow-cancel-subscription` | tenant_id | success | JWT |
| `flow-webhook` | Flow.cl POST body | received | anon |

### LOGIFY-ONLY

| Function | Input | Output | Auth |
|----------|-------|--------|------|
| `import-inventory` | tenant_id, file_path, type | imported, errors | JWT |
| `generate-report` | tenant_id, report_type, filters | report_data | JWT |

---

## RLS Policy Pattern (applies to ALL domain tables)

```sql
-- Same pattern for every table. Just change the table name.
-- SELECT: any member of the same tenant
CREATE POLICY "{table}_tenant_select" ON public.{table} FOR SELECT
USING (tenant_id IN (
  SELECT tenant_id FROM public.memberships WHERE user_id = auth.uid()
));

-- INSERT: owner, admin, member
CREATE POLICY "{table}_tenant_insert" ON public.{table} FOR INSERT
WITH CHECK (tenant_id IN (
  SELECT tenant_id FROM public.memberships
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
));

-- UPDATE: owner, admin
CREATE POLICY "{table}_tenant_update" ON public.{table} FOR UPDATE
USING (tenant_id IN (
  SELECT tenant_id FROM public.memberships
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
));

-- DELETE: owner only
CREATE POLICY "{table}_tenant_delete" ON public.{table} FOR DELETE
USING (tenant_id IN (
  SELECT tenant_id FROM public.memberships
  WHERE user_id = auth.uid() AND role = 'owner'
));
```

---

## Index Pattern

Every domain table gets:
```
idx_{table}_tenant ON {table} (tenant_id)    -- RLS performance
idx_{table}_name ON {table} (name)           -- search (if has name column)
idx_{table}_date ON {table} (created_at)     -- date range queries
```

---

## Frontend Structure

```
solify-platform/
├── packages/
│   ├── shared-types/          # Tenant, Profile, Membership, enums
│   ├── shared-auth/           # useAuth, useTenant, TenantProvider
│   ├── shared-ui/             # Button, Card, Modal, DataTable, etc.
│   └── shared-utils/          # cn(), format.ts, supabase client
│
├── apps/
│   ├── soly/                  # Soly CRM frontend (Vite + React)
│   │   ├── src/
│   │   │   ├── features/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── customers/
│   │   │   │   ├── appointments/
│   │   │   │   ├── reports/
│   │   │   │   ├── files/
│   │   │   │   ├── billing/
│   │   │   │   └── settings/
│   │   │   └── lib/
│   │   │       └── api.ts     # only Soly domain functions
│   │   ├── .env               # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│   │   └── vercel.json
│   │
│   └── logify/                # Logify Inventory frontend (Vite + React)
│       ├── src/
│       │   ├── features/
│       │   │   ├── dashboard/
│       │   │   ├── products/
│       │   │   ├── stock/
│       │   │   ├── movements/
│       │   │   ├── suppliers/
│       │   │   ├── orders/
│       │   │   ├── reports/
│       │   │   ├── files/
│       │   │   └── settings/
│       │   └── lib/
│       │       └── api.ts     # only Logify domain functions
│       ├── .env               # same VITE_SUPABASE_URL, same anon key
│       └── vercel.json
│
└── backend/
    └── supabase/
        ├── migrations/
        │   ├── 0000_shared.sql        # tenants, profiles, memberships, seats, products, allowed_emails
        │   ├── 0001_soly_domain.sql   # customers, appointments, services + views + RPCs + RLS
        │   └── 0002_logify_domain.sql # products, stock, movements, suppliers, orders + views + RPCs + RLS
        ├── functions/
        │   ├── shared/
        │   │   ├── create-tenant/
        │   │   └── invite-member/
        │   ├── soly/
        │   │   ├── import-crm-data/
        │   │   ├── flow-create-subscription/
        │   │   ├── flow-cancel-subscription/
        │   │   └── flow-webhook/
        │   ├── logify/
        │   │   ├── import-inventory/
        │   │   └── generate-report/
        │   └── _shared/
        │       └── cors.ts
        └── tests/
            ├── shared_tests.sql
            ├── soly_tests.sql
            └── logify_tests.sql
```

---

## Deployment

| Product | Domain | Vercel App | Root Dir |
|---------|--------|------------|----------|
| Soly | app.soly.cl | soly-frontend | `apps/soly` |
| Logify | app.logify.cl | logify-frontend | `apps/logify` |

Both share the same Supabase project, same `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

---

## How They Coexist

### Tenant X uses only Soly
```
tenants: { id: X, product: 'soly' }
tenant_products: { tenant_id: X, product_key: 'soly' }
→ X sees: customers, appointments, services, dashboard, reports
→ X does NOT see: products, stock, movements, suppliers, orders
```

### Tenant Y uses only Logify
```
tenants: { id: Y, product: 'logify' }
tenant_products: { tenant_id: Y, product_key: 'logify' }
→ Y sees: products, stock, movements, suppliers, orders, reports
→ Y does NOT see: customers, appointments, services
```

### Tenant Z uses both
```
tenants: { id: Z, product: 'soly' }
tenant_products: { tenant_id: Z, product_key: 'soly' },
                { tenant_id: Z, product_key: 'logify' }
→ Z sees: everything (both Soly and Logify domains)
```

### RLS ensures isolation regardless
```
Even if Z has access to both product tables, RLS restricts them to tenant_id = Z.
Tenant X can NEVER see Tenant Y's data, even if they both use Soly.
```

---

## Cost Structure

| Resource | Shared? | Notes |
|----------|---------|-------|
| PostgreSQL | Shared | Single Supabase Pro project |
| Auth users | Shared | auth.users table |
| Storage | Shared | Separate buckets, same project |
| Edge Functions | Shared | Deployed to same project, different endpoints |
| Vercel | Separate | One Vercel project per frontend |
| Domain | Separate | soly.cl + logify.cl |

**No duplication. No extra cost. Same infrastructure.**
