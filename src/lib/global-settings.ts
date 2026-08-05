import { supabase } from "@/integrations/supabase/client";

export interface GlobalSettings {
  enable_payments: boolean;
  default_free_credits: number;
  maintenance_mode: boolean;
  ai_enabled: boolean;
  ai_disabled_reason: string;
  show_institutional_landing: boolean;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  enable_payments: false,
  default_free_credits: 20,
  maintenance_mode: false,
  ai_enabled: true,
  ai_disabled_reason: "",
  show_institutional_landing: true,
};

export const loadGlobalSettings = async (): Promise<GlobalSettings> => {
  const { data, error } = await supabase
    .from("global_settings")
    .select("enable_payments, default_free_credits, maintenance_mode, ai_enabled, ai_disabled_reason, show_institutional_landing")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) {
    console.warn("loadGlobalSettings", error);
    return DEFAULT_GLOBAL_SETTINGS;
  }
  return {
    enable_payments: data.enable_payments,
    default_free_credits: data.default_free_credits,
    maintenance_mode: data.maintenance_mode,
    ai_enabled: data.ai_enabled ?? true,
    ai_disabled_reason: data.ai_disabled_reason ?? "",
    show_institutional_landing: data.show_institutional_landing ?? true,
  };
};

/**
 * Lectura pública y liviana para la portada: flags de visibilidad y pagos.
 * No requiere sesión (accesible por el rol anon).
 */
export const loadPublicLandingSettings = async (): Promise<{ show_institutional_landing: boolean; enable_payments: boolean }> => {
  const { data, error } = await supabase
    .from("global_settings")
    .select("show_institutional_landing, enable_payments")
    .eq("id", true)
    .maybeSingle();
  if (error || !data) return { show_institutional_landing: true, enable_payments: false };
  return {
    show_institutional_landing: data.show_institutional_landing ?? true,
    enable_payments: data.enable_payments ?? false,
  };
};


export const updateGlobalSettings = async (
  updates: Partial<GlobalSettings>,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from("global_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};
