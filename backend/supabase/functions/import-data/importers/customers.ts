// ============================================================================
// importers/customers — Customer deduplication logic
// ============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export async function deduplicateCustomers(
  supabaseAdmin: SupabaseClient,
  rows: Record<string, unknown>[],
  tenantId: string,
): Promise<{ rows: Record<string, unknown>[]; skipped: number }> {
  const { data: existing, error } = await supabaseAdmin
    .from('customers')
    .select('name, email, phone')
    .eq('tenant_id', tenantId)
    .limit(20000)

  if (error) throw new Error(`Failed to fetch existing customers: ${error.message}`)

  const seen = new Set<string>()
  for (const c of existing ?? []) {
    if (c.email) seen.add(`e:${String(c.email).toLowerCase()}`)
    if (c.phone) seen.add(`p:${String(c.phone).replace(/\D/g, '')}`)
    if (c.name) seen.add(`n:${String(c.name).toLowerCase().trim()}`)
  }

  let skipped = 0
  const deduped: Record<string, unknown>[] = []
  for (const r of rows) {
    const keys = [
      r.email ? `e:${String(r.email).toLowerCase()}` : null,
      r.phone ? `p:${String(r.phone).replace(/\D/g, '')}` : null,
      !r.email && !r.phone && r.name ? `n:${String(r.name).toLowerCase().trim()}` : null,
    ].filter(Boolean) as string[]

    if (keys.some((k) => seen.has(k))) {
      skipped++
      continue
    }
    keys.forEach((k) => seen.add(k))
    deduped.push(r)
  }

  return { rows: deduped, skipped }
}
