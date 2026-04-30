import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssessmentMeta } from "@/lib/assessment-schema";
import type { FormatTemplate } from "@/lib/templates";
import type { GradeOption, SubjectOption, TeacherOption } from "@/lib/catalog";
import { getOAs, hasCurriculum } from "@/lib/curriculum-data";
import { Info } from "lucide-react";

interface Props {
  meta: AssessmentMeta;
  onChange: (meta: AssessmentMeta) => void;
  templates: FormatTemplate[];
  subjects: SubjectOption[];
  grades: GradeOption[];
  teachers: TeacherOption[];
}

export const AssessmentMetaForm = ({ meta, onChange, templates, subjects, grades, teachers }: Props) => {
  const set = <K extends keyof AssessmentMeta>(k: K, v: AssessmentMeta[K]) => onChange({ ...meta, [k]: v });

  // Cuando cambia curso o asignatura limpiamos los OAs vinculados (evita códigos huérfanos).
  const setGrade = (v: string) => onChange({ ...meta, gradeValue: v, linkedOA: [] });
  const setSubject = (v: string) => onChange({ ...meta, subjectValue: v, linkedOA: [] });

  const availableOAs = getOAs(meta.gradeValue, meta.subjectValue);
  const isFallback = !!meta.gradeValue && !!meta.subjectValue && !hasCurriculum(meta.gradeValue, meta.subjectValue);
  const linked = meta.linkedOA ?? [];

  const toggleOA = (code: string, checked: boolean) => {
    const next = checked ? [...linked, code] : linked.filter((c) => c !== code);
    set("linkedOA", next);
  };

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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Asignatura</Label>
            <Select value={meta.subjectValue} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Curso</Label>
            <Select value={meta.gradeValue} onValueChange={setGrade}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {grades.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
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
