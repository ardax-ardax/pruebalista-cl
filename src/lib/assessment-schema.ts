// Esquema estructurado de evaluación. Es la única fuente de verdad
// para el preview, el PDF y el .docx generado nativamente.

export type QuestionType =
  | "multiple-choice"
  | "true-false"
  | "short-answer"
  | "info-block"
  | "section-title";

export interface ImageCrop {
  // Porcentajes (0–100) de cada lado a recortar.
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface QuestionImage {
  src: string; // dataURL
  alt?: string;
  widthPct: number; // 10–100, ancho relativo al área de contenido
  alignment: "left" | "center" | "right";
  crop: ImageCrop;
  // Dimensiones naturales (px) — necesarias para preservar proporción al recortar.
  naturalW?: number;
  naturalH?: number;
}

export interface Option {
  id: string;
  text: string;
  correct?: boolean;
  image?: QuestionImage | null;
}

export interface TfStatement {
  id: string;
  text: string;
  answer: "V" | "F";
  image?: QuestionImage | null;
  points?: number;
}

export type ImageLayout = "block" | "side-right" | "side-left";

export type Difficulty = "baja" | "media" | "alta";

export interface Question {
  id: string;
  type: QuestionType;
  title?: string; // título corto del enunciado (opcional)
  prompt: string; // texto principal o título de sección
  instructions?: string; // instrucciones opcionales bajo title (solo section-title)
  points?: number;
  image?: QuestionImage | null;
  imageLayout?: ImageLayout; // solo aplica a multiple-choice + image; default "block"
  options?: Option[]; // para multiple-choice
  statements?: TfStatement[]; // para true-false (lista de afirmaciones)
  answerLines?: number; // para short-answer
  useTwoColumns?: boolean; // solo aplica a multiple-choice y true-false
  infoStyle?: "highlighted" | "plain"; // solo aplica a info-block; default "highlighted"
  // === Trazabilidad curricular y pauta de corrección (opcionales) ===
  difficulty?: Difficulty;          // estimado por la IA
  rubric?: string;                  // explicación / criterio para corregir
  sourceOA?: string;                // OA con el que se generó esta pregunta
  sourceIndicators?: string[];      // códigos de indicadores usados
}

// Optimización de Diseño y Papel: overrides opcionales por prueba.
// Editables por admin/utp_head y por usuarios individuales (no institucionales).
// Márgenes en milímetros, espaciado entre preguntas en pt.

export type PageSizeKey = "folio" | "carta" | "a4" | "oficio";

export const PAGE_SIZE_OPTIONS: { key: PageSizeKey; label: string; widthCm: number; heightCm: number }[] = [
  { key: "folio",  label: "Folio (21.59 × 33.02 cm)",  widthCm: 21.59, heightCm: 33.02 },
  { key: "carta",  label: "Carta (21.59 × 27.94 cm)",  widthCm: 21.59, heightCm: 27.94 },
  { key: "a4",     label: "A4 (21 × 29.7 cm)",         widthCm: 21,    heightCm: 29.7 },
  { key: "oficio", label: "Oficio (21.6 × 34 cm)",     widthCm: 21.6,  heightCm: 34 },
];

export function resolvePageSize(layout: AssessmentLayout | undefined, templatePageSize: { widthCm: number; heightCm: number }): { widthCm: number; heightCm: number } {
  if (layout?.pageSizeKey) {
    const found = PAGE_SIZE_OPTIONS.find((o) => o.key === layout.pageSizeKey);
    if (found) return { widthCm: found.widthCm, heightCm: found.heightCm };
  }
  return templatePageSize;
}

export interface AssessmentLayout {
  marginTop: number;     // mm (10–40)
  marginBottom: number;  // mm (10–40)
  marginSide: number;    // mm (10–40) — aplica a izquierda y derecha
  questionSpacing: number; // pt (entre preguntas)
  optionsColumns: 1 | 2; // distribución de alternativas A/B/C/D
  pageSizeKey?: PageSizeKey; // override de tamaño de página (null = usa el del template)
}

export const DEFAULT_LAYOUT: AssessmentLayout = {
  marginTop: 20,
  marginBottom: 20,
  marginSide: 20,
  questionSpacing: 14,
  optionsColumns: 1,
};

export const LAYOUT_LIMITS = {
  marginMinMm: 10,
  marginMaxMm: 40,
  spacingMinPt: 4,
  spacingMaxPt: 28,
} as const;

export interface AssessmentMeta {
  templateId: string; // id de FormatTemplate (banner-evaluacion / banner-guia / ...)
  title: string;
  instructions: string;
  number: string; // "1"
  subjectValue: string; // value del catálogo
  gradeValue: string;
  teacherValue: string;
  totalPoints: number; // calculado pero editable como override
  date?: string;
  studentName?: string;
  linkedOA: string[]; // códigos de Objetivos de Aprendizaje (Mineduc) seleccionados
  showOaInHeader?: boolean; // si true, imprime los OAs bajo las instrucciones de la prueba
  layout?: AssessmentLayout; // optimización de espacio (papel)
  // === Modo Ensayo PAES ===
  paesVariant?: PaesVariant;
  paesAxis?: string; // Eje temático / habilidad (catálogo oficial DEMRE)
  paesCienciasModule?: "biologia" | "fisica" | "quimica"; // sub-módulo cuando variant === "ciencias"
}

// Variantes oficiales del Ensayo PAES.
export type PaesVariant =
  | "competencia-lectora"
  | "m1"
  | "m2"
  | "ciencias"
  | "historia";

export const PAES_VARIANTS: { value: PaesVariant; label: string; questionGoal: number }[] = [
  { value: "competencia-lectora", label: "Competencia Lectora", questionGoal: 65 },
  { value: "m1", label: "Matemática M1", questionGoal: 65 },
  { value: "m2", label: "Matemática M2", questionGoal: 55 },
  { value: "ciencias", label: "Ciencias", questionGoal: 80 },
  { value: "historia", label: "Historia y Cs. Sociales", questionGoal: 65 },
];

// Metas oficiales SIMCE (varían por nivel y asignatura, usamos 65 como referencia general).
export const SIMCE_QUESTION_GOAL = 65;

export type AssessmentStatus = "borrador" | "pendiente_revision" | "aprobado" | "rechazado";

export const ASSESSMENT_STATUS_LABEL: Record<AssessmentStatus, string> = {
  borrador: "Borrador",
  pendiente_revision: "Pendiente de Revisión",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

export interface Assessment {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: AssessmentStatus;
  utpFeedback?: string | null;
  meta: AssessmentMeta;
  questions: Question[];
}

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// UUID v4 válido para columnas Postgres tipo `uuid` (p.ej. assessments.id).
// Usa crypto.randomUUID() cuando esté disponible y cae a un fallback manual.
export const newAssessmentId = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    // ignore
  }
  // Fallback RFC4122 v4
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string =>
  typeof s === "string" && UUID_RE.test(s);

// Tope estándar (left/right): 20%. Tope para alineación centro: 50%.
export const MAX_IMAGE_WIDTH_PCT = 20;
export const MAX_IMAGE_WIDTH_CENTER_PCT = 50;
export const MIN_IMAGE_WIDTH_PCT = 10;
// Para preguntas de desarrollo: imagen siempre centrada, hasta 80%, default 50%.
export const MAX_IMAGE_WIDTH_DEV_PCT = 80;
export const DEFAULT_IMAGE_WIDTH_DEV_PCT = 50;
export const clampWidthPct = (n: number): number =>
  Math.max(MIN_IMAGE_WIDTH_PCT, Math.min(MAX_IMAGE_WIDTH_PCT, Number.isFinite(n) ? n : MAX_IMAGE_WIDTH_PCT));
export const clampWidthPctByAlign = (
  n: number,
  alignment: "left" | "center" | "right",
): number => {
  const max = alignment === "center" ? MAX_IMAGE_WIDTH_CENTER_PCT : MAX_IMAGE_WIDTH_PCT;
  return Math.max(MIN_IMAGE_WIDTH_PCT, Math.min(max, Number.isFinite(n) ? n : max));
};
export const clampWidthPctDev = (n: number): number =>
  Math.max(MIN_IMAGE_WIDTH_PCT, Math.min(MAX_IMAGE_WIDTH_DEV_PCT, Number.isFinite(n) ? n : DEFAULT_IMAGE_WIDTH_DEV_PCT));

export const emptyAssessment = (templateId: string): Assessment => ({
  id: newAssessmentId(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
  status: "borrador",
  meta: {
    templateId,
    title: "",
    instructions: "",
    number: "1",
    subjectValue: "",
    gradeValue: "",
    teacherValue: "",
    totalPoints: 0,
    linkedOA: [],
    showOaInHeader: false,
  },
  questions: [],
});

export const newStatement = (answer: "V" | "F" = "V"): TfStatement => ({
  id: newId(),
  text: "",
  answer,
  points: 1,
});

export const newQuestion = (type: QuestionType): Question => {
  const base: Question = {
    id: newId(),
    type,
    prompt: "",
    points: type === "info-block" || type === "section-title" || type === "true-false" ? undefined : 1,
  };
  if (type === "multiple-choice") {
    base.options = ["a", "b", "c", "d"].map((_, i) => ({
      id: newId(),
      text: "",
      correct: i === 0,
    }));
  }
  if (type === "true-false") {
    base.statements = [newStatement("V")];
  }
  if (type === "short-answer") {
    base.answerLines = 3;
  }
  return base;
};

// Migra preguntas V/F antiguas (con options Verdadero/Falso) al modelo de statements.
export const migrateQuestion = (q: Question): Question => {
  if (q.type === "true-false" && (!q.statements || q.statements.length === 0)) {
    return { ...q, statements: [newStatement("V")], options: undefined };
  }
  return q;
};

export const computeTotalPoints = (qs: Question[]): number =>
  qs.reduce((acc, q) => {
    if (q.type === "true-false") {
      return acc + (q.statements ?? []).reduce((s, st) => s + (st.points ?? 0), 0);
    }
    return acc + (q.points ?? 0);
  }, 0);

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  "multiple-choice": "Selección múltiple",
  "true-false": "Verdadero / Falso",
  "short-answer": "Desarrollo corto",
  "info-block": "Bloque informativo",
  "section-title": "Título de sección",
};
