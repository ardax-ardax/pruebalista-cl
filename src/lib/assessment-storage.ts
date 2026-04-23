// Persistencia simple de borradores de evaluación en localStorage.
import type { Assessment } from "./assessment-schema";

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
    return JSON.parse(raw) as Assessment;
  } catch {
    return null;
  }
};

export const clearDraft = () => {
  localStorage.removeItem(KEY);
};
