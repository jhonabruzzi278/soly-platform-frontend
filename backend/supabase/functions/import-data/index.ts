// ============================================================================
// import-data — Smart spreadsheet import (xlsx/csv) with AI-assisted mapping
//
// Pipeline (the AI proposes, the code disposes):
//   1. Deterministic parse with SheetJS (.xlsx, .xls, .csv) — the model never
//      touches the raw file.
//   2. Heuristic header mapping (Spanish/English alias dictionary).
//   3. Optional AI mapping for unresolved headers only, using the tenant's
//      configured provider (ai_settings): 'anthropic' or any OpenAI-compatible
//      endpoint via base_url. The model only returns JSON that is validated
//      against the column whitelist — spreadsheet content is data, never
//      instructions, so prompt injection can at worst propose an invalid
//      mapping that gets rejected.
//   4. dry_run=true returns the mapping + sample preview without writing.
//   5. Confirmed import: type coercion, customer dedup, appointments resolve
//      customer by name (NOT NULL customer_id), chunked inserts, tenant_id
//      always forced server-side.
// ============================================================================

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

import {
  VALID_TABLES, ALLOWED_COLUMNS, cellToString, coerceRow, stripUndefined,
  type TableName, type Mapping,
} from './logic.ts'

import {
  heuristicMapping, aiMapping, applyManualMapping,
  AI_TIMEOUT_MS, AI_SAMPLE_VALUES,
  type AiConfig,
} from './mapping.ts'

import { deduplicateCustomers } from './importers/customers.ts'
import { resolveAppointmentCustomers, deduplicateAppointments } from './importers/appointments.ts'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_ROWS = 10_000
const SAMPLE_PREVIEW_ROWS = 5
const INSERT_CHUNK = 500

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status })

  try {
    // ---- auth & rate limit
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    )
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const rateLimitResponse = await applyRateLimit(req, 'import-data', user.id)
    if (rateLimitResponse) return rateLimitResponse

    // ---- request parsing
    const body = await req.json()
    const filePath = String(body.file_path ?? '')
    const table = String(body.table ?? '') as TableName
    const dryRun = body.dry_run === true
    const manualMapping = body.mapping && typeof body.mapping === 'object' ? body.mapping as Record<string, unknown> : null

    if (!filePath || !table) throw new Error('Missing required fields')
    if (!(VALID_TABLES as readonly string[]).includes(table)) throw new Error('Invalid table')

    // ---- tenant resolution
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    ) as SupabaseClient

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()
    if (membershipError || !membership) throw new Error('User has no tenant membership')
    const tenantId = membership.tenant_id as string

    const sanitizedPath = filePath.replace(/\.\./g, '').replace(/\/\//g, '/')
    if (sanitizedPath !== filePath || !filePath.startsWith(`${tenantId}/`)) throw new Error('Invalid file path')

    // ---- download & parse spreadsheet
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('excel-files')
      .download(filePath)
    if (downloadError || !fileData) throw new Error('Failed to download file')
    if (fileData.size > MAX_FILE_SIZE) throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`)

    const buf = new Uint8Array(await fileData.arrayBuffer())
    let workbook: XLSX.WorkBook
    try {
      workbook = XLSX.read(buf, { type: 'array', cellDates: true, codepage: 65001, raw: true })
    } catch {
      throw new Error('No se pudo leer el archivo. Usa .xlsx, .xls o .csv valido.')
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    if (!sheet) throw new Error('El archivo no tiene hojas con datos')
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '' })

    const headerRowIdx = grid.findIndex((r) => Array.isArray(r) && r.some((c) => cellToString(c)))
    if (headerRowIdx === -1 || grid.length <= headerRowIdx + 1) throw new Error('File is empty or has no data rows')
    const headers = (grid[headerRowIdx] as unknown[]).map((h) => cellToString(h))
    const dataRows = grid.slice(headerRowIdx + 1).filter((r) => Array.isArray(r) && r.some((c) => cellToString(c)))
    if (dataRows.length === 0) throw new Error('File is empty or has no data rows')
    if (dataRows.length > MAX_ROWS) throw new Error(`Too many rows (max ${MAX_ROWS.toLocaleString()})`)

    // ---- mapping: manual > heuristic > AI
    const allowed = ALLOWED_COLUMNS[table]
    let mapping: Mapping = {}
    let unmapped: string[] = []
    let mappingSource = 'heuristic'
    let aiError: string | null = null

    if (manualMapping) {
      const manual = applyManualMapping(headers, manualMapping, allowed)
      mapping = manual.mapping
      unmapped = manual.unmapped
      mappingSource = 'manual'
    } else {
      const heur = heuristicMapping(table, headers)
      mapping = heur.mapping
      unmapped = heur.unmapped

      if (unmapped.length > 0) {
        const { data: aiCfg } = await supabaseAdmin
          .from('ai_settings')
          .select('provider, base_url, model, api_key')
          .eq('tenant_id', tenantId)
          .maybeSingle()
        if (aiCfg?.api_key) {
          const usedTargets = new Set(Object.values(mapping))
          const available = allowed.filter((c) => !usedTargets.has(c))
          if (available.length > 0) {
            const samplesFor = (header: string) => {
              const col = headers.indexOf(header)
              const out: string[] = []
              for (const r of dataRows) {
                const s = cellToString((r as unknown[])[col])
                if (s) out.push(s)
                if (out.length >= AI_SAMPLE_VALUES) break
              }
              return out
            }
            try {
              const aiResult = await aiMapping(
                aiCfg as AiConfig, table, available,
                unmapped.map((h) => ({ header: h, samples: samplesFor(h) })),
              )
              if (Object.keys(aiResult).length > 0) {
                mapping = { ...mapping, ...aiResult }
                unmapped = unmapped.filter((h) => !aiResult[h])
                mappingSource = Object.keys(mapping).length > Object.keys(aiResult).length ? 'mixed' : 'ai'
              }
            } catch (e) {
              aiError = e instanceof Error ? e.message : 'AI mapping failed'
            }
          }
        }
      }
    }

    if (Object.keys(mapping).length === 0) {
      return json({
        error: `No se reconocio ninguna columna para ${table}.`,
        detected_headers: headers.filter(Boolean),
        allowed_columns: allowed,
      }, 400)
    }

    // ---- coercion
    const errors: string[] = []
    const rows: Record<string, unknown>[] = []
    dataRows.forEach((r, i) => {
      const row = coerceRow(table, mapping, headers, r as unknown[], headerRowIdx + i + 2, errors)
      if (row) rows.push(row)
    })

    // ---- dry run
    if (dryRun) {
      return json({
        dry_run: true,
        table,
        total_rows: dataRows.length,
        valid_rows: rows.length,
        headers: headers.filter(Boolean),
        mapping,
        unmapped,
        mapping_source: mappingSource,
        ai_error: aiError,
        sample: rows.slice(0, SAMPLE_PREVIEW_ROWS),
        errors: errors.slice(0, 10),
      })
    }

    // ---- import: table-specific preparation
    let skippedDuplicates = 0
    let preparedRows = rows

    if (table === 'customers') {
      const result = await deduplicateCustomers(supabaseAdmin, rows, tenantId)
      preparedRows = result.rows
      skippedDuplicates = result.skipped
    }

    if (table === 'appointments') {
      const resolved = await resolveAppointmentCustomers(supabaseAdmin, rows, tenantId)
      const result = await deduplicateAppointments(supabaseAdmin, resolved, tenantId)
      preparedRows = result.rows
      skippedDuplicates = result.skipped
    }

    // ---- chunked insert
    const rowsWithTenant = preparedRows.map((r) => stripUndefined({ ...r, tenant_id: tenantId }))
    const isAppointmentsImport = table === 'appointments'

    if (isAppointmentsImport) await supabaseAdmin.rpc('disable_rollup_trigger')

    let imported = 0
    try {
      for (let i = 0; i < rowsWithTenant.length; i += INSERT_CHUNK) {
        const batch = rowsWithTenant.slice(i, i + INSERT_CHUNK)
        const { error } = await supabaseAdmin.from(table).insert(batch)
        if (error) errors.push(`Lote ${i / INSERT_CHUNK + 1}: ${error.message}`)
        else imported += batch.length
      }
      if (isAppointmentsImport && imported > 0) {
        await supabaseAdmin.rpc('refresh_customer_rollup_batch', { p_tenant_id: tenantId })
      }
    } finally {
      if (isAppointmentsImport) await supabaseAdmin.rpc('enable_rollup_trigger')
    }

    return json({
      imported,
      skipped_duplicates: skippedDuplicates,
      total: dataRows.length,
      errors: errors.slice(0, 20),
      mapping,
      mapping_source: mappingSource,
      table,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Import failed' }, 400)
  }
})
