import { supabase } from "@/integrations/supabase/client";

export interface GlobalSettings {
  enable_payments: boolean;
  default_free_credits: number;
  maintenance_mode: boolean;
}

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  enable_payments: false,
  default_free_credits: 20,
  maintenance_mode: false,
};

export const loadGlobalSettings = async (): Promise<GlobalSettings> => {
  const { data, error } = await supabase
    .from("global_settings")
    .select("enable_payments, default_free_credits, maintenance_mode")
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
