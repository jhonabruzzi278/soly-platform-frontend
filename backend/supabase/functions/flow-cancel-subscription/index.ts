import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

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

    const rateLimitResponse = await applyRateLimit(req, 'flow-cancel-subscription', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const { subscription_id } = await req.json()
    if (!subscription_id) {
      throw new Error('Missing subscription_id')
    }

    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('id', subscription_id)
      .eq('user_id', user.id)
      .single()

    if (subError || !subscription) {
      throw new Error('Subscription not found')
    }

    if (subscription.status === 'cancelled') {
      throw new Error('Subscription already cancelled')
    }

    const flowApiKey = Deno.env.get('FLOW_API_KEY')
    if (!flowApiKey) {
      throw new Error('Flow.cl not configured')
    }

    // Cancel in Flow.cl FIRST — only update local DB if provider succeeds
    if (subscription.provider_subscription_id) {
    const flowResponse = await fetch(
      `https://api.flow.cl/api/v2/subscriptions/${subscription.provider_subscription_id}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${flowApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    ).catch((fetchError) => {
      // Manejar errores de red/DNS específicamente
      if (fetchError.message.includes('dns') || fetchError.message.includes('network') || fetchError.message.includes('fetch')) {
        throw new Error('Payment service temporarily unavailable. Please try again in a few minutes.')
      }
      throw fetchError
    })

    if (!flowResponse.ok) {
      throw new Error('Failed to cancel subscription with payment provider. Please try again.')
    }
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseAdmin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', subscription_id)

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Cancellation failed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
