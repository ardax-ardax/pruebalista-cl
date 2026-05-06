import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  customInstitutionName: string | null;
  customLogoUrl: string | null;
  colegioId: string | null;
  secondaryEmail: string | null;
  documentId: string | null;
}

export interface ListProfilesResult {
  profiles: Profile[];
  error: string | null;
}

export const listProfiles = async (): Promise<ListProfilesResult> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, custom_institution_name, custom_logo_url, colegio_id, secondary_email, document_id");
  if (error) {
    console.error("listProfiles", error);
    return { profiles: [], error: error.message };
  }
  const profiles = (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    customInstitutionName: (r as Record<string, unknown>).custom_institution_name as string | null,
    customLogoUrl: (r as Record<string, unknown>).custom_logo_url as string | null,
    colegioId: (r as Record<string, unknown>).colegio_id as string | null,
    secondaryEmail: (r as Record<string, unknown>).secondary_email as string | null,
    documentId: (r as Record<string, unknown>).document_id as string | null,
  }));
  return { profiles, error: null };
};

export const getMyProfile = async (): Promise<Profile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, custom_institution_name, custom_logo_url, colegio_id, secondary_email, document_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    displayName: data.display_name,
    avatarUrl: data.avatar_url,
    customInstitutionName: (data as Record<string, unknown>).custom_institution_name as string | null,
    customLogoUrl: (data as Record<string, unknown>).custom_logo_url as string | null,
    colegioId: (data as Record<string, unknown>).colegio_id as string | null,
    secondaryEmail: (data as Record<string, unknown>).secondary_email as string | null,
    documentId: (data as Record<string, unknown>).document_id as string | null,
  };
};

export const updateMyProfile = async (updates: {
  custom_institution_name?: string | null;
  custom_logo_url?: string | null;
  display_name?: string;
}): Promise<{ ok: boolean; error?: string }> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "No autenticado" };
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const syncProfilesFromAuth = async (): Promise<{ ok: boolean; total?: number; synced?: number; error?: string }> => {
  const { data, error } = await supabase.functions.invoke("sync-profiles", { body: {} });
  if (error) return { ok: false, error: error.message };
  if (data?.error) return { ok: false, error: data.error };
  return { ok: true, total: data?.total, synced: data?.synced };
};

export const profileLabel = (p: Profile | undefined, fallbackId: string): string => {
  if (!p) return fallbackId.slice(0, 8);
  return p.displayName || p.email || fallbackId.slice(0, 8);
};
