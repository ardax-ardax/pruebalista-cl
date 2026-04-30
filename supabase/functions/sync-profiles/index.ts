// Edge function: sincroniza perfiles desde auth.users hacia public.profiles.
// Solo accesible para usuarios con rol admin.
// Usa la SERVICE_ROLE_KEY para listar auth.users (operación privilegiada).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "No autenticado" }), {
        status: 401, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }
    const uid = userData.user.id;

    // Verificar rol admin con cliente del usuario (RLS sobre user_roles)
    const { data: roles } = await userClient
      .from("user_roles").select("role").eq("user_id", uid);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Solo admin" }), {
        status: 403, headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // Service role: listar auth.users e insertar perfiles faltantes
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    let page = 1;
    let inserted = 0;
    let total = 0;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const users = data?.users ?? [];
      if (users.length === 0) break;
      total += users.length;

      const rows = users.map((u) => ({
        id: u.id,
        email: u.email ?? null,
        display_name:
          (u.user_metadata?.full_name as string) ||
          (u.user_metadata?.name as string) ||
          (u.email ? u.email.split("@")[0] : null),
        avatar_url: (u.user_metadata?.avatar_url as string) ?? null,
      }));

      const { error: upErr, count } = await admin
        .from("profiles")
        .upsert(rows, { onConflict: "id", ignoreDuplicates: false, count: "exact" });
      if (upErr) throw upErr;
      inserted += count ?? rows.length;

      if (users.length < 200) break;
      page += 1;
    }

    return new Response(JSON.stringify({ ok: true, total, synced: inserted }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
