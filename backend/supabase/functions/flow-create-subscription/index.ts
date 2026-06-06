import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { getFlowCredentials, getPlanId, flowApiCall } from "../_flow/api.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const publicUrl = Deno.env.get("PUBLIC_URL") ?? "http://localhost:5173";
const adminClient = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
    const { data: userData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { plan } = await req.json();
    if (!plan) {
      return new Response(JSON.stringify({ error: "Falta plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { apiKey, secretKey } = getFlowCredentials();
    const planId = getPlanId(plan);
    const userId = userData.user.id;
    const email = userData.user.email ?? "";
    const commerceOrder = `soly-${userId.slice(0, 8)}-${Date.now()}`;

    const params: Record<string, string> = {
      apiKey, planId, customerEmail: email,
      customerName: email.split("@")[0],
      commerceOrder,
      urlConfirmation: `${publicUrl}/billing?billing=success`,
      urlReturn: `${publicUrl}/billing?billing=cancelled`
    };

    const result = await flowApiCall("/subscription/create", params, secretKey) as { url?: string };
    if (!result.url) throw new Error("Flow no devolvio URL de pago");

    await adminClient.from("billing_customers").upsert({ user_id: userId, email, provider: "flow" }, { onConflict: "user_id,provider" });

    return new Response(JSON.stringify({ url: result.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
