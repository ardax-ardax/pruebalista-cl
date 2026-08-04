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
