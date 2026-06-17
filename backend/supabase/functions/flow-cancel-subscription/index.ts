import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { flowPost } from '../_shared/flow.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const rateLimitResponse = await applyRateLimit(req, 'flow-cancel-subscription', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const { subscription_id } = await req.json()
    if (!subscription_id) throw new Error('Missing subscription_id')

    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('id, status, provider, provider_subscription_id')
      .eq('id', subscription_id)
      .eq('user_id', user.id)
      .single()

    if (subError || !subscription) throw new Error('Suscripción no encontrada')
    if (subscription.status === 'cancelled') throw new Error('La suscripción ya está cancelada')

    const flowApiKey = Deno.env.get('FLOW_API_KEY')
    const flowSecretKey = Deno.env.get('FLOW_SECRET_KEY')

    // Cancel in Flow for recurring subscriptions.
    // Direct-pay subscriptions (created via /payment/create) store a commerceOrder
    // in provider_subscription_id, not a Flow subscription ID — /subscription/cancel
    // will reject those, so we catch the error and proceed to cancel in DB regardless.
    if (
      subscription.provider === 'flow' &&
      subscription.provider_subscription_id &&
      flowApiKey &&
      flowSecretKey
    ) {
      try {
        await flowPost(
          '/subscription/cancel',
          { subscriptionId: subscription.provider_subscription_id },
          flowApiKey,
          flowSecretKey
        )
      } catch (flowError) {
        console.warn('[flow-cancel] Flow cancel failed (may be a one-time payment):', flowError instanceof Error ? flowError.message : flowError)
      }
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', subscription_id)

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error al cancelar' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
