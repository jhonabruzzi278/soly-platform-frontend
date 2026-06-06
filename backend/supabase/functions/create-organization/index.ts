import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const apikey = req.headers.get("apikey");
  if (!apikey || apikey !== supabaseAnonKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
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

    let userId: string;

    if (createError) {
      if (createError.message.includes("already been registered")) {
        const { data: existing } = await adminClient.auth.admin.listUsers();
        const found = existing?.users?.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
        if (!found) throw new Error("Usuario no encontrado");
        userId = found.id;
      } else {
        throw createError;
      }
    } else {
      userId = created.user!.id;
    }

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
        await adminClient.from("memberships").insert({ tenant_id: org2.id, user_id: userId, role: "owner" }).onConflict("user_id,tenant_id").ignore();
        await adminClient.from("tenant_seats").insert({ tenant_id: org2.id, user_id: userId, is_active: true }).onConflict("user_id,tenant_id").ignore();
        const trialEnds2 = new Date(); trialEnds2.setDate(trialEnds2.getDate() + 14);
        await adminClient.from("subscriptions").upsert({ user_id: userId, product: "soly", plan: plan || "starter", status: "trialing", trial_ends_at: trialEnds2.toISOString() }, { onConflict: "user_id,product" });
        return new Response(JSON.stringify({ tenant_id: org2.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      throw orgError;
    }

    await adminClient.from("memberships").insert({ tenant_id: org.id, user_id: userId, role: "owner" }).onConflict("user_id,tenant_id").ignore();
    await adminClient.from("tenant_seats").insert({ tenant_id: org.id, user_id: userId, is_active: true }).onConflict("user_id,tenant_id").ignore();

    // Crear trial de 14 dias
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    await adminClient.from("subscriptions").upsert({
      user_id: userId, product: "soly", plan: plan || "starter",
      status: "trialing", trial_ends_at: trialEnds.toISOString()
    }, { onConflict: "user_id,product" });

    return new Response(JSON.stringify({ tenant_id: org.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

