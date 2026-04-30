// Capa de overrides curriculares: permite que el administrador edite/agregue
// OAs e indicadores. La fuente efectiva = base hard-coded + overrides.
//
// Persistencia híbrida:
//   - Lectura: cache en memoria, hidratada al primer acceso desde localStorage.
//   - Escritura: localStorage SIEMPRE; además sincroniza a Supabase
//     (`curriculum_base`) si el usuario tiene permisos (RLS lo valida).
//
// Las funciones pesadas son async (loadOverridesFromCloud, save, remove).
// `listOverrides` es síncrono (usa cache) para que `curriculum-data.ts`
// pueda consumirlo desde getters.

import { supabase } from "@/integrations/supabase/client";
import type { Indicator } from "./curriculum-data";

export interface OverrideOA {
  grade_value: string;
  subject_value: string;
  oa_code: string;
  oa_description: string;
  eje?: string;
  indicators: Indicator[];
}

const LS_KEY = "curriculum_overrides_v1";

let cache: OverrideOA[] | null = null;
// Promesa "in-flight" para deduplicar fetches paralelos y evitar repetir la
// descarga al cambiar entre cursos. Una vez resuelta, las llamadas siguientes
// usan la cache en memoria de inmediato.
let cloudPromise: Promise<{ ok: boolean; count: number; error?: string }> | null = null;
let cloudHydratedAt = 0;
const CLOUD_TTL_MS = 5 * 60 * 1000; // 5 min: refresca si pasa más tiempo

// Natural sort para códigos como "OA 1", "OA 2", ..., "OA 10".
// Devuelve negativo si a < b. Usa el primer número embebido.
const naturalCompare = (a: string, b: string): number => {
  const re = /(\d+)/g;
  const ax = a.match(re)?.map(Number) ?? [];
  const bx = b.match(re)?.map(Number) ?? [];
  const len = Math.max(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const av = ax[i] ?? -1;
    const bv = bx[i] ?? -1;
    if (av !== bv) return av - bv;
  }
  return a.localeCompare(b);
};

export const naturalSortByCode = <T extends { code?: string; oa_code?: string }>(arr: T[]): T[] =>
  [...arr].sort((x, y) => naturalCompare((x.code ?? x.oa_code ?? ""), (y.code ?? y.oa_code ?? "")));

const safeRead = (): OverrideOA[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OverrideOA[]) : [];
  } catch {
    return [];
  }
};

const safeWrite = (data: OverrideOA[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
};

const ensureCache = (): OverrideOA[] => {
  if (cache === null) cache = safeRead();
  return cache;
};

export const listOverrides = (gradeValue?: string, subjectValue?: string): OverrideOA[] => {
  const all = ensureCache();
  const filtered = (!gradeValue || !subjectValue)
    ? all
    : all.filter((o) => o.grade_value === gradeValue && o.subject_value === subjectValue);
  return naturalSortByCode(filtered);
};

export const findOverride = (
  gradeValue: string,
  subjectValue: string,
  oaCode: string,
): OverrideOA | undefined =>
  ensureCache().find(
    (o) => o.grade_value === gradeValue && o.subject_value === subjectValue && o.oa_code === oaCode,
  );

const upsertLocal = (entry: OverrideOA) => {
  const all = ensureCache();
  const idx = all.findIndex(
    (o) =>
      o.grade_value === entry.grade_value &&
      o.subject_value === entry.subject_value &&
      o.oa_code === entry.oa_code,
  );
  if (idx >= 0) all[idx] = entry;
  else all.push(entry);
  cache = [...all];
  safeWrite(cache);
};

const removeLocal = (gradeValue: string, subjectValue: string, oaCode: string) => {
  const all = ensureCache();
  cache = all.filter(
    (o) => !(o.grade_value === gradeValue && o.subject_value === subjectValue && o.oa_code === oaCode),
  );
  safeWrite(cache);
};

// Sincroniza la cache local con la BD. Optimizada:
//  - Deduplica fetches paralelos (in-flight promise compartida).
//  - Respeta un TTL (5 min): si la cache ya fue hidratada recientemente,
//    no vuelve a tocar la red. Esto hace que cambiar de curso/asignatura
//    sea instantáneo después de la primera carga.
//  - `force: true` salta el TTL (útil tras guardar un override).
export const loadOverridesFromCloud = async (
  opts: { force?: boolean } = {},
): Promise<{ ok: boolean; count: number; error?: string }> => {
  const fresh = Date.now() - cloudHydratedAt < CLOUD_TTL_MS;
  if (!opts.force && fresh && cache) {
    return { ok: true, count: cache.length };
  }
  if (cloudPromise) return cloudPromise;

  cloudPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from("curriculum_base")
        .select("grade_value, subject_value, oa_code, oa_description, eje, indicators")
        .order("grade_value", { ascending: true })
        .order("subject_value", { ascending: true })
        .order("oa_code", { ascending: true });
      if (error) return { ok: false, count: 0, error: error.message };
      const rows = (data ?? []) as Array<{
        grade_value: string;
        subject_value: string;
        oa_code: string;
        oa_description: string;
        eje: string | null;
        indicators: unknown;
      }>;
      cache = rows.map((r) => ({
        grade_value: r.grade_value,
        subject_value: r.subject_value,
        oa_code: r.oa_code,
        oa_description: r.oa_description,
        eje: r.eje ?? undefined,
        indicators: Array.isArray(r.indicators) ? (r.indicators as Indicator[]) : [],
      }));
      safeWrite(cache);
      cloudHydratedAt = Date.now();
      return { ok: true, count: cache.length };
    } catch (e) {
      return { ok: false, count: 0, error: (e as Error).message };
    } finally {
      cloudPromise = null;
    }
  })();

  return cloudPromise;
};

// Guarda (insert/update) un override. Persiste local SIEMPRE; intenta cloud.
export const saveOverride = async (entry: OverrideOA): Promise<{ cloud: boolean; error?: string }> => {
  upsertLocal(entry);
  try {
    const { error } = await supabase
      .from("curriculum_base")
      .upsert(
        [
          {
            grade_value: entry.grade_value,
            subject_value: entry.subject_value,
            oa_code: entry.oa_code,
            oa_description: entry.oa_description,
            eje: entry.eje ?? undefined,
            indicators: entry.indicators as unknown as never,
          },
        ],
        { onConflict: "grade_value,subject_value,oa_code" },
      );
    if (error) return { cloud: false, error: error.message };
    return { cloud: true };
  } catch (e) {
    return { cloud: false, error: (e as Error).message };
  }
};

// Elimina el override (restaurar a base). No toca la base hard-coded.
export const removeOverride = async (
  gradeValue: string,
  subjectValue: string,
  oaCode: string,
): Promise<{ cloud: boolean; error?: string }> => {
  removeLocal(gradeValue, subjectValue, oaCode);
  try {
    const { error } = await supabase
      .from("curriculum_base")
      .delete()
      .eq("grade_value", gradeValue)
      .eq("subject_value", subjectValue)
      .eq("oa_code", oaCode);
    if (error) return { cloud: false, error: error.message };
    return { cloud: true };
  } catch (e) {
    return { cloud: false, error: (e as Error).message };
  }
};

// Útil para tests / forzar relectura.
export const __resetCache = () => {
  cache = null;
  cloudHydratedAt = 0;
  cloudPromise = null;
};
