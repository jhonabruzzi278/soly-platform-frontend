import { createClient } from "@supabase/supabase-js";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const adminClient = createClient(supabaseUrl, serviceRoleKey);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization")!;
    const { user } = await adminClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, email, role = "member" } = await req.json();

    // Verify inviter is admin/owner
    const { data: inviter } = await adminClient
      .from("memberships")
      .select("role")
      .eq("tenant_id", tenant_id)
      .eq("user_id", user.id)
      .single();

    if (!inviter || !["owner", "admin"].includes(inviter.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check seat limit
    const { count: activeSeats } = await adminClient
      .from("tenant_seats")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    const { data: org } = await adminClient
      .from("tenants")
      .select("plan")
      .eq("id", tenant_id)
      .single();

    const SEAT_LIMITS: Record<string, number> = {
      starter: 1, pro: 5, business: 20, enterprise: 999
    };

    const limit = SEAT_LIMITS[org?.plan ?? "starter"] ?? 1;
    if ((activeSeats ?? 0) >= limit) {
      return new Response(
        JSON.stringify({ error: `Límite de seats alcanzado para el plan ${org?.plan}. Upgrade para agregar más usuarios.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create or find user
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { tenant_id, role }
    });

    if (createError) throw createError;

    if (created.user) {
      await adminClient.from("memberships").insert({
        tenant_id,
        user_id: created.user.id,
        role
      });

      await adminClient.from("tenant_seats").insert({
        tenant_id,
        user_id: created.user.id,
        is_active: true
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
