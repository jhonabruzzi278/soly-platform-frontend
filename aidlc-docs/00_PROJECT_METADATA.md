# Project Metadata

**Project Name:** Soly Platform (repo also historically referenced as "Logify" — see note below)
**Owner:** JONAHBRUZZI (git author: `jon.guerra@duocuc.cl`)
**Analyzed On:** 2026-07-19
**Current Phase:** Operations (Early / Maturing)
**Last Updated:** 2026-07-19

## Status
- [x] Inception Phase — informally complete (retroactively reconstructed in this audit; no original PRD/stories found, extracted from README + code)
- [x] Construction Phase — complete (working product, CI green, 75 commits, real third-party integrations)
- [~] Operations Phase — partial (production monitoring just landed; no runbooks, SLA, or IaC beyond CI/Vercel config yet)

## Quick Links
- Requirements: [aidlc-docs/requirements/](./requirements/)
- Architecture: [aidlc-docs/design-artifacts/ARCHITECTURE.md](./design-artifacts/ARCHITECTURE.md)
- Testing: [aidlc-docs/testing/TEST_STRATEGY.md](./testing/TEST_STRATEGY.md)
- Deployment: [aidlc-docs/deployment/](./deployment/)
- Operations: [aidlc-docs/operations/](./operations/)

## Notas del Análisis Automático

**Cómo se detectó la fase:** El repo tiene código funcional completo (no scaffolding), 75 commits, tests que corren en CI (`.github/workflows/ci.yml`: typecheck → lint → test → build), y evidencia de producción activa: `frontend/vercel.json` con headers de seguridad y CSP apuntando a dominios reales (`*.supabase.co`, `api.flow.cl`, Sentry ingest), y una integración de monitoring recién completada (commits `79a11eb`…`c5a3f31`, 2026-07 aprox.) con Sentry error boundary, user context, y métricas custom (`frontend/src/lib/monitoring.ts`). Esto cumple el criterio "Operations" del árbol de decisión (monitoring configs presentes), aunque **no hay** runbooks, SLA formal, ni IaC más allá de la config declarativa de Vercel/CI — de ahí "Operations (Early/Maturing)" en vez de Operations maduro.

**Supuestos hechos (requieren validación humana):**
1. **Nombre del proyecto**: el `package.json` de frontend dice `soly-frontend`, el remote `origin` es `soly-platform-frontend`, pero también existe un remote `logify` apuntando a `jhonabruzzi278/logify.git`, y una migración menciona "Logify compatibility" (commit `2026-06-05 fix: remove Soly-specific DB constraints for Logify compatibility`). Asumo que **Soly** es el producto activo actual y **Logify** fue/es un nombre de producto hermano o anterior que comparte el mismo schema multi-tenant. No se pudo confirmar la relación exacta entre ambos — marcado pendiente.
2. **Stakeholders**: no hay documentación de stakeholders externos. Por el patrón de commits (un solo autor, un solo remote personal, dominio `duocuc.cl` que es un correo universitario chileno), asumo que este es un proyecto de fundador único/solo-developer, posiblemente un proyecto académico o bootstrapped SaaS. Marcado pendiente de confirmación.
3. **Credenciales de Flow.cl en producción**: el código de integración es real y correcto (HMAC-SHA256, endpoints correctos según OpenAPI spec adjunto `es-openApiFlow (1).yaml`), pero no se puede verificar desde el repo si `FLOW_API_KEY`/`FLOW_SECRET_KEY` están configurados como secrets reales en Supabase — eso vive fuera del repo. Ver [operations/MONITORING_SETUP.md](./operations/MONITORING_SETUP.md).
4. **Working tree state al momento del análisis**: había cambios sin commitear (README.md, CLAUDE.md, migración 0026→0027 renombrada, `frontend/package.json`/lock modificados) y archivos sin trackear (`es-openApiFlow (1).yaml`, `package.json`/`package-lock.json` en la raíz). No se modificó ninguno de estos — este análisis es de solo lectura sobre código fuente.
