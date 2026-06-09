const ALLOWED_ORIGINS = [
  'https://app.soly.cl',
  'https://soly.cl',
  'https://www.soly.cl',
]

if (Deno.env.get('ENVIRONMENT') === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3000')
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

export function handleCorsOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  return null
}
