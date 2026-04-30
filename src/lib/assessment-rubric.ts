// Construye la "Pauta de Corrección" a partir de un Assessment.
// Se imprime al final del PDF/DOCX en una hoja aparte.

import type { Assessment, Question } from "./assessment-schema";
import { findOA } from "./curriculum-data";

export interface RubricItem {
  number: number;             // numeración secuencial de la pregunta
  type: Question["type"];
  title?: string;
  prompt: string;
  oaCode?: string;
  oaDescription?: string;
  indicators: { code: string; description: string }[];
  correctAnswer: string;      // texto descriptivo
  rubric?: string;            // explicación adicional (de la IA o manual)
  points: number;
  difficulty?: "baja" | "media" | "alta";
}

const numberingForQuestions = (questions: Question[]): Array<number | null> => {
  const out: Array<number | null> = [];
  let n = 0;
  for (const q of questions) {
    if (q.type === "section-title") { n = 0; out.push(null); continue; }
    if (q.type === "info-block") { out.push(null); continue; }
    n += 1;
    out.push(n);
  }
  return out;
};

const correctAnswerFor = (q: Question): string => {
  if (q.type === "multiple-choice") {
    const letters = ["a", "b", "c", "d", "e", "f"];
    const correct = (q.options ?? [])
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => o.correct)
      .map(({ o, i }) => `${letters[i] ?? i + 1}) ${o.text}`);
    return correct.length > 0 ? correct.join(" / ") : "—";
  }
  if (q.type === "true-false") {
    return (q.statements ?? [])
      .map((st, i) => `${i + 1}: ${st.answer}`)
      .join("   ");
  }
  if (q.type === "short-answer") {
    return q.rubric ? "Respuesta abierta — ver criterio." : "Respuesta abierta.";
  }
  return "—";
};

const pointsOf = (q: Question): number => {
  if (q.type === "true-false") {
    return (q.statements ?? []).reduce((s, st) => s + (st.points ?? 0), 0);
  }
  return q.points ?? 0;
};

export const buildRubric = (a: Assessment): RubricItem[] => {
  const numbering = numberingForQuestions(a.questions);
  const items: RubricItem[] = [];
  a.questions.forEach((q, i) => {
    const n = numbering[i];
    if (n == null) return;
    const oa = q.sourceOA ? findOA(a.meta.gradeValue, a.meta.subjectValue, q.sourceOA) : undefined;
    const indicators = (q.sourceIndicators ?? [])
      .map((code) => oa?.indicators.find((ind) => ind.code === code))
      .filter((x): x is { code: string; description: string } => !!x);
    items.push({
      number: n,
      type: q.type,
      title: q.title,
      prompt: q.prompt,
      oaCode: oa?.code,
      oaDescription: oa?.description,
      indicators,
      correctAnswer: correctAnswerFor(q),
      rubric: q.rubric,
      points: pointsOf(q),
      difficulty: q.difficulty,
    });
  });
  return items;
};

/** Indicadores únicos derivados de las preguntas (para encabezado). */
export const collectAssessmentIndicators = (a: Assessment): string[] => {
  const set = new Set<string>();
  for (const q of a.questions) {
    for (const code of q.sourceIndicators ?? []) set.add(code);
  }
  return Array.from(set);
};
