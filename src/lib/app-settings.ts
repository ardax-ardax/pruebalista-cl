// Configuración global de la app (tabla single-row).
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  allow_self_assignment: boolean;
  institution_name: string;
  institution_logo: string | null;
}

export const DEFAULT_INSTITUTION_NAME = "New Little College La Florida";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  allow_self_assignment: false,
  institution_name: DEFAULT_INSTITUTION_NAME,
  institution_logo: null,
};

export const loadAppSettings = async (): Promise<AppSettings> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("allow_self_assignment, institution_name, institution_logo")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    console.warn("loadAppSettings", error);
    return DEFAULT_APP_SETTINGS;
  }
  return {
    allow_self_assignment: !!data?.allow_self_assignment,
    institution_name: (data?.institution_name as string) || DEFAULT_INSTITUTION_NAME,
    institution_logo: (data?.institution_logo as string | null) ?? null,
  };
};

export const setAllowSelfAssignment = async (
  value: boolean,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from("app_settings")
    .update({ allow_self_assignment: value, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const setInstitutionName = async (
  name: string,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from("app_settings")
    .update({ institution_name: name, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const setInstitutionLogo = async (
  dataUrl: string | null,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from("app_settings")
    .update({ institution_logo: dataUrl, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};
