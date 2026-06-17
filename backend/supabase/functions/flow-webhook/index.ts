import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { stripUndefined } from '../_shared/utils.ts'
import { flowGet } from '../_shared/flow.ts'

// Flow sends a POST to this URL with a `token` param (form-encoded) when a payment is processed.
// We verify via /payment/getStatus and update the subscription accordingly.
// Status codes: 1=pending, 2=paid, 3=rejected, 4=cancelled

type FlowPaymentStatus = {
  flowOrder: number
  commerceOrder: string
  requestDate: string
  status: number
  subject: string
  currency: string
  amount: number
  payer: string
  optional: Record<string, string> | null
  paymentData: Record<string, unknown> | null
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    const rateLimitResponse = await applyRateLimit(req, 'flow-webhook')
    if (rateLimitResponse) return rateLimitResponse

    const flowApiKey = Deno.env.get('FLOW_API_KEY')
    const flowSecretKey = Deno.env.get('FLOW_SECRET_KEY')

    if (!flowApiKey || !flowSecretKey) throw new Error('Flow no configurado')

    // Flow sends form-encoded POST with `token` param
    const contentType = req.headers.get('content-type') ?? ''
    let token: string | null = null

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const params = new URLSearchParams(await req.text())
      token = params.get('token')
    } else {
      const body = await req.json() as Record<string, unknown>
      token = (body.token as string) ?? null
    }

    if (!token) throw new Error('Missing token')

    // Verify with Flow — this is the source of truth
    const payment = await flowGet<FlowPaymentStatus>(
      '/payment/getStatus',
      { token },
      flowApiKey,
      flowSecretKey
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const eventType = payment.status === 2 ? 'payment.paid'
      : payment.status === 3 ? 'payment.rejected'
      : payment.status === 4 ? 'payment.cancelled'
      : 'payment.pending'

    // Idempotency: skip if this flowOrder was already processed
    const { data: existingEvent } = await supabaseAdmin
      .from('billing_webhook_events')
      .select('id')
      .eq('provider', 'flow')
      .eq('event_type', eventType)
      .eq('processed', true)
      .filter('raw_payload->>flowOrder', 'eq', String(payment.flowOrder))
      .maybeSingle()

    if (existingEvent) {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Find subscription: first by commerceOrder (direct-pay flow), then by payer email (fallback)
    let dbSubscription: Record<string, unknown> | null = null

    // For /payment/create flow, provider_subscription_id holds the commerceOrder
    if (payment.commerceOrder) {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('provider', 'flow')
        .eq('provider_subscription_id', payment.commerceOrder)
        .maybeSingle()
      dbSubscription = sub
    }

    // Fallback: find by payer email for trial subscriptions
    if (!dbSubscription && payment.payer) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', payment.payer)
        .maybeSingle()

      if (profile) {
        const { data: sub } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('user_id', profile.id)
          .eq('provider', 'flow')
          .in('status', ['active', 'trialing', 'pending_payment'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        dbSubscription = sub
      }
    }

    const { error: insertError } = await supabaseAdmin
      .from('billing_webhook_events')
      .insert(stripUndefined({
        provider: 'flow',
        event_type: eventType,
        raw_payload: payment as unknown as Record<string, unknown>,
        subscription_id: dbSubscription?.id as string ?? null,
        processed: false
      }))

    // Duplicate at DB level (race condition) — treat as success
    if (insertError && insertError.code === '23505') {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    if (insertError) throw insertError

    // Update subscription based on payment status
    if (dbSubscription) {
      if (payment.status === 2) {
        // Paid: activate for 30 days (Flow will send next charge webhook monthly)
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          .eq('id', dbSubscription.id as string)
      } else if (payment.status === 3 || payment.status === 4) {
        // Rejected or cancelled
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', dbSubscription.id as string)
      }
    }

    // Mark event as processed
    await supabaseAdmin
      .from('billing_webhook_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('provider', 'flow')
      .eq('event_type', eventType)
      .filter('raw_payload->>flowOrder', 'eq', String(payment.flowOrder))

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    // Always return 200 to Flow so it doesn't retry indefinitely
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('flow-webhook error:', message)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
