// Configuración global de la app (tabla single-row).
import { supabase } from "@/integrations/supabase/client";
import defaultInstitutionLogoUrl from "@/assets/logo-colegio.jpg";

export interface AppSettings {
  allow_self_assignment: boolean;
  institution_name: string;
  institution_logo: string | null;
  hide_credits_from_teachers: boolean;
}

export const DEFAULT_INSTITUTION_NAME = "New Little College La Florida";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  allow_self_assignment: false,
  institution_name: DEFAULT_INSTITUTION_NAME,
  institution_logo: null,
  hide_credits_from_teachers: false,
};

let defaultLogoDataUrlPromise: Promise<string | null> | null = null;

export const loadDefaultInstitutionLogo = (): Promise<string | null> => {
  defaultLogoDataUrlPromise ??= fetch(defaultInstitutionLogoUrl)
    .then((response) => response.blob())
    .then((blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
  return defaultLogoDataUrlPromise;
};

export const loadAppSettings = async (): Promise<AppSettings> => {
  const { data, error } = await supabase
    .from("app_settings")
    .select("allow_self_assignment, institution_name, institution_logo, hide_credits_from_teachers")
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
    hide_credits_from_teachers: !!data?.hide_credits_from_teachers,
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

export const setHideCreditsFromTeachers = async (
  value: boolean,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from("app_settings")
    .update({ hide_credits_from_teachers: value, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};
