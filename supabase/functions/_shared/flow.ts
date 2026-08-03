// Shared Flow.cl helpers (pago único / Link de pago).
// Environment: sandbox (default) or production.

import { createHmac } from "node:crypto";

export const FLOW_ENV = (Deno.env.get("FLOW_ENV") ?? "sandbox").toLowerCase();

export const FLOW_BASE_URL =
  FLOW_ENV === "production" ? "https://www.flow.cl/api" : "https://sandbox.flow.cl/api";

export const FLOW_CHECKOUT_URL_BASE =
  FLOW_ENV === "production" ? "https://www.flow.cl/app/web/pay.php" : "https://sandbox.flow.cl/app/web/pay.php";

const FLOW_API_KEY = (Deno.env.get("FLOW_API_KEY") ?? "").trim();
const FLOW_SECRET_KEY = (Deno.env.get("FLOW_SECRET_KEY") ?? "").trim();

/** Firma Flow: concatenar pares key+value en orden alfabético y HMAC-SHA256 con secretKey. */
export function signParams(params: Record<string, string | number>): string {
  const keys = Object.keys(params).sort();
  const toSign = keys.map((k) => `${k}${params[k]}`).join("");
  return createHmac("sha256", FLOW_SECRET_KEY).update(toSign).digest("hex");
}

/** Agrega apiKey + firma s a los parámetros. */
function withAuth(params: Record<string, string | number>) {
  if (!FLOW_API_KEY || !FLOW_SECRET_KEY) {
    throw new Error(
      "Faltan credenciales de Flow (FLOW_API_KEY / FLOW_SECRET_KEY). Agrégalas en Configuración del proyecto → Secrets.",
    );
  }
  const withKey = { ...params, apiKey: FLOW_API_KEY };
  const s = signParams(withKey);
  return { ...withKey, s };
}

/** Traduce errores de Flow a mensajes accionables. */
function flowError(action: string, status: number, txt: string): Error {
  let msg = `Flow ${action} failed ${status}: ${txt}`;
  if (/apiKey not found/i.test(txt)) {
    msg =
      `Flow rechazó las credenciales en el ambiente "${FLOW_ENV}" (apiKey not found). ` +
      `Las credenciales de sandbox y producción son distintas: si tus llaves son de ` +
      `www.flow.cl usa FLOW_ENV=production; si son de sandbox.flow.cl usa FLOW_ENV=sandbox.`;
  }
  console.error("flow_error", {
    action,
    status,
    env: FLOW_ENV,
    baseUrl: FLOW_BASE_URL,
    apiKeyLength: FLOW_API_KEY.length,
    secretKeyLength: FLOW_SECRET_KEY.length,
    body: txt,
  });
  return new Error(msg);
}


export async function flowCreatePayment(input: {
  commerceOrder: string;
  subject: string;
  amount: number;
  email: string;
  urlConfirmation: string;
  urlReturn: string;
  optional?: Record<string, string>;
}): Promise<{ url: string; token: string; flowOrder: number }> {
  const params: Record<string, string | number> = {
    commerceOrder: input.commerceOrder,
    subject: input.subject,
    currency: "CLP",
    amount: input.amount,
    email: input.email,
    urlConfirmation: input.urlConfirmation,
    urlReturn: input.urlReturn,
  };
  if (input.optional && Object.keys(input.optional).length > 0) {
    params.optional = JSON.stringify(input.optional);
  }
  const signed = withAuth(params);
  const body = new URLSearchParams(
    Object.entries(signed).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${FLOW_BASE_URL}/payment/create`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const txt = await res.text();
  if (!res.ok) throw flowError("create", res.status, txt);
  const data = JSON.parse(txt);
  return { url: data.url, token: data.token, flowOrder: data.flowOrder };
}

export async function flowGetStatus(token: string): Promise<{
  status: number; // 1 pending, 2 paid, 3 rejected, 4 cancelled
  commerceOrder: string;
  flowOrder: number;
  amount: number;
  payer: string;
  paymentData?: unknown;
  optional?: Record<string, string>;
}> {
  const signed = withAuth({ token });
  const qs = new URLSearchParams(
    Object.entries(signed).map(([k, v]) => [k, String(v)]),
  );
  const res = await fetch(`${FLOW_BASE_URL}/payment/getStatus?${qs.toString()}`);
  const txt = await res.text();
  if (!res.ok) throw flowError("getStatus", res.status, txt);
  return JSON.parse(txt);
}

export function checkoutUrl(token: string): string {
  return `${FLOW_CHECKOUT_URL_BASE}?token=${token}`;
}
