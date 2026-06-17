import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { flowPost, FlowSubscription } from '../_shared/flow.ts'

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

    // Cancel in Flow only for proper recurring subscriptions (provider_subscription_id
    // starts with "sus_" per Flow's format). Direct-pay rows store a commerceOrder
    // (hex string) which cannot be cancelled via /subscription/cancel — we skip that
    // call and just mark cancelled in our DB.
    const isFlowSubscription =
      subscription.provider === 'flow' &&
      typeof subscription.provider_subscription_id === 'string' &&
      subscription.provider_subscription_id.startsWith('sus_') &&
      flowApiKey &&
      flowSecretKey

    if (isFlowSubscription) {
      try {
        await flowPost<FlowSubscription>(
          '/subscription/cancel',
          { subscriptionId: subscription.provider_subscription_id },
          flowApiKey!,
          flowSecretKey!
        )
      } catch (flowError) {
        // Log but don't block DB cancellation — the user's intent is to cancel
        console.warn('[flow-cancel] Flow API cancel failed:', flowError instanceof Error ? flowError.message : flowError)
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
