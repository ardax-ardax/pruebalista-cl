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
}

export interface Option {
  id: string;
  text: string;
  correct?: boolean;
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string; // texto principal o título de sección
  points?: number;
  image?: QuestionImage | null;
  options?: Option[]; // para multiple-choice / true-false
  answerLines?: number; // para short-answer
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
  },
  questions: [],
});

export const newQuestion = (type: QuestionType): Question => {
  const base: Question = {
    id: newId(),
    type,
    prompt: "",
    points: type === "info-block" || type === "section-title" ? undefined : 1,
  };
  if (type === "multiple-choice") {
    base.options = ["a", "b", "c", "d"].map((_, i) => ({
      id: newId(),
      text: "",
      correct: i === 0,
    }));
  }
  if (type === "true-false") {
    base.options = [
      { id: newId(), text: "Verdadero", correct: true },
      { id: newId(), text: "Falso", correct: false },
    ];
  }
  if (type === "short-answer") {
    base.answerLines = 3;
  }
  return base;
};

export const computeTotalPoints = (qs: Question[]): number =>
  qs.reduce((acc, q) => acc + (q.points ?? 0), 0);

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  "multiple-choice": "Selección múltiple",
  "true-false": "Verdadero / Falso",
  "short-answer": "Desarrollo corto",
  "info-block": "Bloque informativo",
  "section-title": "Título de sección",
};
