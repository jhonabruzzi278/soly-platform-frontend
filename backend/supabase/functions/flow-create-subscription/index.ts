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
    const { user_id, plan, product = "soly" } = await req.json();
    if (!user_id || !plan) {
      return new Response(JSON.stringify({ error: "Faltan user_id y plan" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { apiKey, secretKey } = getFlowCredentials();
    const planId = getPlanId(plan);

    const { data: user } = await adminClient.auth.admin.getUserById(user_id);
    if (!user?.user) throw new Error("Usuario no encontrado");

    const email = user.user.email ?? "";
    const commerceOrder = `${product}-${user_id.slice(0, 8)}-${Date.now()}`;

    const params: Record<string, string> = {
      apiKey, planId, customerEmail: email,
      customerName: email.split("@")[0],
      commerceOrder,
      urlConfirmation: `${publicUrl}/billing?billing=success`,
      urlReturn: `${publicUrl}/billing?billing=cancelled`
    };

    const result = await flowApiCall("/subscription/create", params, secretKey) as { url?: string };
    if (!result.url) throw new Error("Flow no devolvio URL de pago");

    // Guardar intento de suscripcion
    await adminClient.from("billing_customers").upsert({ user_id, email: email, provider: "flow" }, { onConflict: "user_id,provider" });

    return new Response(JSON.stringify({ url: result.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
