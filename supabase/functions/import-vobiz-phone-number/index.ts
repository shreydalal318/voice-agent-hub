import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const userId = user.id;
    const { phoneNumberId, force } = await req.json();

    if (!phoneNumberId || typeof phoneNumberId !== "string") {
      return new Response(JSON.stringify({ error: "Missing phoneNumberId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Only admins can sync/import phone numbers.
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!roleRow || roleRow.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: phone, error: phoneError } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, number, label, elevenlabs_phone_number_id")
      .eq("id", phoneNumberId)
      .maybeSingle();

    if (phoneError) {
      throw new Error("Failed to load phone number: " + phoneError.message);
    }
    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone number not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (phone.elevenlabs_phone_number_id && !force) {
      return new Response(JSON.stringify({
        success: true,
        elevenlabs_phone_number_id: phone.elevenlabs_phone_number_id,
        already_imported: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const VOBIZ_SIP_DOMAIN = Deno.env.get("VOBIZ_SIP_DOMAIN");
    const VOBIZ_USERNAME = Deno.env.get("VOBIZ_USERNAME");
    const VOBIZ_PASSWORD = Deno.env.get("VOBIZ_PASSWORD");
    const VOBIZ_TRANSPORT = Deno.env.get("VOBIZ_TRANSPORT") ?? "tcp";

    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
    if (!VOBIZ_SIP_DOMAIN) throw new Error("VOBIZ_SIP_DOMAIN is not configured");
    if (!VOBIZ_USERNAME) throw new Error("VOBIZ_USERNAME is not configured");
    if (!VOBIZ_PASSWORD) throw new Error("VOBIZ_PASSWORD is not configured");

    // Match the integration format in `doc.txt` (outbound calling).
    // This shape uses `outbound_trunk` with username/password directly.
    const importPayload = {
      phone_number: phone.number,
      label: phone.label ?? "Vobiz Main Line",
      provider: "sip_trunk",
      outbound_trunk: {
        address: VOBIZ_SIP_DOMAIN,
        transport: VOBIZ_TRANSPORT,
        username: VOBIZ_USERNAME,
        password: VOBIZ_PASSWORD,
      },
      // Helps ElevenLabs advertise capabilities for the number.
      supports_inbound: true,
      supports_outbound: true,
    };

    const elevenlabsRes = await fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(importPayload),
    });

    if (!elevenlabsRes.ok) {
      const errBody = await elevenlabsRes.text();
      throw new Error(`ElevenLabs API error [${elevenlabsRes.status}]: ${errBody}`);
    }

    const elevenlabsData = await elevenlabsRes.json();
    const elevenlabsPhoneNumberId = elevenlabsData.phone_number_id ?? elevenlabsData.id;

    if (!elevenlabsPhoneNumberId || typeof elevenlabsPhoneNumberId !== "string") {
      throw new Error("ElevenLabs did not return phone_number_id");
    }

    const { error: updateError } = await supabaseAdmin
      .from("phone_numbers")
      .update({ elevenlabs_phone_number_id: elevenlabsPhoneNumberId })
      .eq("id", phoneNumberId);

    if (updateError) {
      throw new Error("Failed saving elevenlabs_phone_number_id: " + updateError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      phone_number_id: phoneNumberId,
      elevenlabs_phone_number_id: elevenlabsPhoneNumberId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("import-vobiz-phone-number error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

