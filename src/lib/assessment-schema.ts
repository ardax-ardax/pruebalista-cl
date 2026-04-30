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
}

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
}

export interface Assessment {
  id: string;
  createdAt: number;
  updatedAt: number;
  meta: AssessmentMeta;
  questions: Question[];
}

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

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
  id: newId(),
  createdAt: Date.now(),
  updatedAt: Date.now(),
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
