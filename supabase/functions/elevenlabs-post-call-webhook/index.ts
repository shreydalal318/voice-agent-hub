import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ElevenLabsClient } from "https://esm.sh/@elevenlabs/elevenlabs-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
};

type ElevenLabsWebhookEvent = {
  type?: string;
  data?: {
    agent_id?: string;
    conversation_id?: string;
    from_number?: string | number | null;
    to_number?: string | number | null;
    analysis?: {
      call_successful?: boolean;
      transcript_summary?: string | null;
      transcriptSummary?: string | null;
    };
    failure_reason?: string | null;
    metadata?: Record<string, unknown>;
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // This webhook should be public; auth is via ElevenLabs HMAC signature.
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get("elevenlabs-signature") ?? req.headers.get("ElevenLabs-Signature") ?? "";

    const WEBHOOK_SECRET = Deno.env.get("ELEVENLABS_WEBHOOK_SECRET");

    if (!WEBHOOK_SECRET) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_WEBHOOK_SECRET is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!signature) {
      return new Response(JSON.stringify({ error: "Missing ElevenLabs signature header" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use ElevenLabs SDK signature verification.
    const elevenlabs = new ElevenLabsClient();
    const event = await elevenlabs.webhooks.constructEvent(rawBody, signature, WEBHOOK_SECRET);

    const typedEvent = event as ElevenLabsWebhookEvent;
    const eventType = typedEvent?.type;
    const data = typedEvent?.data ?? {};

    if (!data?.conversation_id || !data?.agent_id) {
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conversationId = data.conversation_id as string;
    const elevenlabsAgentId = data.agent_id as string;

    const fromNumber = data.from_number ?? null;
    const toNumber = data.to_number ?? null;
    const fromNumberStr = fromNumber !== null && fromNumber !== undefined ? String(fromNumber) : null;
    const toNumberStr = toNumber !== null && toNumber !== undefined ? String(toNumber) : null;

    const analysis = data.analysis ?? {};
    const callSuccessful =
      typeof analysis.call_successful === "boolean"
        ? analysis.call_successful
        : undefined;

    const failureReason = data.failure_reason ?? data.metadata?.error_reason ?? null;
    const transcriptSummary = analysis.transcript_summary ?? analysis.transcriptSummary ?? null;

    const status = eventType === "call_initiation_failure" ? "cancelled" : (callSuccessful ? "confirmed" : "cancelled");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Map ElevenLabs agent => your internal agent => your client.
    const { data: agentRow, error: agentError } = await supabaseAdmin
      .from("agents")
      .select("id, client_id, elevenlabs_agent_id")
      .eq("elevenlabs_agent_id", elevenlabsAgentId)
      .maybeSingle();

    if (agentError) {
      console.error("Agent lookup error:", agentError.message);
      return new Response(JSON.stringify({ error: "agent lookup failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!agentRow) {
      // Unknown agent; ignore.
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if we already created a booking (outbound calls create one immediately).
    const { data: existingBooking } = await supabaseAdmin
      .from("bookings")
      .select("id, booking_type, customer_phone")
      .eq("elevenlabs_conversation_id", conversationId)
      .maybeSingle();

    const notes = {
      transcriptSummary,
      callSuccessful,
      fromNumber,
      toNumber,
      eventType,
      failureReason,
    };

    if (existingBooking) {
      const { error: updateError } = await supabaseAdmin
        .from("bookings")
        .update({
          status,
          notes: JSON.stringify(notes),
        })
        .eq("id", existingBooking.id);

      if (updateError) throw updateError;
    } else {
      // If the booking wasn't created yet, infer direction by checking whether
      // `to_number` matches one of the client's assigned phone numbers.
      let bookingType: string = "inbound_call";
      let customerPhone: string | null = fromNumberStr;

      if (toNumberStr) {
        const { data: matchingPhone } = await supabaseAdmin
          .from("phone_numbers")
          .select("id")
          .eq("assigned_client_id", agentRow.client_id)
          .eq("number", toNumberStr);

        if (!matchingPhone || matchingPhone.length === 0) {
          bookingType = "outbound_call";
          customerPhone = toNumberStr;
        }
      }

      const { error: insertError } = await supabaseAdmin
        .from("bookings")
        .insert({
          client_id: agentRow.client_id,
          agent_id: agentRow.id,
          booking_type: bookingType,
          customer_phone: customerPhone,
          status,
          elevenlabs_conversation_id: conversationId,
          notes: JSON.stringify(notes),
          date_time: new Date().toISOString(),
        });

      if (insertError) throw insertError;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("elevenlabs-post-call-webhook error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

