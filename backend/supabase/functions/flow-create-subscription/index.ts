import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'
import { flowPost, FlowPayResponse, FlowCustomer } from '../_shared/flow.ts'

const VALID_PLANS = ['business'] as const
type PlanKey = typeof VALID_PLANS[number]

const PLAN_AMOUNT: Record<PlanKey, string> = { business: '49000' }
const TRIAL_DAYS = 14

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
    const validPlan = plan as PlanKey

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Block if already active or trialing
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

    // Cancel any stale manual trial before proceeding
    if (existingSub && existingSub.provider === 'manual') {
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('id', existingSub.id)
    }

    // ── Trial flow: DB-only, no card required ─────────────────────────────────
    // The trial is managed entirely in our DB. expire-subscriptions cron expires
    // it after TRIAL_DAYS. After expiry the user comes back and pays via skipTrial=true.
    // Flow's /subscription/create is NOT used here because:
    //   a) It requires a registered card (card must exist first via /customer/register)
    //   b) The UI explicitly says "sin tarjeta requerida"
    if (!skipTrial) {
      // Cancel any previous expired/cancelled rows to keep the table clean
      await supabaseAdmin
        .from('subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('product', 'soly')
        .in('status', ['expired', 'pending_payment'])

      const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()

      const { error: insertError } = await supabaseAdmin.from('subscriptions').insert({
        user_id: user.id,
        product: 'soly',
        plan: validPlan,
        status: 'trialing',
        provider: 'manual',
        provider_subscription_id: null,
        trial_ends_at: trialEndsAt,
      })
      if (insertError) {
        throw new Error('Error al registrar la prueba: ' + insertError.message)
      }

      // No redirect needed — BillingPage handles url=null by showing success
      return new Response(
        JSON.stringify({ url: null }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Direct pay: /payment/create ───────────────────────────────────────────
    // Creates a one-time payment link. Flow returns url+token for checkout redirect.
    // commerceOrder is stored as provider_subscription_id so the webhook can find
    // the subscription row when Flow confirms payment.
    const flowApiKey = Deno.env.get('FLOW_API_KEY')
    const flowSecretKey = Deno.env.get('FLOW_SECRET_KEY')
    const appUrl = Deno.env.get('FLOW_APP_URL') ?? Deno.env.get('PUBLIC_URL')

    if (!flowApiKey || !flowSecretKey) throw new Error('Pagos no configurados. Contacta soporte.')
    if (!appUrl) throw new Error('FLOW_APP_URL no está configurado')

    // Find or create Flow customer (needed for future card-based subscriptions)
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
        provider_customer_id: flowCustomerId,
      })
    }

    const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/flow-webhook`
    const commerceOrder = crypto.randomUUID().replace(/-/g, '').slice(0, 20)

    // Cancel stale pending_payment rows (clean retry)
    await supabaseAdmin
      .from('subscriptions')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('product', 'soly')
      .eq('status', 'pending_payment')

    // Insert subscription row BEFORE calling Flow so the webhook can find it
    const { error: insertError } = await supabaseAdmin.from('subscriptions').insert({
      user_id: user.id,
      product: 'soly',
      plan: validPlan,
      status: 'pending_payment',
      provider: 'flow',
      provider_subscription_id: commerceOrder,
      trial_ends_at: null,
    })
    if (insertError) {
      throw new Error('Error al registrar la suscripción: ' + insertError.message)
    }

    const payment = await flowPost<FlowPayResponse>(
      '/payment/create',
      {
        commerceOrder,
        subject: `Soly · Plan ${validPlan} mensual`,
        currency: 'CLP',
        amount: PLAN_AMOUNT[validPlan],
        email: user.email ?? '',
        urlConfirmation: webhookUrl,
        urlReturn: `${appUrl}/api/flow-return`,
      },
      flowApiKey,
      flowSecretKey
    )

    return new Response(
      JSON.stringify({ url: `${payment.url}?token=${payment.token}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Error al crear suscripción' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
