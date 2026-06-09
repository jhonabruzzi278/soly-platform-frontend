import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac, timingSafeEqual } from 'https://deno.land/std@0.177.0/node/crypto.ts'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    const rateLimitResponse = await applyRateLimit(req, 'flow-webhook')
    if (rateLimitResponse) return rateLimitResponse

    const body = await req.text()
    const signature = req.headers.get('X-Flow-Signature')

    const flowSecretKey = Deno.env.get('FLOW_SECRET_KEY')
    if (!flowSecretKey) {
      throw new Error('Flow secret key not configured')
    }

    if (!signature) {
      throw new Error('Missing webhook signature')
    }

    const expected = createHmac('sha256', flowSecretKey).update(body).digest('hex') as string
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      throw new Error('Invalid signature')
    }

    const payload = JSON.parse(body)
    const eventType = payload.event || payload.type
    const subscriptionId = payload.subscription_id || payload.data?.subscription_id

    if (!eventType) {
      throw new Error('Missing event type')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let dbSubscription = null
    if (subscriptionId) {
      const { data } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('provider_subscription_id', subscriptionId)
        .single()

      dbSubscription = data
    }

    // Idempotency: check if we already processed this exact event
    const { data: existingEvent } = await supabaseAdmin
      .from('billing_webhook_events')
      .select('id')
      .eq('provider', 'flow')
      .eq('event_type', eventType)
      .eq('processed', true)
      .filter('raw_payload->>id', 'eq', payload.id || '')
      .maybeSingle()

    if (existingEvent) {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Insert event record — handle unique constraint violation (idempotency at DB level)
    const { error: insertError } = await supabaseAdmin.from('billing_webhook_events').insert({
      provider: 'flow',
      event_type: eventType,
      raw_payload: payload,
      subscription_id: dbSubscription?.id || null,
      processed: false
    })

    // If unique constraint violation, this is a duplicate event
    if (insertError && insertError.code === '23505') {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (insertError) {
      throw insertError
    }

    // Extract billing period from Flow payload (or calculate from subscription)
    const periodStart = payload.current_period_start
      || payload.data?.current_period_start
      || payload.billing_period?.start
      || new Date().toISOString()

    const periodEnd = payload.current_period_end
      || payload.data?.current_period_end
      || payload.billing_period?.end
      || (dbSubscription?.current_period_end
        ? new Date(new Date(dbSubscription.current_period_end).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())

    if (eventType === 'subscription.paid' || eventType === 'payment.completed') {
      if (dbSubscription) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: periodStart,
            current_period_end: periodEnd
          })
          .eq('id', dbSubscription.id)
      }
    } else if (eventType === 'subscription.failed' || eventType === 'payment.failed') {
      if (dbSubscription) {
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', dbSubscription.id)
      }
    } else if (eventType === 'subscription.cancelled') {
      if (dbSubscription) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          })
          .eq('id', dbSubscription.id)
      }
    }

    // Mark event as processed
    await supabaseAdmin
      .from('billing_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('provider', 'flow')
      .eq('event_type', eventType)
      .eq('processed', false)
      .filter('raw_payload->>id', 'eq', payload.id || '')

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('signature') ? 401 : 400
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status }
    )
  }
})
