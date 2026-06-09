import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

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
    if (!plan || !['pro', 'business', 'enterprise'].includes(plan)) {
      throw new Error('Invalid plan')
    }

    const flowApiKey = Deno.env.get('FLOW_API_KEY')
    const flowSecretKey = Deno.env.get('FLOW_SECRET_KEY')

    if (!flowApiKey || !flowSecretKey) {
      throw new Error('Flow.cl not configured')
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
      const error = await flowResponse.text()
      throw new Error(`Flow.cl error: ${error}`)
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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
