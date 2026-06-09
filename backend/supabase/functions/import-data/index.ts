import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'

const VALID_TABLES = ['customers', 'appointments', 'services', 'inventory_products'] as const
const VALID_COLUMN_REGEX = /^[a-z_][a-z0-9_]{0,63}$/
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_ROWS = 10_000

// Whitelist of allowed columns per table — prevents injection of arbitrary columns
const ALLOWED_COLUMNS: Record<string, string[]> = {
  customers: ['name', 'email', 'email_alt', 'phone', 'phone_alt_1', 'phone_alt_2', 'company', 'address', 'notes', 'tags'],
  appointments: ['customer_id', 'barber_id', 'appointment_date', 'appointment_time', 'service_name', 'cost', 'status', 'comments', 'address', 'city', 'state', 'country', 'postal_code', 'staff_name'],
  services: ['name', 'price'],
  inventory_products: ['name', 'supplier', 'cost', 'sale_price', 'stock', 'min_stock', 'safety_stock', 'purchase_date'],
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }

    const { file_path, table } = await req.json()

    if (!file_path || !table) {
      throw new Error('Missing required fields')
    }

    if (!(VALID_TABLES as readonly string[]).includes(table)) {
      throw new Error('Invalid table')
    }

    // Derive tenant_id from user's membership (zero-trust)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('memberships')
      .select('tenant_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (membershipError || !membership) {
      throw new Error('User has no tenant membership')
    }

    const tenantId = membership.tenant_id

    // Validate file_path to prevent path traversal
    const sanitizedPath = file_path.replace(/\.\./g, '').replace(/\/\//g, '/')
    if (sanitizedPath !== file_path || !file_path.startsWith(tenantId)) {
      throw new Error('Invalid file path')
    }

    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('excel-files')
      .download(file_path)

    if (downloadError || !fileData) {
      throw new Error('Failed to download file')
    }

    // File size limit
    if (fileData.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`)
    }

    const text = await fileData.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      throw new Error('File is empty or has no data rows')
    }

    // Row limit
    if (lines.length - 1 > MAX_ROWS) {
      throw new Error(`Too many rows (max ${MAX_ROWS.toLocaleString()})`)
    }

    // Sanitize and whitelist headers
    const tableAllowedCols = ALLOWED_COLUMNS[table] || []
    const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'))
    const headers = rawHeaders.filter(h => VALID_COLUMN_REGEX.test(h) && tableAllowedCols.includes(h))

    if (headers.length === 0) {
      throw new Error(`No valid column headers found. Allowed columns for ${table}: ${tableAllowedCols.join(', ')}`)
    }

    const rows = lines.slice(1).map(line => {
      const values = line.split(',')
      const row: Record<string, string> = {}
      headers.forEach((header, i) => {
        row[header] = values[i]?.trim() || ''
      })
      return row
    })

    const rowsWithTenant = rows.map(row => ({
      ...row,
      tenant_id: tenantId
    }))

    const batchSize = 100
    let imported = 0
    const errors: string[] = []

    for (let i = 0; i < rowsWithTenant.length; i += batchSize) {
      const batch = rowsWithTenant.slice(i, i + batchSize)
      const { error } = await supabaseAdmin.from(table).insert(batch)

      if (error) {
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`)
      } else {
        imported += batch.length
      }
    }

    return new Response(
      JSON.stringify({
        imported,
        total: rows.length,
        errors,
        headers
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Import failed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
