// Catálogo de asignaturas y cursos del colegio.
// Cada opción tiene `label` (legible para el usuario) y `value` (compacto, sin
// espacios ni símbolos, listo para insertarse en el nombre del archivo).

export interface CatalogOption {
  label: string;
  value: string;
}

export type SubjectOption = CatalogOption;
export type GradeOption = CatalogOption;

export const DEFAULT_SUBJECTS: SubjectOption[] = [
  { label: "Lenguaje", value: "Lenguaje" },
  { label: "Matemática", value: "Matemática" },
  { label: "Historia", value: "Historia" },
  { label: "Ciencias", value: "Ciencias" },
  { label: "Inglés", value: "Inglés" },
  { label: "Arte", value: "Arte" },
  { label: "Música", value: "Música" },
  { label: "Educación Física", value: "EducaciónFísica" },
  { label: "Tecnología", value: "Tecnología" },
  { label: "Religión", value: "Religión" },
  { label: "Orientación", value: "Orientación" },
];

export const DEFAULT_GRADES: GradeOption[] = [
  { label: "Prekínder", value: "Prekínder" },
  { label: "Kínder", value: "Kínder" },
  { label: "1° Básico", value: "1Básico" },
  { label: "2° Básico", value: "2Básico" },
  { label: "3° Básico", value: "3Básico" },
  { label: "4° Básico", value: "4Básico" },
  { label: "5° Básico", value: "5Básico" },
  { label: "6° Básico", value: "6Básico" },
  { label: "7° Básico", value: "7Básico" },
  { label: "8° Básico", value: "8Básico" },
  { label: "1° Medio", value: "1Medio" },
  { label: "2° Medio", value: "2Medio" },
  { label: "3° Medio", value: "3Medio" },
  { label: "4° Medio", value: "4Medio" },
];

const SUBJECTS_KEY = "doc-standardizer:subjects";
const GRADES_KEY = "doc-standardizer:grades";

const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as T;
    return fallback;
  } catch {
    return fallback;
  }
};

export const loadSubjects = (): SubjectOption[] => {
  if (typeof window === "undefined") return DEFAULT_SUBJECTS;
  return safeParse(localStorage.getItem(SUBJECTS_KEY), DEFAULT_SUBJECTS);
};

export const saveSubjects = (subjects: SubjectOption[]) => {
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
};

export const loadGrades = (): GradeOption[] => {
  if (typeof window === "undefined") return DEFAULT_GRADES;
  return safeParse(localStorage.getItem(GRADES_KEY), DEFAULT_GRADES);
};

export const saveGrades = (grades: GradeOption[]) => {
  localStorage.setItem(GRADES_KEY, JSON.stringify(grades));
};

export const resetSubjects = (): SubjectOption[] => {
  saveSubjects(DEFAULT_SUBJECTS);
  return DEFAULT_SUBJECTS;
};

export const resetGrades = (): GradeOption[] => {
  saveGrades(DEFAULT_GRADES);
  return DEFAULT_GRADES;
};

// Sanitiza el value para que sea seguro como parte de un nombre de archivo:
// elimina espacios y símbolos problemáticos.
export const sanitizeFileToken = (s: string): string =>
  s.replace(/\s+/g, "").replace(/[\\/:*?"<>|]/g, "");
