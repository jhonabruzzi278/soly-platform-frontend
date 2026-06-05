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
        JSON.stringify({ error: "Faltan campos requeridos: email, password, business_name, slug" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: business_name }
    });

    if (createError) {
      if (createError.message.includes("already been registered")) {
        const { data: existing } = await adminClient.auth.admin.listUsers();
        const found = existing?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
        if (found) {
          const { data: members } = await adminClient
            .from("memberships")
            .select("tenant_id")
            .eq("user_id", found.id)
            .limit(1)
            .maybeSingle();
          if (members) {
            await adminClient.auth.admin.generateLink({
              type: "magiclink", email, options: { redirectTo: (req.headers.get("origin") ?? supabaseUrl) + "/dashboard" }
            } as any);
            return new Response(JSON.stringify({ tenant_id: members.tenant_id, email_sent: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
          }
        }
      }
      throw createError;
    }

    const userId = created.user!.id;

    const { data: org, error: orgError } = await adminClient
      .from("tenants")
      .insert({ slug, business_name, plan })
      .select()
      .single();

    if (orgError) {
      if (orgError.message.includes("tenants_slug_key")) {
        const altSlug = slug + "-" + userId.slice(0, 8);
        const { data: org2, error: org2Error } = await adminClient
          .from("tenants")
          .insert({ slug: altSlug, business_name, plan })
          .select()
          .single();
        if (org2Error) throw org2Error;
        await adminClient.from("memberships").insert({ tenant_id: org2.id, user_id: userId, role: "owner" });
        await adminClient.from("tenant_seats").insert({ tenant_id: org2.id, user_id: userId, is_active: true });
        await adminClient.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: (req.headers.get("origin") ?? supabaseUrl) + "/dashboard" } } as any);
        return new Response(JSON.stringify({ tenant_id: org2.id, email_sent: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw orgError;
    }

    await adminClient.from("memberships").insert({ tenant_id: org.id, user_id: userId, role: "owner" });
    await adminClient.from("tenant_seats").insert({ tenant_id: org.id, user_id: userId, is_active: true });

    await adminClient.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: (req.headers.get("origin") ?? supabaseUrl) + "/dashboard" } } as any);

    return new Response(JSON.stringify({ tenant_id: org.id, email_sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

