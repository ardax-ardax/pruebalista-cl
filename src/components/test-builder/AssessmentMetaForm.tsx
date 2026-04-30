import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssessmentMeta } from "@/lib/assessment-schema";
import type { FormatTemplate } from "@/lib/templates";
import { getSubjectsForGrade, type GradeOption, type SubjectOption, type TeacherOption } from "@/lib/catalog";
import { getOAs, hasCurriculum } from "@/lib/curriculum-data";
import type { TeacherAssignment } from "@/lib/teacher-assignments";
import { Info, Lock } from "lucide-react";
import { useMemo } from "react";

interface Props {
  meta: AssessmentMeta;
  onChange: (meta: AssessmentMeta) => void;
  templates: FormatTemplate[];
  subjects: SubjectOption[];
  grades: GradeOption[];
  teachers: TeacherOption[];
  /**
   * Si viene definido (rol "user"), restringe Curso y Asignatura a las parejas
   * asignadas a ese docente. Si es null/undefined (admin/UTP), catálogo completo.
   */
  restrictedAssignments?: TeacherAssignment[] | null;
}

export const AssessmentMetaForm = ({
  meta, onChange, templates, subjects, grades, teachers, restrictedAssignments,
}: Props) => {
  const set = <K extends keyof AssessmentMeta>(k: K, v: AssessmentMeta[K]) => onChange({ ...meta, [k]: v });

  const isRestricted = !!restrictedAssignments;

  // Cursos visibles: si restringido, solo aquellos con al menos una asignación.
  const availableGrades = useMemo(() => {
    if (!isRestricted) return grades;
    const allowed = new Set(restrictedAssignments!.map((a) => a.grade_value));
    return grades.filter((g) => allowed.has(g.value));
  }, [grades, isRestricted, restrictedAssignments]);

  // Asignaturas: filtradas por nivel del curso, y además, si restringido,
  // solo las parejas (curso, asignatura) que el docente tiene asignadas.
  const availableSubjects = useMemo(() => {
    if (!meta.gradeValue) return [];
    const byLevel = getSubjectsForGrade(meta.gradeValue, subjects, grades);
    if (!isRestricted) return byLevel;
    const allowedForGrade = new Set(
      restrictedAssignments!
        .filter((a) => a.grade_value === meta.gradeValue)
        .map((a) => a.subject_value),
    );
    return byLevel.filter((s) => allowedForGrade.has(s.value));
  }, [meta.gradeValue, subjects, grades, isRestricted, restrictedAssignments]);

  const setGrade = (v: string) => {
    const subjectsForNew = isRestricted
      ? getSubjectsForGrade(v, subjects, grades).filter((s) =>
          restrictedAssignments!.some((a) => a.grade_value === v && a.subject_value === s.value))
      : getSubjectsForGrade(v, subjects, grades);
    const stillValid = subjectsForNew.some((s) => s.value === meta.subjectValue);
    onChange({
      ...meta,
      gradeValue: v,
      subjectValue: stillValid ? meta.subjectValue : "",
      linkedOA: [],
    });
  };
  const setSubject = (v: string) => onChange({ ...meta, subjectValue: v, linkedOA: [] });

  const availableOAs = getOAs(meta.gradeValue, meta.subjectValue);
  const isFallback = !!meta.gradeValue && !!meta.subjectValue && !hasCurriculum(meta.gradeValue, meta.subjectValue);
  const linked = meta.linkedOA ?? [];

  const toggleOA = (code: string, checked: boolean) => {
    const next = checked ? [...linked, code] : linked.filter((c) => c !== code);
    set("linkedOA", next);
  };

  const noAssignments = isRestricted && availableGrades.length === 0;

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Datos generales</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Plantilla institucional</Label>
            <Select value={meta.templateId} onValueChange={(v) => set("templateId", v)}>
              <SelectTrigger><SelectValue placeholder="Plantilla" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">N°</Label>
            <Input value={meta.number} onChange={(e) => set("number", e.target.value)} placeholder="1" />
          </div>
        </div>

        {noAssignments && (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Aún no tienes cursos ni asignaturas asignadas. Pide al equipo de UTP o Administración
              que registre tus asignaciones en <strong>Configuración → Asignaciones de docentes</strong>.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Curso</Label>
            <Select value={meta.gradeValue} onValueChange={setGrade} disabled={noAssignments}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {availableGrades.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Asignatura</Label>
            <Select
              value={meta.subjectValue}
              onValueChange={setSubject}
              disabled={!meta.gradeValue || availableSubjects.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={meta.gradeValue ? "Selecciona" : "Primero selecciona el curso"} />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Docente</Label>
            <Select value={meta.teacherValue} onValueChange={(v) => set("teacherValue", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {teachers.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="text-xs">Título de la evaluación</Label>
          <Input value={meta.title} onChange={(e) => set("title", e.target.value)} placeholder="Evaluación Sumativa N°1 — Reino Animal" />
        </div>
        <div>
          <Label className="text-xs">Instrucciones</Label>
          <Textarea
            value={meta.instructions}
            onChange={(e) => set("instructions", e.target.value)}
            placeholder="Lee atentamente cada pregunta. Marca solo una alternativa…"
            rows={3}
          />
        </div>

        {/* === Objetivos de Aprendizaje (Bases Curriculares Mineduc) === */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Objetivos de Aprendizaje (OA)</Label>
            <span className="text-xs text-muted-foreground">{linked.length} seleccionado{linked.length === 1 ? "" : "s"}</span>
          </div>
          {!meta.gradeValue || !meta.subjectValue ? (
            <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-3">
              Selecciona curso y asignatura para ver los OA disponibles.
            </p>
          ) : (
            <>
              {isFallback && (
                <div className="flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Aún no cargamos los OA oficiales para esta combinación. Mientras tanto, puedes vincular Habilidades Transversales.
                  </span>
                </div>
              )}
              <div className="space-y-1.5 rounded-md border border-border p-3 max-h-64 overflow-y-auto">
                {availableOAs.map((oa) => {
                  const checked = linked.includes(oa.code);
                  return (
                    <label key={oa.code} className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 rounded p-1">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => toggleOA(oa.code, !!v)}
                        className="mt-0.5"
                      />
                      <div className="text-xs leading-snug">
                        <span className="font-semibold">{oa.code}</span>
                        {oa.eje ? <span className="ml-1 text-muted-foreground">· {oa.eje}</span> : null}
                        <div className="text-muted-foreground">{oa.description}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
