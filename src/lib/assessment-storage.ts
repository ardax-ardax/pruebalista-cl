// Persistencia: pruebas guardadas viven en Lovable Cloud (Supabase) por usuario,
// con RLS. El borrador (mientras se edita una prueba nueva) sigue en IndexedDB
// porque es local al dispositivo.
import { get, set, del } from "idb-keyval";
import { migrateQuestion, type Assessment } from "./assessment-schema";
import { supabase } from "@/integrations/supabase/client";

const KEY_DRAFT = "estandarizador.assessment.draft.v1";
const KEY_LOCAL_LIB = "estandarizador.assessment.library.v1";

const migrate = (a: Assessment): Assessment => ({
  ...a,
  questions: (a.questions ?? []).map(migrateQuestion),
});

// ============ Borrador (local) ============
let draftCache: Assessment | null = null;
let draftReady = false;
let draftReadyPromise: Promise<void> | null = null;

const hydrateDraft = async () => {
  try {
    const idbDraft = await get<Assessment>(KEY_DRAFT);
    if (idbDraft) draftCache = migrate(idbDraft);
  } catch (e) {
    console.warn("No se pudo hidratar borrador", e);
  } finally {
    draftReady = true;
  }
};

export const ensureStorageReady = (): Promise<void> => {
  if (draftReady) return Promise.resolve();
  if (!draftReadyPromise) draftReadyPromise = hydrateDraft();
  return draftReadyPromise;
};

ensureStorageReady();

export const saveDraft = (a: Assessment) => {
  draftCache = { ...a, updatedAt: Date.now() };
  set(KEY_DRAFT, draftCache).catch((e) => console.warn("No se pudo guardar el borrador", e));
};

export const loadDraft = (): Assessment | null => draftCache;

export const clearDraft = () => {
  draftCache = null;
  del(KEY_DRAFT).catch(() => undefined);
};

// ============ Biblioteca (cloud) ============
type Row = {
  id: string;
  user_id: string;
  title: string;
  data: Assessment;
  created_at: string;
  updated_at: string;
};

const rowToAssessment = (r: Row): Assessment => migrate(r.data);

export const listAssessments = async (): Promise<Assessment[]> => {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("listAssessments", error);
    return [];
  }
  return (data as unknown as Row[]).map(rowToAssessment);
};

export const listAssessmentsWithOwner = async (): Promise<Array<{ assessment: Assessment; userId: string }>> => {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("listAssessmentsWithOwner", error);
    return [];
  }
  return (data as unknown as Row[]).map((r) => ({ assessment: rowToAssessment(r), userId: r.user_id }));
};

export const getAssessment = async (id: string): Promise<Assessment | null> => {
  const { data, error } = await supabase
    .from("assessments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getAssessment", error);
    return null;
  }
  return data ? rowToAssessment(data as unknown as Row) : null;
};

export const upsertAssessment = async (a: Assessment): Promise<Assessment> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión iniciada");
  const next: Assessment = { ...a, updatedAt: Date.now() };
  const { error } = await supabase.from("assessments").upsert([{
    id: next.id,
    user_id: user.id,
    title: next.meta.title ?? "",
    data: next as never,
  }], { onConflict: "id" });
  if (error) throw error;
  return next;
};

export const deleteAssessment = async (id: string): Promise<void> => {
  const { error } = await supabase.from("assessments").delete().eq("id", id);
  if (error) throw error;
};

// ============ Importación one-shot desde IndexedDB local ============
export const getLocalLegacyAssessments = async (): Promise<Assessment[]> => {
  try {
    const items = await get<Assessment[]>(KEY_LOCAL_LIB);
    return items ? items.map(migrate) : [];
  } catch {
    return [];
  }
};

export const clearLocalLegacyAssessments = async (): Promise<void> => {
  try { await del(KEY_LOCAL_LIB); } catch { /* ignore */ }
};
