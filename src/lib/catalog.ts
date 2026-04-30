// Catálogo de asignaturas, cursos y docentes del colegio.
//
// Modelo: cada asignatura puede declarar en qué `levels` se imparte
// ("Básica", "Media", "ElectivoMedia"). Si no declara nada, se considera
// disponible en todos los niveles (compatibilidad).
// Cada curso pertenece a un único `level`.

export type SchoolLevel = "Básica" | "Media" | "ElectivoMedia";

export interface CatalogOption {
  label: string;
  value: string;
}

export interface SubjectOption extends CatalogOption {
  /** Niveles donde se imparte. `undefined` = disponible en todos. */
  levels?: SchoolLevel[];
}

export interface GradeOption extends CatalogOption {
  level: SchoolLevel;
}

export interface TeacherOption extends CatalogOption {
  /** Values de SubjectOption preferidos por este docente (no filtra todavía, futuro). */
  preferredSubjects?: string[];
}

// === Asignaturas oficiales (con vínculo a niveles) ===
export const DEFAULT_SUBJECTS: SubjectOption[] = [
  // --- Plan de Formación General ---
  { label: "Lenguaje y Comunicación", value: "Lenguaje", levels: ["Básica"] },
  { label: "Lengua y Literatura", value: "Lengua", levels: ["Media"] },
  { label: "Taller de Habilidades Lingüísticas", value: "TDHLengua", levels: ["Básica"] },
  { label: "Matemática", value: "Matemática", levels: ["Básica", "Media"] },
  { label: "Taller de Habilidades Matemática", value: "TDHMatemática", levels: ["Básica"] },
  { label: "Ciencias Naturales", value: "Ciencias", levels: ["Básica"] },
  { label: "Biología", value: "Biología", levels: ["Media"] },
  { label: "Física", value: "Física", levels: ["Media"] },
  { label: "Química", value: "Química", levels: ["Media"] },
  { label: "Historia, Geografía y Ciencias Sociales", value: "Historia", levels: ["Básica", "Media"] },
  { label: "Filosofía", value: "Filosofía", levels: ["Media"] },
  { label: "Ciencias para la Ciudadanía", value: "CienciasCiudadanía", levels: ["Media"] },
  { label: "Educación Ciudadana", value: "EdCiudadana", levels: ["Media"] },
  { label: "Mundo Global", value: "MundoGlobal", levels: ["Media"] },
  { label: "Chile y la Región Latinoamericana", value: "ChileLatam", levels: ["Media"] },
  { label: "Inglés", value: "Inglés", levels: ["Básica", "Media"] },
  { label: "Tecnología", value: "Tecnología", levels: ["Básica", "Media"] },
  { label: "Música", value: "Música", levels: ["Básica", "Media"] },
  { label: "Artes Visuales", value: "Artes", levels: ["Básica", "Media"] },
  { label: "Artes (Electivo)", value: "ArtesElectivo", levels: ["ElectivoMedia"] },
  { label: "Educación Física y Salud", value: "EdFísica", levels: ["Básica", "Media"] },
  { label: "Orientación", value: "Orientación", levels: ["Básica", "Media"] },
  { label: "Religión", value: "Religión", levels: ["Básica", "Media"] },
  { label: "Desarrollo Personal", value: "DesarrolloPersonal", levels: ["Media"] },
  // --- Electivos de Profundización (III° y IV° Medio) ---
  { label: "Probabilidades y Estadística", value: "Probabilidades", levels: ["ElectivoMedia"] },
  { label: "Interpretación y Creación en Teatro", value: "Teatro", levels: ["ElectivoMedia"] },
  { label: "Comprensión Histórica del Presente", value: "ComprensiónHistórica", levels: ["ElectivoMedia"] },
  { label: "Biología Celular y Molecular", value: "BiologíaCelular", levels: ["ElectivoMedia"] },
  { label: "Interpretación Musical", value: "InterpretaciónMusical", levels: ["ElectivoMedia"] },
  { label: "Economía y Sociedad", value: "Economía", levels: ["ElectivoMedia"] },
  { label: "Ciencias de la Salud", value: "CienciasSalud", levels: ["ElectivoMedia"] },
  { label: "Participación y Argumentación en Democracia", value: "ParticipaciónDemocracia", levels: ["ElectivoMedia"] },
  { label: "Pensamiento Computacional y Programación", value: "Programación", levels: ["ElectivoMedia"] },
  { label: "Biología de los Ecosistemas", value: "BiologíaEcosistemas", levels: ["ElectivoMedia"] },
  { label: "Promoción de Estilos de Vida Activos y Saludables", value: "EstilosVidaSaludable", levels: ["ElectivoMedia"] },
  { label: "Diseño y Arquitectura", value: "DiseñoArquitectura", levels: ["ElectivoMedia"] },
  { label: "Lectura y Escritura Especializada", value: "LecturaEscritura", levels: ["ElectivoMedia"] },
  { label: "Límites, Derivadas e Integrales", value: "LímitesDerivadas", levels: ["ElectivoMedia"] },
];

// === Cursos (con nivel) ===
export const DEFAULT_GRADES: GradeOption[] = [
  { label: "1º Básico", value: "1ºBásico", level: "Básica" },
  { label: "2º Básico", value: "2ºBásico", level: "Básica" },
  { label: "3º Básico", value: "3ºBásico", level: "Básica" },
  { label: "4º Básico", value: "4ºBásico", level: "Básica" },
  { label: "5º Básico", value: "5ºBásico", level: "Básica" },
  { label: "6º Básico", value: "6ºBásico", level: "Básica" },
  { label: "7º Básico", value: "7ºBásico", level: "Básica" },
  { label: "8º Básico", value: "8ºBásico", level: "Básica" },
  { label: "I Medio A", value: "IMedioA", level: "Media" },
  { label: "I Medio B", value: "IMedioB", level: "Media" },
  { label: "II Medio A", value: "IIMedioA", level: "Media" },
  { label: "II Medio B", value: "IIMedioB", level: "Media" },
  { label: "III Medio A", value: "IIIMedioA", level: "Media" },
  { label: "III Medio B", value: "IIIMedioB", level: "Media" },
  { label: "IV Medio A", value: "IVMedioA", level: "Media" },
  { label: "IV Medio B", value: "IVMedioB", level: "Media" },
];

// === Docentes ===
export const DEFAULT_TEACHERS: TeacherOption[] = [
  { label: "Bastián Pizarro", value: "BastiánPizarro" },
  { label: "Christian Soto", value: "ChristianSoto" },
  { label: "Denisse Escobar", value: "DenisseEscobar" },
  { label: "Diego Olea", value: "DiegoOlea" },
  { label: "Emiliano González", value: "EmilianoGonzález" },
  { label: "Gina Fernández", value: "GinaFernández" },
  { label: "Isidora Navarrete", value: "IsidoraNavarrete" },
  { label: "Jorge Villablanca", value: "JorgeVillablanca" },
  { label: "Julio Fernández", value: "JulioFernández" },
  { label: "Manuel Guerrero", value: "ManuelGuerrero" },
  { label: "Margarita Pérez", value: "MargaritaPérez" },
  { label: "María José Cartes", value: "MaríaJoséCartes" },
  { label: "Marilin Martínez", value: "MarilinMartínez" },
  { label: "Nicole Badilla", value: "NicoleBadilla" },
  { label: "Nicole Iasalvatore", value: "NicoleIasalvatore" },
  { label: "Pamela Herrera", value: "PamelaHerrera" },
  { label: "Patricia Calderón", value: "PatriciaCalderón" },
  { label: "Paulina Oyanedel", value: "PaulinaOyanedel" },
  { label: "Rayen Huenchuñir", value: "RayenHuenchuñir" },
  { label: "Solange Garcés", value: "SolangeGarcés" },
  { label: "Stefany Garcín", value: "StefanyGarcín" },
  { label: "Tamara Navarro", value: "TamaraNavarro" },
  { label: "Valentina Jara", value: "ValentinaJara" },
  { label: "Viviana Orrego", value: "VivianaOrrego" },
  { label: "Yesenia Zúñiga", value: "YeseniaZúñiga" },
];

const SUBJECTS_KEY = "doc-standardizer:subjects";
const GRADES_KEY = "doc-standardizer:grades";
const TEACHERS_KEY = "doc-standardizer:teachers";

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

// === Hidratación retrocompatible ===
// Los catálogos guardados antes de esta iteración no tienen `levels` ni `level`.
// Inferimos los datos faltantes para no romper nada.

const inferGradeLevel = (value: string): SchoolLevel =>
  /Básico/i.test(value) ? "Básica" : "Media";

const hydrateGrades = (items: GradeOption[]): GradeOption[] =>
  items.map((g) => (g.level ? g : { ...g, level: inferGradeLevel(g.value) }));

const hydrateSubjects = (items: SubjectOption[]): SubjectOption[] =>
  items.map((s) => {
    if (s.levels && s.levels.length > 0) return s;
    const known = DEFAULT_SUBJECTS.find((d) => d.value === s.value);
    return { ...s, levels: known?.levels };
  });

export const loadSubjects = (): SubjectOption[] => {
  if (typeof window === "undefined") return DEFAULT_SUBJECTS;
  return hydrateSubjects(safeParse(localStorage.getItem(SUBJECTS_KEY), DEFAULT_SUBJECTS));
};

export const saveSubjects = (subjects: SubjectOption[]) => {
  localStorage.setItem(SUBJECTS_KEY, JSON.stringify(subjects));
};

export const loadGrades = (): GradeOption[] => {
  if (typeof window === "undefined") return DEFAULT_GRADES;
  return hydrateGrades(safeParse(localStorage.getItem(GRADES_KEY), DEFAULT_GRADES));
};

export const saveGrades = (grades: GradeOption[]) => {
  localStorage.setItem(GRADES_KEY, JSON.stringify(grades));
};

export const loadTeachers = (): TeacherOption[] => {
  if (typeof window === "undefined") return DEFAULT_TEACHERS;
  return safeParse(localStorage.getItem(TEACHERS_KEY), DEFAULT_TEACHERS);
};

export const saveTeachers = (teachers: TeacherOption[]) => {
  localStorage.setItem(TEACHERS_KEY, JSON.stringify(teachers));
};

export const resetSubjects = (): SubjectOption[] => {
  saveSubjects(DEFAULT_SUBJECTS);
  return DEFAULT_SUBJECTS;
};

export const resetGrades = (): GradeOption[] => {
  saveGrades(DEFAULT_GRADES);
  return DEFAULT_GRADES;
};

export const resetTeachers = (): TeacherOption[] => {
  saveTeachers(DEFAULT_TEACHERS);
  return DEFAULT_TEACHERS;
};

// === Helpers de filtrado Curso → Asignatura ===

export const getLevelForGrade = (
  gradeValue: string,
  grades: GradeOption[],
): SchoolLevel | null => {
  if (!gradeValue) return null;
  const found = grades.find((g) => g.value === gradeValue);
  return found?.level ?? inferGradeLevel(gradeValue);
};

/** Detecta si un curso es III° o IV° Medio (donde aplican electivos). */
const isElectiveEligible = (gradeValue: string): boolean =>
  /^(III|IV)Medio/i.test(gradeValue);

/**
 * Filtra las asignaturas disponibles para un curso dado.
 * - Si la asignatura no declara `levels`, se considera disponible siempre.
 * - III°/IV° Medio incluyen también las asignaturas marcadas como "ElectivoMedia".
 */
export const getSubjectsForGrade = (
  gradeValue: string,
  subjects: SubjectOption[],
  grades: GradeOption[],
): SubjectOption[] => {
  const level = getLevelForGrade(gradeValue, grades);
  if (!level) return [];
  const allowElective = level === "Media" && isElectiveEligible(gradeValue);
  return subjects.filter((s) => {
    if (!s.levels || s.levels.length === 0) return true;
    if (s.levels.includes(level)) return true;
    if (allowElective && s.levels.includes("ElectivoMedia")) return true;
    return false;
  });
};

// Sanitiza el value para que sea seguro como parte de un nombre de archivo.
export const sanitizeFileToken = (s: string): string =>
  s.replace(/\s+/g, "").replace(/[\\/:*?"<>|]/g, "");
