import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { getFlowCredentials, getPlanId, flowApiCall } from "../_flow/api.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicUrl = Deno.env.get("PUBLIC_URL") ?? "http://localhost:5173";
const adminClient = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenant_id, plan } = await req.json();

    if (!tenant_id || !plan) {
      return new Response(JSON.stringify({ error: "Faltan tenant_id y plan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { apiKey, secretKey } = getFlowCredentials();
    const planId = getPlanId(plan);

    const { data: org, error: orgError } = await adminClient
      .from("tenants")
      .select("slug, business_name")
      .eq("id", tenant_id)
      .single();

    if (orgError) throw orgError;

    const { data: member } = await adminClient
      .from("memberships")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .eq("role", "owner")
      .single();

    let customerEmail = "";
    if (member) {
      const { data: authUser } = await adminClient.auth.admin.getUserById(member.user_id);
      customerEmail = authUser.user?.email ?? "";
    }

    const commerceOrder = `${org.slug}-${Date.now()}`;
    const confirmationUrl = `${publicUrl}/billing?billing=success`;
    const returnUrl = `${publicUrl}/billing?billing=cancelled`;

    const params: Record<string, string> = {
      apiKey,
      planId,
      customerEmail,
      customerName: org.business_name,
      commerceOrder,
      urlConfirmation: confirmationUrl,
      urlReturn: returnUrl
    };

    const result = await flowApiCall("/subscription/create", params, secretKey) as { url?: string; token?: string; flowOrder?: number };

    if (!result.url) {
      throw new Error("Flow no devolvio URL de pago");
    }

    return new Response(JSON.stringify({ url: result.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
