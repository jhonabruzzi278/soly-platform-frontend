import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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

    const { tenant_id, file_path, table } = await req.json()

    if (!tenant_id || !file_path || !table) {
      throw new Error('Missing required fields')
    }

    const validTables = ['customers', 'appointments', 'services', 'inventory_products']
    if (!validTables.includes(table)) {
      throw new Error('Invalid table')
    }

    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('excel-files')
      .download(file_path)

    if (downloadError || !fileData) {
      throw new Error('Failed to download file')
    }

    const text = await fileData.text()
    const lines = text.split('\n').filter(line => line.trim())

    if (lines.length < 2) {
      throw new Error('File is empty or has no data rows')
    }

    const headers = lines[0].split(',').map(h => h.trim())
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
      tenant_id
    }))

    const batchSize = 100
    let imported = 0
    const errors: string[] = []

    for (let i = 0; i < rowsWithTenant.length; i += batchSize) {
      const batch = rowsWithTenant.slice(i, i + batchSize)
      const { error } = await supabaseClient.from(table).insert(batch)

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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
