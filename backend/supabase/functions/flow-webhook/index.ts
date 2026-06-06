import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { getFlowCredentials, flowApiCall } from "../_flow/api.ts";

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
    const token = params.token ?? params.flowToken ?? "";
    const customerEmail = params.customerEmail ?? params.payerEmail ?? "";
    const planId = params.planId ?? params.subscriptionPlanId ?? "";

    if (!token) {
      return new Response(JSON.stringify({ error: "Falta token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Verificar el pago contra la API de Flow (no confiar en el POST entrante)
    const { apiKey, secretKey } = getFlowCredentials();
    const statusResult = await flowApiCall("/payment/getStatus", { apiKey, token }, secretKey) as {
      status?: number; flowOrder?: number; commerceOrder?: string;
    };

    // Flow status: 1=pending, 2=paid, 3=rejected, 4=cancelled
    if (!statusResult.status || statusResult.status !== 2) {
      return new Response(JSON.stringify({
        received: true, action: "ignored",
        reason: `status=${statusResult.status}, not confirmed`
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const planName = planIdToName[planId] ?? "business";

    const { data: cust } = await adminClient.from("billing_customers")
      .select("user_id").eq("email", customerEmail).maybeSingle();

    if (!cust) {
      return new Response(JSON.stringify({
        received: true, action: "ignored", reason: "no billing customer"
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await adminClient.from("subscriptions").upsert({
      user_id: cust.user_id, product: "soly", plan: planName,
      status: "active", provider: "flow",
      provider_subscription_id: String(statusResult.flowOrder ?? token),
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
