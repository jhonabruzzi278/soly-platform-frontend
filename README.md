# Soly Platform

CRM SaaS Web PWA multi-tenant dividido en:

- `frontend/`: React + Tailwind + PWA.
- `backend/`: Supabase self-hosted en Docker (SQL, RLS, Edge Functions).

## Arquitectura

Frontend -> Supabase (PostgreSQL + Auth + Storage + Edge Functions) -> Docker/VM.

## Modelo SaaS

Este producto opera como SaaS multi-tenant:

- `1 organización = 1 workspace aislado`
- `1 plan = límites de seats y features`
- `1 despliegue = todos los tenants comparten infraestructura`

Guía completa:

- [docs/saas-arquitectura.md](docs/saas-arquitectura.md)
- [docs/guia-desarrollador.md](docs/guia-desarrollador.md)
- [docs/despliegue-vm.md](docs/despliegue-vm.md)

## 1) Backend (Docker / VM)

### Requisitos

- Docker + Docker Compose
- VM con Ubuntu 22.04 LTS (4 vCPU, 16GB RAM)

### Pasos

1. Entrar a `backend/`.
2. Configurar `.env` con tus variables reales.
3. Ejecutar: `docker compose up -d`.
4. Aplicar migraciones: `docker compose exec postgres psql -U soly -d soly < migrations/20260324170000_initial_schema.sql`.

## 2) Frontend

### Requisitos

- Node.js 20+
- npm

### Pasos

1. Entrar a `frontend/`.
2. Crear/configurar `.env` con tus variables reales.
3. Instalar dependencias: `npm install`.
4. Ejecutar en desarrollo: `npm run dev`.

## Flujo principal implementado

- Auth email/password con perfiles y roles (`admin`, `member`, `viewer`).
- Multi-tenancy con `organization_id` y RLS.
- Gestión de seats por plan (Starter/Pro/Business/Enterprise).
- Billing con Stripe (Checkout + Customer Portal).
- Feature flags por plan.
- Gestión de archivos Excel (Starter+).
- PWA habilitado con service worker.
- Tema neumórfico con modo claro/oscuro.
