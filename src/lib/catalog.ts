// Catálogo de asignaturas y cursos del colegio.
// Cada opción tiene `label` (legible para el usuario) y `value` (compacto, sin
// espacios ni símbolos, listo para insertarse en el nombre del archivo).

export interface CatalogOption {
  label: string;
  value: string;
}

export type SubjectOption = CatalogOption;
export type GradeOption = CatalogOption;

// Asignaturas oficiales del colegio (extraídas de horarios de Básica y Media).
// El `value` es el token usado en el nombre de archivo (sin espacios ni símbolos).
export const DEFAULT_SUBJECTS: SubjectOption[] = [
  // --- Plan de Formación General (Básica y Media) ---
  { label: "Lenguaje y Comunicación", value: "Lenguaje" },
  { label: "Lengua y Literatura", value: "Lengua" },
  { label: "Taller de Habilidades Lingüísticas", value: "TDHLengua" },
  { label: "Matemática", value: "Matemática" },
  { label: "Taller de Habilidades Matemática", value: "TDHMatemática" },
  { label: "Ciencias Naturales", value: "Ciencias" },
  { label: "Biología", value: "Biología" },
  { label: "Física", value: "Física" },
  { label: "Química", value: "Química" },
  { label: "Historia, Geografía y Ciencias Sociales", value: "Historia" },
  { label: "Filosofía", value: "Filosofía" },
  { label: "Ciencias para la Ciudadanía", value: "CienciasCiudadanía" },
  { label: "Educación Ciudadana", value: "EdCiudadana" },
  { label: "Mundo Global", value: "MundoGlobal" },
  { label: "Chile y la Región Latinoamericana", value: "ChileLatam" },
  { label: "Inglés", value: "Inglés" },
  { label: "Tecnología", value: "Tecnología" },
  { label: "Música", value: "Música" },
  { label: "Artes Visuales", value: "Artes" },
  { label: "Artes (Electivo)", value: "ArtesElectivo" },
  { label: "Educación Física y Salud", value: "EdFísica" },
  { label: "Orientación", value: "Orientación" },
  { label: "Religión", value: "Religión" },
  { label: "Desarrollo Personal", value: "DesarrolloPersonal" },
  // --- Electivos de Profundización (III° y IV° Medio) ---
  { label: "Probabilidades y Estadística", value: "Probabilidades" },
  { label: "Interpretación y Creación en Teatro", value: "Teatro" },
  { label: "Comprensión Histórica del Presente", value: "ComprensiónHistórica" },
  { label: "Biología Celular y Molecular", value: "BiologíaCelular" },
  { label: "Interpretación Musical", value: "InterpretaciónMusical" },
  { label: "Economía y Sociedad", value: "Economía" },
  { label: "Ciencias de la Salud", value: "CienciasSalud" },
  { label: "Participación y Argumentación en Democracia", value: "ParticipaciónDemocracia" },
  { label: "Pensamiento Computacional y Programación", value: "Programación" },
  { label: "Biología de los Ecosistemas", value: "BiologíaEcosistemas" },
  { label: "Promoción de Estilos de Vida Activos y Saludables", value: "EstilosVidaSaludable" },
  { label: "Diseño y Arquitectura", value: "DiseñoArquitectura" },
  { label: "Lectura y Escritura Especializada", value: "LecturaEscritura" },
  { label: "Límites, Derivadas e Integrales", value: "LímitesDerivadas" },
];

// Cursos: Básica con formato "1º Básico", Media con "I Medio A/B" en romanos.
// (Sin Prekínder ni Kínder según convención del colegio.)
export const DEFAULT_GRADES: GradeOption[] = [
  { label: "1º Básico", value: "1ºBásico" },
  { label: "2º Básico", value: "2ºBásico" },
  { label: "3º Básico", value: "3ºBásico" },
  { label: "4º Básico", value: "4ºBásico" },
  { label: "5º Básico", value: "5ºBásico" },
  { label: "6º Básico", value: "6ºBásico" },
  { label: "7º Básico", value: "7ºBásico" },
  { label: "8º Básico", value: "8ºBásico" },
  { label: "I Medio A", value: "IMedioA" },
  { label: "I Medio B", value: "IMedioB" },
  { label: "II Medio A", value: "IIMedioA" },
  { label: "II Medio B", value: "IIMedioB" },
  { label: "III Medio A", value: "IIIMedioA" },
  { label: "III Medio B", value: "IIIMedioB" },
  { label: "IV Medio A", value: "IVMedioA" },
  { label: "IV Medio B", value: "IVMedioB" },
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
