import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'

// This Edge Function expires overdue subscriptions.
// It can be called by:
// 1. pg_cron (if available) via SQL: SELECT expire_overdue_subscriptions()
// 2. External cron service (cron-job.org, GitHub Actions scheduled, etc.)
//    calling this endpoint every hour with a CRON_SECRET header for auth.

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    // Authenticate the request — either via CRON_SECRET header or internal call
    const cronSecret = Deno.env.get('CRON_SECRET')
    const authHeader = req.headers.get('Authorization')

    // Allow internal calls (from pg_cron or service_role) or external with CRON_SECRET
    const isInternalCall = authHeader?.startsWith('Bearer ey') === false && !authHeader
    const isCronCall = cronSecret && authHeader === `Bearer ${cronSecret}`

    if (!isInternalCall && !isCronCall) {
      // Check if it's a service_role call
      const supabaseCheck = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        { global: { headers: { Authorization: authHeader || '' } } }
      )
      const { data: { user } } = await supabaseCheck.auth.getUser()
      if (!user) {
        throw new Error('Unauthorized — provide CRON_SECRET header or call internally')
      }
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
      JSON.stringify({ error: 'Expiration failed', details: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
    )
  }
})
