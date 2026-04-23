// Persistencia de evaluaciones en IndexedDB (vía idb-keyval) con cache en
// memoria para mantener una API síncrona compatible con el código existente.
// Antes usábamos localStorage pero las imágenes base64 saturan rápido la cuota
// de ~5MB. IndexedDB permite cientos de MB.
import { get, set, del } from "idb-keyval";
import { migrateQuestion, type Assessment } from "./assessment-schema";

const KEY_DRAFT = "estandarizador.assessment.draft.v1";
const KEY_LIB = "estandarizador.assessment.library.v1";

const migrate = (a: Assessment): Assessment => ({
  ...a,
  questions: (a.questions ?? []).map(migrateQuestion),
});

// ============ Cache en memoria + hidratación inicial ============
let draftCache: Assessment | null = null;
let libCache: Assessment[] = [];
let ready = false;
let readyPromise: Promise<void> | null = null;

const hydrate = async () => {
  try {
    // Migración suave desde localStorage si quedó algo allí.
    const lsLib = localStorage.getItem(KEY_LIB);
    const lsDraft = localStorage.getItem(KEY_DRAFT);

    const idbLib = await get<Assessment[]>(KEY_LIB);
    const idbDraft = await get<Assessment>(KEY_DRAFT);

    if (idbLib) {
      libCache = idbLib.map(migrate);
    } else if (lsLib) {
      try {
        libCache = (JSON.parse(lsLib) as Assessment[]).map(migrate);
        await set(KEY_LIB, libCache);
      } catch {
        libCache = [];
      }
    }

    if (idbDraft) {
      draftCache = migrate(idbDraft);
    } else if (lsDraft) {
      try {
        draftCache = migrate(JSON.parse(lsDraft) as Assessment);
        await set(KEY_DRAFT, draftCache);
      } catch {
        draftCache = null;
      }
    }

    // Liberar localStorage para evitar futuros QuotaExceeded.
    try {
      localStorage.removeItem(KEY_LIB);
      localStorage.removeItem(KEY_DRAFT);
    } catch {
      /* ignore */
    }
  } catch (e) {
    console.warn("No se pudo hidratar storage", e);
  } finally {
    ready = true;
  }
};

export const ensureStorageReady = (): Promise<void> => {
  if (ready) return Promise.resolve();
  if (!readyPromise) readyPromise = hydrate();
  return readyPromise;
};

// Disparar hidratación de inmediato al importar el módulo.
ensureStorageReady();

const persistLib = () => {
  set(KEY_LIB, libCache).catch((e) => console.warn("No se pudo guardar la biblioteca", e));
};
const persistDraft = () => {
  if (draftCache) {
    set(KEY_DRAFT, draftCache).catch((e) => console.warn("No se pudo guardar el borrador", e));
  } else {
    del(KEY_DRAFT).catch(() => undefined);
  }
};

// ============ Borrador ============
export const saveDraft = (a: Assessment) => {
  draftCache = { ...a, updatedAt: Date.now() };
  persistDraft();
};

export const loadDraft = (): Assessment | null => draftCache;

export const clearDraft = () => {
  draftCache = null;
  persistDraft();
};

// ============ Biblioteca ============
export const listAssessments = (): Assessment[] =>
  [...libCache].sort((a, b) => b.updatedAt - a.updatedAt);

export const upsertAssessment = (a: Assessment): Assessment => {
  const next: Assessment = { ...a, updatedAt: Date.now() };
  const idx = libCache.findIndex((x) => x.id === a.id);
  if (idx >= 0) libCache[idx] = next;
  else libCache.unshift(next);
  persistLib();
  return next;
};

export const getAssessment = (id: string): Assessment | null =>
  libCache.find((a) => a.id === id) ?? null;

export const deleteAssessment = (id: string) => {
  libCache = libCache.filter((a) => a.id !== id);
  persistLib();
};
