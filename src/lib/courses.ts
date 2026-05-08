// Capa de acceso a cursos y estudiantes. Solo lecturas para todos los
// autenticados; las mutaciones requieren rol staff (admin / utp_head)
// según las RLS del backend.

import { supabase } from "@/integrations/supabase/client";

export interface Course {
  id: string;
  name: string;
  level: string;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  rut: string;
  first_name: string;
  last_name: string;
  course_id: string;
  created_at: string;
  updated_at: string;
}

export async function listCourses(): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data ?? []) as Course[];
}

// Nota: la creación/edición/eliminación manual de cursos quedó deprecada.
// Toda gestión de cursos se hace ahora vía `admin_courses` y el asistente
// de UtpCoursesManager. La tabla `courses` solo se conserva como destino
// del roster de estudiantes (usado por la hoja OMR).

export async function listStudentsByCourse(courseId: string): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("course_id", courseId)
    .order("last_name");
  if (error) throw error;
  return (data ?? []) as Student[];
}

export async function listAllStudents(): Promise<Student[]> {
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("last_name");
  if (error) throw error;
  return (data ?? []) as Student[];
}

export interface NewStudent {
  rut: string; // ya limpio
  first_name: string;
  last_name: string;
  course_id: string;
}

export interface BulkInsertResult {
  inserted: number;
  duplicates: number;
  failed: { row: NewStudent; error: string }[];
}

/** Inserta estudiantes ignorando duplicados (RUT único global). */
export async function bulkInsertStudents(rows: NewStudent[]): Promise<BulkInsertResult> {
  if (rows.length === 0) return { inserted: 0, duplicates: 0, failed: [] };

  // Detecta duplicados existentes para reportarlos limpiamente.
  const ruts = rows.map((r) => r.rut);
  const { data: existing, error: existingError } = await supabase
    .from("students")
    .select("rut")
    .in("rut", ruts);
  if (existingError) throw existingError;
  const existingSet = new Set((existing ?? []).map((r) => r.rut));

  const toInsert = rows.filter((r) => !existingSet.has(r.rut));
  const duplicates = rows.length - toInsert.length;

  if (toInsert.length === 0) {
    return { inserted: 0, duplicates, failed: [] };
  }

  const { data, error } = await supabase
    .from("students")
    .insert(toInsert)
    .select("id");

  if (error) {
    return { inserted: 0, duplicates, failed: toInsert.map((r) => ({ row: r, error: error.message })) };
  }

  return { inserted: (data ?? []).length, duplicates, failed: [] };
}

export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabase.from("students").delete().eq("id", id);
  if (error) throw error;
}
