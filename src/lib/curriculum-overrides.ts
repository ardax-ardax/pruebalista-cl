// CRUD directo contra `curriculum_base`. Sin localStorage ni overrides.
// Fuente única de verdad: la tabla curriculum_base en Supabase.

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

let cache: OverrideOA[] | null = null;
let cloudPromise: Promise<{ ok: boolean; count: number; error?: string }> | null = null;
let cloudHydratedAt = 0;
const CLOUD_TTL_MS = 5 * 60 * 1000;

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

export const listOverrides = (gradeValue?: string, subjectValue?: string): OverrideOA[] => {
  const all = cache ?? [];
  const filtered = all.filter((o) => {
    if (gradeValue && o.grade_value !== gradeValue) return false;
    if (subjectValue && o.subject_value !== subjectValue) return false;
    return true;
  });
  return naturalSortByCode(filtered);
};

export const findOverride = (
  gradeValue: string,
  subjectValue: string,
  oaCode: string,
): OverrideOA | undefined =>
  (cache ?? []).find(
    (o) => o.grade_value === gradeValue && o.subject_value === subjectValue && o.oa_code === oaCode,
  );

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
        .order("oa_code", { ascending: true })
        .limit(5000);
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

export const saveOverride = async (entry: OverrideOA): Promise<{ cloud: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from("curriculum_base")
      .upsert(
        [{
          grade_value: entry.grade_value,
          subject_value: entry.subject_value,
          oa_code: entry.oa_code,
          oa_description: entry.oa_description,
          eje: entry.eje ?? undefined,
          indicators: entry.indicators as unknown as never,
        }],
        { onConflict: "grade_value,subject_value,oa_code" },
      );
    if (error) return { cloud: false, error: error.message };
    await loadOverridesFromCloud({ force: true });
    return { cloud: true };
  } catch (e) {
    return { cloud: false, error: (e as Error).message };
  }
};

export const saveBulkOAs = async (entries: OverrideOA[]): Promise<{ cloud: boolean; count: number; error?: string }> => {
  try {
    const rows = entries.map((e) => ({
      grade_value: e.grade_value,
      subject_value: e.subject_value,
      oa_code: e.oa_code,
      oa_description: e.oa_description,
      eje: e.eje ?? undefined,
      indicators: e.indicators as unknown as never,
    }));
    const { error } = await supabase
      .from("curriculum_base")
      .upsert(rows, { onConflict: "grade_value,subject_value,oa_code" });
    if (error) return { cloud: false, count: 0, error: error.message };
    await loadOverridesFromCloud({ force: true });
    return { cloud: true, count: entries.length };
  } catch (e) {
    return { cloud: false, count: 0, error: (e as Error).message };
  }
};

export const removeOverride = async (
  gradeValue: string,
  subjectValue: string,
  oaCode: string,
): Promise<{ cloud: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from("curriculum_base")
      .delete()
      .eq("grade_value", gradeValue)
      .eq("subject_value", subjectValue)
      .eq("oa_code", oaCode);
    if (error) return { cloud: false, error: error.message };
    await loadOverridesFromCloud({ force: true });
    return { cloud: true };
  } catch (e) {
    return { cloud: false, error: (e as Error).message };
  }
};

export const __resetCache = () => {
  cache = null;
  cloudHydratedAt = 0;
  cloudPromise = null;
};
