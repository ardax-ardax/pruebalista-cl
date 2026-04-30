import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_LAYOUT, LAYOUT_LIMITS, type AssessmentLayout, type AssessmentMeta } from "@/lib/assessment-schema";
import type { FormatTemplate } from "@/lib/templates";
import { getSubjectsForGrade, type GradeOption, type SubjectOption, type TeacherOption } from "@/lib/catalog";
import { getOAs, hasCurriculum } from "@/lib/curriculum-data";
import { loadOverridesFromCloud } from "@/lib/curriculum-overrides";
import type { TeacherAssignment } from "@/lib/teacher-assignments";
import { ChevronDown, Info, Lock, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface Props {
  meta: AssessmentMeta;
  onChange: (meta: AssessmentMeta) => void;
  templates: FormatTemplate[];
  subjects: SubjectOption[];
  grades: GradeOption[];
  teachers: TeacherOption[];
  /**
   * Si viene definido (rol "user") y el modo auto-asignación está OFF,
   * restringe Curso y Asignatura a las parejas asignadas a ese docente.
   * Si es null/undefined (admin/UTP) o auto-asignación está ON, catálogo completo.
   */
  restrictedAssignments?: TeacherAssignment[] | null;
  /** True para admin/utp_head: pueden cambiar libremente el docente. */
  canChooseTeacher?: boolean;
  /** Etiqueta para mostrar como docente bloqueado cuando no es staff. */
  lockedTeacherLabel?: string;
  /** Si es true, ignora restrictedAssignments (modo auto-asignación). */
  allowSelfAssignment?: boolean;
  /** True para admin/utp_head: pueden editar la sección de optimización de papel. */
  canEditLayout?: boolean;
}

export const AssessmentMetaForm = ({
  meta, onChange, templates, subjects, grades, teachers, restrictedAssignments,
  canChooseTeacher = true, lockedTeacherLabel, allowSelfAssignment = false,
  canEditLayout = false,
}: Props) => {
  const set = <K extends keyof AssessmentMeta>(k: K, v: AssessmentMeta[K]) => onChange({ ...meta, [k]: v });
  const layout: AssessmentLayout = meta.layout ?? DEFAULT_LAYOUT;
  const setLayout = (patch: Partial<AssessmentLayout>) =>
    onChange({ ...meta, layout: { ...layout, ...patch } });

  // Hidrata la cache de currículo desde Supabase para que getOAs devuelva
  // los OAs reales (base + overrides) almacenados en la BD.
  const [cloudReady, setCloudReady] = useState(false);
  useEffect(() => {
    let active = true;
    loadOverridesFromCloud().finally(() => { if (active) setCloudReady(true); });
    return () => { active = false; };
  }, []);

  // Si auto-asignación está ON, ignoramos la restricción del docente.
  const isRestricted = !!restrictedAssignments && !allowSelfAssignment;

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

  // Recalcula cuando la nube termina de hidratar.
  const availableOAs = useMemo(
    () => getOAs(meta.gradeValue, meta.subjectValue),
    [meta.gradeValue, meta.subjectValue, cloudReady],
  );
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
              Contacta al administrador para que se te asignen cursos. Mientras tanto no podrás
              crear pruebas porque no tienes cursos ni asignaturas asociadas.
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
            <Label className="text-xs flex items-center gap-1">
              Docente
              {!canChooseTeacher && <Lock className="h-3 w-3 text-muted-foreground" />}
            </Label>
            {canChooseTeacher ? (
              <Select value={meta.teacherValue} onValueChange={(v) => set("teacherValue", v)}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={lockedTeacherLabel ?? teachers.find((t) => t.value === meta.teacherValue)?.label ?? ""}
                readOnly
                disabled
                title="Solo administradores y Jefe UTP pueden cambiar el docente."
              />
            )}
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
              <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                <div className="text-xs">
                  <div className="font-medium">¿Mostrar Objetivos (OA) en el encabezado de la prueba?</div>
                  <div className="text-muted-foreground">Si está activo, los códigos de los OA seleccionados aparecerán bajo el título / instrucciones del documento.</div>
                </div>
                <Switch
                  checked={!!meta.showOaInHeader}
                  onCheckedChange={(v) => set("showOaInHeader", v)}
                  disabled={linked.length === 0}
                />
              </label>
            </>
          )}
        </div>

        {/* === Optimización de Diseño y Papel === */}
        <LayoutOptimizationSection
          layout={layout}
          canEdit={canEditLayout}
          onChange={setLayout}
          onReset={() => onChange({ ...meta, layout: { ...DEFAULT_LAYOUT } })}
        />
      </CardContent>
    </Card>
  );
};

interface LayoutSectionProps {
  layout: AssessmentLayout;
  canEdit: boolean;
  onChange: (patch: Partial<AssessmentLayout>) => void;
  onReset: () => void;
}

const LayoutOptimizationSection = ({ layout, canEdit, onChange, onReset }: LayoutSectionProps) => {
  const [open, setOpen] = useState(false);
  const { marginMinMm, marginMaxMm, spacingMinPt, spacingMaxPt } = LAYOUT_LIMITS;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md border border-border">
      <CollapsibleTrigger className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/40">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Optimización de Diseño y Papel</span>
          {!canEdit && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Solo lectura" />}
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 border-t border-border px-3 py-4">
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Solo Administradores y Jefe UTP pueden modificar estos valores. Estás viendo la
            configuración actual en modo solo lectura.
          </p>
        )}

        <LayoutSlider
          label="Margen superior"
          value={layout.marginTop}
          min={marginMinMm}
          max={marginMaxMm}
          step={1}
          unit="mm"
          disabled={!canEdit}
          onChange={(v) => onChange({ marginTop: v })}
        />
        <LayoutSlider
          label="Margen inferior"
          value={layout.marginBottom}
          min={marginMinMm}
          max={marginMaxMm}
          step={1}
          unit="mm"
          disabled={!canEdit}
          onChange={(v) => onChange({ marginBottom: v })}
        />
        <LayoutSlider
          label="Márgenes laterales (izq./der.)"
          value={layout.marginSide}
          min={marginMinMm}
          max={marginMaxMm}
          step={1}
          unit="mm"
          disabled={!canEdit}
          onChange={(v) => onChange({ marginSide: v })}
        />
        <LayoutSlider
          label="Espacio entre preguntas"
          value={layout.questionSpacing}
          min={spacingMinPt}
          max={spacingMaxPt}
          step={1}
          unit="pt"
          disabled={!canEdit}
          onChange={(v) => onChange({ questionSpacing: v })}
        />

        <label className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <div className="text-xs">
            <div className="font-medium">Alternativas en 2 columnas</div>
            <div className="text-muted-foreground">
              Distribuye A/B/C/D en dos columnas para reducir el alto de cada pregunta y ahorrar papel.
            </div>
          </div>
          <Switch
            checked={layout.optionsColumns === 2}
            onCheckedChange={(v) => onChange({ optionsColumns: v ? 2 : 1 })}
            disabled={!canEdit}
          />
        </label>

        {canEdit && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              Restablecer valores por defecto
            </button>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
};

interface LayoutSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}

const LayoutSlider = ({ label, value, min, max, step, unit, disabled, onChange }: LayoutSliderProps) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs font-mono text-muted-foreground">
        {value} {unit}
      </span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(vals) => onChange(vals[0] ?? value)}
    />
  </div>
);
