import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

export const listProfiles = async (): Promise<Profile[]> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url");
  if (error) {
    console.error("listProfiles", error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
  }));
};

export const profileLabel = (p: Profile | undefined, fallbackId: string): string => {
  if (!p) return fallbackId.slice(0, 8);
  return p.displayName || p.email || fallbackId.slice(0, 8);
};
