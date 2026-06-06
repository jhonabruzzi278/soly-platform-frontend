import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey);

const planIdToName: Record<string, string> = {};

function initPlanMap() {
  const pro = Deno.env.get("FLOW_PRO_PLAN_ID");
  const business = Deno.env.get("FLOW_BUSINESS_PLAN_ID");
  const enterprise = Deno.env.get("FLOW_ENTERPRISE_PLAN_ID");
  if (pro) planIdToName[pro] = "pro";
  if (business) planIdToName[business] = "business";
  if (enterprise) planIdToName[enterprise] = "enterprise";
}
initPlanMap();

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const params = await req.json().catch(() => ({}));
    const providerSubscriptionId = params.subscriptionId ?? params.flowSubscriptionId ?? "";
    const customerEmail = params.customerEmail ?? params.payerEmail ?? "";
    const planId = params.planId ?? params.subscriptionPlanId ?? "";
    const status = String(params.status ?? "1");

    if (!providerSubscriptionId) {
      return new Response(JSON.stringify({ error: "Falta subscriptionId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (status !== "1") {
      return new Response(JSON.stringify({ received: true, action: "ignored", reason: `status=${status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const planName = planIdToName[planId] ?? "business";

    // Buscar el billing customer por email
    const { data: cust } = await adminClient.from("billing_customers").select("user_id").eq("email", customerEmail).maybeSingle();
    if (!cust) {
      return new Response(JSON.stringify({ received: true, action: "ignored", reason: "no billing customer found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Crear o actualizar suscripcion para soly
    await adminClient.from("subscriptions").upsert({
      user_id: cust.user_id,
      product: "soly",
      plan: planName,
      status: "active",
      provider: "flow",
      provider_subscription_id: providerSubscriptionId,
      provider_customer_id: customerEmail,
      current_period_start: new Date().toISOString()
    }, { onConflict: "user_id,product" });

    return new Response(JSON.stringify({ received: true, user_id: cust.user_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
