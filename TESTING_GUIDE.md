# 🧪 Guía de Testing - Soly CRM Platform

## ✅ Estado del Proyecto

- **TypeScript**: ✅ Compila sin errores
- **Build**: ✅ Exitoso (536 KB gzipped)
- **Migraciones**: ✅ Todas aplicadas (0001-0013)
- **Verificación DB**: ✅ 9 funciones, 5 archive tables, 16 features, 1 idempotency index

---

## 🚀 Plan de Testing Paso a Paso

### 1️⃣ Testing Local del Frontend

```bash
# Iniciar servidor de desarrollo
cd frontend
npm run dev

# Abrir en navegador
# http://localhost:5111
```

**Qué probar:**
- [ ] La página carga sin errores en consola
- [ ] El formulario de login aparece correctamente
- [ ] No hay errores de TypeScript en la terminal

---

### 2️⃣ Testing de Autenticación

#### A. Registro de nuevo usuario
1. Ve a http://localhost:5111
2. Click en "Crear cuenta"
3. Completa el formulario:
   - Email: `test@soly.cl`
   - Password: `Test12345678`
   - Nombre: `Test User`
   - Nombre del negocio: `Test Business`
4. **Verificar:**
   - [ ] Recibes email de verificación (revisa inbox en Supabase Dashboard → Authentication)
   - [ ] Después de verificar email, puedes hacer login
   - [ ] Se crea un tenant con plan "starter"

#### B. Login
1. Usa las credenciales creadas
2. **Verificar:**
   - [ ] Login exitoso
   - [ ] Redirige a /dashboard
   - [ ] Se muestra el nombre del negocio
   - [ ] No hay errores en consola

#### C. Verificar Session desde BD
Abre DevTools → Console y ejecuta:
```javascript
// Verificar que la sesión viene de la BD, no del JWT metadata
const { data } = await supabase.rpc('get_user_session')
console.log('Session from DB:', data)
// Debería mostrar: user_id, email, tenant_id, tenant_name, tenant_plan, membership_role
```

---

### 3️⃣ Testing de Feature Gating

#### A. Plan Starter (actual)
Con tu usuario en plan "starter":
1. Intenta acceder a `/clientes`
   - [ ] Debería mostrar mensaje: "Feature no disponible en tu plan"
   - [ ] Botón "Hacer upgrade" visible
2. Intenta acceder a `/citas`
   - [ ] Mismo comportamiento
3. Intenta acceder a `/reportes`
   - [ ] Mismo comportamiento
4. Ve a `/archivos`
   - [ ] ✅ Debería funcionar (excel_files está habilitado en starter)

#### B. Verificar en BD
```sql
-- Verificar que el tenant tiene plan starter
SELECT id, slug, plan FROM tenants WHERE slug = 'test-business';

-- Verificar features disponibles para starter
SELECT feature_key, enabled FROM plan_features WHERE plan = 'starter';
```

---

### 4️⃣ Testing de Paginación

#### A. Crear datos de prueba
Ve a `/archivos` y sube un archivo CSV con muchos clientes:

**crear_clientes.csv:**
```csv
name,email,phone,company,notes
Cliente 1,cliente1@test.com,+56912345671,Empresa 1,Nota 1
Cliente 2,cliente2@test.com,+56912345672,Empresa 2,Nota 2
... (agrega 100+ filas)
```

O ejecuta esto en SQL Editor para crear datos sintéticos:
```sql
-- Crear 150 clientes de prueba
INSERT INTO customers (name, email, phone, tenant_id)
SELECT 
  'Cliente ' || i,
  'cliente' || i || '@test.com',
  '+569123456' || lpad(i::text, 3, '0'),
  (SELECT id FROM tenants LIMIT 1)
FROM generate_series(1, 150) as i;
```

#### B. Verificar paginación
1. Ve a `/clientes`
2. **Verificar:**
   - [ ] Solo se cargan 50 clientes inicialmente
   - [ ] Aparece botón "Cargar más" al final
   - [ ] Al hacer click, se cargan 50 más
   - [ ] Se repite hasta mostrar todos

#### C. Verificar en Network tab
Abre DevTools → Network:
- [ ] Solo 1 request inicial a `get_customers_paginated`
- [ ] Requests adicionales solo al hacer click en "Cargar más"
- [ ] Cada request retorna máximo 50 items

---

### 5️⃣ Testing de Rate Limiting

#### A. Test manual (crea-organization)
```bash
# Ejecutar 4 veces rápidamente
for i in {1..4}; do
  curl -X POST https://mkoqatywbfxtcwyttkjm.supabase.co/functions/v1/create-organization \
    -H "Content-Type: application/json" \
    -d '{"email":"test'$i'@test.com","password":"Test12345678","business_name":"Test'$i'","slug":"test'$i'"}'
  echo ""
done
```

**Verificar:**
- [ ] Primeras 3 requests: éxito
- [ ] Cuarta request: error 429 "Too many requests"

#### B. Test desde frontend
1. Intenta crear 4 organizaciones rápidamente desde la UI
2. **Verificar:**
   - [ ] Las primeras 3 funcionan
   - [ ] La cuarta muestra error de rate limit

---

### 6️⃣ Testing de Billing Flow

#### A. Verificar suscripción actual
```sql
-- Ver estado de suscripción
SELECT 
  u.email,
  s.status,
  s.plan,
  s.current_period_start,
  s.current_period_end,
  s.trial_ends_at
FROM subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE u.email = 'test@soly.cl';
```

#### B. Simular expiración de suscripción
```sql
-- Forzar expiración manual (solo para testing)
UPDATE subscriptions 
SET current_period_end = now() - interval '1 day'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@soly.cl');

-- Ejecutar función de expiración
SELECT expire_overdue_subscriptions();

-- Verificar que cambió a 'expired'
SELECT status FROM subscriptions 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@soly.cl');
```

#### C. Verificar acceso después de expiración
1. Cierra sesión y vuelve a entrar
2. **Verificar:**
   - [ ] Redirige a `/billing`
   - [ ] No puede acceder a `/dashboard`
   - [ ] Mensaje de suscripción requerida

---

### 7️⃣ Testing de Invitaciones

#### A. Invitar usuario
1. Ve a `/configuracion`
2. En sección "Equipo", ingresa email: `invitado@test.com`
3. Click en "Invitar"
4. **Verificar:**
   - [ ] Mensaje de éxito
   - [ ] Email de invitación enviado (revisa Supabase Dashboard → Authentication → Users)

#### B. Aceptar invitación
1. Abre el email de invitación
2. Click en el link
3. Completa el registro
4. **Verificar:**
   - [ ] Usuario creado correctamente
   - [ ] Membership creada automáticamente
   - [ ] Puede hacer login
   - [ ] Ve el tenant del invitante

#### C. Verificar en BD
```sql
-- Verificar membership
SELECT 
  u.email,
  m.role,
  t.slug as tenant_slug
FROM memberships m
JOIN auth.users u ON u.id = m.user_id
JOIN tenants t ON t.id = m.tenant_id
WHERE u.email = 'invitado@test.com';
```

---

### 8️⃣ Testing de Import Data

#### A. Subir archivo CSV
1. Ve a `/archivos`
2. Sube el archivo CSV con 150 clientes
3. **Verificar:**
   - [ ] Upload exitoso
   - [ ] Archivo aparece en la lista

#### B. Importar datos
1. Click en "Importar" en el archivo
2. Selecciona tabla: "Clientes"
3. Click en "Previsualizar"
4. **Verificar:**
   - [ ] Muestra headers detectados
   - [ ] Muestra número de filas
5. Click en "Importar"
6. **Verificar:**
   - [ ] Importación exitosa
   - [ ] Clientes aparecen en `/clientes`
   - [ ] Paginación funciona con los nuevos datos

#### C. Verificar batch rollup
```sql
-- Verificar que el trigger rollup se ejecutó correctamente
SELECT 
  name,
  total_appointments,
  total_spent
FROM customers
WHERE tenant_id = (SELECT id FROM tenants LIMIT 1)
ORDER BY created_at DESC
LIMIT 10;
```

---

### 9️⃣ Testing de Downgrade Cleanup

**⚠️ ADVERTENCIA: Esto eliminará datos. Solo hacer en ambiente de testing.**

#### A. Simular upgrade a Business
```sql
-- Crear suscripción business
INSERT INTO subscriptions (user_id, product, plan, status, current_period_start, current_period_end)
VALUES (
  (SELECT id FROM auth.users WHERE email = 'test@soly.cl'),
  'soly',
  'business',
  'active',
  now(),
  now() + interval '30 days'
);

-- Verificar que el tenant cambió a business
SELECT plan FROM tenants WHERE slug = 'test-business';
-- Debería ser 'business'
```

#### B. Crear datos premium
1. Ve a `/clientes` y crea 5 clientes
2. Ve a `/citas` y crea 3 citas
3. **Verificar:**
   - [ ] Features de business funcionan

#### C. Simular downgrade a starter
```sql
-- Cancelar suscripción
UPDATE subscriptions 
SET status = 'cancelled'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@soly.cl');

-- Verificar que se ejecutó el cleanup
SELECT * FROM customers_archive LIMIT 5;
-- Debería mostrar los clientes archivados

SELECT count(*) FROM customers WHERE tenant_id = (SELECT id FROM tenants WHERE slug = 'test-business');
-- Debería ser 0
```

---

### 🔟 Testing de Webhook Idempotencia

#### A. Simular webhook duplicado
```bash
# Enviar el mismo webhook 2 veces
WEBHOOK_PAYLOAD='{"event":"subscription.paid","subscription_id":"test-123","id":"unique-event-1"}'

# Primera vez
curl -X POST https://mkoqatywbfxtcwyttkjm.supabase.co/functions/v1/flow-webhook \
  -H "Content-Type: application/json" \
  -H "X-Flow-Signature: <firma-valida>" \
  -d "$WEBHOOK_PAYLOAD"

# Segunda vez (mismo payload)
curl -X POST https://mkoqatywbfxtcwyttkjm.supabase.co/functions/v1/flow-webhook \
  -H "Content-Type: application/json" \
  -H "X-Flow-Signature: <firma-valida>" \
  -d "$WEBHOOK_PAYLOAD"
```

**Verificar:**
```sql
-- Debería haber solo 1 registro (no duplicado)
SELECT count(*) FROM billing_webhook_events 
WHERE raw_payload->>'id' = 'unique-event-1';
```

---

## 📊 Checklist de Testing

### Funcionalidad Crítica
- [ ] Login/Signup funciona
- [ ] Session viene de BD (no JWT metadata)
- [ ] Feature gating funciona (starter no ve customers/appointments)
- [ ] Paginación carga 50 items + botón "Cargar más"
- [ ] Rate limiting bloquea después del límite
- [ ] Invitaciones crean membership automáticamente
- [ ] Import data funciona con batch rollup
- [ ] Downgrade limpia datos correctamente

### Seguridad
- [ ] No hay errores de CORS
- [ ] Rate limiting funciona en todas las Edge Functions
- [ ] Webhook idempotencia previene duplicados
- [ ] Feature gating se aplica en backend (RLS)
- [ ] No se puede acceder a features sin plan adecuado

### Performance
- [ ] Paginación reduce carga inicial
- [ ] Índices compuestos mejoran queries
- [ ] Batch rollup acelera imports masivos
- [ ] No hay N+1 queries en frontend

---

## 🐛 Si Algo Falla

### Error: "relation does not exist"
```bash
# Las migraciones no se aplicaron
supabase db push --linked
```

### Error: "permission denied"
```sql
-- Verificar RLS policies
SELECT * FROM pg_policies WHERE tablename = 'customers';
```

### Error: "function does not exist"
```sql
-- Verificar que las funciones existen
SELECT proname FROM pg_proc WHERE proname LIKE '%paginated%';
```

### Frontend no compila
```bash
cd frontend
rm -rf node_modules
npm install
npm run build
```

---

## 🎯 Criterios de Aceptación

El proyecto está listo para producción si:

✅ Todos los tests manuales pasan  
✅ No hay errores en consola del navegador  
✅ No hay errores en logs de Supabase  
✅ Paginación funciona correctamente  
✅ Feature gating bloquea acceso sin plan adecuado  
✅ Rate limiting previene abuso  
✅ Webhooks son idempotentes  
✅ Downgrade limpia datos correctamente  

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa logs en Supabase Dashboard → Logs
2. Revisa consola del navegador (F12)
3. Verifica que todas las migraciones están aplicadas
4. Consulta `AUDITORIA_FINAL.md` para detalles de implementación
