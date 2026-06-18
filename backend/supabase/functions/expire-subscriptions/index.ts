import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual } from 'https://deno.land/std@0.177.0/node/crypto.ts'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'

// This Edge Function expires overdue subscriptions. It is an administrative,
// platform-wide operation and MUST only be triggered by a trusted scheduler
// presenting the CRON_SECRET. It is never callable by regular end users.

function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder()
  const ab = enc.encode(a)
  const bb = enc.encode(b)
  // Length check is not constant-time, but reveals only length, not content.
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    // Authenticate: require a valid CRON_SECRET bearer token. No user passthrough.
    const cronSecret = Deno.env.get('CRON_SECRET')
    if (!cronSecret) {
      throw new Error('Unauthorized — CRON_SECRET not configured')
    }

    const authHeader = req.headers.get('Authorization') ?? ''
    const provided = authHeader.replace(/^Bearer\s+/i, '')

    if (!provided || !safeEqual(provided, cronSecret)) {
      throw new Error('Unauthorized — valid CRON_SECRET required')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Expire active subscriptions past their period end
    const { data: expiredActive, error: activeError } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'active')
      .not('current_period_end', 'is', null)
      .lt('current_period_end', new Date().toISOString())
      .select('id, user_id, product')

    if (activeError) {
      throw activeError
    }

    // Expire trialing subscriptions past their trial end
    const { data: expiredTrialing, error: trialingError } = await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('status', 'trialing')
      .not('trial_ends_at', 'is', null)
      .lt('trial_ends_at', new Date().toISOString())
      .select('id, user_id, product')

    if (trialingError) {
      throw trialingError
    }

    const expiredCount = (expiredActive?.length || 0) + (expiredTrialing?.length || 0)

    // Sync tenant plans for expired subscriptions (downgrade to starter)
    const allExpired = [...(expiredActive || []), ...(expiredTrialing || [])]
    for (const sub of allExpired) {
      // Find the tenant owned by this user
      const { data: membership } = await supabaseAdmin
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', sub.user_id)
        .eq('role', 'owner')
        .limit(1)
        .maybeSingle()

      if (membership?.tenant_id) {
        await supabaseAdmin
          .from('tenants')
          .update({ plan: 'starter', updated_at: new Date().toISOString() })
          .eq('id', membership.tenant_id)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired: expiredCount,
        active: expiredActive?.length || 0,
        trialing: expiredTrialing?.length || 0,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('Unauthorized') ? 401 : 500
    return new Response(
      JSON.stringify({ error: 'Expiration failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
    )
  }
})
