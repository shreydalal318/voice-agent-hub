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

    const { currency } = await req.json().catch(() => ({}));
    const finalCurrency =
      typeof currency === "string" && currency.trim().length > 0 ? currency.trim() : "INR";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin-only
    const { data: roleRow, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleError) throw new Error("Failed to check role: " + roleError.message);
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

    const tryCurrencies = Array.from(new Set([finalCurrency, "USD", "INR"]));
    let lastErr: unknown = null;

    for (const cur of tryCurrencies) {
      const url = `https://api.vobiz.ai/api/v1/account/${encodeURIComponent(VOBIZ_X_AUTH_ID)}/balance/${encodeURIComponent(cur)}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "X-Auth-ID": VOBIZ_X_AUTH_ID,
          "X-Auth-Token": VOBIZ_X_AUTH_TOKEN,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      const body = await res.json().catch(() => null);
      if (res.ok) {
        return new Response(JSON.stringify(body), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      lastErr = { status: res.status, body };
    }

    throw new Error(`Vobiz API error: ${JSON.stringify(lastErr ?? null)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
