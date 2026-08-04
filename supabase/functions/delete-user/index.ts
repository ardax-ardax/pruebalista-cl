// Edge function: elimina definitivamente un usuario (auth.users) y sus datos.
// Solo accesible para admin. Usa SERVICE_ROLE_KEY.
// GET-like modo "preview": devuelve conteos antes de borrar (dry_run: true).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "No autenticado" }, 401);
    const callerId = userData.user.id;

    const { data: roles } = await userClient
      .from("user_roles").select("role").eq("user_id", callerId);
    if (!(roles ?? []).some((r) => r.role === "admin")) return json({ error: "Solo admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const targetId: string | undefined = body?.user_id;
    const dryRun = body?.dry_run === true;
    if (!targetId) return json({ error: "user_id requerido" }, 400);
    if (targetId === callerId) return json({ error: "No puedes eliminar tu propia cuenta" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const countOf = async (table: string, column: string) => {
      const { count } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, targetId);
      return count ?? 0;
    };

    const counts = {
      assessments: await countOf("assessments", "user_id"),
      questions: await countOf("question_bank", "user_id"),
      assignments: await countOf("teacher_assignments", "teacher_user_id"),
      tickets: await countOf("support_tickets", "user_id"),
    };

    if (dryRun) return json({ ok: true, dry_run: true, counts });

    // Tablas SIN cascade a auth.users: borrado explícito en orden seguro.
    // assessments y question_bank NO se borran: su user_id queda en NULL (ON DELETE SET NULL)
    // y siguen visibles para el admin en la base general de pruebas.
    for (const [table, column] of [
      ["ai_generation_log", "user_id"],
      ["teacher_assignments", "teacher_user_id"],
      ["user_usage", "user_id"],
    ] as const) {
      const { error } = await admin.from(table).delete().eq(column, targetId);
      if (error) throw new Error(`${table}: ${error.message}`);
    }

    // Referencias sueltas (sin FK): desvincular en lugar de borrar el recurso.
    await admin.from("admin_courses").update({ created_by: null }).eq("created_by", targetId);
    await admin.from("colegios").update({ created_by: null }).eq("created_by", targetId);

    // auth.users → cascade a profiles, user_roles, assessments, support_tickets,
    // flow_payment_orders (todas tienen ON DELETE CASCADE).
    const { error: delErr } = await admin.auth.admin.deleteUser(targetId);
    if (delErr) throw delErr;

    return json({ ok: true, counts });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
