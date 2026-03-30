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

    const { phoneNumberId, agentId } = await req.json();

    if (!phoneNumberId || typeof phoneNumberId !== "string") {
      return new Response(JSON.stringify({ error: "Missing phoneNumberId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // agentId may be null (when user selects "— No agent —")
    const maybeAgentId = agentId === "none" ? null : agentId;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: clientRow, error: clientError } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (clientError) throw new Error("Failed to load client: " + clientError.message);
    if (!clientRow) {
      return new Response(JSON.stringify({ error: "Client profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: phoneRow, error: phoneError } = await supabaseAdmin
      .from("phone_numbers")
      .select("id, assigned_client_id, elevenlabs_phone_number_id")
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
    if (!phoneRow.elevenlabs_phone_number_id) {
      return new Response(JSON.stringify({ error: "Phone number not synced into ElevenLabs yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");

    // If no agent is selected, we attempt to clear the assignment.
    // ElevenLabs may reject null/empty; if so, we return a clear message.
    let patchBody: Record<string, unknown> = {};
    if (maybeAgentId) {
      const { data: agentRow, error: agentError } = await supabaseAdmin
        .from("agents")
        .select("id, client_id, elevenlabs_agent_id")
        .eq("id", maybeAgentId)
        .maybeSingle();

      if (agentError) throw new Error("Failed to load agent: " + agentError.message);
      if (!agentRow || !agentRow.elevenlabs_agent_id) {
        return new Response(JSON.stringify({ error: "Selected agent is not provisioned in ElevenLabs yet" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (agentRow.client_id !== clientRow.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      patchBody = { agent_id: agentRow.elevenlabs_agent_id };
    } else {
      patchBody = { agent_id: null };
    }

    const elevenlabsRes = await fetch(
      `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneRow.elevenlabs_phone_number_id}`,
      {
        method: "PATCH",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patchBody),
      },
    );

    if (!elevenlabsRes.ok) {
      const errBody = await elevenlabsRes.text();
      return new Response(JSON.stringify({
        error: `ElevenLabs API error [${elevenlabsRes.status}]: ${errBody}`,
      }), {
        status: elevenlabsRes.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-elevenlabs-phone-number-agent error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

