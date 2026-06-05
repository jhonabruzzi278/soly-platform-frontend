import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";
import { getFlowCredentials } from "../_flow/api.ts";

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
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const params = await req.json().catch(() => ({}));
    const subscriptionId = params.subscriptionId ?? params.flowSubscriptionId ?? "";
    const customerEmail = params.customerEmail ?? params.payerEmail ?? "";
    const planId = params.planId ?? params.subscriptionPlanId ?? "";
    const status = String(params.status ?? "1");

    if (!subscriptionId) {
      return new Response(JSON.stringify({ error: "Falta subscriptionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (status !== "1" && status !== "2") {
      return new Response(JSON.stringify({ received: true, action: "ignored", reason: `status=${status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const planName = planIdToName[planId] ?? "pro";

    if (status === "1") {
      await adminClient.rpc("handle_flow_webhook", {
        p_flow_subscription_id: subscriptionId,
        p_flow_customer_email: customerEmail,
        p_plan: planName
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
