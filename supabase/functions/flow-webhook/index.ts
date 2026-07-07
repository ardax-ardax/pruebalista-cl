// deno-lint-ignore-file no-explicit-any
// Public webhook (verify_jwt=false). Flow POSTs { token } via urlConfirmation.
// We MUST respond with plain "200 OK" text; otherwise Flow retries.
import { createClient } from "npm:@supabase/supabase-js@2";
import { flowGetStatus } from "../_shared/flow.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function addPeriod(from: Date, cycle: "monthly" | "yearly"): Date {
  const d = new Date(from);
  if (cycle === "monthly") d.setMonth(d.getMonth() + 1);
  else d.setFullYear(d.getFullYear() + 1);
  return d;
}

Deno.serve(async (req) => {
  try {
    let token: string | null = null;
    if (req.method === "POST") {
      const ct = req.headers.get("content-type") ?? "";
      if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
        const form = await req.formData();
        token = (form.get("token") as string | null) ?? null;
      } else if (ct.includes("application/json")) {
        const j = await req.json();
        token = j?.token ?? null;
      } else {
        // Fall back: attempt form
        try {
          const form = await req.formData();
          token = (form.get("token") as string | null) ?? null;
        } catch { /* ignore */ }
      }
    } else {
      const url = new URL(req.url);
      token = url.searchParams.get("token");
    }

    if (!token) return new Response("missing token", { status: 400 });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const status = await flowGetStatus(token);

    const { data: order, error: findErr } = await admin
      .from("flow_payment_orders")
      .select("*")
      .eq("commerce_order", status.commerceOrder)
      .maybeSingle();
    if (findErr || !order) {
      console.warn("flow-webhook: order not found", status.commerceOrder);
      return new Response("order not found", { status: 200 });
    }

    // Already processed
    if (order.status === "paid") return new Response("OK", { status: 200 });

    if (status.status === 2) {
      // PAID → activate plan
      const cycle = order.billing_cycle as "monthly" | "yearly";
      const now = new Date();

      if (order.plan_id === "pro") {
        // Extend from current expiration if still valid
        const { data: usage } = await admin
          .from("user_usage")
          .select("plan_expires_at, plan_type")
          .eq("user_id", order.user_id)
          .maybeSingle();
        const base = usage?.plan_type === "pro" && usage?.plan_expires_at && new Date(usage.plan_expires_at) > now
          ? new Date(usage.plan_expires_at)
          : now;
        const newExpiry = addPeriod(base, cycle);
        await admin.from("user_usage").update({
          plan_type: "pro",
          plan_expires_at: newExpiry.toISOString(),
        }).eq("user_id", order.user_id);
      } else if (order.plan_id === "institucional" && order.colegio_id) {
        const { data: col } = await admin
          .from("colegios")
          .select("plan_expires_at")
          .eq("id", order.colegio_id)
          .maybeSingle();
        const base = col?.plan_expires_at && new Date(col.plan_expires_at) > now
          ? new Date(col.plan_expires_at)
          : now;
        const newExpiry = addPeriod(base, cycle);
        await admin.from("colegios").update({
          plan_expires_at: newExpiry.toISOString(),
          seats_purchased: order.seats ?? 0,
          plan_billing_cycle: cycle,
        }).eq("id", order.colegio_id);

        // Also mark UTP user as institucional
        await admin.from("user_usage").update({
          plan_type: "institucional",
          plan_expires_at: newExpiry.toISOString(),
        }).eq("user_id", order.user_id);
      }

      await admin.from("flow_payment_orders").update({
        status: "paid",
        paid_at: now.toISOString(),
        metadata: { flowOrder: status.flowOrder, payer: status.payer, amount: status.amount },
      }).eq("id", order.id);
    } else if (status.status === 3) {
      await admin.from("flow_payment_orders").update({ status: "rejected" }).eq("id", order.id);
    } else if (status.status === 4) {
      await admin.from("flow_payment_orders").update({ status: "cancelled" }).eq("id", order.id);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("flow-webhook error", e);
    return new Response("error", { status: 500 });
  }
});
