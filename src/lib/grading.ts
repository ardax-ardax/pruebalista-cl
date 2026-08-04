// === Corrección y cálculo de notas (escala chilena) ===
import { supabase } from "@/integrations/supabase/client";
import type { AnswerSlot, OptionLetter } from "./omr-geometry";
import type { ScanMark } from "./omr-scan";

export interface GradingSettings {
  /** Exigencia: % de logro necesario para la nota 4,0. */
  passingPercent: number;
  maxGrade: number;
  minGrade: number;
}

export const DEFAULT_GRADING: GradingSettings = {
  passingPercent: 60,
  maxGrade: 7.0,
  minGrade: 1.0,
};

const PASS_GRADE = 4.0;

/** Nota chilena de 2 tramos con exigencia configurable. */
export function computeGrade(
  correct: number,
  total: number,
  s: GradingSettings = DEFAULT_GRADING,
): number {
  if (total <= 0) return s.minGrade;
  const p = correct / total;
  const e = Math.min(0.99, Math.max(0.01, s.passingPercent / 100));
  const raw =
    p >= e
      ? PASS_GRADE + ((p - e) / (1 - e)) * (s.maxGrade - PASS_GRADE)
      : s.minGrade + (p / e) * (PASS_GRADE - s.minGrade);
  return Math.round(Math.min(s.maxGrade, Math.max(s.minGrade, raw)) * 10) / 10;
}

export interface GradedAnswer {
  slotIndex: number;
  num: number;
  kind: "mc" | "tf";
  marked: OptionLetter | null;
  expected: OptionLetter | null;
  isCorrect: boolean;
  ambiguous: boolean;
}

export interface GradingResult {
  answers: GradedAnswer[];
  correct: number;
  incorrect: number;
  blank: number;
  gradable: number;
  scorePercent: number;
  grade: number;
}

export function gradeMarks(
  slots: AnswerSlot[],
  marks: ScanMark[],
  settings: GradingSettings = DEFAULT_GRADING,
): GradingResult {
  const answers: GradedAnswer[] = marks.map((m) => {
    const slot = slots[m.slotIndex];
    const expected = slot?.expected ?? null;
    return {
      slotIndex: m.slotIndex,
      num: m.num,
      kind: m.kind,
      marked: m.marked,
      expected,
      isCorrect: !!expected && !!m.marked && expected === m.marked,
      ambiguous: m.ambiguous,
    };
  });

  // Solo se puntúan los slots con alternativa correcta definida.
  const gradableAnswers = answers.filter((a) => a.expected !== null);
  const correct = gradableAnswers.filter((a) => a.isCorrect).length;
  const blank = gradableAnswers.filter((a) => a.marked === null).length;
  const incorrect = gradableAnswers.length - correct - blank;
  const gradable = gradableAnswers.length;
  const scorePercent = gradable ? Math.round((correct / gradable) * 1000) / 10 : 0;

  return {
    answers,
    correct,
    incorrect,
    blank,
    gradable,
    scorePercent,
    grade: computeGrade(correct, gradable, settings),
  };
}

// ------------------------------------------------------------------
// Persistencia
// ------------------------------------------------------------------

export interface SavedGrading {
  id: string;
  assessment_id: string | null;
  assessment_title: string | null;
  student_name: string | null;
  student_rut: string | null;
  course_label: string | null;
  total_slots: number;
  correct_count: number;
  incorrect_count: number;
  blank_count: number;
  score_percent: number;
  grade: number;
  passing_percent: number;
  max_grade: number;
  min_grade: number;
  scan_confidence: number | null;
  created_at: string;
}

export interface SaveGradingInput {
  assessmentId: string;
  assessmentTitle: string;
  studentName: string | null;
  studentRut: string | null;
  courseLabel: string | null;
  settings: GradingSettings;
  result: GradingResult;
  confidence: number | null;
}

export async function saveGrading(input: SaveGradingInput): Promise<SavedGrading> {
  const { data, error } = await supabase
    .from("assessment_gradings")
    .insert({
      assessment_id: input.assessmentId,
      assessment_title: input.assessmentTitle,
      student_name: input.studentName,
      student_rut: input.studentRut,
      course_label: input.courseLabel,
      total_slots: input.result.gradable,
      correct_count: input.result.correct,
      incorrect_count: input.result.incorrect,
      blank_count: input.result.blank,
      score_percent: input.result.scorePercent,
      grade: input.result.grade,
      passing_percent: input.settings.passingPercent,
      max_grade: input.settings.maxGrade,
      min_grade: input.settings.minGrade,
      scan_confidence: input.confidence,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const rows = input.result.answers.map((a) => ({
    grading_id: data.id as string,
    slot_num: a.num,
    marked: a.marked,
    expected: a.expected,
    is_correct: a.isCorrect,
    ambiguous: a.ambiguous,
  }));
  if (rows.length) {
    const { error: e2 } = await supabase.from("assessment_grading_answers").insert(rows);
    if (e2) throw new Error(e2.message);
  }

  return data as SavedGrading;
}

export async function listGradings(assessmentId?: string): Promise<SavedGrading[]> {
  let query = supabase
    .from("assessment_gradings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (assessmentId) query = query.eq("assessment_id", assessmentId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SavedGrading[];
}

export async function deleteGrading(id: string): Promise<void> {
  const { error } = await supabase.from("assessment_gradings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/** Estadísticas del curso para el panel de resultados. */
export function summarizeGradings(rows: SavedGrading[]) {
  if (!rows.length) return null;
  const grades = rows.map((r) => Number(r.grade));
  const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
  const approved = grades.filter((g) => g >= PASS_GRADE).length;
  return {
    count: rows.length,
    average: Math.round(avg * 10) / 10,
    approved,
    failed: rows.length - approved,
    approvalRate: Math.round((approved / rows.length) * 100),
    best: Math.max(...grades),
    worst: Math.min(...grades),
  };
}
