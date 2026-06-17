import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { flowPost } from '../_shared/flow.ts'

const VALID_PLANS = ['business'] as const
const PLAN_AMOUNT: Record<string, string> = { business: '49000' }

type FlowCustomer = { customerId: string }
type FlowSubscription = { subscriptionId: string; url?: string; token?: string }

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

    const { plan } = await req.json()
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

    // Create Flow subscription
    // Plan must exist in Flow with id = FLOW_PLAN_ID env var (or soly-business-v1 by default).
    // See setup instructions: https://www.flow.cl/app/web/plan/list
    // Support FLOW_BUSINESS_PLAN_ID (legacy) as fallback
    const flowPlanId = Deno.env.get('FLOW_PLAN_ID')
      ?? Deno.env.get('FLOW_BUSINESS_PLAN_ID')
      ?? `soly-${plan}-v1`
    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/flow-webhook`

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

    // Store subscription in DB (status trialing until first payment confirmed by webhook)
    // If the user had a manual trial, replace it.
    if (existingSub && existingSub.provider === 'manual') {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', existingSub.id)
    }

    await supabaseAdmin.from('subscriptions').insert({
      user_id: user.id,
      product: 'soly',
      plan,
      status: 'trialing',
      provider: 'flow',
      provider_subscription_id: subscription.subscriptionId,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    })

    // For trial subscriptions Flow returns no url/token (amount = 0, no payment needed yet)
    const paymentUrl = subscription.url && subscription.token
      ? `${subscription.url}?token=${subscription.token}`
      : null

    return new Response(
      JSON.stringify({ url: paymentUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error al crear suscripción' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
