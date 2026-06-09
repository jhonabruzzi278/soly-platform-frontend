import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from 'https://deno.land/std@0.177.0/node/crypto.ts'

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.text()
    const signature = req.headers.get('X-Flow-Signature')

    const flowSecretKey = Deno.env.get('FLOW_SECRET_KEY')
    if (!flowSecretKey) {
      throw new Error('Flow secret key not configured')
    }

    if (signature) {
      const hmac = createHmac('sha256', flowSecretKey)
      hmac.update(body)
      const expectedSignature = hmac.digest('hex')

      if (signature !== expectedSignature) {
        throw new Error('Invalid signature')
      }
    }

    const payload = JSON.parse(body)
    const eventType = payload.event || payload.type
    const subscriptionId = payload.subscription_id || payload.data?.subscription_id

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

    await supabaseAdmin.from('billing_webhook_events').insert({
      provider: 'flow',
      event_type: eventType,
      raw_payload: payload,
      subscription_id: dbSubscription?.id || null,
      processed: false
    })

    if (eventType === 'subscription.paid' || eventType === 'payment.completed') {
      if (dbSubscription) {
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
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

    return new Response(
      JSON.stringify({ received: true }),
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
