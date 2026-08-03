// Diagnóstico de credenciales Flow. NO expone valores de secretos:
// solo indica en qué ambiente (sandbox / production) las llaves son válidas.
import { createHmac } from "node:crypto";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const API_KEY = (Deno.env.get("FLOW_API_KEY") ?? "").trim();
const SECRET_KEY = (Deno.env.get("FLOW_SECRET_KEY") ?? "").trim();

const BASE = {
  sandbox: "https://sandbox.flow.cl/api",
  production: "https://www.flow.cl/api",
} as const;

function sign(params: Record<string, string>) {
  const toSign = Object.keys(params).sort().map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", SECRET_KEY).update(toSign).digest("hex");
}

async function probe(env: keyof typeof BASE) {
  const params: Record<string, string> = { apiKey: API_KEY, token: "diagnose-probe" };
  const qs = new URLSearchParams({ ...params, s: sign(params) });
  try {
    const res = await fetch(`${BASE[env]}/payment/getStatus?${qs.toString()}`);
    const txt = await res.text();
    const apiKeyUnknown = /apiKey not found/i.test(txt);
    return {
      env,
      status: res.status,
      credentials_valid: !apiKeyUnknown,
      detail: txt.slice(0, 200),
    };
  } catch (e) {
    return { env, status: 0, credentials_valid: false, detail: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const results = await Promise.all([probe("sandbox"), probe("production")]);
  return new Response(
    JSON.stringify({
      configured_env: (Deno.env.get("FLOW_ENV") ?? "sandbox").toLowerCase(),
      api_key_present: API_KEY.length > 0,
      api_key_length: API_KEY.length,
      secret_key_present: SECRET_KEY.length > 0,
      secret_key_length: SECRET_KEY.length,
      results,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
