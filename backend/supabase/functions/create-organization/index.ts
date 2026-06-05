import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, password, business_name, slug, plan = "starter" } = await req.json();

    if (!email || !password || !business_name || !slug) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create auth user
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: business_name }
    });

    if (createError) throw createError;
    if (!created.user) throw new Error("No se pudo crear el usuario");

    const userId = created.user.id;

    // Create organization
    const { data: org, error: orgError } = await adminClient
      .from("tenants")
      .insert({ slug, business_name, plan })
      .select()
      .single();

    if (orgError) throw orgError;

    // Add owner as member
    await adminClient.from("memberships").insert({
      tenant_id: org.id,
      user_id: userId,
      role: "owner"
    });

    // Add seat
    await adminClient.from("tenant_seats").insert({
      tenant_id: org.id,
      user_id: userId,
      is_active: true
    });

    return new Response(JSON.stringify({ tenant_id: org.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
