import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type RequireAdminUser = { id: string };
type RequireAdminResult = { authHeader: string | null; user: RequireAdminUser | null };

async function requireAdmin(req: Request): Promise<RequireAdminResult> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { authHeader: null, user: null };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data, error } = await supabase.auth.getUser();
  const userId = error || !data?.user ? null : (data.user.id ?? null);
  if (!userId || typeof userId !== "string") return { authHeader, user: null };

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  const role = (roleRow as { role?: string } | null)?.role;
  if (!role || role !== "admin") return { authHeader, user: null };
  return { authHeader, user: { id: userId } };
}

function isE164(s: string) {
  return /^\+[1-9]\d{1,14}$/.test(s.trim());
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { authHeader, user } = await requireAdmin(req);
    if (!authHeader || !user) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const e164 = typeof body?.e164 === "string" ? body.e164.trim() : "";
    if (!e164 || !isE164(e164)) {
      return jsonResponse({ error: "Missing or invalid e164. Expected +123... format." }, 400);
    }

    const VOBIZ_X_AUTH_ID = Deno.env.get("VOBIZ_X_AUTH_ID");
    const VOBIZ_X_AUTH_TOKEN = Deno.env.get("VOBIZ_X_AUTH_TOKEN");
    if (!VOBIZ_X_AUTH_ID) throw new Error("VOBIZ_X_AUTH_ID is not configured");
    if (!VOBIZ_X_AUTH_TOKEN) throw new Error("VOBIZ_X_AUTH_TOKEN is not configured");

    const unassignUrl = `https://api.vobiz.ai/api/v1/account/${encodeURIComponent(VOBIZ_X_AUTH_ID)}/numbers/${encodeURIComponent(e164)}/assign`;
    const unassignRes = await fetch(unassignUrl, {
      method: "DELETE",
      headers: {
        "X-Auth-ID": VOBIZ_X_AUTH_ID,
        "X-Auth-Token": VOBIZ_X_AUTH_TOKEN,
        "Content-Type": "application/json",
      },
    });

    if (unassignRes.status === 204) {
      return jsonResponse({ success: true, unassigned: true });
    }

    const unassignBody = await unassignRes.json().catch(() => null);
    if (unassignRes.ok) {
      return jsonResponse({ success: true, unassigned: true, response: unassignBody });
    }

    throw new Error(`Vobiz unassign failed [${unassignRes.status}]: ${JSON.stringify(unassignBody ?? null)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

