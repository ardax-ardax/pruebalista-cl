// Persistencia simple de borradores de evaluación en localStorage.
import { migrateQuestion, type Assessment } from "./assessment-schema";

const KEY = "estandarizador.assessment.draft.v1";

export const saveDraft = (a: Assessment) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...a, updatedAt: Date.now() }));
  } catch (e) {
    console.warn("No se pudo guardar el borrador", e);
  }
};

export const loadDraft = (): Assessment | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Assessment;
    // Migrar preguntas V/F antiguas al modelo de statements
    parsed.questions = (parsed.questions ?? []).map(migrateQuestion);
    return parsed;
  } catch {
    return null;
  }
};

export const clearDraft = () => {
  localStorage.removeItem(KEY);
};
