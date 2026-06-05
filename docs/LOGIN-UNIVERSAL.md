# Guia: Login Universal Logify ↔ Soly

Ambos SaaS comparten el mismo Supabase. El usuario NUNCA sabe que existe el otro.

---

## Solucion implementada: Cero friccion

### Problema

Si un usuario se registra en Logify con `juan@gmail.com` y luego intenta crear cuenta en Soly con el mismo email, Supabase devuelve error 422 "User already registered". El usuario ve un mensaje de error que no deberia existir.

### Solucion

3 capas que trabajan juntas:

1. **Frontend (`auth.tsx`)**: Si `signUp()` falla con "already registered", llama silenciosamente a la edge function
2. **Edge function (`create-organization`)**: Si el usuario ya existe, obtiene su ID y le crea el tenant de Soly sin intentar crear el usuario de nuevo
3. **DB Trigger (`handle_new_auth_user`)**: Para usuarios NUEVOS, crea tenant + membership + seat al registrarse

```
Usuario pone email+password en Soly
         │
         ▼
   supabase.auth.signUp()
         │
    ┌────┴────┐
    │         │
  EXITO    "already registered"
    │         │
    ▼         ▼
 Trigger   Edge function
 crea       busca user existente
 tenant     crea tenant Soly
    │         │
    └────┬────┘
         ▼
  supabase.auth.signInWithPassword()
         │
         ▼
     DASHBOARD
```

El usuario SOLO ve: formulario → "Crear mi cuenta" → dashboard.

Nunca un mensaje de error, nunca una referencia a Logify.

---

## Implementacion

### 1. Frontend - `auth.tsx` (signup method)

```typescript
async signup({ email, password, name, businessName }) {
  setLoading(true);
  setError(null);
  const normalizedEmail = email.trim().toLowerCase();
  const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);

  // Intento 1: signup normal
  const { error: signUpErr } = await supabase.auth.signUp({
    email: normalizedEmail, password,
    options: { data: { name, tenant_name: businessName, tenant_id: slug, plan: "starter", role: "owner" } }
  });

  // Si el usuario ya existe (Logify), crear tenant Soly silenciosamente
  if (signUpErr && signUpErr.message.includes("already")) {
    const resp = await fetch(`${supabaseUrl}/functions/v1/create-organization`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
      body: JSON.stringify({ email: normalizedEmail, password, business_name: businessName, slug, plan: "starter" })
    });
    if (!resp.ok) {
      const { error: apiErr } = await resp.json();
      throw new Error(apiErr || "Error al crear tu espacio");
    }
  } else if (signUpErr) {
    throw new Error(translateAuthError(signUpErr.message));
  }

  // Login automatico despues de crear el tenant
  const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
  if (loginErr || !loginData.session) {
    throw new Error("Cuenta lista. Inicia sesion en la pestana Login.");
  }
  const s = buildSession(loginData.session.user, loginData.session);
  if (!s) throw new Error("No se pudo iniciar sesion");
  setSession(s); setLoading(false);
  return s;
}
```

### 2. Edge Function - `create-organization`

```typescript
const { data: created, error: createError } = await adminClient.auth.admin.createUser({
  email, password, email_confirm: true,
  user_metadata: { full_name: business_name }
});

let userId: string;

if (createError) {
  // Usuario ya existe → obtener su ID
  if (createError.message.includes("already been registered")) {
    const { data: existing } = await adminClient.auth.admin.listUsers();
    const found = existing?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!found) throw new Error("Usuario no encontrado");
    userId = found.id;
  } else {
    throw createError;
  }
} else {
  userId = created.user!.id;
}

// Crear tenant + membership + seat (con onConflict para evitar duplicados)
const { data: org } = await adminClient.from("tenants")
  .insert({ slug, business_name, plan }).select().single();

await adminClient.from("memberships")
  .insert({ tenant_id: org.id, user_id: userId, role: "owner" })
  .onConflict("user_id,tenant_id").ignore();

await adminClient.from("tenant_seats")
  .insert({ tenant_id: org.id, user_id: userId, is_active: true })
  .onConflict("user_id,tenant_id").ignore();
```

### 3. DB Trigger - `handle_new_auth_user` (para usuarios NUEVOS)

```sql
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid;
  v_slug text;
begin
  -- Crear perfil
  insert into public.profiles (id, email, full_name, role, is_active)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', new.email), 'member', true)
  on conflict (id) do nothing;

  -- Auto-crear tenant si el metadata incluye tenant_id
  v_slug := new.raw_user_meta_data ->> 'tenant_id';
  if v_slug is not null and v_slug != '' then
    v_tenant_id := gen_random_uuid();
    insert into public.tenants (id, slug, business_name, plan)
    values (v_tenant_id, v_slug, coalesce(new.raw_user_meta_data ->> 'tenant_name', v_slug), coalesce(new.raw_user_meta_data ->> 'plan', 'starter'))
    on conflict (slug) do update set updated_at = now();
    select id into v_tenant_id from public.tenants where slug = v_slug;

    insert into public.memberships (user_id, tenant_id, role)
    values (new.id, v_tenant_id, 'owner') on conflict do nothing;
    insert into public.tenant_seats (user_id, tenant_id, is_active)
    values (new.id, v_tenant_id, true) on conflict do nothing;
    update public.profiles set tenant_id = v_tenant_id where id = new.id;
  end if;
  return new;
end;
$$;
```

---

## Escenarios cubiertos

| # | Situacion | Que pasa |
|---|-----------|----------|
| 1 | Usuario NUEVO en Soly | `signUp` → trigger crea tenant → login directo |
| 2 | Usuario NUEVO en Logify | `signUp` → trigger crea tenant → login directo |
| 3 | Usuario de Logify crea cuenta en Soly | `signUp` falla → edge function busca user → crea tenant Soly → login |
| 4 | Usuario de Soly crea cuenta en Logify | `signUp` falla → edge function busca user → crea tenant Logify → login |
| 5 | Mismo usuario en ambas apps | Tiene 2 tenants, 2 memberships. Cada app ve solo su tenant. |
| 6 | Login en Soly con cuenta de Logify | `signInWithPassword` → login normal → TenantContext carga el tenant correcto |

---

## Aislamiento total

Cada app usa su propio `storageKey` en Supabase para que las sesiones no se pisen:

| App | storageKey |
|-----|-----------|
| Soly | `Soly-supabase-auth` |
| Logify | `Logify-supabase-auth` |

Un usuario puede tener ambas apps abiertas en el mismo navegador sin conflictos.

---

## Configuracion Supabase

### Rate Limits (evitar 429)

```powershell
$token = "sbp_TU_TOKEN"
$projectRef = "egwhkiviungtqeefddqa"
$body = @{ mailer_autoconfirm = $true; rate_limit_verify = 500; rate_limit_token_refresh = 500; rate_limit_anonymous_users = 200 } | ConvertTo-Json
Invoke-RestMethod -Uri "https://api.supabase.com/v1/projects/$projectRef/config/auth" -Method Patch -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } -Body $body
```

### Redirect URLs

```
Site URL: https://app.soly.cl

Redirect URLs:
https://app.soly.cl
https://app.logify.cl
https://soly.cl
https://logify.cl
http://localhost:3000
```

---

## user_metadata estandar

Ambos proyectos usan el mismo formato:

```json
{
  "name": "Nombre del Usuario",
  "role": "owner",
  "tenant_id": "nombre-del-negocio",
  "tenant_name": "Nombre del Negocio",
  "plan": "starter"
}
```

---

## Mensajes de error (translateAuthError)

| Error Supabase | Mensaje usuario |
|----------------|-----------------|
| "Invalid login credentials" | "Email o contrasena incorrectos." |
| "User already registered" | **NUNCA se muestra al usuario** — se maneja silenciosamente |
| "Password too weak" | "La contrasena es muy debil. Minimo 6 caracteres." |
| "Rate limit exceeded" | "Demasiados intentos. Espera unos segundos." |
| "Network error" | "Error de conexion. Verifica tu internet." |
| "500 / internal" | "Error del servidor. Intenta de nuevo." |
