import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'

const VALID_PLANS = ['pro', 'business', 'enterprise'] as const

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

    const { plan } = await req.json()
    if (!plan || !(VALID_PLANS as readonly string[]).includes(plan)) {
      throw new Error('Invalid plan')
    }

    const flowApiKey = Deno.env.get('FLOW_API_KEY')
    const flowSecretKey = Deno.env.get('FLOW_SECRET_KEY')

    if (!flowApiKey || !flowSecretKey) {
      throw new Error('Flow.cl not configured')
    }

    // Idempotency: check for existing active/trialing subscription
    const { data: existingSub } = await supabaseClient
      .from('subscriptions')
      .select('id, status, plan')
      .eq('user_id', user.id)
      .eq('product', 'soly')
      .in('status', ['active', 'trialing'])
      .maybeSingle()

    if (existingSub) {
      throw new Error(`You already have an active ${existingSub.plan} subscription`)
    }

    const planPrices: Record<string, number> = {
      pro: 19000,
      business: 49000,
      enterprise: 99000
    }

    const flowResponse = await fetch('https://api.flow.cl/api/v2/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${flowApiKey}`
      },
      body: JSON.stringify({
        customer_email: user.email,
        plan_id: plan,
        amount: planPrices[plan],
        currency: 'CLP',
        interval: 'month',
        trial_days: 14,
        metadata: {
          user_id: user.id,
          plan
        }
      })
    })

    if (!flowResponse.ok) {
      throw new Error('Failed to create subscription with payment provider')
    }

    const flowData = await flowResponse.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    await supabaseAdmin.from('subscriptions').insert({
      user_id: user.id,
      product: 'soly',
      plan,
      status: 'trialing',
      provider: 'flow',
      provider_subscription_id: flowData.subscription_id,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    })

    return new Response(
      JSON.stringify({ url: flowData.payment_url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Subscription creation failed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
