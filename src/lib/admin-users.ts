// Utilidades de administración de usuarios (solo admin).
// Cambio de plan + vencimiento, ajuste de créditos, vinculación a colegio y
// eliminación definitiva de la cuenta (vía edge function con service role).
import { supabase } from "@/integrations/supabase/client";

export interface UserUsageRow {
  userId: string;
  planType: string;
  planExpiresAt: string | null;
  creditsAvailable: number;
}

export interface ColegioOption {
  id: string;
  nombre: string;
}

export interface DeleteUserCounts {
  assessments: number;
  questions: number;
  assignments: number;
  tickets: number;
}

export const listAllUsage = async (): Promise<Map<string, UserUsageRow>> => {
  const { data, error } = await supabase
    .from("user_usage")
    .select("user_id, plan_type, plan_expires_at, credits_available");
  const map = new Map<string, UserUsageRow>();
  if (error) {
    console.error("listAllUsage", error);
    return map;
  }
  for (const r of data ?? []) {
    map.set(r.user_id, {
      userId: r.user_id,
      planType: r.plan_type ?? "free",
      planExpiresAt: r.plan_expires_at ?? null,
      creditsAvailable: r.credits_available ?? 0,
    });
  }
  return map;
};

export const listColegios = async (): Promise<ColegioOption[]> => {
  const { data, error } = await supabase.from("colegios").select("id, nombre").order("nombre");
  if (error) {
    console.error("listColegios", error);
    return [];
  }
  return (data ?? []).map((c) => ({ id: c.id, nombre: c.nombre }));
};

/** Sincroniza vencimientos vencidos en servidor (lógica existente, no duplicar). */
export const syncAllExpiredPlans = async (): Promise<number> => {
  const { data, error } = await supabase.rpc("sync_all_expired_plans");
  if (error) {
    console.error("sync_all_expired_plans", error);
    return 0;
  }
  return (data as number) ?? 0;
};

export const setUserPlan = async (
  userId: string,
  planType: string,
  expiresAt: string | null,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from("user_usage")
    .update({ plan_type: planType, plan_expires_at: expiresAt })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const setUserCredits = async (
  userId: string,
  credits: number,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from("user_usage")
    .update({ credits_available: Math.max(0, Math.round(credits)) })
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const setUserColegio = async (
  userId: string,
  colegioId: string | null,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase.from("profiles").update({ colegio_id: colegioId }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

const invokeDeleteUser = async (userId: string, dryRun: boolean) => {
  const { data, error } = await supabase.functions.invoke("delete-user", {
    body: { user_id: userId, dry_run: dryRun },
  });
  if (error) return { ok: false as const, error: error.message };
  if (data?.error) return { ok: false as const, error: data.error as string };
  return { ok: true as const, counts: data?.counts as DeleteUserCounts | undefined };
};

export const previewDeleteUser = (userId: string) => invokeDeleteUser(userId, true);
export const deleteUserAccount = (userId: string) => invokeDeleteUser(userId, false);

// ---- Métricas y actividad por usuario (solo admin) ----

export interface AuthInfoRow {
  fullName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
}

/** Datos de auth.users (nombre, registro, último acceso) vía edge function admin. */
export const listAuthInfo = async (): Promise<Map<string, AuthInfoRow>> => {
  const map = new Map<string, AuthInfoRow>();
  const { data, error } = await supabase.functions.invoke("admin-user-auth-info", { body: {} });
  if (error || data?.error) {
    console.error("listAuthInfo", error ?? data.error);
    return map;
  }
  const users = (data?.users ?? {}) as Record<
    string,
    { full_name: string | null; created_at: string | null; last_sign_in_at: string | null }
  >;
  for (const [id, u] of Object.entries(users)) {
    map.set(id, {
      fullName: u.full_name,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
    });
  }
  return map;
};

export interface UserContentCounts {
  assessments: number;
  questions: number;
}

/** Conteo de pruebas y preguntas por usuario (agregado en cliente). */
export const listContentCounts = async (): Promise<Map<string, UserContentCounts>> => {
  const map = new Map<string, UserContentCounts>();
  const bump = (id: string | null, key: keyof UserContentCounts) => {
    if (!id) return;
    const cur = map.get(id) ?? { assessments: 0, questions: 0 };
    cur[key] += 1;
    map.set(id, cur);
  };
  const [a, q] = await Promise.all([
    supabase.from("assessments").select("user_id"),
    supabase.from("question_bank").select("user_id"),
  ]);
  if (a.error) console.error("listContentCounts assessments", a.error);
  if (q.error) console.error("listContentCounts questions", q.error);
  for (const r of a.data ?? []) bump(r.user_id, "assessments");
  for (const r of q.data ?? []) bump(r.user_id, "questions");
  return map;
};

export interface UserAssessmentHistoryItem {
  id: string;
  title: string;
  createdAt: string;
  status: string;
  gradeLabel: string | null;
  subjectLabel: string | null;
}

/** Últimas pruebas creadas por un usuario, para el panel de historial. */
export const listUserAssessmentHistory = async (
  userId: string,
  limit = 25,
): Promise<UserAssessmentHistoryItem[]> => {
  const { data, error } = await supabase
    .from("assessments")
    .select("id, title, created_at, status, data")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("listUserAssessmentHistory", error);
    return [];
  }
  return (data ?? []).map((r) => {
    const meta = ((r.data as Record<string, unknown> | null)?.meta ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      title: r.title,
      createdAt: r.created_at,
      status: r.status,
      gradeLabel:
        (meta.gradeLabel as string) ?? (meta.gradeValue as string) ?? null,
      subjectLabel:
        (meta.subjectLabel as string) ?? (meta.subjectValue as string) ?? null,
    };
  });
};
