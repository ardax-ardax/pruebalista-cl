import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Eye, FileDown, FileText, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";

import { AssessmentMetaForm } from "@/components/test-builder/AssessmentMetaForm";
import { QuestionList } from "@/components/test-builder/QuestionList";
import { AssessmentPreview } from "@/components/test-builder/AssessmentPreview";

import {
  computeTotalPoints,
  emptyAssessment,
  type Assessment,
} from "@/lib/assessment-schema";
import {
  clearDraft,
  getAssessment,
  loadDraft,
  saveDraft,
  upsertAssessment,
} from "@/lib/assessment-storage";
import { loadInstitutionName, loadLogo, loadTemplates, type FormatTemplate } from "@/lib/templates";
import { loadGrades, loadSubjects, loadTeachers, type GradeOption, type SubjectOption, type TeacherOption } from "@/lib/catalog";
import type { RenderContext } from "@/lib/assessment-render";
import { exportAssessmentToPdf } from "@/lib/assessment-pdf";
import { exportAssessmentToDocx } from "@/lib/assessment-docx";
import { buildAssessmentFileName } from "@/lib/assessment-file-name";

const CrearPrueba = () => {
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState("New Little College La Florida");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [tab, setTab] = useState<"meta" | "content" | "preview">("meta");
  const [exporting, setExporting] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const editingId = searchParams.get("id");

  useEffect(() => {
    const t = loadTemplates();
    setTemplates(t);
    setSubjects(loadSubjects());
    setGrades(loadGrades());
    setTeachers(loadTeachers());
    setLogo(loadLogo());
    setInstitutionName(loadInstitutionName() || "New Little College La Florida");

    // Si hay ?id=, cargar esa prueba; si no, borrador o nueva.
    if (editingId) {
      const found = getAssessment(editingId);
      if (found) {
        setAssessment(found);
      } else if (t.length > 0) {
        toast.error("No se encontró la prueba");
        setAssessment(emptyAssessment(t[0].id));
      }
    } else {
      const draft = loadDraft();
      if (draft) setAssessment(draft);
      else if (t.length > 0) setAssessment(emptyAssessment(t[0].id));
    }
  }, [editingId]);

  // Auto-guardar borrador (solo si NO estamos editando una prueba guardada)
  useEffect(() => {
    if (assessment && !editingId) saveDraft(assessment);
  }, [assessment, editingId]);

  const template = useMemo(
    () => templates.find((t) => t.id === assessment?.meta.templateId) ?? templates[0] ?? null,
    [templates, assessment?.meta.templateId],
  );

  const renderCtx: RenderContext | null = useMemo(() => {
    if (!assessment || !template) return null;
    const subjectLabel = subjects.find((s) => s.value === assessment.meta.subjectValue)?.label ?? "";
    const gradeLabel = grades.find((g) => g.value === assessment.meta.gradeValue)?.label ?? "";
    const teacherLabel = teachers.find((t) => t.value === assessment.meta.teacherValue)?.label ?? "";
    const totalPoints = computeTotalPoints(assessment.questions);
    return {
      assessment: { ...assessment, meta: { ...assessment.meta, totalPoints } },
      template,
      logoDataUrl: logo,
      institutionName,
      subjectLabel,
      gradeLabel,
      teacherLabel,
    };
  }, [assessment, template, subjects, grades, teachers, logo, institutionName]);

  if (!assessment || !template || !renderCtx) {
    return (
      <AppLayout>
        <div className="text-center py-20 text-muted-foreground">Cargando…</div>
      </AppLayout>
    );
  }

  const handleNew = () => {
    if (!confirm("¿Empezar una nueva prueba? Se descartará el borrador actual.")) return;
    clearDraft();
    setAssessment(emptyAssessment(templates[0]?.id ?? template.id));
    setTab("meta");
  };

  const validate = (): string | null => {
    if (!assessment.meta.subjectValue) return "Selecciona la asignatura";
    if (!assessment.meta.gradeValue) return "Selecciona el curso";
    if (!assessment.meta.teacherValue) return "Selecciona el docente";
    if (!assessment.meta.title.trim()) return "Escribe un título para la evaluación";
    const counted = assessment.questions.filter((q) => q.type !== "section-title" && q.type !== "info-block");
    if (counted.length === 0) return "Agrega al menos una pregunta";
    return null;
  };

  const handleExportPdf = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    try {
      const fileName = buildAssessmentFileName(renderCtx.assessment.meta, template, "pdf");
      exportAssessmentToPdf(renderCtx, fileName);
      toast.success("Abriendo diálogo de impresión…");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleExportDocx = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    setExporting(true);
    try {
      const fileName = buildAssessmentFileName(renderCtx.assessment.meta, template, "docx");
      await exportAssessmentToDocx(renderCtx, fileName);
      toast.success("Documento .docx generado");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo generar el .docx: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Crear prueba</h1>
            <p className="text-sm text-muted-foreground">
              Construye una evaluación estandarizada. El formato institucional se aplica automáticamente al exportar.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNew}>
              <Plus className="h-4 w-4" /> Nueva
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button size="sm" onClick={handleExportDocx} disabled={exporting}>
              <Download className="h-4 w-4" /> {exporting ? "Generando…" : "Descargar .docx"}
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="meta"><Pencil className="h-4 w-4 mr-1" /> Datos</TabsTrigger>
            <TabsTrigger value="content"><FileText className="h-4 w-4 mr-1" /> Contenido</TabsTrigger>
            <TabsTrigger value="preview"><Eye className="h-4 w-4 mr-1" /> Vista previa</TabsTrigger>
          </TabsList>
          <TabsContent value="meta" className="mt-4">
            <AssessmentMetaForm
              meta={assessment.meta}
              onChange={(m) => setAssessment({ ...assessment, meta: m })}
              templates={templates}
              subjects={subjects}
              grades={grades}
              teachers={teachers}
            />
          </TabsContent>
          <TabsContent value="content" className="mt-4">
            <QuestionList
              questions={assessment.questions}
              onChange={(qs) => setAssessment({ ...assessment, questions: qs })}
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <Card className="shadow-card">
              <CardContent className="p-0">
                <AssessmentPreview ctx={renderCtx} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default CrearPrueba;
