import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toJsonSafe(value: unknown): unknown {
  if (value === undefined) return null;
  return value;
}

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const body = await req.json().catch(() => ({}));
    const limit = typeof body?.limit === "number" && Number.isFinite(body.limit)
      ? body.limit
      : 50;
    const offset = typeof body?.offset === "number" && Number.isFinite(body.offset)
      ? body.offset
      : 0;

    const VOBIZ_X_AUTH_ID = Deno.env.get("VOBIZ_X_AUTH_ID");
    const VOBIZ_X_AUTH_TOKEN = Deno.env.get("VOBIZ_X_AUTH_TOKEN");
    if (!VOBIZ_X_AUTH_ID) throw new Error("VOBIZ_X_AUTH_ID is not configured");
    if (!VOBIZ_X_AUTH_TOKEN) throw new Error("VOBIZ_X_AUTH_TOKEN is not configured");

    const url = new URL(`https://api.vobiz.ai/api/v1/account/${encodeURIComponent(VOBIZ_X_AUTH_ID)}/trunks`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Auth-ID": VOBIZ_X_AUTH_ID,
        "X-Auth-Token": VOBIZ_X_AUTH_TOKEN,
        "Accept": "application/json",
      },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(`Vobiz API error [${res.status}]: ${JSON.stringify(data ?? null)}`);
    }

    return new Response(JSON.stringify(toJsonSafe(data)), {
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

