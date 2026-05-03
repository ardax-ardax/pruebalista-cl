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
  content_hash: string;
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
 * Genera un hash determinista del contenido de una pregunta.
 * Usa solo los campos que definen la identidad (tipo, enunciado, opciones/statements),
 * ignorando el ID, metadatos y campos que pueden cambiar.
 */
async function computeHash(q: Question): Promise<string> {
  const identity: Record<string, unknown> = { type: q.type, prompt: q.prompt };
  if (q.options) identity.options = q.options.map((o) => ({ text: o.text, correct: o.correct }));
  if (q.statements) identity.statements = q.statements.map((s) => ({ text: s.text, answer: s.answer }));
  const raw = JSON.stringify(identity);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Guarda todas las preguntas evaluables de una prueba en el banco.
 * Se ejecuta en background tras guardar; errores no bloquean al usuario.
 * Usa content_hash para evitar duplicados: si la pregunta ya existe, se ignora.
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

  const rows = await Promise.all(evaluable.map(async (q) => ({
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
    content_hash: await computeHash(q),
  })));

  // onConflict ignora duplicados silenciosamente
  const { error } = await supabase.from("question_bank").upsert(rows, {
    onConflict: "user_id,content_hash",
    ignoreDuplicates: true,
  });
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

/**
 * Soft-delete: oculta la pregunta para el docente sin eliminarla del banco general.
 */
export async function hideFromBank(id: string, userId: string): Promise<boolean> {
  // Use raw SQL via rpc or update the array
  const { data, error: fetchErr } = await supabase
    .from("question_bank")
    .select("hidden_by_users")
    .eq("id", id)
    .single();
  if (fetchErr || !data) {
    console.error("hideFromBank fetch", fetchErr);
    return false;
  }
  const current = (data as Record<string, unknown>).hidden_by_users as string[] ?? [];
  if (current.includes(userId)) return true;
  const { error } = await supabase
    .from("question_bank")
    .update({ hidden_by_users: [...current, userId] })
    .eq("id", id);
  if (error) {
    console.error("hideFromBank", error);
    return false;
  }
  return true;
}
