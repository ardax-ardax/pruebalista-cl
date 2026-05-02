import { supabase } from "@/integrations/supabase/client";
import type { Question, AssessmentMeta } from "./assessment-schema";

export interface QuestionBankRow {
  id: string;
  user_id: string;
  question_data: Question;
  question_type: string;
  subject_value: string | null;
  grade_value: string | null;
  oa_code: string | null;
  difficulty: string | null;
  source: string;
  title: string | null;
  prompt_preview: string | null;
  created_at: string;
}

export interface BankFilters {
  question_type?: string;
  subject_value?: string;
  grade_value?: string;
  oa_code?: string;
  difficulty?: string;
  source?: string;
  search?: string;
}

/**
 * Guarda todas las preguntas evaluables de una prueba en el banco.
 * Se ejecuta en background tras guardar; errores no bloquean al usuario.
 */
export async function saveQuestionsToBank(
  questions: Question[],
  meta: AssessmentMeta,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const evaluable = questions.filter(
    (q) => q.type !== "info-block" && q.type !== "section-title",
  );
  if (evaluable.length === 0) return;

  const rows = evaluable.map((q) => ({
    user_id: user.id,
    question_data: JSON.parse(JSON.stringify(q)),
    question_type: q.type,
    subject_value: meta.subjectValue || null,
    grade_value: meta.gradeValue || null,
    oa_code: q.sourceOA || null,
    difficulty: q.difficulty || null,
    source: q.sourceOA ? "ai" : "manual",
    title: q.title || null,
    prompt_preview: (q.prompt || "").slice(0, 120) || null,
  }));

  const { error } = await supabase.from("question_bank").insert(rows);
  if (error) console.warn("saveQuestionsToBank", error.message);
}

export async function searchBank(filters: BankFilters = {}): Promise<QuestionBankRow[]> {
  let query = supabase
    .from("question_bank")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (filters.question_type) query = query.eq("question_type", filters.question_type);
  if (filters.subject_value) query = query.eq("subject_value", filters.subject_value);
  if (filters.grade_value) query = query.eq("grade_value", filters.grade_value);
  if (filters.oa_code) query = query.eq("oa_code", filters.oa_code);
  if (filters.difficulty) query = query.eq("difficulty", filters.difficulty);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.search) query = query.ilike("prompt_preview", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) {
    console.error("searchBank", error);
    return [];
  }
  return (data ?? []) as unknown as QuestionBankRow[];
}

export async function deleteFromBank(id: string): Promise<boolean> {
  const { error } = await supabase.from("question_bank").delete().eq("id", id);
  if (error) {
    console.error("deleteFromBank", error);
    return false;
  }
  return true;
}
