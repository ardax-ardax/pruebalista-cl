// Asignaciones Docente ↔ Curso ↔ Asignatura.
// Persiste en Supabase (RLS: docente lee las suyas, staff CRUD todas).

import { supabase } from "@/integrations/supabase/client";

export interface TeacherAssignment {
  id: string;
  teacher_user_id: string;
  grade_value: string;
  subject_value: string;
  created_at: string;
}

export const listAllAssignments = async (): Promise<TeacherAssignment[]> => {
  const { data, error } = await supabase
    .from("teacher_assignments")
    .select("*")
    .order("teacher_user_id");
  if (error) {
    console.error("listAllAssignments", error);
    return [];
  }
  return (data ?? []) as TeacherAssignment[];
};

export const listAssignmentsForTeacher = async (
  teacherUserId: string,
): Promise<TeacherAssignment[]> => {
  const { data, error } = await supabase
    .from("teacher_assignments")
    .select("*")
    .eq("teacher_user_id", teacherUserId);
  if (error) {
    console.error("listAssignmentsForTeacher", error);
    return [];
  }
  return (data ?? []) as TeacherAssignment[];
};

export const addAssignment = async (
  teacherUserId: string,
  gradeValue: string,
  subjectValue: string,
): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase
    .from("teacher_assignments")
    .insert({
      teacher_user_id: teacherUserId,
      grade_value: gradeValue,
      subject_value: subjectValue,
    });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};

export const removeAssignment = async (id: string): Promise<{ ok: boolean; error?: string }> => {
  const { error } = await supabase.from("teacher_assignments").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
};
