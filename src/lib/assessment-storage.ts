// Persistencia: pruebas guardadas viven en Lovable Cloud (Supabase) por usuario,
// con RLS. El borrador (mientras se edita una prueba nueva) sigue en IndexedDB
// porque es local al dispositivo.
import { get, set, del } from "idb-keyval";
import { migrateQuestion, newAssessmentId, isUuid, type Assessment, type AssessmentStatus } from "./assessment-schema";
import { supabase } from "@/integrations/supabase/client";
import { saveQuestionsToBank } from "./question-bank";

const KEY_DRAFT = "estandarizador.assessment.draft.v1";
const KEY_LOCAL_LIB = "estandarizador.assessment.library.v1";

const migrate = (a: Assessment, dbStatus?: string, dbFeedback?: string | null): Assessment => ({
  ...a,
  id: isUuid(a.id) ? a.id : newAssessmentId(),
  status: (dbStatus as Assessment["status"]) ?? a.status ?? "borrador",
  utpFeedback: dbFeedback ?? a.utpFeedback ?? null,
  meta: { ...a.meta, linkedOA: a.meta?.linkedOA ?? [] },
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
  user_id: string | null;
  title: string;
  data: Assessment;
  status: string;
  utp_feedback: string | null;
  created_at: string;
  updated_at: string;
};

const rowToAssessment = (r: Row): Assessment => migrate(r.data, r.status, r.utp_feedback);

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

export const listAssessmentsWithOwner = async (): Promise<Array<{ assessment: Assessment; userId: string | null }>> => {
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

export const ASSESSMENTS_PAGE_SIZE = 20;

export interface AssessmentListFilters {
  userId?: string | null; // null => sin dueño (usuario eliminado)
  subjectValue?: string;
  status?: string;
}

/**
 * Listado paginado real (range + count exacto) de pruebas con su dueño.
 * Los filtros se aplican en el servidor para que la paginación sea consistente.
 */
export const listAssessmentsWithOwnerPaged = async (
  filters: AssessmentListFilters = {},
  page = 0,
  pageSize = ASSESSMENTS_PAGE_SIZE,
): Promise<{ items: Array<{ assessment: Assessment; userId: string | null }>; total: number; hasMore: boolean }> => {
  const from = page * pageSize;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from("assessments")
    .select("*", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (filters.userId === null) query = query.is("user_id", null);
  else if (filters.userId) query = query.eq("user_id", filters.userId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.subjectValue) query = query.eq("data->meta->>subjectValue", filters.subjectValue);

  const { data, error, count } = await query;
  if (error) {
    console.error("listAssessmentsWithOwnerPaged", error);
    return { items: [], total: 0, hasMore: false };
  }
  const items = (data as unknown as Row[]).map((r) => ({ assessment: rowToAssessment(r), userId: r.user_id }));
  const total = count ?? items.length;
  return { items, total, hasMore: from + items.length < total };
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
  const safeId = isUuid(a.id) ? a.id : newAssessmentId();
  const next: Assessment = { ...a, id: safeId, updatedAt: Date.now() };
  const { data: existing } = await supabase
    .from("assessments")
    .select("user_id")
    .eq("id", next.id)
    .maybeSingle();
  const ownerId = (existing as { user_id?: string } | null)?.user_id ?? user.id;

  const { error } = await supabase.from("assessments").upsert([{
    id: next.id,
    user_id: ownerId,
    title: next.meta.title ?? "",
    status: next.status ?? "borrador",
    utp_feedback: next.utpFeedback ?? null,
    data: next as never,
  }], { onConflict: "id" });
  if (error) throw error;
  // Guardar preguntas en el banco (background, no bloquea)
  saveQuestionsToBank(next.questions, next.meta).catch(() => {});
  return next;
};

/** Actualiza solo el estado (y opcionalmente feedback) de una prueba. */
export const updateAssessmentStatus = async (
  id: string,
  status: AssessmentStatus,
  utpFeedback?: string | null,
): Promise<void> => {
  const { error } = await supabase
    .from("assessments")
    .update({
      status,
      ...(utpFeedback !== undefined ? { utp_feedback: utpFeedback } : {}),
    })
    .eq("id", id);
  if (error) throw error;
};

/** Devuelve el user_id dueño de una prueba (para mostrar autoría al editar). */
export const getAssessmentOwner = async (id: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from("assessments")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { user_id: string }).user_id;
};

export const deleteAssessment = async (id: string): Promise<void> => {
  const { error } = await supabase.from("assessments").delete().eq("id", id);
  if (error) throw error;
};

// ============ Importación one-shot desde IndexedDB local ============
export const getLocalLegacyAssessments = async (): Promise<Assessment[]> => {
  try {
    const items = await get<Assessment[]>(KEY_LOCAL_LIB);
    return items ? items.map((a) => migrate(a)) : [];
  } catch {
    return [];
  }
};

export const clearLocalLegacyAssessments = async (): Promise<void> => {
  try { await del(KEY_LOCAL_LIB); } catch { /* ignore */ }
};
