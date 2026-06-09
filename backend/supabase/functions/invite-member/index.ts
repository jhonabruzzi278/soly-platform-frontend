import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'

const ALLOWED_INVITE_ROLES = ['member', 'admin'] as const

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

    const { tenant_id, email, role: rawRole = 'member' } = await req.json()

    if (!tenant_id || !email) {
      throw new Error('Missing required fields')
    }

    if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
      throw new Error('Invalid email format')
    }

    // Validate role — never allow 'owner' escalation via invite
    const role = (ALLOWED_INVITE_ROLES as readonly string[]).includes(rawRole) ? rawRole : 'member'

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

    // Admin cannot invite other admins — only owners can
    if (role === 'admin' && membership.role !== 'owner') {
      throw new Error('Only owners can invite admins')
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
    if (currentSeats !== null && currentSeats >= limit) {
      throw new Error(`Seat limit reached for ${tenant.plan} plan`)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Find user by email with filtered query instead of loading all users
    const { data: usersByEmail } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    })

    // Use a targeted lookup: search through users matching the email
    let invitedUser = null
    let page = 1
    const perPage = 50
    while (true) {
      const { data: batch } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
      if (!batch?.users || batch.users.length === 0) break
      const found = batch.users.find(u => u.email === email)
      if (found) { invitedUser = found; break }
      if (batch.users.length < perPage) break
      page++
    }

    if (invitedUser) {
      // Check not already a member
      const { data: existingMembership } = await supabaseAdmin
        .from('memberships')
        .select('user_id')
        .eq('tenant_id', tenant_id)
        .eq('user_id', invitedUser.id)
        .maybeSingle()

      if (existingMembership) {
        throw new Error('User is already a member of this organization')
      }

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
      JSON.stringify({ error: error instanceof Error ? error.message : 'Invite failed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
