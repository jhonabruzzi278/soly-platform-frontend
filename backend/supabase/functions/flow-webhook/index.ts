import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { timingSafeEqual } from 'https://deno.land/std@0.177.0/node/crypto.ts'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { stripUndefined } from '../_shared/utils.ts'
import { flowGet, FlowPaymentStatus, signParams } from '../_shared/flow.ts'

// Flow calls this URL via POST with a `token` param (form-encoded) after any payment event.
// We call /payment/getStatus to verify, then update the matching subscription.
//
// Payment status codes: 1=pending, 2=paid, 3=rejected, 4=cancelled
//
// Subscription lookup order:
//   1. By commerceOrder → provider_subscription_id (direct-pay via /payment/create)
//   2. By payer email → most recent active/trialing/pending_payment subscription
//
// This webhook must return HTTP 200 always. Flow retries on non-200 responses.

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

    // Flow sends form-encoded POST with `token` + `s` (HMAC-SHA256 signature) params
    const formText = await req.text()
    const params = new URLSearchParams(formText)
    const incomingSignature = params.get('s')

    if (!incomingSignature) {
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Verify Flow HMAC-SHA256: reconstruct params without 's', sign, compare
    const paramsForSigning: Record<string, string> = {}
    for (const [k, v] of params.entries()) {
      if (k !== 's') paramsForSigning[k] = v
    }
    const expectedSignature = await signParams(paramsForSigning, flowSecretKey)
    const enc = new TextEncoder()
    const sigA = enc.encode(expectedSignature)
    const sigB = enc.encode(incomingSignature)
    if (sigA.length !== sigB.length || !timingSafeEqual(sigA, sigB)) {
      console.error('[flow-webhook] Invalid HMAC signature')
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    const token = params.get('token')
    if (!token) throw new Error('Missing token')

    // Verify with Flow — this is the source of truth for payment status
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

    const eventType =
      payment.status === 2 ? 'payment.paid'
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

    // ── Find matching subscription ────────────────────────────────────────────
    // Strategy 1: match by commerceOrder stored in provider_subscription_id.
    // This covers payments created via /payment/create (skipTrial=true flow).
    let dbSubscription: Record<string, unknown> | null = null

    if (payment.commerceOrder) {
      const { data: sub } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('provider', 'flow')
        .eq('provider_subscription_id', payment.commerceOrder)
        .maybeSingle()
      dbSubscription = sub
    }

    // Strategy 2: match by payer email → most recent subscription for that user.
    // Fallback for recurring subscription charges where provider_subscription_id
    // holds a Flow subscriptionId (sus_xxx), not the commerceOrder.
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

    // Log the event regardless of whether we found the subscription
    const { error: insertError } = await supabaseAdmin
      .from('billing_webhook_events')
      .insert(stripUndefined({
        provider: 'flow',
        event_type: eventType,
        raw_payload: payment as unknown as Record<string, unknown>,
        subscription_id: (dbSubscription?.id as string) ?? null,
        processed: false,
      }))

    // Duplicate event at DB level (race condition) — treat as success
    if (insertError && insertError.code === '23505') {
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    if (insertError) throw insertError

    // ── Update subscription based on payment result ───────────────────────────
    if (dbSubscription) {
      const subId = dbSubscription.id as string

      if (payment.status === 2) {
        // Paid: activate for 30 days. For recurring subscriptions, Flow will send
        // the next webhook when the next invoice is charged.
        const now = new Date()
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            trial_ends_at: null,
          })
          .eq('id', subId)

        // Sync tenant plan to match the paid subscription
        const { data: membership } = await supabaseAdmin
          .from('memberships')
          .select('tenant_id')
          .eq('user_id', dbSubscription.user_id as string)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle()

        if (membership?.tenant_id) {
          await supabaseAdmin
            .from('tenants')
            .update({ plan: dbSubscription.plan as string, updated_at: now.toISOString() })
            .eq('id', membership.tenant_id)
        }
      } else if (payment.status === 3 || payment.status === 4) {
        // Rejected or cancelled — mark expired, user will need to retry
        await supabaseAdmin
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('id', subId)
      }
      // status=1 (pending): no DB update needed, still waiting for final payment
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
    // Always return 200 so Flow doesn't retry indefinitely
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[flow-webhook] error:', message)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
