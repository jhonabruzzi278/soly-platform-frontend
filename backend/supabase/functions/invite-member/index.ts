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

    const { tenant_id, email, role = 'member' } = await req.json()

    if (!tenant_id || !email) {
      throw new Error('Missing required fields')
    }

    const { data: membership, error: membershipError } = await supabaseClient
      .from('memberships')
      .select('role')
      .eq('tenant_id', tenant_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      throw new Error('Not a member of this tenant')
    }

    if (!['owner', 'admin'].includes(membership.role)) {
      throw new Error('Insufficient permissions')
    }

    const { data: tenant, error: tenantError } = await supabaseClient
      .from('tenants')
      .select('plan')
      .eq('id', tenant_id)
      .single()

    if (tenantError || !tenant) {
      throw new Error('Tenant not found')
    }

    const seatLimits: Record<string, number> = {
      starter: 1,
      pro: 5,
      business: 20,
      enterprise: Infinity
    }

    const { count: currentSeats } = await supabaseClient
      .from('tenant_seats')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenant_id)
      .eq('is_active', true)

    const limit = seatLimits[tenant.plan] || 1
    if (currentSeats && currentSeats >= limit) {
      throw new Error(`Seat limit reached for ${tenant.plan} plan`)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers()
    const invitedUser = existingUser?.users.find(u => u.email === email)

    if (invitedUser) {
      await supabaseAdmin.from('memberships').insert({
        tenant_id,
        user_id: invitedUser.id,
        role
      })

      await supabaseAdmin.from('tenant_seats').insert({
        tenant_id,
        user_id: invitedUser.id,
        is_active: true
      })

      await supabaseAdmin.from('profiles').update({ tenant_id }).eq('id', invitedUser.id)
    } else {
      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        data: {
          tenant_id,
          tenant_name: tenant_id,
          role,
          invited_by: user.id
        }
      })

      if (inviteError) {
        throw inviteError
      }
    }

    return new Response(
      JSON.stringify({ success: true, invited: email }),
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
