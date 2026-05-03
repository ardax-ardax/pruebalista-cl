// Helpers de generación de preguntas con IA.
// Llama al edge function `generate-question` y normaliza la respuesta a `Question`.

import { supabase } from "@/integrations/supabase/client";
import {
  newId,
  newQuestion,
  type Option,
  type Question,
  type QuestionType,
  type TfStatement,
} from "./assessment-schema";

export interface GenerateQuestionParams {
  oaCode: string;
  oaDescription: string;
  gradeLabel: string;
  subjectLabel: string;
  questionType: Extract<QuestionType, "multiple-choice" | "true-false" | "short-answer">;
  indicators?: { code: string; description: string }[];
  optionCount?: number; // 3-5 for MC
  statementCount?: number; // 2-4 for TF
}

interface RawGenerated {
  prompt?: string;
  title?: string;
  points?: number;
  options?: Array<{ text?: string; correct?: boolean }>;
  statements?: Array<{ text?: string; answer?: "V" | "F"; points?: number }>;
  answerLines?: number;
  difficulty?: "baja" | "media" | "alta";
  rubricExplanation?: string;
}

export async function generateQuestion(params: GenerateQuestionParams): Promise<Question> {
  const { data, error } = await supabase.functions.invoke("generate-question", {
    body: params,
  });
  if (error) {
    const ctx = (error as unknown as { context?: { error?: string } }).context;
    throw new Error(ctx?.error || error.message || "Error al generar la pregunta");
  }
  if (!data || (data as { error?: string }).error) {
    throw new Error((data as { error?: string })?.error || "Respuesta vacía de la IA");
  }
  const q = coerceGeneratedQuestion(data as RawGenerated, params.questionType);
  q.sourceOA = params.oaCode;
  if (params.indicators && params.indicators.length > 0) {
    q.sourceIndicators = params.indicators.map((i) => i.code);
  }
  return q;
}

export function coerceGeneratedQuestion(raw: RawGenerated, type: GenerateQuestionParams["questionType"]): Question {
  const base = newQuestion(type);
  base.prompt = (raw.prompt ?? "").toString().trim() || base.prompt;
  if (raw.title) base.title = String(raw.title).trim();
  if (raw.difficulty && ["baja", "media", "alta"].includes(raw.difficulty)) {
    base.difficulty = raw.difficulty;
  }
  if (raw.rubricExplanation) {
    base.rubric = String(raw.rubricExplanation).trim();
  }


  if (type === "multiple-choice") {
    const opts = Array.isArray(raw.options) ? raw.options : [];
    let correctSeen = false;
    const options: Option[] = opts
      .filter((o) => o && typeof o.text === "string")
      .slice(0, 6)
      .map((o) => {
        const isCorrect = !!o.correct && !correctSeen;
        if (isCorrect) correctSeen = true;
        return { id: newId(), text: String(o.text).trim(), correct: isCorrect };
      });
    if (options.length === 0) {
      // Fallback: 4 alternativas vacías para que el docente complete.
      base.options = ["", "", "", ""].map((t, i) => ({ id: newId(), text: t, correct: i === 0 }));
    } else {
      // Garantizar al menos 1 correcta.
      if (!options.some((o) => o.correct)) options[0].correct = true;
      base.options = options;
    }
    base.points = Number.isFinite(raw.points) && (raw.points as number) > 0 ? (raw.points as number) : 1;
  } else if (type === "true-false") {
    const sts = Array.isArray(raw.statements) ? raw.statements : [];
    const statements: TfStatement[] = sts
      .filter((s) => s && typeof s.text === "string")
      .slice(0, 10)
      .map((s) => ({
        id: newId(),
        text: String(s.text).trim(),
        answer: s.answer === "F" ? "F" : "V",
        points: Number.isFinite(s.points) && (s.points as number) > 0 ? (s.points as number) : 1,
      }));
    base.statements = statements.length > 0 ? statements : base.statements;
  } else if (type === "short-answer") {
    const lines = Number(raw.answerLines);
    base.answerLines = Number.isFinite(lines) && lines > 0 ? Math.min(10, Math.round(lines)) : 3;
    base.points = Number.isFinite(raw.points) && (raw.points as number) > 0 ? (raw.points as number) : 2;
  }
  return base;
}
