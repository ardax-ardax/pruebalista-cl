import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface ListProfilesResult {
  profiles: Profile[];
  error: string | null;
}

export const listProfiles = async (): Promise<ListProfilesResult> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url");
  if (error) {
    console.error("listProfiles", error);
    return { profiles: [], error: error.message };
  }
  const profiles = (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
  }));
  return { profiles, error: null };
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
