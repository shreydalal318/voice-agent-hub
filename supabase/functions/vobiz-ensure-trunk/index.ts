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

type VobizTrunk = {
  trunk_id: string;
  trunk_domain?: string;
  name?: string;
  trunk_direction?: string;
  transport?: string;
  created_at?: string;
  updated_at?: string;
};

async function fetchJson(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Vobiz API error [${res.status}]: ${JSON.stringify(body ?? null)}`);
  }
  return body;
}

async function listAllTrunks(authId: string, authToken: string) {
  const limit = 100;
  let offset = 0;
  const trunks: VobizTrunk[] = [];
  while (true) {
    const url = new URL(`https://api.vobiz.ai/api/v1/account/${encodeURIComponent(authId)}/trunks`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Auth-ID": authId,
        "X-Auth-Token": authToken,
        "Accept": "application/json",
      },
    });
    const data = await fetchJson(res) as { objects?: VobizTrunk[]; meta?: { total_count?: number } };
    trunks.push(...(data.objects ?? []));
    const total = data.meta?.total_count;
    if (typeof total === "number") {
      if (offset + limit >= total) break;
    }
    if ((data.objects ?? []).length < limit) break;
    offset += limit;
  }
  return trunks;
}

async function listAllCredentials(authId: string, authToken: string) {
  const limit = 100;
  let offset = 0;
  const objects: Array<{ id: string; username: string; enabled?: boolean; description?: string }> = [];
  while (true) {
    const url = new URL(`https://api.vobiz.ai/api/v1/account/${encodeURIComponent(authId)}/trunks/credentials`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Auth-ID": authId,
        "X-Auth-Token": authToken,
        "Accept": "application/json",
      },
    });
    const data = await fetchJson(res) as {
      objects?: Array<{ id: string; username: string; enabled?: boolean; description?: string }>;
      meta?: { total_count?: number };
    };
    objects.push(...(data.objects ?? []));
    const total = data.meta?.total_count;
    if (typeof total === "number") {
      if (offset + limit >= total) break;
    }
    if ((data.objects ?? []).length < limit) break;
    offset += limit;
  }
  return objects;
}

async function listAllOriginationUris(authId: string, authToken: string) {
  const limit = 100;
  let offset = 0;
  const objects: Array<{ id: string; uri: string; priority?: number; weight?: number; enabled?: boolean }> = [];
  while (true) {
    const url = new URL(`https://api.vobiz.ai/api/v1/account/${encodeURIComponent(authId)}/trunks/origination-uris`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Auth-ID": authId,
        "X-Auth-Token": authToken,
        "Accept": "application/json",
      },
    });
    const data = await fetchJson(res) as {
      objects?: Array<{ id: string; uri: string; priority?: number; weight?: number; enabled?: boolean }>;
      meta?: { total_count?: number };
    };
    objects.push(...(data.objects ?? []));
    const total = data.meta?.total_count;
    if (typeof total === "number") {
      if (offset + limit >= total) break;
    }
    if ((data.objects ?? []).length < limit) break;
    offset += limit;
  }
  return objects;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { authHeader, user } = await requireAdmin(req);
    if (!authHeader || !user) return jsonResponse({ error: "Forbidden" }, 403);

    const body = await req.json().catch(() => ({}));

    const VOBIZ_X_AUTH_ID = Deno.env.get("VOBIZ_X_AUTH_ID");
    const VOBIZ_X_AUTH_TOKEN = Deno.env.get("VOBIZ_X_AUTH_TOKEN");
    const VOBIZ_SIP_DOMAIN = Deno.env.get("VOBIZ_SIP_DOMAIN");
    const VOBIZ_USERNAME = Deno.env.get("VOBIZ_USERNAME");
    const VOBIZ_PASSWORD = Deno.env.get("VOBIZ_PASSWORD");
    const VOBIZ_TRANSPORT = Deno.env.get("VOBIZ_TRANSPORT") ?? "tcp";
    if (!VOBIZ_X_AUTH_ID) throw new Error("VOBIZ_X_AUTH_ID is not configured");
    if (!VOBIZ_X_AUTH_TOKEN) throw new Error("VOBIZ_X_AUTH_TOKEN is not configured");
    if (!VOBIZ_SIP_DOMAIN) throw new Error("VOBIZ_SIP_DOMAIN is not configured");

    const trunkName = typeof body?.trunkName === "string" && body.trunkName.trim().length
      ? body.trunkName.trim()
      : "VoiceOS Default Trunk";

    const trunkDirection = typeof body?.trunkDirection === "string"
      ? body.trunkDirection
      : "both";

    const secure = typeof body?.secure === "boolean" ? body.secure : false;
    const concurrentCallsLimit = typeof body?.concurrentCallsLimit === "number"
      ? body.concurrentCallsLimit
      : (Number(Deno.env.get("VOBIZ_CONCURRENT_CALLS_LIMIT") ?? 10) || 10);
    const cpsLimit = typeof body?.cpsLimit === "number"
      ? body.cpsLimit
      : (Number(Deno.env.get("VOBIZ_CPS_LIMIT") ?? 5) || 5);

    const inboundDestination = typeof body?.inboundDestination === "string"
      ? body.inboundDestination.trim()
      : (Deno.env.get("VOBIZ_INBOUND_DESTINATION") ?? "");

    const primaryOriginationUri = typeof body?.primaryOriginationUri === "string"
      ? body.primaryOriginationUri.trim()
      : (Deno.env.get("VOBIZ_PRIMARY_ORIGINATION_URI") ?? "");

    const fallbackOriginationUri = typeof body?.fallbackOriginationUri === "string"
      ? body.fallbackOriginationUri.trim()
      : (Deno.env.get("VOBIZ_FALLBACK_ORIGINATION_URI") ?? "");

    // 1) Check if the trunk already exists (based on VOBIZ_SIP_DOMAIN).
    const trunks = await listAllTrunks(VOBIZ_X_AUTH_ID, VOBIZ_X_AUTH_TOKEN);
    const existingTrunk = trunks.find(t => t?.trunk_domain === VOBIZ_SIP_DOMAIN);
    if (existingTrunk) {
      return jsonResponse({
        success: true,
        created: false,
        trunk: existingTrunk,
      });
    }

    // If trunk doesn't exist, we need credentials + outbound routing configuration to create it.
    if (!VOBIZ_USERNAME) throw new Error("VOBIZ_USERNAME is not configured");
    if (!VOBIZ_PASSWORD) throw new Error("VOBIZ_PASSWORD is not configured");

    if (!primaryOriginationUri) {
      throw new Error(
        "Missing outbound origination URI. Provide `primaryOriginationUri` in the request body or set env `VOBIZ_PRIMARY_ORIGINATION_URI`.",
      );
    }

    // 2) Ensure credential exists (username/password).
    const credentials = await listAllCredentials(VOBIZ_X_AUTH_ID, VOBIZ_X_AUTH_TOKEN);
    const existingCredential = credentials.find(c => c?.username === VOBIZ_USERNAME);

    let credentialId = existingCredential?.id;
    if (!credentialId) {
      const createRes = await fetch(
        `https://api.vobiz.ai/api/v1/account/${encodeURIComponent(VOBIZ_X_AUTH_ID)}/credentials`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-ID": VOBIZ_X_AUTH_ID,
            "X-Auth-Token": VOBIZ_X_AUTH_TOKEN,
          },
          body: JSON.stringify({
            username: VOBIZ_USERNAME,
            password: VOBIZ_PASSWORD,
            enabled: true,
            description: `VoiceOS trunk credential (${trunkName})`,
          }),
        },
      );
      const createBody = await fetchJson(createRes) as { id?: string } | null;
      credentialId = createBody?.id;
    }
    if (!credentialId) throw new Error("Failed to ensure Vobiz credential id");

    // 3) Ensure origination URIs exist.
    const originationUris = await listAllOriginationUris(VOBIZ_X_AUTH_ID, VOBIZ_X_AUTH_TOKEN);
    const existingPrimary = originationUris.find(u => u?.uri === primaryOriginationUri);
    const existingFallback = fallbackOriginationUri
      ? originationUris.find(u => u?.uri === fallbackOriginationUri)
      : undefined;

    let primaryUriId = existingPrimary?.id;
    let fallbackUriId = existingFallback?.id;

    if (!primaryUriId) {
      const createRes = await fetch(
        `https://api.vobiz.ai/api/v1/account/${encodeURIComponent(VOBIZ_X_AUTH_ID)}/origination-uris`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-ID": VOBIZ_X_AUTH_ID,
            "X-Auth-Token": VOBIZ_X_AUTH_TOKEN,
          },
          body: JSON.stringify({
            uri: primaryOriginationUri,
            priority: 1,
            weight: 10,
            enabled: true,
          }),
        },
      );
      const createBody = await fetchJson(createRes) as { id?: string } | null;
      primaryUriId = createBody?.id;
    }

    if (fallbackOriginationUri && !fallbackUriId) {
      const createRes = await fetch(
        `https://api.vobiz.ai/api/v1/account/${encodeURIComponent(VOBIZ_X_AUTH_ID)}/origination-uris`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Auth-ID": VOBIZ_X_AUTH_ID,
            "X-Auth-Token": VOBIZ_X_AUTH_TOKEN,
          },
          body: JSON.stringify({
            uri: fallbackOriginationUri,
            priority: 2,
            weight: 10,
            enabled: true,
          }),
        },
      );
      const createBody = await fetchJson(createRes) as { id?: string } | null;
      fallbackUriId = createBody?.id;
    }

    if (!primaryUriId) throw new Error("Failed to ensure primary origination uri id");

    // 4) Create trunk.
    const createTrunkRes = await fetch(
      `https://api.vobiz.ai/api/v1/account/${encodeURIComponent(VOBIZ_X_AUTH_ID)}/trunks`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Auth-ID": VOBIZ_X_AUTH_ID,
          "X-Auth-Token": VOBIZ_X_AUTH_TOKEN,
        },
        body: JSON.stringify({
          name: trunkName,
          trunk_status: "enabled",
          secure,
          trunk_direction: trunkDirection,
          trunk_domain: VOBIZ_SIP_DOMAIN,
          concurrent_calls_limit: concurrentCallsLimit,
          cps_limit: cpsLimit,
          transport: VOBIZ_TRANSPORT,
          credential_uuid: credentialId,
          primary_uri_uuid: primaryUriId,
          fallback_uri_uuid: fallbackUriId,
          inbound_destination: inboundDestination || undefined,
        }),
      },
    );

    const createdTrunk = await fetchJson(createTrunkRes) as VobizTrunk;
    return jsonResponse({
      success: true,
      created: true,
      trunk: createdTrunk,
      setup: {
        credential_id: credentialId,
        primary_origination_uri_id: primaryUriId,
        fallback_origination_uri_id: fallbackUriId ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});

