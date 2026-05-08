import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { AssessmentMeta, PaesVariant, OaPosition } from "@/lib/assessment-schema";
import { PAES_VARIANTS } from "@/lib/assessment-schema";
import {
  getAxesFor,
  requiresCienciasModule,
  PAES_CIENCIAS_MODULES,
  type PaesCienciasModule,
} from "@/lib/paes-axes";
import type { FormatTemplate } from "@/lib/templates";
import { getSubjectsForGrade, type GradeOption, type SubjectOption, type TeacherOption } from "@/lib/catalog";
import { getOAs, hasCurriculum } from "@/lib/curriculum-data";
import { loadOverridesFromCloud } from "@/lib/curriculum-overrides";
import type { TeacherAssignment } from "@/lib/teacher-assignments";
import { AlertTriangle, Info, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// Tipo de formato de evaluación
export type EvaluationFormat = "estandar" | "simce" | "paes";

// Restricciones de grado por modo ensayo.
const SIMCE_ALLOWED_GRADES = new Set(["4ºBásico", "6ºBásico", "8ºBásico", "IIMedio"]);
const PAES_ALLOWED_GRADES = new Set(["IIIMedio", "IVMedio"]);

// IDs de plantilla ensayo
const SIMCE_TEMPLATE_ID = "ensayo-simce";
const PAES_TEMPLATE_ID = "ensayo-paes";

interface Props {
  meta: AssessmentMeta;
  onChange: (meta: AssessmentMeta) => void;
  templates: FormatTemplate[];
  subjects: SubjectOption[];
  grades: GradeOption[];
  teachers: TeacherOption[];
  restrictedAssignments?: TeacherAssignment[] | null;
  canChooseTeacher?: boolean;
  lockedTeacherLabel?: string;
  allowSelfAssignment?: boolean;
  /** Cuando true, todos los campos son readonly excepto OA y cantidad de alternativas */
  readOnlyExceptOA?: boolean;
}

export const AssessmentMetaForm = ({
  meta, onChange, templates, subjects, grades, teachers, restrictedAssignments,
  canChooseTeacher = true, lockedTeacherLabel, allowSelfAssignment = false,
  readOnlyExceptOA = false,
}: Props) => {
  const set = <K extends keyof AssessmentMeta>(k: K, v: AssessmentMeta[K]) => onChange({ ...meta, [k]: v });

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

  // === Formato de evaluación derivado de la plantilla seleccionada ===
  const currentTemplate = useMemo(
    () => templates.find((t) => t.id === meta.templateId) ?? null,
    [templates, meta.templateId],
  );

  // Derive format from template
  const evaluationFormat: EvaluationFormat = currentTemplate?.essayMode === "simce"
    ? "simce"
    : currentTemplate?.essayMode === "paes"
      ? "paes"
      : "estandar";

  const isPaes = evaluationFormat === "paes";
  const isSimce = evaluationFormat === "simce";

  // Cambiar formato: auto-asignar plantilla + defaults
  const handleFormatChange = (fmt: EvaluationFormat) => {
    let newTemplateId = meta.templateId;
    let newMcOptions = meta.defaultMcOptions ?? 4;
    const updates: Partial<AssessmentMeta> = {};

    if (fmt === "simce") {
      const simceTpl = templates.find((t) => t.id === SIMCE_TEMPLATE_ID);
      if (simceTpl) newTemplateId = SIMCE_TEMPLATE_ID;
      newMcOptions = 4;
      // Clear PAES-specific fields
      updates.paesVariant = undefined;
      updates.paesCienciasModule = undefined;
      updates.paesAxis = "";
      // Check if current grade is valid for SIMCE
      if (meta.gradeValue && !SIMCE_ALLOWED_GRADES.has(meta.gradeValue)) {
        updates.gradeValue = "";
        updates.subjectValue = "";
        updates.linkedOA = [];
      }
    } else if (fmt === "paes") {
      const paesTpl = templates.find((t) => t.id === PAES_TEMPLATE_ID);
      if (paesTpl) newTemplateId = PAES_TEMPLATE_ID;
      newMcOptions = 5; // default for PAES, will adjust per variant
      updates.linkedOA = [];
      // Check if current grade is valid for PAES
      if (meta.gradeValue && !PAES_ALLOWED_GRADES.has(meta.gradeValue)) {
        // Auto-select first available PAES grade
        const firstPaes = isRestricted
          ? [...PAES_ALLOWED_GRADES].find((g) => restrictedAssignments!.some((a) => a.grade_value === g))
          : [...PAES_ALLOWED_GRADES][0];
        updates.gradeValue = firstPaes ?? "";
        updates.subjectValue = "";
      }
    } else {
      // Estándar: pick first non-essay template
      const stdTpl = templates.find((t) => !t.essayMode);
      if (stdTpl) newTemplateId = stdTpl.id;
      newMcOptions = 4;
      updates.paesVariant = undefined;
      updates.paesCienciasModule = undefined;
      updates.paesAxis = "";
    }

    onChange({
      ...meta,
      ...updates,
      templateId: newTemplateId,
      defaultMcOptions: newMcOptions,
    });
  };

  // Auto-adjust alternatives when PAES variant changes
  useEffect(() => {
    if (!isPaes) return;
    const newMc = meta.paesVariant === "m1" ? 4 : 5;
    if (meta.defaultMcOptions !== newMc) {
      onChange({ ...meta, defaultMcOptions: newMc });
    }
  }, [isPaes, meta.paesVariant]);

  // SIMCE grade incompatibility warning
  const simceGradeInvalid = isSimce && !!meta.gradeValue && !SIMCE_ALLOWED_GRADES.has(meta.gradeValue);

  // Cursos visibles: restricciones por essayMode + asignaciones de docente.
  const availableGrades = useMemo(() => {
    let base = grades;
    if (isPaes) base = grades.filter((g) => PAES_ALLOWED_GRADES.has(g.value));
    else if (isSimce) base = grades.filter((g) => SIMCE_ALLOWED_GRADES.has(g.value));
    if (isRestricted) {
      const allowed = new Set(restrictedAssignments!.map((a) => a.grade_value));
      base = base.filter((g) => allowed.has(g.value));
    }
    // Preserve current grade even if not in filtered list (e.g. editing a rejected assessment
    // or grades haven't loaded from DB yet)
    if (meta.gradeValue && !base.some((g) => g.value === meta.gradeValue)) {
      const existing = grades.find((g) => g.value === meta.gradeValue);
      if (existing) {
        base = [...base, existing];
      } else {
        // Grades not yet loaded from DB — add a temporary placeholder so Select shows the value
        base = [...base, { value: meta.gradeValue, label: meta.gradeValue, level: "Básica" as const }];
      }
    }
    return base;
  }, [grades, isRestricted, restrictedAssignments, isPaes, isSimce, meta.gradeValue]);

  // Asignaturas: filtradas por nivel del curso, y además, si restringido,
  // solo las parejas (curso, asignatura) que el docente tiene asignadas.
  const availableSubjects = useMemo(() => {
    if (!meta.gradeValue) return [];
    const byLevel = getSubjectsForGrade(meta.gradeValue, subjects, grades);
    let filtered = byLevel;
    if (isRestricted) {
      const allowedForGrade = new Set(
        restrictedAssignments!
          .filter((a) => a.grade_value === meta.gradeValue)
          .map((a) => a.subject_value),
      );
      filtered = byLevel.filter((s) => allowedForGrade.has(s.value));
    }
    // Preserve current subject even if not in filtered list (e.g. editing a rejected assessment
    // or subjects/grades haven't loaded from DB yet)
    if (meta.subjectValue && !filtered.some((s) => s.value === meta.subjectValue)) {
      const existing = byLevel.find((s) => s.value === meta.subjectValue) ?? subjects.find((s) => s.value === meta.subjectValue);
      if (existing) {
        filtered = [...filtered, existing];
      } else {
        // Subjects not yet resolved — add a temporary placeholder so Select shows the value
        filtered = [...filtered, { value: meta.subjectValue, label: meta.subjectValue }];
      }
    }
    return filtered;
  }, [meta.gradeValue, meta.subjectValue, subjects, grades, isRestricted, restrictedAssignments]);

  const setGrade = (v: string) => {
    const subjectsForNew = isRestricted
      ? getSubjectsForGrade(v, subjects, grades).filter((s) =>
          restrictedAssignments!.some((a) => a.grade_value === v && a.subject_value === s.value))
      : getSubjectsForGrade(v, subjects, grades);
    const stillValid = subjectsForNew.some((s) => s.value === meta.subjectValue);

    // Si el formato actual es incompatible con el grado del curso,
    // hacer fallback automático a "Estándar".
    let templateId = meta.templateId;
    if (v) {
      const tpl = templates.find((t) => t.id === templateId);
      const isSimceTpl = tpl?.essayMode === "simce";
      const isPaesTpl = tpl?.essayMode === "paes";
      const compatible =
        (!isSimceTpl && !isPaesTpl) ||
        (isSimceTpl && SIMCE_ALLOWED_GRADES.has(v)) ||
        (isPaesTpl && PAES_ALLOWED_GRADES.has(v));
      if (!compatible) {
        const stdTpl = templates.find((t) => !t.essayMode);
        if (stdTpl) templateId = stdTpl.id;
      }
    }

    onChange({
      ...meta,
      gradeValue: v,
      subjectValue: stillValid ? meta.subjectValue : "",
      linkedOA: [],
      templateId,
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

  // Question count suggestion
  const suggestedQuestions = isPaes
    ? (PAES_VARIANTS.find((v) => v.value === meta.paesVariant)?.questionGoal ?? 65)
    : isSimce ? 35 : null;

  // Only show non-essay templates in standard mode, or only the matching essay template
  const visibleTemplates = useMemo(() => {
    if (isPaes) return templates.filter((t) => t.id === PAES_TEMPLATE_ID);
    if (isSimce) return templates.filter((t) => t.id === SIMCE_TEMPLATE_ID);
    return templates.filter((t) => !t.essayMode);
  }, [templates, isPaes, isSimce]);

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Datos generales</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* === Selector de Formato === */}
        <div data-tour="formatos">
          <Label className="text-xs font-semibold">Formato de evaluación</Label>
          {(() => {
            // Gating por grade_value (no por nivel) porque I-II Medio y III-IV Medio
            // comparten level="Media" pero requieren formatos distintos.
            const g = meta.gradeValue ?? "";
            const isBasica = g.includes("Básico");
            const isMediaInicial = /^(I|II)Medio/.test(g) && !/^(III|IV)Medio/.test(g);
            const isMediaSuperior = /^(III|IV)Medio/.test(g);
            const noGrade = !g;
            const simceEnabled = noGrade || isBasica || isMediaInicial;
            const paesEnabled = noGrade || isMediaSuperior;
            const opts = [
              { value: "estandar" as const, label: "Evaluación Estándar", desc: "Formato libre", disabled: false, reason: "" },
              {
                value: "simce" as const,
                label: "SIMCE",
                desc: "Básica e I-II Medio",
                disabled: !simceEnabled,
                reason: "SIMCE solo está disponible en Básica e I-II Medio",
              },
              {
                value: "paes" as const,
                label: "PAES",
                desc: "III y IV Medio",
                disabled: !paesEnabled,
                reason: "PAES solo está disponible en III y IV Medio",
              },
            ];
            return (
              <div className="grid grid-cols-3 gap-2 mt-1">
                {opts.map((opt) => {
                  const isDisabled = readOnlyExceptOA || opt.disabled;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => !isDisabled && handleFormatChange(opt.value)}
                      disabled={isDisabled}
                      title={opt.disabled ? opt.reason : undefined}
                      className={`rounded-lg border-2 p-3 text-left transition-all ${
                        evaluationFormat === opt.value
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : "border-border hover:border-muted-foreground/30"
                      } ${isDisabled ? "opacity-40 cursor-not-allowed pointer-events-none" : ""}`}
                    >
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {/* === Campos generales (readonly al editar para docentes) === */}
        <div className={readOnlyExceptOA ? "pointer-events-none opacity-60" : ""}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Plantilla institucional</Label>
            <Select value={meta.templateId} onValueChange={(v) => set("templateId", v)}>
              <SelectTrigger><SelectValue placeholder="Plantilla" /></SelectTrigger>
              <SelectContent>
                {visibleTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">N°</Label>
            <Input value={meta.number} onChange={(e) => set("number", e.target.value)} placeholder="1" />
          </div>
          <div>
            <Label className="text-xs">Semestre</Label>
            <Select value={meta.semester ?? ""} onValueChange={(v) => set("semester", v || undefined)}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1° Semestre</SelectItem>
                <SelectItem value="2">2° Semestre</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {noAssignments && (
          <div className="flex items-start gap-2 rounded-md border border-dashed border-amber-400 bg-amber-50 p-3 text-xs text-amber-900">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Pide a tu UTP que te asigne cursos y asignaturas. Mientras tanto no podrás
              crear pruebas porque no tienes cursos ni asignaturas asociadas.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div data-tour="nivel-selector">
            <Label className="text-xs flex items-center gap-1">
              Curso
              {isPaes && <span className="text-[10px] text-muted-foreground">(III-IV Medio)</span>}
              {isSimce && <span className="text-[10px] text-muted-foreground">(SIMCE)</span>}
            </Label>
            <Select value={meta.gradeValue} onValueChange={setGrade} disabled={noAssignments}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {availableGrades.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Letra</Label>
            <Select value={meta.sectionLetter ?? "A"} onValueChange={(v) => set("sectionLetter", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["A", "B", "C", "D", "E", "F"].map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
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

        {/* SIMCE grade incompatibility warning */}
        {simceGradeInvalid && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Formato SIMCE no disponible para este nivel. Solo aplica a 4° Básico, 6° Básico, 8° Básico y II Medio.
            </AlertDescription>
          </Alert>
        )}

        <div>
          <Label className="text-xs">Título de la evaluación <span className="text-destructive">*</span></Label>
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
        </div>{/* fin readOnlyExceptOA wrapper */}

        {/* === Cantidad de alternativas por tipo de pregunta (solo IA) === */}
        <div className="space-y-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Alternativas (Selección múltiple)</Label>
              <Select
                value={String(meta.defaultMcOptions ?? 4)}
                onValueChange={(v) => set("defaultMcOptions", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 alternativas</SelectItem>
                  <SelectItem value="4">4 alternativas</SelectItem>
                  <SelectItem value="5">5 alternativas</SelectItem>
                </SelectContent>
              </Select>
              {(isPaes || isSimce) && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {isSimce ? "SIMCE: 4 alternativas (predeterminado)" : 
                   meta.paesVariant === "m1" ? "PAES Matemática M1: 4 alternativas" : "PAES: 5 alternativas (predeterminado)"}
                </p>
              )}
            </div>
            <div>
              <Label className="text-xs">Afirmaciones (Verdadero / Falso)</Label>
              <Select
                value={String(meta.defaultTfStatements ?? 3)}
                onValueChange={(v) => set("defaultTfStatements", Number(v))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 afirmaciones</SelectItem>
                  <SelectItem value="4">4 afirmaciones</SelectItem>
                  <SelectItem value="5">5 afirmaciones</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Info className="h-3 w-3" />
            Estas cantidades aplican solo a preguntas generadas por IA. Las preguntas manuales se configuran individualmente.
          </p>
        </div>

        {/* === Sugerencia de cantidad de preguntas (SIMCE/PAES) === */}
        {suggestedQuestions !== null && (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
            <Info className="h-4 w-4 shrink-0" />
            <span>
              Se sugieren <strong>{suggestedQuestions} preguntas</strong> para el formato {isPaes ? "PAES" : "SIMCE"}.
              {" "}Puedes agregar más o menos según tu criterio.
            </span>
          </div>
        )}

        {/* === Modo Ensayo PAES: variante + (módulo Ciencias) + eje temático === */}
        {isPaes && (() => {
          const needsModule = requiresCienciasModule(meta.paesVariant);
          const axes = getAxesFor(meta.paesVariant, meta.paesCienciasModule);
          const hasLegacyAxis =
            !!meta.paesAxis && axes.length > 0 && !axes.includes(meta.paesAxis);
          const axisDisabled = !meta.paesVariant || (needsModule && !meta.paesCienciasModule);
          return (
            <div className="space-y-3 rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                Configuración Ensayo PAES
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Variante PAES <span className="text-destructive">*</span></Label>
                  <Select
                    value={meta.paesVariant ?? ""}
                    onValueChange={(v) =>
                      onChange({
                        ...meta,
                        paesVariant: v as PaesVariant,
                        // Reinicia módulo y eje al cambiar variante.
                        paesCienciasModule: undefined,
                        paesAxis: "",
                        // Ajustar alternativas: M1 = 4, resto = 5
                        defaultMcOptions: v === "m1" ? 4 : 5,
                      })
                    }
                  >
                    <SelectTrigger><SelectValue placeholder="Selecciona una variante" /></SelectTrigger>
                    <SelectContent>
                      {PAES_VARIANTS.map((v) => (
                        <SelectItem key={v.value} value={v.value}>
                          {v.label} · meta {v.questionGoal}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {needsModule && (
                  <div>
                    <Label className="text-xs">Módulo de Ciencias <span className="text-destructive">*</span></Label>
                    <Select
                      value={meta.paesCienciasModule ?? ""}
                      onValueChange={(v) =>
                        onChange({
                          ...meta,
                          paesCienciasModule: v as PaesCienciasModule,
                          paesAxis: "", // resetea el eje al cambiar módulo
                        })
                      }
                    >
                      <SelectTrigger><SelectValue placeholder="Bio / Fis / Qui" /></SelectTrigger>
                      <SelectContent>
                        {PAES_CIENCIAS_MODULES.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className={needsModule ? "sm:col-span-2" : ""}>
                  <Label className="text-xs">
                    Eje Temático PAES <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={meta.paesAxis ?? ""}
                    onValueChange={(v) => set("paesAxis", v)}
                    disabled={axisDisabled}
                  >
                    <SelectTrigger aria-required="true">
                      <SelectValue
                        placeholder={
                          axisDisabled
                            ? (needsModule && !meta.paesCienciasModule
                                ? "Selecciona primero el módulo"
                                : "Selecciona primero la variante")
                            : "Selecciona un eje temático"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {axes.map((axis) => (
                        <SelectItem key={axis} value={axis}>{axis}</SelectItem>
                      ))}
                      {hasLegacyAxis && (
                        <SelectItem key="__legacy" value={meta.paesAxis!}>
                          <em>{meta.paesAxis} (valor anterior)</em>
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                En modo PAES no se vinculan Objetivos de Aprendizaje; el Eje Temático oficial es obligatorio para guardar la prueba.
              </p>
            </div>
          );
        })()}

        {/* === Objetivos de Aprendizaje (oculto en modo PAES) === */}
        {!isPaes && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Objetivos de Aprendizaje (OA)</Label>
              <span className="text-xs text-muted-foreground">{linked.length} seleccionado{linked.length === 1 ? "" : "s"}</span>
            </div>
            {!meta.gradeValue || !meta.subjectValue ? (
              <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-3">
                Selecciona curso y asignatura para ver los OA disponibles. <span className="italic">Los OA son opcionales.</span>
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
                    <div className="text-muted-foreground">Si está activo, los códigos de los OA seleccionados aparecerán en el documento.</div>
                  </div>
                  <Switch
                    checked={!!meta.showOaInHeader}
                    onCheckedChange={(v) => set("showOaInHeader", v)}
                    disabled={linked.length === 0}
                  />
                </label>
                {meta.showOaInHeader && linked.length > 0 && (
                  <div className="rounded-md border border-border px-3 py-2">
                    <Label className="text-xs font-medium">Posición del OA en el documento</Label>
                    <Select
                      value={meta.oaPosition ?? "after-instructions"}
                      onValueChange={(v) => set("oaPosition", v as OaPosition)}
                    >
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="before-title">Antes del título e instrucciones</SelectItem>
                        <SelectItem value="after-instructions">Después del título e instrucciones</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
