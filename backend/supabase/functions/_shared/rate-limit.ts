import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type RateLimitConfig = {
  windowMs: number
  maxRequests: number
  keyPrefix: string
}

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt: Date
  retryAfterMs: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'create-organization': { windowMs: 60 * 60 * 1000, maxRequests: 3, keyPrefix: 'org' },
  'flow-webhook': { windowMs: 60 * 1000, maxRequests: 100, keyPrefix: 'webhook' },
  'invite-member': { windowMs: 60 * 1000, maxRequests: 10, keyPrefix: 'invite' },
  'import-data': { windowMs: 60 * 1000, maxRequests: 5, keyPrefix: 'import' },
  'flow-create-subscription': { windowMs: 60 * 1000, maxRequests: 5, keyPrefix: 'sub-create' },
  'flow-cancel-subscription': { windowMs: 60 * 1000, maxRequests: 5, keyPrefix: 'sub-cancel' },
}

function getClientIp(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

export async function checkRateLimit(
  req: Request,
  functionName: string,
  userId?: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[functionName]
  if (!config) {
    return { allowed: true, remaining: Infinity, resetAt: new Date(), retryAfterMs: 0 }
  }

  const ip = getClientIp(req)
  const key = userId ? `${config.keyPrefix}:${userId}` : `${config.keyPrefix}:ip:${ip}`
  const now = Date.now()
  const windowStart = now - config.windowMs

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Clean expired entries
  await supabaseAdmin
    .from('rate_limits')
    .delete()
    .lt('expires_at', new Date().toISOString())

  // Count requests in current window
  const { count } = await supabaseAdmin
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('key', key)
    .gte('created_at', new Date(windowStart).toISOString())

  const requestCount = count ?? 0
  const remaining = Math.max(0, config.maxRequests - requestCount - 1)
  const resetAt = new Date(now + config.windowMs)

  if (requestCount >= config.maxRequests) {
    const retryAfterMs = config.windowMs
    return { allowed: false, remaining: 0, resetAt, retryAfterMs }
  }

  // Record this request
  await supabaseAdmin.from('rate_limits').insert({
    key,
    created_at: new Date().toISOString(),
    expires_at: new Date(now + config.windowMs * 2).toISOString()
  })

  return { allowed: true, remaining, resetAt, retryAfterMs: 0 }
}

export function rateLimitResponse(resetAt: Date, retryAfterMs: number): Response {
  return new Response(
    JSON.stringify({ error: 'Too many requests. Please wait before trying again.' }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(Math.ceil(retryAfterMs / 1000)),
        'X-RateLimit-Reset': resetAt.toISOString()
      }
    }
  )
}

export async function applyRateLimit(
  req: Request,
  functionName: string,
  userId?: string
): Promise<Response | null> {
  const result = await checkRateLimit(req, functionName, userId)
  if (!result.allowed) {
    return rateLimitResponse(result.resetAt, result.retryAfterMs)
  }
  return null
}
