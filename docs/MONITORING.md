# Plan de Monitoreo y Observabilidad — Soly

## Capas de observabilidad

```
Frontend (Vercel)     →  Sentry + Vercel Analytics
Edge Functions (Deno) →  Supabase Logs + tabla audit_logs
Base de datos (PG)    →  pg_stat_statements + Supabase Dashboard
Billing (Flow.cl)     →  tabla billing_webhook_events (ya existe)
Alertas               →  Supabase Database Webhooks → Slack/email
```

---

## 1. Frontend

### 1.1 Error tracking — Sentry

```bash
# Instalar en frontend/
npm install @sentry/react @sentry/vite-plugin
```

```typescript
// frontend/src/main.tsx — inicializar antes del render
import * as Sentry from '@sentry/react'

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  // No enviar source maps al cliente; subirlos solo a Sentry
  integrations: [Sentry.browserTracingIntegration()],
  tracesSampleRate: 0.1,          // 10% de transacciones en prod
  beforeSend(event) {
    // Nunca enviar tokens ni passwords
    if (event.request?.data) delete event.request.data
    return event
  },
})
```

```typescript
// vite.config.ts — subir source maps a Sentry en build (NO al bundle público)
import { sentryVitePlugin } from '@sentry/vite-plugin'

plugins: [
  react(),
  VitePWA({ ... }),
  sentryVitePlugin({
    org: 'soly',
    project: 'soly-frontend',
    authToken: process.env.SENTRY_AUTH_TOKEN,
    sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
  }),
]
```

### 1.2 Web Vitals — Vercel Analytics

Activar en Vercel Dashboard → Analytics → Enable.  
Targets a monitorear (ver `frontend/vercel.json`):

| Métrica | Target | Alerta si |
|---------|--------|-----------|
| LCP     | < 2.5s | > 4s      |
| INP     | < 200ms| > 500ms   |
| CLS     | < 0.1  | > 0.25    |

### 1.3 CSP violations

El header `report-uri /api/csp-report` en `vercel.json` necesita un endpoint real.

```javascript
// frontend/api/csp-report.js
export default function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return }
  const report = req.body?.['csp-report']
  if (report) {
    console.log('[CSP-VIOLATION]', JSON.stringify({
      blocked: report['blocked-uri'],
      violated: report['violated-directive'],
      source: report['source-file'],
    }))
  }
  res.status(204).end()
}
```

---

## 2. Edge Functions (Deno / Supabase)

### 2.1 Tabla audit_logs

```sql
-- Migración: backend/supabase/migrations/0027_audit_logs.sql
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  function    text not null,               -- 'flow-webhook', 'import-data', etc.
  event       text not null,               -- 'hmac_failure', 'rate_limit', 'error', 'success'
  tenant_id   uuid references tenants(id),
  user_id     uuid references auth.users(id),
  ip          text,
  metadata    jsonb
);

-- Solo service_role puede insertar; nadie puede leer desde el cliente
alter table public.audit_logs enable row level security;
create policy "service_role_only" on public.audit_logs
  using (false);                           -- bloquea SELECT desde anon/authenticated
```

### 2.2 Eventos a registrar por función

| Función              | Evento a loguear                              | Nivel    |
|----------------------|-----------------------------------------------|----------|
| `flow-webhook`       | HMAC inválido, firma ausente                  | CRITICAL |
| `flow-webhook`       | Pago procesado (paid/rejected)                | INFO     |
| `import-data`        | URL de AI fuera del allowlist                 | HIGH     |
| `import-data`        | Error de parseo AI                            | WARN     |
| `create-organization`| Onboarding exitoso / fallido                  | INFO     |
| `expire-subscriptions`| N suscripciones expiradas                    | INFO     |
| Todas las funciones  | Rate limit alcanzado (IP)                     | WARN     |

```typescript
// _shared/audit.ts — helper reutilizable
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function logAuditEvent(params: {
  fn: string
  event: string
  tenantId?: string
  userId?: string
  ip?: string | null
  metadata?: Record<string, unknown>
}) {
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    await admin.from('audit_logs').insert({
      function: params.fn,
      event: params.event,
      tenant_id: params.tenantId ?? null,
      user_id: params.userId ?? null,
      ip: params.ip ?? null,
      metadata: params.metadata ?? null,
    })
  } catch {
    // No propagar errores de logging
  }
}
```

Ejemplo en `flow-webhook/index.ts`:
```typescript
if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
  await logAuditEvent({ fn: 'flow-webhook', event: 'hmac_failure', ip: getClientIp(req) })
  return new Response(...)
}
```

---

## 3. Base de datos

### 3.1 Queries de salud (ejecutar vía Supabase Dashboard → SQL Editor)

```sql
-- Suscripciones activas por plan
select status, count(*) from subscriptions group by status;

-- Clientes por tenant (top 10)
select tenant_id, count(*) as total
from customers group by tenant_id
order by total desc limit 10;

-- Eventos de billing de las últimas 24h
select event_type, count(*), bool_or(processed) as all_processed
from billing_webhook_events
where created_at > now() - interval '24h'
group by event_type;

-- Rate limit hits por IP (últimos 30 min)
select key, count(*) from rate_limits
where created_at > now() - interval '30 minutes'
group by key order by count desc limit 20;
```

### 3.2 Alertas de base de datos

Configurar en Supabase Dashboard → Database → Webhooks:

| Trigger                                    | Destino           | Umbral           |
|--------------------------------------------|-------------------|------------------|
| INSERT en `billing_webhook_events` con `event_type='payment.rejected'` | Slack #billing | Inmediato |
| UPDATE en `subscriptions` con `status='expired'` | Email admin | Inmediato |
| INSERT en `audit_logs` con `event='hmac_failure'` | Slack #security | ≥ 3 en 1h |

---

## 4. Alertas y on-call

### 4.1 Canales

```
CRÍTICO   →  PagerDuty / llamada / SMS        (respuesta < 15 min)
ALTO      →  Slack #alertas-soly              (respuesta < 1h)
INFO      →  Slack #logs-soly (resumen diario)
```

### 4.2 Reglas de alerta prioritarias

| Condición                                  | Severidad | Acción            |
|--------------------------------------------|-----------|-------------------|
| Webhook HMAC inválido > 5 en 10 min        | CRÍTICO   | Investigar ataque |
| Suscripción de pago falló 3+ veces         | ALTO      | Contactar usuario |
| Edge Function con error 500 > 1% de calls  | ALTO      | Revisar logs      |
| Cron `expire-subscriptions` sin ejecutarse > 25h | ALTO | Verificar scheduler |
| LCP > 4s en Vercel Analytics               | MEDIO     | Revisar bundle    |
| npm audit con HIGH en prod deps             | MEDIO     | Actualizar dep    |

---

## 5. Runbooks de incidentes comunes

### 5.1 Pagos no procesados

```
1. Verificar billing_webhook_events con processed=false
2. Revisar logs de flow-webhook en Supabase Dashboard → Logs → Edge Functions
3. Llamar manualmente a /payment/getStatus con el token del webhook
4. Re-insertar en billing_webhook_events si se perdió
5. Notificar al usuario con email manual si status=paid
```

### 5.2 Usuario bloqueado por rate limit

```
1. Identificar la IP en la tabla rate_limits
2. DELETE FROM rate_limits WHERE key LIKE 'xxx:ip:<IP>';
3. Investigar si fue un ataque o un error legítimo
4. Si es legítimo, aumentar el límite puntualmente
```

### 5.3 Suscripción expirada incorrectamente

```
1. UPDATE subscriptions SET status='active',
   current_period_end = now() + interval '30 days'
   WHERE id = '<sub_id>';
2. UPDATE tenants SET plan='business' WHERE id = '<tenant_id>';
3. Documentar en la tabla audit_logs manualmente
```

---

## 6. Variables de entorno adicionales necesarias

Agregar a `.env` (y a Vercel + Supabase Secrets):

```bash
# Sentry
VITE_SENTRY_DSN=https://xxx@oxx.ingest.sentry.io/xxx
SENTRY_AUTH_TOKEN=sntryu_xxx     # solo en CI, nunca en cliente

# Slack webhooks (para alertas de DB)
SLACK_SECURITY_WEBHOOK=https://hooks.slack.com/services/xxx
SLACK_BILLING_WEBHOOK=https://hooks.slack.com/services/xxx
```

---

## 7. Checklist de activación

- [ ] Crear tabla `audit_logs` (migración 0027)
- [ ] Crear `_shared/audit.ts` e integrar en `flow-webhook` e `import-data`
- [ ] Instalar Sentry en frontend y configurar `VITE_SENTRY_DSN`
- [ ] Configurar `sentryVitePlugin` en `vite.config.ts` con upload de source maps
- [ ] Crear endpoint `api/csp-report.js`
- [ ] Activar Vercel Analytics en Dashboard
- [ ] Crear 3 Database Webhooks en Supabase para alertas de billing y seguridad
- [ ] Configurar canales de Slack #alertas-soly y #logs-soly
- [ ] Documentar runbooks en Notion/Confluence con links a este archivo
- [ ] Programar revisión semanal de logs los lunes a las 9:00
