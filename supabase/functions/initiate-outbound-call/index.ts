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
    const { phoneNumberId, toNumber } = await req.json();

    if (!phoneNumberId || typeof phoneNumberId !== "string") {
      return new Response(JSON.stringify({ error: "Missing phoneNumberId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!toNumber || typeof toNumber !== "string") {
      return new Response(JSON.stringify({ error: "Missing toNumber" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toNumberTrimmed = toNumber.trim();
    // Basic E.164 validation: + followed by country code and up to 15 digits.
    // Vobiz/SIP integrations typically require E.164.
    const e164Ok = /^\+[1-9]\d{1,14}$/.test(toNumberTrimmed);
    if (!e164Ok) {
      return new Response(JSON.stringify({
        error: "toNumber must be E.164 format (e.g. +14155550100)",
        toNumber: toNumberTrimmed,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate the user owns the client attached to this phone number.
    const { data: clientRow } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (!clientRow) {
      return new Response(JSON.stringify({ error: "Client profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: phoneRow, error: phoneError } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, assigned_client_id, assigned_agent_id, elevenlabs_phone_number_id")
      .eq("id", phoneNumberId)
      .maybeSingle();

    if (phoneError) throw new Error("Failed to load phone number: " + phoneError.message);
    if (!phoneRow) {
      return new Response(JSON.stringify({ error: "Phone number not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (phoneRow.assigned_client_id !== clientRow.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!phoneRow.assigned_agent_id) {
      return new Response(JSON.stringify({ error: "No agent assigned to this phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!phoneRow.elevenlabs_phone_number_id) {
      return new Response(JSON.stringify({ error: "This phone number is not imported into ElevenLabs yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: agentRow, error: agentError } = await supabaseAdmin
      .from("agents")
      .select("id, client_id, elevenlabs_agent_id")
      .eq("id", phoneRow.assigned_agent_id)
      .maybeSingle();

    if (agentError) throw new Error("Failed to load agent: " + agentError.message);
    if (!agentRow || !agentRow.elevenlabs_agent_id) {
      return new Response(JSON.stringify({ error: "Agent not provisioned in ElevenLabs yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    const outboundPayload = {
      agent_id: agentRow.elevenlabs_agent_id,
      agent_phone_number_id: phoneRow.elevenlabs_phone_number_id,
      to_number: toNumberTrimmed,
    };

    const elevenlabsRes = await fetch("https://api.elevenlabs.io/v1/convai/sip-trunk/outbound-call", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(outboundPayload),
    });

    const responseJson = await elevenlabsRes.json().catch(() => null);
    if (!elevenlabsRes.ok) {
      throw new Error(`ElevenLabs API error [${elevenlabsRes.status}]: ${JSON.stringify(responseJson ?? null)}`);
    }

    // ElevenLabs may return a 200 with { success: false, message: ... }.
    const responseSuccess = typeof responseJson === "object" && responseJson !== null
      ? (responseJson as { success?: boolean }).success
      : undefined;

    if (responseSuccess === false) {
      const msg = typeof responseJson === "object" && responseJson !== null
        ? (responseJson as { message?: string }).message
        : undefined;

      return new Response(JSON.stringify({
        success: false,
        message: msg ?? "ElevenLabs failed to initiate SIP call",
        response: responseJson,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record the call attempt in our bookings table.
    const conversationId = responseJson?.conversation_id ?? null;
    const sipCallId = responseJson?.sip_call_id ?? null;

    const { error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        client_id: clientRow.id,
        agent_id: phoneRow.assigned_agent_id,
        booking_type: "outbound_call",
        customer_phone: toNumberTrimmed,
        status: "pending",
        elevenlabs_conversation_id: conversationId,
        notes: conversationId || sipCallId ? JSON.stringify({ conversationId, sipCallId }) : null,
        date_time: new Date().toISOString(),
      });

    if (bookingError) {
      // Don't fail the API call if booking insert fails; just return the call response.
      console.error("Failed to insert booking:", bookingError.message);
    }

    return new Response(JSON.stringify({
      success: true,
      conversation_id: conversationId,
      sip_call_id: sipCallId,
      response: responseJson,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("initiate-outbound-call error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

