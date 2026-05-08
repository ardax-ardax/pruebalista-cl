import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, GraduationCap, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

interface AdminCourse {
  id: string;
  grade_value: string;
  label: string;
  level: string;
  sort_order: number;
}

interface CourseSubject {
  id: string;
  course_id: string;
  subject_value: string;
  subject_label: string;
}

interface AdminSubjectRow {
  id: string;
  subject_value: string;
  subject_label: string;
  levels: string[];
  sort_order: number;
}

const LEVELS = ["Básica", "Media", "ElectivoMedia"] as const;

// Helper: jerarquía Nivel → Grado → Letra para crear cursos rápidamente.
const GRADES_BY_LEVEL: Record<string, { value: string; label: string }[]> = {
  "Básica": [
    { value: "1º", label: "1º Básico" },
    { value: "2º", label: "2º Básico" },
    { value: "3º", label: "3º Básico" },
    { value: "4º", label: "4º Básico" },
    { value: "5º", label: "5º Básico" },
    { value: "6º", label: "6º Básico" },
    { value: "7º", label: "7º Básico" },
    { value: "8º", label: "8º Básico" },
  ],
  "Media": [
    { value: "I", label: "I Medio" },
    { value: "II", label: "II Medio" },
    { value: "III", label: "III Medio" },
    { value: "IV", label: "IV Medio" },
  ],
  "ElectivoMedia": [
    { value: "III", label: "III Medio (Electivo)" },
    { value: "IV", label: "IV Medio (Electivo)" },
  ],
};
const SECTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

function buildCourseLabels(level: string, gradeKey: string, letter: string) {
  const grade = GRADES_BY_LEVEL[level]?.find((g) => g.value === gradeKey);
  if (!grade) return { label: "", slug: "" };
  const label = `${grade.label}${letter ? ` ${letter}` : ""}`;
  // slug coherente con DEFAULT_GRADES (ej: "IMedioA", "1ºBásico")
  const baseSlug = level === "Básica"
    ? `${grade.value}Básico`
    : `${grade.value}Medio`;
  const slug = `${baseSlug}${letter}`;
  return { label, slug };
}

export default function AdminCoursesManager() {
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [subjects, setSubjects] = useState<CourseSubject[]>([]);
  const [allSubjects, setAllSubjects] = useState<AdminSubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AdminCourse> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingSubjects, setSavingSubjects] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [cRes, sRes, asRes] = await Promise.all([
      supabase.from("admin_courses").select("*").order("sort_order"),
      supabase.from("admin_course_subjects").select("*"),
      supabase.from("admin_subjects").select("*").order("sort_order"),
    ]);
    setCourses((cRes.data ?? []) as AdminCourse[]);
    setSubjects((sRes.data ?? []) as CourseSubject[]);
    setAllSubjects((asRes.data ?? []) as AdminSubjectRow[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const openNew = () => {
    const maxSort = courses.reduce((m, c) => Math.max(m, c.sort_order), -1);
    setWizardLevel("Básica");
    setWizardGrade("");
    setWizardLetter("A");
    setEditing({ grade_value: "", label: "", level: "Básica", sort_order: maxSort + 1 });
    setIsNew(true);
  };

  const openEdit = (c: AdminCourse) => {
    setEditing({ ...c });
    setIsNew(false);
  };

  const [wizardLevel, setWizardLevel] = useState<string>("Básica");
  const [wizardGrade, setWizardGrade] = useState<string>("");
  const [wizardLetter, setWizardLetter] = useState<string>("A");

  // Auto-rellena label + slug en modo Nuevo cuando cambia el wizard
  useEffect(() => {
    if (!isNew || !editing) return;
    if (!wizardGrade) return;
    const { label, slug } = buildCourseLabels(wizardLevel, wizardGrade, wizardLetter);
    setEditing((prev) => prev ? { ...prev, label, grade_value: slug, level: wizardLevel } : prev);
  }, [wizardLevel, wizardGrade, wizardLetter, isNew]);

  const handleSave = async () => {
    if (!editing?.grade_value?.trim() || !editing?.label?.trim()) {
      toast.error("Valor y nombre son obligatorios");
      return;
    }
    setSaving(true);
    const row = {
      grade_value: editing.grade_value!.trim(),
      label: editing.label!.trim(),
      level: editing.level || "Básica",
      sort_order: editing.sort_order ?? 0,
    };

    const { error } = isNew
      ? await supabase.from("admin_courses").insert(row)
      : await supabase.from("admin_courses").update(row).eq("id", editing.id!);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Curso creado" : "Curso actualizado");
    setEditing(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("admin_courses").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Curso eliminado");
    setDeleteId(null);
    refresh();
  };

  const subjectsForCourse = (courseId: string) =>
    subjects.filter((s) => s.course_id === courseId);

  const toggleSubject = async (course: AdminCourse, subjectValue: string, subjectLabel: string, checked: boolean) => {
    setSavingSubjects(true);
    if (checked) {
      const { error } = await supabase.from("admin_course_subjects").insert({
        course_id: course.id,
        subject_value: subjectValue,
        subject_label: subjectLabel,
      });
      if (error && !error.message.includes("duplicate")) toast.error(error.message);
    } else {
      await supabase
        .from("admin_course_subjects")
        .delete()
        .eq("course_id", course.id)
        .eq("subject_value", subjectValue);
    }
    // Refresh subjects
    const { data } = await supabase.from("admin_course_subjects").select("*");
    setSubjects((data ?? []) as CourseSubject[]);
    setSavingSubjects(false);
  };

  const filteredSubjectsForLevel = (level: string) => {
    return allSubjects.filter((s) => {
      if (!s.levels || s.levels.length === 0) return true;
      if (s.levels.includes(level)) return true;
      if (level === "Media" && s.levels.includes("ElectivoMedia")) return true;
      return false;
    });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Cursos y Asignaturas
            </CardTitle>
            <CardDescription>
              Define los cursos del sistema y las asignaturas que se imparten en cada uno.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> Nuevo curso
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : courses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay cursos definidos.</p>
          ) : (
            <div className="space-y-1">
              {courses.map((c) => {
                const cs = subjectsForCourse(c.id);
                const isOpen = expandedId === c.id;
                return (
                  <Collapsible key={c.id} open={isOpen} onOpenChange={() => setExpandedId(isOpen ? null : c.id)}>
                    <div className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-muted/50">
                      <CollapsibleTrigger asChild>
                        <button className="p-0.5">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                      </CollapsibleTrigger>
                      <span className="font-medium text-sm flex-1">{c.label}</span>
                      <Badge variant="outline" className="text-[10px]">{c.level}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{cs.length} asig.</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <CollapsibleContent className="pl-8 pr-3 py-2">
                      <p className="text-xs text-muted-foreground mb-2">Asignaturas para este curso:</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                        {filteredSubjectsForLevel(c.level).map((s) => {
                          const isChecked = cs.some((x) => x.subject_value === s.subject_value);
                          return (
                            <div key={s.subject_value} className="flex items-center gap-2">
                              <Checkbox
                                id={`${c.id}-${s.subject_value}`}
                                checked={isChecked}
                                disabled={savingSubjects}
                                onCheckedChange={(v) => toggleSubject(c, s.subject_value, s.subject_label, !!v)}
                              />
                              <label htmlFor={`${c.id}-${s.subject_value}`} className="text-xs cursor-pointer">{s.subject_label}</label>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuevo Curso" : `Editar: ${editing?.label}`}</DialogTitle>
            <DialogDescription>Define el curso que aparecerá en los selectores.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              {isNew && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <p className="text-xs font-medium">Asistente jerárquico</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px]">Nivel</Label>
                      <Select value={wizardLevel} onValueChange={(v) => { setWizardLevel(v); setWizardGrade(""); }}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Grado</Label>
                      <Select value={wizardGrade} onValueChange={setWizardGrade}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          {(GRADES_BY_LEVEL[wizardLevel] ?? []).map((g) => (
                            <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px]">Letra</Label>
                      <Select value={wizardLetter} onValueChange={setWizardLetter}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SECTION_LETTERS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Auto-genera <strong>{editing.label || "—"}</strong> ({editing.grade_value || "slug"}). Editable abajo.
                  </p>
                </div>
              )}
              <div className="space-y-1">
                <Label>Nombre visible</Label>
                <Input
                  value={editing.label ?? ""}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="Ej: 1° Básico"
                />
              </div>
              <div className="space-y-1">
                <Label>Valor interno (slug)</Label>
                <Input
                  value={editing.grade_value ?? ""}
                  onChange={(e) => setEditing({ ...editing, grade_value: e.target.value })}
                  placeholder="Ej: 1ºBásico"
                  disabled={!isNew}
                />
                <p className="text-[10px] text-muted-foreground">Identificador único, no puede cambiarse después.</p>
              </div>
              <div className="space-y-1">
                <Label>Nivel</Label>
                <Select value={editing.level ?? "Básica"} onValueChange={(v) => setEditing({ ...editing, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={editing.sort_order ?? 0}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isNew ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar curso?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también las asignaturas asociadas y las restricciones de plan. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
