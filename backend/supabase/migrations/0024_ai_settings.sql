-- ============================================================================
-- Module 24: Per-tenant AI provider settings (AI-agnostic smart import)
--
-- Stores the AI provider configuration used by the import-data Edge Function
-- to map spreadsheet columns. Provider-agnostic: 'anthropic' uses the native
-- Messages API; 'openai' covers every OpenAI-compatible endpoint (OpenAI,
-- OpenRouter, Groq, Gemini-compat, Ollama, etc.) via an optional base_url.
--
-- Security model:
--   * RLS: only owner/admin of the tenant can manage the row; anon has nothing.
--   * The api_key column is WRITE-ONLY for clients: column-level grants exclude
--     it from SELECT, so PostgREST can never return it. Only the service role
--     (used by the Edge Function) can read it.
--   * base_url must be https:// to avoid plaintext key leakage.
--   * Row presence = "AI configured" (frontend never needs the key back).
-- ============================================================================

create table if not exists public.ai_settings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  provider text not null default 'anthropic' check (provider in ('anthropic', 'openai')),
  base_url text check (base_url is null or base_url ~ '^https://'),
  model text not null,
  api_key text not null check (length(api_key) between 8 and 512),
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create trigger trg_ai_settings_updated_at
  before update on public.ai_settings
  for each row execute function public.set_updated_at();

alter table public.ai_settings enable row level security;

create policy ai_settings_select on public.ai_settings
  for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.tenant_id = ai_settings.tenant_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create policy ai_settings_insert on public.ai_settings
  for insert to authenticated
  with check (exists (
    select 1 from public.memberships m
    where m.tenant_id = ai_settings.tenant_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create policy ai_settings_update on public.ai_settings
  for update to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.tenant_id = ai_settings.tenant_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ))
  with check (exists (
    select 1 from public.memberships m
    where m.tenant_id = ai_settings.tenant_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

create policy ai_settings_delete on public.ai_settings
  for delete to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.tenant_id = ai_settings.tenant_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  ));

-- Column-level privileges: clients can write the key but never read it back.
revoke all on public.ai_settings from public, anon, authenticated;
grant select (tenant_id, provider, base_url, model, updated_at) on public.ai_settings to authenticated;
grant insert (tenant_id, provider, base_url, model, api_key) on public.ai_settings to authenticated;
grant update (provider, base_url, model, api_key) on public.ai_settings to authenticated;
grant delete on public.ai_settings to authenticated;
