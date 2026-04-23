import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AssessmentMeta } from "@/lib/assessment-schema";
import type { FormatTemplate } from "@/lib/templates";
import type { GradeOption, SubjectOption, TeacherOption } from "@/lib/catalog";

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
            <Select value={meta.subjectValue} onValueChange={(v) => set("subjectValue", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Curso</Label>
            <Select value={meta.gradeValue} onValueChange={(v) => set("gradeValue", v)}>
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
      </CardContent>
    </Card>
  );
};
