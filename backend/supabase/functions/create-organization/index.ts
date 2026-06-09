import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts'

const ALLOWED_PLANS = ['starter'] as const
const SLUG_REGEX = /^[a-z0-9]{1,30}$/

Deno.serve(async (req) => {
  const corsResponse = handleCorsOptions(req)
  if (corsResponse) return corsResponse

  const corsHeaders = getCorsHeaders(req)

  try {
    const { email, password, business_name, slug, plan: rawPlan } = await req.json()

    if (!email || !password || !business_name || !slug) {
      throw new Error('Missing required fields')
    }

    if (typeof email !== 'string' || !email.includes('@') || email.length > 254) {
      throw new Error('Invalid email format')
    }

    if (!SLUG_REGEX.test(slug)) {
      throw new Error('Invalid slug format: lowercase alphanumeric, max 30 chars')
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw new Error('Password must be between 8 and 128 characters')
    }

    const plan = (ALLOWED_PLANS as readonly string[]).includes(rawPlan) ? rawPlan : 'starter'

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: existingTenant } = await supabaseAdmin
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle()

    if (existingTenant) {
      throw new Error('Organization slug already taken')
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        name: business_name,
        tenant_name: business_name,
        tenant_id: slug,
        plan,
        role: 'owner'
      }
    })

    if (authError) {
      throw authError
    }

    return new Response(
      JSON.stringify({ tenant_id: slug, user_id: authData.user.id }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Registration failed' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
