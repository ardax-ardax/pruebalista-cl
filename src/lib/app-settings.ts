// Configuración global de la app (tabla single-row).
import { supabase } from "@/integrations/supabase/client";

export interface AppSettings {
  allow_self_assignment: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  allow_self_assignment: false,
};

export const loadAppSettings = async (): Promise<AppSettings> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("allow_self_assignment")
    .eq("id", true)
    .maybeSingle();
  if (error) {
    console.warn("loadAppSettings", error);
    return DEFAULT_APP_SETTINGS;
  }
  return {
    allow_self_assignment: !!data?.allow_self_assignment,
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
