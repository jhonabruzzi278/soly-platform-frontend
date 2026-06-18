// ============================================================================
// importers/appointments — Appointment customer resolution + deduplication
// ============================================================================

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const INSERT_CHUNK = 500

export async function deduplicateAppointments(
  supabaseAdmin: SupabaseClient,
  rows: Record<string, unknown>[],
  tenantId: string,
): Promise<{ rows: Record<string, unknown>[]; skipped: number }> {
  const { data: existing, error } = await supabaseAdmin
    .from('appointments')
    .select('customer_id, appointment_date, appointment_time')
    .eq('tenant_id', tenantId)
    .limit(20000)

  if (error) throw new Error(`Failed to fetch existing appointments: ${error.message}`)

  const seen = new Set<string>()
  for (const a of existing ?? []) {
    seen.add(`${a.customer_id}|${a.appointment_date}|${a.appointment_time}`)
  }

  let skipped = 0
  const deduped: Record<string, unknown>[] = []
  for (const r of rows) {
    const key = `${r.customer_id}|${r.appointment_date}|${r.appointment_time}`
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    deduped.push(r)
  }

  return { rows: deduped, skipped }
}

export async function resolveAppointmentCustomers(
  supabaseAdmin: SupabaseClient,
  rows: Record<string, unknown>[],
  tenantId: string,
): Promise<Record<string, unknown>[]> {
  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('id, name')
    .eq('tenant_id', tenantId)
    .limit(20000)

  const byName = new Map<string, string>()
  for (const c of existing ?? []) {
    byName.set(String(c.name).toLowerCase().trim(), c.id)
  }

  const missing = new Map<string, string>()
  for (const r of rows) {
    const key = String(r.customer_name).toLowerCase().trim()
    if (!byName.has(key) && !missing.has(key)) {
      missing.set(key, String(r.customer_name).trim())
    }
  }

  for (let i = 0; i < missing.size; i += INSERT_CHUNK) {
    const chunk = [...missing.values()]
      .slice(i, i + INSERT_CHUNK)
      .map((name) => ({ name, tenant_id: tenantId }))

    const { data: created, error } = await supabaseAdmin
      .from('customers')
      .insert(chunk)
      .select('id, name')

    if (error) throw new Error(`No se pudieron crear clientes: ${error.message}`)
    for (const c of created ?? []) {
      byName.set(String(c.name).toLowerCase().trim(), c.id)
    }
  }

  const unresolved: string[] = []
  for (const r of rows) {
    const id = byName.get(String(r.customer_name).toLowerCase().trim())
    if (!id) {
      unresolved.push(String(r.customer_name).trim())
      continue
    }
    r.customer_id = id
    delete r.customer_name
  }
  if (unresolved.length > 0) {
    throw new Error(`No se pudo resolver customer_id para: ${unresolved.slice(0, 5).join(', ')}`)
  }

  return rows
}
