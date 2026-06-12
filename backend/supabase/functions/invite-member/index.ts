import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'
import { applyRateLimit } from '../_shared/rate-limit.ts'

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

    const rateLimitResponse = await applyRateLimit(req, 'invite-member', user.id)
    if (rateLimitResponse) return rateLimitResponse

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
      .select('plan, slug')
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

    // Generate a single-use invitation token (server-side source of truth).
    // The auth trigger validates this token against public.invitations on
    // signup — it never trusts the role/tenant from client-supplied metadata.
    const tokenBytes = new Uint8Array(32)
    crypto.getRandomValues(tokenBytes)
    const inviteToken = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, '0')).join('')

    const { error: invitationError } = await supabaseAdmin.from('invitations').insert({
      tenant_id,
      email: email.trim().toLowerCase(),
      role,
      token: inviteToken,
      invited_by: user.id
    })

    if (invitationError) {
      throw invitationError
    }

    // Always invite by email — the auth trigger will create the membership
    // (using the role from the invitations row) when the user accepts and
    // signs up. This avoids paginating all users.
    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: {
        tenant_id,
        tenant_name: tenant.slug ?? tenant_id,
        invite_token: inviteToken
      }
    })

    if (inviteError) {
      throw inviteError
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
