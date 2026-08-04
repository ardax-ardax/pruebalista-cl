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
  hasSeenTour: boolean;
}

export interface ListProfilesResult {
  profiles: Profile[];
  error: string | null;
}

export const listProfiles = async (): Promise<ListProfilesResult> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, custom_institution_name, custom_logo_url, colegio_id, secondary_email, document_id, has_seen_tour");
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
    hasSeenTour: ((r as Record<string, unknown>).has_seen_tour as boolean | null) ?? false,
  }));
  return { profiles, error: null };
};

export const getMyProfile = async (): Promise<Profile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, custom_institution_name, custom_logo_url, colegio_id, secondary_email, document_id, has_seen_tour")
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
    hasSeenTour: ((data as Record<string, unknown>).has_seen_tour as boolean | null) ?? false,
  };
};

export const updateMyProfile = async (updates: {
  custom_institution_name?: string | null;
  custom_logo_url?: string | null;
  display_name?: string;
  secondary_email?: string | null;
  document_id?: string | null;
  has_seen_tour?: boolean;
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

export const profileLabel = (p: Profile | undefined, fallbackId: string | null | undefined): string => {
  const shortId = fallbackId?.slice(0, 8) ?? "Usuario eliminado";
  if (!p) return shortId;
  return p.displayName || p.email || shortId;
};
