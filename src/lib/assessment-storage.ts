// Persistencia de evaluaciones en localStorage:
// - Borrador en curso (autosave) bajo KEY_DRAFT
// - Biblioteca de pruebas guardadas bajo KEY_LIB
import { migrateQuestion, type Assessment } from "./assessment-schema";

const KEY_DRAFT = "estandarizador.assessment.draft.v1";
const KEY_LIB = "estandarizador.assessment.library.v1";

const migrate = (a: Assessment): Assessment => ({
  ...a,
  questions: (a.questions ?? []).map(migrateQuestion),
});

// ============ Borrador ============
export const saveDraft = (a: Assessment) => {
  try {
    localStorage.setItem(KEY_DRAFT, JSON.stringify({ ...a, updatedAt: Date.now() }));
  } catch (e) {
    console.warn("No se pudo guardar el borrador", e);
  }
};

export const loadDraft = (): Assessment | null => {
  try {
    const raw = localStorage.getItem(KEY_DRAFT);
    if (!raw) return null;
    return migrate(JSON.parse(raw) as Assessment);
  } catch {
    return null;
  }
};

export const clearDraft = () => {
  localStorage.removeItem(KEY_DRAFT);
};

// ============ Biblioteca ============
export const listAssessments = (): Assessment[] => {
  try {
    const raw = localStorage.getItem(KEY_LIB);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Assessment[];
    return arr.map(migrate).sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
};

const writeLib = (arr: Assessment[]) => {
  localStorage.setItem(KEY_LIB, JSON.stringify(arr));
};

export const upsertAssessment = (a: Assessment): Assessment => {
  const lib = listAssessments();
  const next: Assessment = { ...a, updatedAt: Date.now() };
  const idx = lib.findIndex((x) => x.id === a.id);
  if (idx >= 0) lib[idx] = next;
  else lib.unshift(next);
  writeLib(lib);
  return next;
};

export const getAssessment = (id: string): Assessment | null => {
  return listAssessments().find((a) => a.id === id) ?? null;
};

export const deleteAssessment = (id: string) => {
  writeLib(listAssessments().filter((a) => a.id !== id));
};
