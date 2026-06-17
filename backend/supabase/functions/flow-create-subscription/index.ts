import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { flowPost } from '../_shared/flow.ts'

const VALID_PLANS = ['business'] as const
const PLAN_AMOUNT: Record<string, string> = { business: '49000' }

type FlowCustomer = { customerId: string }
type FlowSubscription = { subscriptionId: string; url?: string; token?: string }
type FlowPayment = { url: string; token: string; flowOrder: number }

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

    const rateLimitResponse = await applyRateLimit(req, 'flow-create-subscription', user.id)
    if (rateLimitResponse) return rateLimitResponse

    const body = await req.json()
    const { plan, skipTrial } = body as { plan: string; skipTrial?: boolean }
    if (!plan || !(VALID_PLANS as readonly string[]).includes(plan)) {
      throw new Error('Plan inválido')
    }

    const flowApiKey = Deno.env.get('FLOW_API_KEY')
    const flowSecretKey = Deno.env.get('FLOW_SECRET_KEY')
    // Support both FLOW_APP_URL (new) and PUBLIC_URL (legacy) for the frontend base URL
    const appUrl = Deno.env.get('FLOW_APP_URL') ?? Deno.env.get('PUBLIC_URL')

    if (!flowApiKey || !flowSecretKey) throw new Error('Pagos no configurados. Contacta soporte.')
    if (!appUrl) throw new Error('FLOW_APP_URL no está configurado')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Idempotency: existing active/trialing subscription with a real Flow provider
    const { data: existingSub } = await supabaseAdmin
      .from('subscriptions')
      .select('id, status, plan, provider')
      .eq('user_id', user.id)
      .eq('product', 'soly')
      .in('status', ['active', 'trialing'])
      .maybeSingle()

    // Only block if already active or trialing (not pending_payment — allow retry)
    if (existingSub && existingSub.provider === 'flow') {
      throw new Error(`Ya tienes una suscripción ${existingSub.plan} activa`)
    }

    // Find or create Flow customer
    const { data: billingCustomer } = await supabaseAdmin
      .from('billing_customers')
      .select('provider_customer_id')
      .eq('user_id', user.id)
      .eq('provider', 'flow')
      .maybeSingle()

    let flowCustomerId = billingCustomer?.provider_customer_id ?? null

    if (!flowCustomerId) {
      const customer = await flowPost<FlowCustomer>(
        '/customer/create',
        { name: user.email!, email: user.email!, externalId: user.id },
        flowApiKey,
        flowSecretKey
      )
      flowCustomerId = customer.customerId
      await supabaseAdmin.from('billing_customers').insert({
        user_id: user.id,
        email: user.email,
        provider: 'flow',
        provider_customer_id: flowCustomerId
      })
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/flow-webhook`

    // Cancel any stale manual trial before proceeding
    if (existingSub && existingSub.provider === 'manual') {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', existingSub.id)
    }

    if (skipTrial) {
      // ── Direct pay: use /payment/create so Flow returns a real payment URL ──
      // Flow's /subscription/create with trialPeriodDays=0 does NOT return url+token.
      // /payment/create always returns url+token for the checkout page.
      const commerceOrder = crypto.randomUUID().replace(/-/g, '').slice(0, 20)

      // Cancel any previous pending_payment subscriptions for this user (allow clean retry)
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('product', 'soly')
        .eq('status', 'pending_payment')

      // Insert subscription now so the webhook can find it via commerceOrder
      const { error: insertError } = await supabaseAdmin.from('subscriptions').insert({
        user_id: user.id,
        product: 'soly',
        plan,
        status: 'pending_payment',
        provider: 'flow',
        provider_subscription_id: commerceOrder,
        trial_ends_at: null
      })
      if (insertError) {
        throw new Error('Error al registrar la suscripción: ' + insertError.message)
      }

      const amount = PLAN_AMOUNT[plan] ?? '49000'
      const payment = await flowPost<FlowPayment>(
        '/payment/create',
        {
          commerceOrder,
          subject: `Soly · Plan ${plan} mensual`,
          currency: 'CLP',
          amount,
          email: user.email ?? '',
          urlConfirmation: webhookUrl,
          urlReturn: `${appUrl}/billing?billing=success`
        },
        flowApiKey,
        flowSecretKey
      )

      const paymentUrl = `${payment.url}?token=${payment.token}`

      return new Response(
        JSON.stringify({ url: paymentUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Trial flow: /subscription/create with 14-day trial ──
    // Plan must exist in Flow dashboard with id = FLOW_PLAN_ID env var.
    const flowPlanId = Deno.env.get('FLOW_PLAN_ID')
      ?? Deno.env.get('FLOW_BUSINESS_PLAN_ID')
      ?? `soly-${plan}-v1`

    const subscription = await flowPost<FlowSubscription>(
      '/subscription/create',
      {
        planId: flowPlanId,
        customerId: flowCustomerId,
        trialPeriodDays: '14',
        urlReturn: `${appUrl}/billing?billing=success`,
        urlConfirmation: webhookUrl
      },
      flowApiKey,
      flowSecretKey
    )

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

    const { error: insertError } = await supabaseAdmin.from('subscriptions').insert({
      user_id: user.id,
      product: 'soly',
      plan,
      status: 'trialing',
      provider: 'flow',
      provider_subscription_id: subscription.subscriptionId,
      trial_ends_at: trialEndsAt
    })
    if (insertError) {
      console.error('[flow-create-subscription] DB insert error (non-fatal):', insertError.message)
    }

    return new Response(
      JSON.stringify({ url: null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error al crear suscripción' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
