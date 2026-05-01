import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Download, Eye, FileDown, FileText, Pencil, Plus, Printer, Save, Send, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { AssessmentMetaForm } from "@/components/test-builder/AssessmentMetaForm";
import { QuestionList } from "@/components/test-builder/QuestionList";
import { AssessmentPreview } from "@/components/test-builder/AssessmentPreview";
import { PreviewLayoutToolbar } from "@/components/test-builder/PreviewLayoutToolbar";
import { OmrSheetDialog } from "@/components/omr/OmrSheetDialog";


import {
  computeTotalPoints,
  emptyAssessment,
  ASSESSMENT_STATUS_LABEL,
  type Assessment,
  type AssessmentStatus,
} from "@/lib/assessment-schema";
import {
  clearDraft,
  getAssessment,
  loadDraft,
  saveDraft,
  upsertAssessment,
  updateAssessmentStatus,
  getAssessmentOwner,
} from "@/lib/assessment-storage";
import { listProfiles, profileLabel, type Profile } from "@/lib/profiles";
import { loadInstitutionName, loadLogo, loadTemplates, type FormatTemplate } from "@/lib/templates";
import { loadGrades, loadSubjects, loadTeachers, type GradeOption, type SubjectOption, type TeacherOption } from "@/lib/catalog";
import type { RenderContext } from "@/lib/assessment-render";
import { exportAssessmentToPdf } from "@/lib/assessment-pdf";
import { exportAssessmentToDocx } from "@/lib/assessment-docx";
import { buildAssessmentFileName } from "@/lib/assessment-file-name";
import { useAuth } from "@/hooks/useAuth";
import { listAssignmentsForTeacher, type TeacherAssignment } from "@/lib/teacher-assignments";
import { loadAppSettings, loadDefaultInstitutionLogo, type AppSettings, DEFAULT_APP_SETTINGS } from "@/lib/app-settings";

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
  const [omrOpen, setOmrOpen] = useState(false);
  const [restrictedAssignments, setRestrictedAssignments] = useState<TeacherAssignment[] | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const { user, isStaff, isUtpHead, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const editingId = searchParams.get("id");

  // Carga app_settings (modo auto-asignación) al montar.
  useEffect(() => {
    loadAppSettings().then(setAppSettings).catch(() => {/* keep default */});
  }, []);

  // Carga las asignaciones del docente. Si es staff (admin/UTP), no restringimos.
  useEffect(() => {
    if (authLoading || !user) return;
    if (isStaff) { setRestrictedAssignments(null); return; }
    listAssignmentsForTeacher(user.id).then(setRestrictedAssignments);
  }, [user, isStaff, authLoading]);

  // Cargamos el perfil del usuario actual (para mostrar el nombre como docente bloqueado).
  useEffect(() => {
    if (!user) { setCurrentProfile(null); return; }
    listProfiles().then(({ profiles: profs }) => {
      setCurrentProfile(profs.find((p) => p.id === user.id) ?? null);
    });
  }, [user?.id]);

  // Si staff abre una prueba ajena, recuperamos el dueño para mostrarlo.
  useEffect(() => {
    if (!editingId || !isStaff) { setOwnerId(null); setOwnerProfile(null); return; }
    getAssessmentOwner(editingId).then(async (oid) => {
      setOwnerId(oid);
      if (oid && oid !== user?.id) {
        const { profiles: profs } = await listProfiles();
        setOwnerProfile(profs.find((p) => p.id === oid) ?? null);
      } else {
        setOwnerProfile(null);
      }
    });
  }, [editingId, isStaff, user?.id]);

  useEffect(() => {
    const t = loadTemplates();
    setTemplates(t);
    setSubjects(loadSubjects());
    setGrades(loadGrades());
    setTeachers(loadTeachers());
    // Branding: caché local primero (rápido), luego backend (autoritativo y compartido).
    setLogo(loadLogo());
    setInstitutionName(loadInstitutionName() || "New Little College La Florida");
    loadAppSettings()
      .then(async (s) => {
        setLogo(s.institution_logo || await loadDefaultInstitutionLogo());
        setInstitutionName(s.institution_name || "New Little College La Florida");
      })
      .catch(() => {/* keep local */});

    // Si hay ?id=, cargar esa prueba; si no, borrador o nueva.
    (async () => {
      if (editingId) {
        const found = await getAssessment(editingId);
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
    })();
  }, [editingId]);

  // Re-cargar el logo y nombre del colegio si cambian en otra pestaña/ventana
  // o al volver a esta pestaña (asegura que la vista previa siempre vea el
  // último logo guardado en Configuración).
  useEffect(() => {
    const refreshBranding = () => {
      setLogo(loadLogo());
      setInstitutionName(loadInstitutionName() || "New Little College La Florida");
      loadAppSettings()
        .then(async (s) => {
          setLogo(s.institution_logo || await loadDefaultInstitutionLogo());
          setInstitutionName(s.institution_name || "New Little College La Florida");
        })
        .catch(() => {/* keep local */});
    };
    window.addEventListener("storage", refreshBranding);
    window.addEventListener("focus", refreshBranding);
    return () => {
      window.removeEventListener("storage", refreshBranding);
      window.removeEventListener("focus", refreshBranding);
    };
  }, []);


  // Determina si la prueba es de solo lectura para el docente
  const isOwnAssessment = !ownerId || ownerId === user?.id;
  const assessmentStatus = assessment?.status ?? "borrador";
  const readOnly = (() => {
    if (!assessment) return false;
    // Staff siempre puede editar
    if (isStaff) return false;
    // Docente: solo puede editar en borrador o rechazado
    return assessmentStatus === "pendiente_revision" || assessmentStatus === "aprobado";
  })();

  // Autosave: si editamos una prueba guardada, actualizamos en la nube.
  // Si es una nueva, guardamos como borrador local.
  useEffect(() => {
    if (!assessment || readOnly) return;
    if (editingId) {
      upsertAssessment(assessment).catch((e) => console.warn("autosave", e));
    } else {
      saveDraft(assessment);
    }
  }, [assessment, editingId, readOnly]);

  const template = useMemo(
    () => templates.find((t) => t.id === assessment?.meta.templateId) ?? templates[0] ?? null,
    [templates, assessment?.meta.templateId],
  );

  // Etiqueta del docente actual (para no-staff). Se usa para auto-asignar y
  // como texto del campo bloqueado.
  const lockedTeacherLabel = useMemo(() => {
    if (!user) return "";
    return profileLabel(currentProfile ?? undefined, user.id);
  }, [currentProfile, user]);

  const canChooseTeacher = isStaff;

  // Auto-asignar el docente al usuario logueado cuando no es staff y el campo
  // está vacío (o cuando sea una prueba propia recién creada).
  useEffect(() => {
    if (!assessment || !user || isStaff) return;
    const ownLabel = lockedTeacherLabel;
    if (!ownLabel) return;
    if (assessment.meta.teacherValue === ownLabel) return;
    // Solo sobrescribimos si el usuario es el dueño de la prueba (o es nueva).
    if (ownerId && ownerId !== user.id) return;
    setAssessment((prev) => prev ? { ...prev, meta: { ...prev.meta, teacherValue: ownLabel } } : prev);
  }, [assessment?.id, user?.id, isStaff, lockedTeacherLabel, ownerId]);


  const renderCtx: RenderContext | null = useMemo(() => {
    if (!assessment || !template) return null;
    const subjectLabel = subjects.find((s) => s.value === assessment.meta.subjectValue)?.label ?? "";
    const gradeLabel = grades.find((g) => g.value === assessment.meta.gradeValue)?.label ?? "";
    const teacherLabel = teachers.find((t) => t.value === assessment.meta.teacherValue)?.label
      ?? assessment.meta.teacherValue
      ?? "";
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
    const msg = editingId
      ? "¿Crear una prueba nueva? Se perderán cambios no guardados."
      : "¿Empezar una nueva prueba? Se descartará el borrador actual.";
    if (!confirm(msg)) return;
    clearDraft();
    setAssessment(emptyAssessment(templates[0]?.id ?? template.id));
    if (editingId) setSearchParams({});
    setTab("meta");
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    try {
      const saved = await upsertAssessment(assessment);
      setAssessment(saved);
      if (!editingId) {
        setSearchParams({ id: saved.id });
        clearDraft();
      }
      toast.success("Prueba guardada");
    } catch (e) {
      toast.error("No se pudo guardar: " + (e as Error).message);
    }
  };

  const handleSubmitForReview = async () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (!editingId) {
      toast.error("Guarda la prueba primero antes de enviarla a revisión.");
      return;
    }
    try {
      await updateAssessmentStatus(assessment.id, "pendiente_revision");
      setAssessment({ ...assessment, status: "pendiente_revision" });
      toast.success("Prueba enviada a revisión UTP");
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const handleApprove = async () => {
    try {
      await updateAssessmentStatus(assessment.id, "aprobado");
      setAssessment({ ...assessment, status: "aprobado", utpFeedback: null });
      toast.success("Evaluación aprobada");
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const handleReject = async () => {
    if (!rejectFeedback.trim()) {
      toast.error("Escribe un comentario para el docente");
      return;
    }
    try {
      await updateAssessmentStatus(assessment.id, "rechazado", rejectFeedback.trim());
      setAssessment({ ...assessment, status: "rechazado", utpFeedback: rejectFeedback.trim() });
      setRejectFeedback("");
      setShowRejectForm(false);
      toast.success("Evaluación rechazada con comentarios");
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    }
  };

  const validate = (): string | null => {
    if (!assessment.meta.subjectValue) return "Selecciona la asignatura";
    if (!assessment.meta.gradeValue) return "Selecciona el curso";
    if (!assessment.meta.teacherValue) return "Selecciona el docente";
    if (!assessment.meta.title.trim()) return "Escribe un título para la evaluación";
    // Validación PAES: variante + (módulo si Ciencias) + eje obligatorios.
    if (template?.essayMode === "paes") {
      if (!assessment.meta.paesVariant) return "Selecciona la Variante PAES";
      if (assessment.meta.paesVariant === "ciencias" && !assessment.meta.paesCienciasModule) {
        return "Selecciona el módulo de Ciencias (Biología, Física o Química)";
      }
      if (!assessment.meta.paesAxis) {
        return "Debes seleccionar un Eje Temático para guardar el ensayo PAES";
      }
    }
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
            <h1 className="text-2xl font-semibold tracking-tight">
              {editingId ? "Editar prueba" : "Crear prueba"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Construye una evaluación estandarizada. El formato institucional se aplica automáticamente al exportar.
            </p>
            {isStaff && ownerId && ownerId !== user?.id && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
                <Save className="h-3.5 w-3.5" />
                Editando como UTP/Admin · Autor: <strong>{profileLabel(ownerProfile ?? undefined, ownerId)}</strong>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleNew}>
              <Plus className="h-4 w-4" /> Nueva
            </Button>
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="h-4 w-4" /> Guardar
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOmrOpen(true)}>
              <Printer className="h-4 w-4" /> Hoja OMR
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
              restrictedAssignments={restrictedAssignments}
              canChooseTeacher={canChooseTeacher}
              lockedTeacherLabel={lockedTeacherLabel}
              allowSelfAssignment={appSettings.allow_self_assignment}
            />
          </TabsContent>
          <TabsContent value="content" className="mt-4">
            <QuestionList
              questions={assessment.questions}
              onChange={(qs) => setAssessment({ ...assessment, questions: qs })}
              meta={assessment.meta}
              gradeLabel={renderCtx.gradeLabel}
              subjectLabel={renderCtx.subjectLabel}
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-4 space-y-4">

            <PreviewLayoutToolbar
              meta={assessment.meta}
              onMetaChange={(m) => setAssessment({ ...assessment, meta: m })}
              canEdit={isStaff}
            />
            <Card className="shadow-card">
              <CardContent className="p-0">
                <AssessmentPreview ctx={renderCtx} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <OmrSheetDialog
          open={omrOpen}
          onOpenChange={setOmrOpen}
          assessment={assessment}
          institutionName={institutionName}
        />
      </div>
    </AppLayout>
  );
};

export default CrearPrueba;
