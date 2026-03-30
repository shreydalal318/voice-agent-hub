import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { e164, currency, label } = await req.json();

    if (!e164 || typeof e164 !== "string") {
      return new Response(JSON.stringify({ error: "Missing e164" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin-only
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!roleRow || roleRow.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VOBIZ_X_AUTH_ID = Deno.env.get("VOBIZ_X_AUTH_ID");
    const VOBIZ_X_AUTH_TOKEN = Deno.env.get("VOBIZ_X_AUTH_TOKEN");
    if (!VOBIZ_X_AUTH_ID) throw new Error("VOBIZ_X_AUTH_ID is not configured");
    if (!VOBIZ_X_AUTH_TOKEN) throw new Error("VOBIZ_X_AUTH_TOKEN is not configured");

    const purchaseRes = await fetch(
      `https://api.vobiz.ai/api/v1/account/${encodeURIComponent(VOBIZ_X_AUTH_ID)}/numbers/purchase-from-inventory`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-ID": VOBIZ_X_AUTH_ID,
          "X-Auth-Token": VOBIZ_X_AUTH_TOKEN,
        },
        body: JSON.stringify({ e164, currency }),
      },
    );

    const purchaseBody = await purchaseRes.json().catch(() => null);
    if (!purchaseRes.ok) {
      throw new Error(`Vobiz API error [${purchaseRes.status}]: ${JSON.stringify(purchaseBody ?? null)}`);
    }

    const purchasedNumber = purchaseBody?.number;
    const vobizPhoneNumberId = purchasedNumber?.id;
    const e164Purchased = purchasedNumber?.e164 ?? e164;

    if (!vobizPhoneNumberId) {
      throw new Error("Vobiz did not return number.id");
    }

    // Upsert into our DB by E.164 number.
    const { data: phoneRow, error: phoneRowError } = await supabaseAdmin
      .from("phone_numbers")
      .upsert({
        number: e164Purchased,
        label: label ?? null,
        status: "available",
        vobiz_phone_number_id: String(vobizPhoneNumberId),
      }, { onConflict: "number" })
      .select("id, number")
      .single();

    if (phoneRowError) {
      // In some Supabase versions, upsert+select.single behaves differently; fall back.
      const { data: existing } = await supabaseAdmin
        .from("phone_numbers")
        .select("id, number")
        .eq("number", e164Purchased)
        .maybeSingle();

      if (!existing) throw new Error("Failed to save phone number to DB");
      // Assign this purchased number to the configured Vobiz inbound/outbound trunk.
      // Don't fail the purchase if assignment fails.
      let trunkAssignment: unknown = null;
      let trunkAssignmentError: unknown = null;
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const assignUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/vobiz-assign-phone-number-to-trunk`;
        const assignRes = await fetch(assignUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify({ e164: e164Purchased }),
        });

        const assignBody = await assignRes.json().catch(() => null);
        if (!assignRes.ok) {
          trunkAssignmentError = { status: assignRes.status, response: assignBody };
        } else {
          trunkAssignment = assignBody;
        }
      } catch (e) {
        trunkAssignmentError = { message: e instanceof Error ? e.message : "Unknown error" };
      }

      return new Response(JSON.stringify({
        success: true,
        phone_number_id: existing.id,
        number: existing.number,
        vobiz_phone_number_id: String(vobizPhoneNumberId),
        trunk_assignment: trunkAssignment,
        trunk_assignment_error: trunkAssignmentError,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Assign this purchased number to the configured Vobiz inbound/outbound trunk.
    // We intentionally don't fail the purchase if assignment fails; we return the error to the UI.
    let trunkAssignment: unknown = null;
    let trunkAssignmentError: unknown = null;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const assignUrl = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/vobiz-assign-phone-number-to-trunk`;
      const assignRes = await fetch(assignUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({ e164: e164Purchased }),
      });

      const assignBody = await assignRes.json().catch(() => null);
      if (!assignRes.ok) {
        trunkAssignmentError = { status: assignRes.status, response: assignBody };
      } else {
        trunkAssignment = assignBody;
      }
    } catch (e) {
      trunkAssignmentError = { message: e instanceof Error ? e.message : "Unknown error" };
    }

    return new Response(JSON.stringify({
      success: true,
      phone_number_id: phoneRow.id,
      number: phoneRow.number,
      vobiz_phone_number_id: String(vobizPhoneNumberId),
      trunk_assignment: trunkAssignment,
      trunk_assignment_error: trunkAssignmentError,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

