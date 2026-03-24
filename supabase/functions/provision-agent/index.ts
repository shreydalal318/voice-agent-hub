import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userId = claimsData.claims.sub;
    const { business_name, business_type, business_details, agent_name, agent_goals, voice_id } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Step 1: Create or update client record
    const { data: existingClient } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let clientId: string;

    if (existingClient) {
      await supabaseAdmin.from('clients').update({
        business_name,
        business_type,
      }).eq('id', existingClient.id);
      clientId = existingClient.id;
    } else {
      const { data: newClient, error: clientError } = await supabaseAdmin.from('clients').insert({
        user_id: userId,
        business_name,
        business_type,
      }).select('id').single();
      if (clientError) throw new Error('Failed to create client: ' + clientError.message);
      clientId = newClient.id;

      // Also ensure client role exists
      await supabaseAdmin.from('user_roles').upsert({
        user_id: userId,
        role: 'client',
      }, { onConflict: 'user_id,role' });
    }

    // Step 2: Build system prompt from business context + agent goals
    const systemPrompt = buildSystemPrompt(business_name, business_type, business_details, agent_goals);

    // Step 3: Create ElevenLabs Conversational AI Agent
    const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ELEVENLABS_API_KEY is not configured');
    }

    const selectedVoiceId = voice_id || 'JBFqnCBsd6RMkjVDRZzb'; // Default: George

    const agentPayload = {
      conversation_config: {
        agent: {
          prompt: {
            prompt: systemPrompt,
          },
          first_message: `Hello! Thank you for calling ${business_name}. How can I help you today?`,
          language: "en",
        },
        tts: {
          voice_id: selectedVoiceId,
        },
      },
      name: agent_name || `${business_name} Assistant`,
    };

    const elevenlabsRes = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentPayload),
    });

    if (!elevenlabsRes.ok) {
      const errBody = await elevenlabsRes.text();
      throw new Error(`ElevenLabs API error [${elevenlabsRes.status}]: ${errBody}`);
    }

    const elevenlabsData = await elevenlabsRes.json();
    const elevenlabsAgentId = elevenlabsData.agent_id;

    // Step 4: Store agent in our database
    const { data: agent, error: agentError } = await supabaseAdmin.from('agents').insert({
      client_id: clientId,
      name: agent_name || `${business_name} Assistant`,
      elevenlabs_agent_id: elevenlabsAgentId,
      voice_id: selectedVoiceId,
      prompt: systemPrompt,
      status: 'active',
    }).select('id').single();

    if (agentError) throw new Error('Failed to store agent: ' + agentError.message);

    return new Response(JSON.stringify({
      success: true,
      client_id: clientId,
      agent_id: agent.id,
      elevenlabs_agent_id: elevenlabsAgentId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Provision agent error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function buildSystemPrompt(
  businessName: string,
  businessType: string,
  businessDetails: string,
  agentGoals: string
): string {
  const typeContext: Record<string, string> = {
    doctor: 'a medical clinic or healthcare practice',
    restaurant: 'a restaurant or food service business',
    hotel: 'a hotel or hospitality business',
    other: 'a professional business',
  };

  const context = typeContext[businessType] || typeContext.other;

  return `You are a professional AI voice assistant for ${businessName}, which is ${context}.

## Business Context
${businessDetails || 'No additional business details provided.'}

## Your Goals
${agentGoals || 'Help callers with general inquiries and provide excellent customer service.'}

## Guidelines
- Be warm, professional, and concise
- Always confirm details before finalizing any action (appointments, reservations, etc.)
- If you're unsure about something, let the caller know and offer to have someone follow up
- Keep responses natural and conversational — avoid sounding robotic
- Collect necessary information: caller name, contact details, and purpose of call
- Thank the caller at the end of each interaction`;
}
