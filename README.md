# VoiceOS (ElevenLabs + Vobiz) - Deployment & Security Handover

This repository contains a Vite + React + TypeScript frontend plus Supabase Edge Functions (Deno) to connect:

- ElevenLabs (AI voice agents + SIP trunk outbound calls + post-call webhooks)
- Vobiz (SIP trunking + phone numbers inventory + assign/unassign numbers to trunks)
- Supabase (auth, roles, database, and Edge Functions)

## Architecture (high level)

1. Admin purchases phone numbers from Vobiz inventory.
2. The newly purchased Vobiz number is automatically assigned to the configured Vobiz trunk (inbound routing).
3. The number is also synced into ElevenLabs so clients can dial using SIP trunking.
4. Clients link an “agent” to a phone number, then place outbound calls through ElevenLabs.
5. ElevenLabs posts call results to a webhook; the webhook updates your `bookings` table.

## Security Measures (what we already do)

- Edge Functions require Supabase auth:
  - Most “admin” operations require an `Authorization: Bearer <supabase_jwt>` header.
  - Admin-only functions verify admin role from `user_roles` (role must be `admin`).
- Client isolation for outbound calls:
  - `initiate-outbound-call` verifies the caller owns the `clients` row attached to the phone number before calling ElevenLabs.
- Webhook verification:
  - `elevenlabs-post-call-webhook` verifies requests using `ELEVENLABS_WEBHOOK_SECRET`.
  - Security hardening: the webhook will **fail closed** if `ELEVENLABS_WEBHOOK_SECRET` is missing.
- Input validation:
  - Phone numbers for dialing are validated as E.164 in `initiate-outbound-call`.
  - Inventory list/release/purchase functions validate required request payload fields.
- Secrets are not shipped to the browser:
  - Only Vite “VITE_*” variables are exposed to the frontend build.
  - ElevenLabs and Vobiz secrets are read via `Deno.env.get(...)` inside Edge Functions.

## Secrets & Environment Variables

### Frontend (`voice-agent-hub/.env`)

These variables are needed by the React app build/runtime (Vite exposes `VITE_*` variables):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID` (optional, if referenced elsewhere)

### Supabase Edge Function Secrets (recommended for production)

Configure these as **Edge Function secrets** in the Supabase Dashboard:

#### ElevenLabs

- `ELEVENLABS_API_KEY` (required for syncing phone numbers + outbound dialing)
- `ELEVENLABS_WEBHOOK_SECRET` (required for webhook signature verification)

#### Vobiz

- `VOBIZ_X_AUTH_ID` and `VOBIZ_X_AUTH_TOKEN` (required for inventory/trunk actions + balance)
- `VOBIZ_SIP_DOMAIN` (used to locate the existing trunk via `trunk_domain`)
- `VOBIZ_USERNAME` and `VOBIZ_PASSWORD`:
  - required only if the system must create the trunk (not if trunk already exists)
  - required for ElevenLabs sync/import payload (`import-vobiz-phone-number`)
- `VOBIZ_TRANSPORT` (optional, default `tcp`)

#### Optional Vobiz trunk creation defaults (only used if trunk does not already exist)

- `VOBIZ_PRIMARY_ORIGINATION_URI` (required to create outbound routing on trunk creation)
- `VOBIZ_FALLBACK_ORIGINATION_URI` (optional)
- `VOBIZ_INBOUND_DESTINATION` (optional)
- `VOBIZ_CONCURRENT_CALLS_LIMIT` (optional, default `10`)
- `VOBIZ_CPS_LIMIT` (optional, default `5`)

### Never commit `.env`

`.env` and `.env.*` are ignored via `.gitignore`.
For handover to other people: use `.env.example` as a template.

## Supabase Edge Functions (what to deploy)

All functions live under `voice-agent-hub/supabase/functions/*`:

- Admin/Vobiz:
  - `vobiz-list-trunks`
  - `vobiz-ensure-trunk`
  - `vobiz-purchase-from-inventory`
  - `vobiz-list-inventory-phone-numbers`
  - `vobiz-release-phone-number`
  - `vobiz-assign-phone-number-to-trunk`
  - `vobiz-unassign-phone-number-from-trunk`
  - `vobiz-get-account-balance`
- ElevenLabs:
  - `import-vobiz-phone-number`
  - `sync-elevenlabs-phone-number-agent`
  - `initiate-outbound-call`
  - `elevenlabs-post-call-webhook`

## Admin / Client Operational Flow

### 1) Admin: ensure trunk (inbound/outbound routing)

Go to **Admin → Dashboard** and click **Ensure Trunk**.

This will:
- list trunks from Vobiz
- find the trunk whose `trunk_domain` matches `VOBIZ_SIP_DOMAIN`
- if missing, create the trunk + outbound origination URI(s) + required credentials

### 2) Admin: purchase number

Go to **Admin → Phone Numbers** and click **Purchase** on a Vobiz inventory number.

After purchase, the app triggers:
- `import-vobiz-phone-number` (sync number into ElevenLabs)
- trunk assignment via `vobiz-assign-phone-number-to-trunk`

### 3) Client: link agent to phone number + dial

Clients:
- link an agent to a phone number (syncs assignment into ElevenLabs)
- dial using `initiate-outbound-call` which calls ElevenLabs SIP outbound

## Costs (what Vobiz charges, and where it shows up)

Vobiz charges include:

1. `setup_fee` (one-time) when purchasing a number from inventory
2. `monthly_fee` (recurring) for keeping the number active
3. Call charges (per call, based on billed duration and a per-minute rate shown in the Call object as `total_rate` / `total_amount`)

For your own reconciliation, use your Vobiz account transactions + your app’s stored booking records.

## Troubleshooting

- If `ELEVENLABS_API_KEY is not configured`:
  - set `ELEVENLABS_API_KEY` as a Supabase Edge Function secret.
- If webhook stops updating bookings:
  - confirm `ELEVENLABS_WEBHOOK_SECRET` is configured and matches what ElevenLabs is signing with.
- If outbound dialing fails:
  - check that the ElevenLabs SIP trunk mapping exists for your imported phone numbers.
