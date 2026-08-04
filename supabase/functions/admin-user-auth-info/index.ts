// Edge function: entrega datos de auth.users (nombre, fecha de registro, último
// acceso) para el panel de administración. Solo accesible para rol admin.
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

    const { data: roles } = await userClient
      .from("user_roles").select("role").eq("user_id", userData.user.id);
    if (!(roles ?? []).some((r) => r.role === "admin")) {
      return json({ error: "Solo admin" }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const users: Record<string, {
      full_name: string | null;
      created_at: string | null;
      last_sign_in_at: string | null;
    }> = {};

    let page = 1;
    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const list = data?.users ?? [];
      if (list.length === 0) break;
      for (const u of list) {
        users[u.id] = {
          full_name:
            (u.user_metadata?.full_name as string) ||
            (u.user_metadata?.name as string) ||
            null,
          created_at: u.created_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        };
      }
      if (list.length < 200) break;
      page += 1;
    }

    return json({ users });
  } catch (e) {
    console.error("admin-user-auth-info", e);
    return json({ error: e instanceof Error ? e.message : "Error inesperado" }, 500);
  }
});
