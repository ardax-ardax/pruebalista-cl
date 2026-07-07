// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { flowCreatePayment, checkoutUrl, FLOW_ENV } from "../_shared/flow.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Body {
  planId: "pro" | "institucional";
  cycle: "monthly" | "yearly";
  seats?: number; // required for institucional
  colegioId?: string; // required for institucional
  successPath?: string; // e.g. /perfil?paid=1
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;
    const email = (claimsData.claims.email as string) ?? "";

    const body = (await req.json()) as Body;
    if (!body?.planId || !body?.cycle) return json({ error: "Missing planId/cycle" }, 400);
    if (!["pro", "institucional"].includes(body.planId)) return json({ error: "Invalid planId" }, 400);
    if (!["monthly", "yearly"].includes(body.cycle)) return json({ error: "Invalid cycle" }, 400);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Compute amount server-side (never trust client)
    let amount = 0;
    let seats: number | null = null;
    let colegioId: string | null = null;

    if (body.planId === "pro") {
      const { data: plan } = await admin
        .from("plans")
        .select("price_clp_monthly, price_clp_yearly, label")
        .eq("id", "pro")
        .maybeSingle();
      if (!plan) return json({ error: "Plan not found" }, 404);
      amount = body.cycle === "monthly" ? plan.price_clp_monthly ?? 0 : plan.price_clp_yearly ?? 0;
    } else {
      // institucional
      if (!body.seats || body.seats < 1) return json({ error: "seats required" }, 400);
      if (!body.colegioId) return json({ error: "colegioId required" }, 400);
      seats = body.seats;
      colegioId = body.colegioId;

      // Verify user is utp_head of that colegio
      const { data: prof } = await admin
        .from("profiles").select("colegio_id").eq("id", userId).maybeSingle();
      if (!prof || prof.colegio_id !== colegioId) {
        return json({ error: "No autorizado para este colegio" }, 403);
      }
      const { data: roleRow } = await admin
        .from("user_roles").select("role").eq("user_id", userId).eq("role", "utp_head").maybeSingle();
      if (!roleRow) return json({ error: "Solo UTP puede comprar plan institucional" }, 403);

      const { data: tiers } = await admin
        .from("institutional_pricing_tiers")
        .select("min_teachers, max_teachers, price_per_teacher_clp_monthly")
        .order("min_teachers", { ascending: true });
      const tier = (tiers ?? []).find(
        (t: any) => seats! >= t.min_teachers && (t.max_teachers == null || seats! <= t.max_teachers),
      );
      if (!tier) return json({ error: "No tier match" }, 400);
      const monthlyPerTeacher = tier.price_per_teacher_clp_monthly;
      amount = body.cycle === "monthly"
        ? monthlyPerTeacher * seats
        : monthlyPerTeacher * seats * 10; // yearly = 10 months
    }

    if (amount <= 0) return json({ error: "Monto inválido" }, 400);

    const commerceOrder = `PL-${crypto.randomUUID().slice(0, 18)}`;

    // Insert pending order
    const { data: order, error: insErr } = await admin
      .from("flow_payment_orders")
      .insert({
        user_id: userId,
        plan_id: body.planId,
        billing_cycle: body.cycle,
        amount_clp: amount,
        seats,
        colegio_id: colegioId,
        commerce_order: commerceOrder,
        status: "pending",
        flow_env: FLOW_ENV,
      })
      .select("id")
      .single();
    if (insErr || !order) return json({ error: insErr?.message ?? "insert failed" }, 500);

    const origin = req.headers.get("origin") ?? "";
    const urlConfirmation = `${SUPABASE_URL}/functions/v1/flow-webhook`;
    const urlReturn = `${origin}${body.successPath ?? "/perfil?paid=1"}`;

    const subject = body.planId === "pro"
      ? `Plan Pro (${body.cycle === "monthly" ? "mensual" : "anual"})`
      : `Plan Institucional · ${seats} docentes (${body.cycle === "monthly" ? "mensual" : "anual"})`;

    const flowRes = await flowCreatePayment({
      commerceOrder,
      subject,
      amount,
      email,
      urlConfirmation,
      urlReturn,
      optional: { orderId: order.id },
    });

    await admin.from("flow_payment_orders").update({
      flow_token: flowRes.token,
      flow_order: String(flowRes.flowOrder),
    }).eq("id", order.id);

    return json({
      url: checkoutUrl(flowRes.token),
      token: flowRes.token,
      orderId: order.id,
      amount,
      env: FLOW_ENV,
    });
  } catch (e) {
    console.error("create-flow-payment error", e);
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
