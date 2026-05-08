import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Cloud, CloudOff, Download, Eye, FileDown, FileText, Loader2, Lock, Pencil, Plus, Printer, Save, Send, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
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
  listAssessments,
  loadDraft,
  saveDraft,
  upsertAssessment,
  updateAssessmentStatus,
  getAssessmentOwner,
} from "@/lib/assessment-storage";
import { listProfiles, profileLabel, getMyProfile, type Profile } from "@/lib/profiles";
import { loadInstitutionName, loadLogo, loadTemplates, type FormatTemplate } from "@/lib/templates";
import { loadSubjects, loadTeachers, type GradeOption, type SubjectOption, type TeacherOption } from "@/lib/catalog";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import type { RenderContext } from "@/lib/assessment-render";
import { exportAssessmentToPdf } from "@/lib/assessment-pdf";
import { exportAssessmentToDocx } from "@/lib/assessment-docx";
import { buildAssessmentFileName } from "@/lib/assessment-file-name";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage, type PlanType } from "@/hooks/useUserUsage";
import { listAssignmentsForTeacher, type TeacherAssignment } from "@/lib/teacher-assignments";
import { loadAppSettings, loadDefaultInstitutionLogo, type AppSettings, DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { supabase } from "@/integrations/supabase/client";

const CrearPrueba = () => {
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const { grades, loading: gradesLoading } = useAdminCourses();
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState("New Little College La Florida");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [tab, setTab] = useState<"meta" | "content" | "preview">("meta");
  const [exporting, setExporting] = useState(false);
  const [omrOpen, setOmrOpen] = useState(false);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const [restrictedAssignments, setRestrictedAssignments] = useState<TeacherAssignment[] | null>(null);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);
  const [hasZeroAssignments, setHasZeroAssignments] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [isDirty, setIsDirty] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();
  // Tracks whether the user has made an explicit edit (vs automatic changes like
  // teacher auto-assign or template reload). Autosave only fires when this is true.
  const userHasEditedRef = useRef(false);
  // Tracks which assessment ID was last loaded from DB to avoid re-saving on load.
  const loadedAssessmentIdRef = useRef<string | null>(null);
  // Preserva valores originales de curso/asignatura cargados desde DB
  // para evitar que el autosave los sobrescriba con valores vacíos durante re-mount.
  const originalMetaRef = useRef<{ gradeValue: string; subjectValue: string } | null>(null);

  const { user, isStaff, isAdmin, isUtpHead, loading: authLoading } = useAuth();
  const isAdminOnly = isAdmin && !isUtpHead;
  const isDocente = !!user && !isStaff;
  const { effectivePlan, creditsAvailable, refresh: refreshUsage, maxAssessments, maxAssignments, canExportDocx, showWatermark, canEditLayout, canUseOmr, canUseAnswerKey, allowedTemplates, planLabel } = useUserUsage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editingId = searchParams.get("id");
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Helper: update assessment and mark as user-edited (triggers autosave)
  const setAssessmentByUser = useCallback((updater: Assessment | ((prev: Assessment | null) => Assessment | null)) => {
    userHasEditedRef.current = true;
    setAssessment(updater);
  }, []);

  // Guard: Admin puro no puede crear pruebas
  useEffect(() => {
    if (!authLoading && isAdminOnly) {
      toast.error("El perfil Admin es solo de gestión. No puede crear pruebas.");
      navigate("/admin/dashboard", { replace: true });
    }
  }, [authLoading, isAdminOnly, navigate]);

  // Navigation guard: warn when a new test only exists as a local draft.
  const shouldBlock = isDirty && !editingId && !loadedAssessmentIdRef.current;

  useEffect(() => {
    if (!shouldBlock) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);

  useEffect(() => {
    if (!shouldBlock) return;
    const handler = (event: MouseEvent) => {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target || event.defaultPrevented) return;
      const nextUrl = new URL(anchor.href, window.location.href);
      if (nextUrl.origin !== window.location.origin || nextUrl.pathname === window.location.pathname) return;
      event.preventDefault();
      const leave = window.confirm(
        "Tu prueba aún no está guardada en la nube. Si sales, se perderán los cambios.\n\n¿Deseas salir de todas formas?"
      );
      if (leave) navigate(`${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [navigate, shouldBlock]);

  useEffect(() => {
    loadAppSettings().then(setAppSettings).catch(() => {/* keep default */});
  }, []);

  // Carga las asignaciones del docente. Si es staff (admin/UTP), no restringimos.
  // Si el docente no tiene asignaciones, se bloquea la creación de pruebas nuevas.
  // If plan has a limit, only the last N assignments (by created_at) are active.
  useEffect(() => {
    if (authLoading || !user) return;
    if (!isDocente) { setRestrictedAssignments(null); setAssignmentsLoaded(true); setHasZeroAssignments(false); return; }
    listAssignmentsForTeacher(user.id).then((a) => {
      if (a.length === 0) {
        setRestrictedAssignments(null);
        // Only block new test creation; allow editing existing tests
        setHasZeroAssignments(!editingId);
      } else {
        // Sort newest first and keep only the active ones per plan limit
        const sorted = [...a].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
        const active = maxAssignments !== null ? sorted.slice(0, maxAssignments) : sorted;
        setRestrictedAssignments(active.length > 0 ? active : null);
        setHasZeroAssignments(active.length === 0);
      }
      setAssignmentsLoaded(true);
    });
  }, [user, isDocente, authLoading, maxAssignments, editingId]);

  // Cargamos el perfil del usuario actual (para mostrar el nombre como docente bloqueado
  // y para aplicar branding personalizado para usuarios individuales).
  useEffect(() => {
    if (!user) { setCurrentProfile(null); return; }
    getMyProfile().then(async (p) => {
      if (p?.colegioId) console.debug("[CrearPrueba] usuario institucional, colegio_id:", p.colegioId);
      setCurrentProfile(p);
      // Si el usuario NO es staff:
      if (!isStaff && p) {
        // Docente institucional: heredar branding del colegio
        if (p.colegioId) {
          const { data: col } = await supabase
            .from("colegios")
            .select("nombre, logo_url")
            .eq("id", p.colegioId)
            .maybeSingle();
          if (col) {
            const colTyped = col as { nombre: string; logo_url: string | null };
            setInstitutionName(colTyped.nombre ?? "");
            let resolvedLogo = colTyped.logo_url ?? null;
            // Si logo_url es un path relativo de storage, construir URL pública
            if (resolvedLogo && !resolvedLogo.startsWith("http") && !resolvedLogo.startsWith("data:")) {
              const { data: urlData } = supabase.storage.from("user-logos").getPublicUrl(resolvedLogo);
              resolvedLogo = urlData?.publicUrl ?? resolvedLogo;
            }
            if (!resolvedLogo) {
              console.warn("[CrearPrueba] El colegio no tiene logo_url configurado; el PDF saldrá sin logo institucional.");
            }
            setLogo(resolvedLogo);
          } else {
            console.warn("[CrearPrueba] colegio_id apunta a un registro inexistente en `colegios`:", p.colegioId);
          }
        } else {
          // Docente autónomo: branding personalizado del perfil
          setInstitutionName(p.customInstitutionName ?? "");
          setLogo(p.customLogoUrl ?? null);
        }
      }
    });
  }, [user?.id, isStaff]);

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
    let t = loadTemplates();
    if (!isStaff && allowedTemplates) {
      t = t.filter((tpl) => allowedTemplates.includes(tpl.id));
    }
    setTemplates(t);
    setSubjects(loadSubjects());
    // grades now loaded via useAdminCourses hook
    setTeachers(loadTeachers());
    // Branding: solo staff usa branding institucional del backend.
    // Docentes autónomos usan su perfil (cargado en otro useEffect).
    if (isStaff) {
      setLogo(loadLogo());
      setInstitutionName(loadInstitutionName() || "New Little College La Florida");
      loadAppSettings()
        .then(async (s) => {
          setLogo(s.institution_logo || await loadDefaultInstitutionLogo());
          setInstitutionName(s.institution_name || "New Little College La Florida");
        })
        .catch(() => {/* keep local */});
    }

    // Si hay ?id=, cargar esa prueba; si ?new=1, empezar desde cero; si no, borrador.
    const isNew = searchParams.get("new") === "1";
    (async () => {
      if (editingId) {
        const found = await getAssessment(editingId);
        if (found) {
          console.log("[CrearPrueba] Loaded from DB — gradeValue:", found.meta.gradeValue, "subjectValue:", found.meta.subjectValue, "status:", found.status);
          loadedAssessmentIdRef.current = found.id;
          userHasEditedRef.current = false;
          // Guardar valores originales para proteger contra sobrescritura vacía
          originalMetaRef.current = {
            gradeValue: found.meta.gradeValue || "",
            subjectValue: found.meta.subjectValue || "",
          };
          setAssessment(found);
        } else if (t.length > 0) {
          toast.error("No se encontró la prueba");
          setAssessment(emptyAssessment(t[0].id));
        }
      } else if (isNew) {
        clearDraft();
        userHasEditedRef.current = false;
        if (t.length > 0) setAssessment(emptyAssessment(t[0].id));
      } else {
        const draft = loadDraft();
        if (draft) setAssessment(draft);
        else if (t.length > 0) setAssessment(emptyAssessment(t[0].id));
      }
    })();
  }, [editingId, allowedTemplates, isStaff]);

  // Plan filtering is now handled by useAdminCourses hook

  // Re-cargar el logo y nombre del colegio si cambian en otra pestaña/ventana
  // o al volver a esta pestaña (asegura que la vista previa siempre vea el
  // último logo guardado en Configuración).
  useEffect(() => {
    if (!isStaff) return; // Docentes autónomos usan su propio branding del perfil
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
  }, [isStaff]);


  // Docente autónomo: sin colegio_id → no pasa por flujo de revisión UTP.
  const isAutonomous = !isStaff && !currentProfile?.colegioId;

  // Determina si la prueba es de solo lectura para el docente
  const isOwnAssessment = !ownerId || ownerId === user?.id;
  const assessmentStatus = assessment?.status ?? "borrador";
  const readOnly = (() => {
    if (!assessment) return false;
    // Staff siempre puede editar
    if (isStaff) return false;
    // Docentes autónomos siempre pueden editar sus pruebas
    if (isAutonomous) return false;
    // Docente institucional: solo puede editar en borrador o rechazado
    return assessmentStatus === "pendiente_revision" || assessmentStatus === "aprobado";
  })();

  // Autosave: only fires when the user has explicitly edited something.
  // Automatic changes (teacher auto-assign, template reload) do NOT trigger saves.
  // Uses a 1.5s debounce to batch rapid edits into a single save.
  useEffect(() => {
    if (!assessment || readOnly) return;
    if (!userHasEditedRef.current) return; // skip automatic/programmatic changes

    setIsDirty(true);
    clearTimeout(debounceTimerRef.current);

    if (editingId) {
      debounceTimerRef.current = setTimeout(() => {
        // Protección: si los campos críticos están vacíos pero los originales no,
        // restaurar valores originales antes de guardar para evitar sobrescritura.
        let toSave = assessment;
        if (originalMetaRef.current) {
          const orig = originalMetaRef.current;
          const meta = toSave.meta;
          const needsGrade = !meta.gradeValue && !!orig.gradeValue;
          const needsSubject = !meta.subjectValue && !!orig.subjectValue;
          if (needsGrade || needsSubject) {
            console.warn("[Autosave] Restoring original meta values — gradeValue:", orig.gradeValue, "subjectValue:", orig.subjectValue);
            toSave = {
              ...toSave,
              meta: {
                ...meta,
                gradeValue: meta.gradeValue || orig.gradeValue,
                subjectValue: meta.subjectValue || orig.subjectValue,
              },
            };
          }
        }
        setSaveStatus("saving");
        clearTimeout(saveTimerRef.current);
        upsertAssessment(toSave)
          .then(() => {
            setSaveStatus("saved");
            setIsDirty(false);
            saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
          })
          .catch((e) => {
            console.warn("autosave", e);
            setSaveStatus("error");
            saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 5000);
          });
      }, 1500);
    } else {
      saveDraft(assessment);
      setSaveStatus("saved");
      setIsDirty(true);
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
    }
    return () => {
      clearTimeout(saveTimerRef.current);
      clearTimeout(debounceTimerRef.current);
    };
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
      planType: effectivePlan,
      showWatermark,
      includeAnswerKey: canUseAnswerKey && includeAnswerKey,
    };
  }, [assessment, template, subjects, grades, teachers, logo, institutionName, effectivePlan, includeAnswerKey, canUseAnswerKey]);

  if (!assessment || !template || !renderCtx) {
    return (
      <AppLayout>
        <div className="text-center py-20 text-muted-foreground">Cargando…</div>
      </AppLayout>
    );
  }

  // Docente sin asignaciones: bloquear creación de pruebas nuevas
  const isInstitutionalDocente = isDocente && !!currentProfile?.colegioId;
  if (isDocente && assignmentsLoaded && hasZeroAssignments && !editingId) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto text-center py-20 space-y-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
          <h2 className="text-xl font-semibold">
            {isInstitutionalDocente ? "Sin cursos asignados" : "Configura tus cursos primero"}
          </h2>
          <p className="text-muted-foreground">
            {isInstitutionalDocente
              ? "Pide a tu UTP que te asigne cursos y asignaturas para poder crear pruebas."
              : "Antes de crear pruebas, debes seleccionar los cursos y asignaturas que impartes desde tu perfil."}
          </p>
          {!isInstitutionalDocente && (
            <Button onClick={() => navigate("/perfil")}>
              Ir a mi perfil
            </Button>
          )}
        </div>
      </AppLayout>
    );
  }

  const handleNew = () => {
    const msg = editingId
      ? "¿Crear una prueba nueva? Se perderán cambios no guardados."
      : "¿Empezar una nueva prueba? Se descartará el borrador actual.";
    if (!confirm(msg)) return;
    clearDraft();
    userHasEditedRef.current = false;
    loadedAssessmentIdRef.current = null;
    setAssessment(emptyAssessment(templates[0]?.id ?? template.id));
    if (editingId) setSearchParams({});
    setTab("meta");
  };

  const handleSave = async () => {
    const err = validateMeta();
    if (err) { toast.error(err); return; }
    // Límite de pruebas según plan (solo al crear nueva, no al editar)
    if (!editingId && maxAssessments !== null) {
      const existing = await listAssessments();
      if (existing.length >= maxAssessments) {
        toast.error(`Has alcanzado el límite de ${maxAssessments} pruebas en tu plan. Elimina una prueba existente o actualiza tu plan.`);
        return;
      }
    }
    try {
      const saved = await upsertAssessment(assessment);
      setAssessment(saved);
      if (!editingId) {
        setSearchParams({ id: saved.id });
        clearDraft();
      }
      setIsDirty(false);
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

  /** Validates only metadata fields (curso, asignatura, docente, título). */
  const validateMeta = (): string | null => {
    if (!assessment.meta.subjectValue) return "Selecciona la asignatura";
    if (!assessment.meta.gradeValue) return "Selecciona el curso";
    if (!assessment.meta.teacherValue) return "Selecciona el docente";
    if (!assessment.meta.title.trim()) return "Escribe un título para la evaluación";
    // Validación de compatibilidad grado/formato
    const SIMCE_ALLOWED = new Set(["4ºBásico", "6ºBásico", "8ºBásico", "IIMedio"]);
    const PAES_ALLOWED = new Set(["IIIMedio", "IVMedio"]);
    if (template?.essayMode === "simce" && !SIMCE_ALLOWED.has(assessment.meta.gradeValue)) {
      return "El formato SIMCE no está disponible para este nivel. Solo aplica a 4° Básico, 6° Básico, 8° Básico y II Medio.";
    }
    if (template?.essayMode === "paes" && !PAES_ALLOWED.has(assessment.meta.gradeValue)) {
      return "El formato PAES solo aplica a III y IV Medio.";
    }
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
    return null;
  };

  /** Full validation: metadata + at least one question. */
  const validate = (): string | null => {
    const metaErr = validateMeta();
    if (metaErr) return metaErr;
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
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              {editingId ? "Editar prueba" : "Crear prueba"}
              {editingId && !isAutonomous && (
                <Badge className={`text-xs ${
                  assessmentStatus === "borrador" ? "bg-muted text-muted-foreground" :
                  assessmentStatus === "pendiente_revision" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                  assessmentStatus === "aprobado" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                  "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                }`}>{ASSESSMENT_STATUS_LABEL[assessmentStatus]}</Badge>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Construye una evaluación estandarizada. El formato del colegio se aplica automáticamente al exportar.
            </p>
            {isStaff && ownerId && ownerId !== user?.id && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-2.5 py-1 text-xs text-amber-900">
                <Save className="h-3.5 w-3.5" />
                Editando como UTP/Admin · Autor: <strong>{profileLabel(ownerProfile ?? undefined, ownerId)}</strong>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === "saving" ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…
              </span>
            ) : saveStatus === "error" ? (
              <span className="inline-flex items-center gap-1 text-xs text-destructive">
                <CloudOff className="h-3.5 w-3.5" /> Error al guardar
              </span>
            ) : saveStatus === "saved" ? (
              <span className={`inline-flex items-center gap-1 text-xs ${editingId ? "text-emerald-600" : "text-amber-500"}`}>
                {editingId ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
                {editingId ? "Guardado en la nube" : "Borrador local"}
              </span>
            ) : isDirty ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                <CloudOff className="h-3.5 w-3.5" /> Cambios sin guardar
              </span>
            ) : editingId ? (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                <Cloud className="h-3.5 w-3.5" /> Guardado en la nube
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <CloudOff className="h-3.5 w-3.5" /> No guardado en la nube
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleNew}>
              <Plus className="h-4 w-4" /> Nueva
            </Button>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="h-4 w-4" /> Guardar
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            {canUseOmr && (template?.essayMode === "simce" || template?.essayMode === "paes") && (
              <Button variant="outline" size="sm" onClick={() => setOmrOpen(true)}>
                <Printer className="h-4 w-4" /> Hoja OMR
              </Button>
            )}
            <label className={`inline-flex items-center gap-1.5 text-sm ${canUseAnswerKey ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`} title={canUseAnswerKey ? "Incluye pauta de corrección al final" : "Disponible en Planes Superiores"}>
              <input
                type="checkbox"
                checked={includeAnswerKey && canUseAnswerKey}
                disabled={!canUseAnswerKey}
                onChange={(e) => setIncludeAnswerKey(e.target.checked)}
                className="accent-primary h-4 w-4"
              />
              {!canUseAnswerKey && <Lock className="h-3.5 w-3.5" />}
              Pauta de Corrección
            </label>
            {!canExportDocx ? (
              <Button size="sm" variant="secondary" disabled title="Disponible en un plan superior">
                <Download className="h-4 w-4" /> .docx
              </Button>
            ) : (
              <Button size="sm" onClick={handleExportDocx} disabled={exporting}>
                <Download className="h-4 w-4" /> {exporting ? "Generando…" : "Descargar .docx"}
              </Button>
            )}
            {/* Docente institucional: enviar a revisión (oculto para autónomos) */}
            {!isStaff && !isAutonomous && editingId && (assessmentStatus === "borrador" || assessmentStatus === "rechazado") && (
              <Button size="sm" variant="default" onClick={handleSubmitForReview}>
                <Send className="h-4 w-4" /> {assessmentStatus === "rechazado" ? "Re-enviar a Revisión" : "Enviar a Revisión UTP"}
              </Button>
            )}
          </div>
        </div>

        {/* Read-only banner for institutional teachers (hidden for autonomous) */}
        {readOnly && !isAutonomous && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Prueba en modo lectura</AlertTitle>
            <AlertDescription>
              {assessmentStatus === "pendiente_revision"
                ? "Esta prueba está pendiente de revisión por la UTP. No puedes editarla hasta que sea revisada."
                : "Esta prueba fue aprobada y no puede ser modificada."}
            </AlertDescription>
          </Alert>
        )}

        {/* Feedback UTP when rejected (hidden for autonomous) */}
        {!isAutonomous && assessmentStatus === "rechazado" && assessment.utpFeedback && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Evaluación rechazada por UTP</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">{assessment.utpFeedback}</AlertDescription>
          </Alert>
        )}

        {/* UTP/Admin approval panel */}
        {isStaff && editingId && ownerId && ownerId !== user?.id && assessmentStatus === "pendiente_revision" && (
          <Card className="border-primary">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Panel de Revisión UTP</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={handleApprove} className="bg-green-600 hover:bg-green-700 text-white">
                  <CheckCircle2 className="h-4 w-4" /> Aprobar Evaluación
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setShowRejectForm(!showRejectForm)}>
                  <XCircle className="h-4 w-4" /> Rechazar con Comentarios
                </Button>
              </div>
              {showRejectForm && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Escribe las observaciones para el docente…"
                    value={rejectFeedback}
                    onChange={(e) => setRejectFeedback(e.target.value)}
                    rows={3}
                  />
                  <Button size="sm" variant="destructive" onClick={handleReject} disabled={!rejectFeedback.trim()}>
                    Confirmar Rechazo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {(() => {
          const metaComplete = !!(assessment?.meta.gradeValue && assessment?.meta.subjectValue && assessment?.meta.title?.trim());
          const contentUnlocked = metaComplete && !!editingId;
          return (
            <Tabs value={tab} onValueChange={(v) => {
              if (v !== "meta" && !contentUnlocked) {
                if (!metaComplete) {
                  toast.error("Completa los datos generales primero (curso, asignatura y título).");
                } else {
                  toast.error("Guarda los datos generales primero antes de agregar contenido.");
                }
                return;
              }
              setTab(v as typeof tab);
            }}>
              <TabsList>
                <TabsTrigger value="meta"><Pencil className="h-4 w-4 mr-1" /> Datos</TabsTrigger>
                <TabsTrigger value="content" disabled={!contentUnlocked} title={!contentUnlocked ? (metaComplete ? "Guarda los datos generales primero" : "Completa curso, asignatura y título primero") : undefined}>
                  <FileText className="h-4 w-4 mr-1" /> {isDesktop ? "Contenido + Preview" : "Contenido"}
                </TabsTrigger>
                {!isDesktop && (
                  <TabsTrigger value="preview" disabled={!contentUnlocked} title={!contentUnlocked ? "Guarda los datos generales primero" : undefined}>
                    <Eye className="h-4 w-4 mr-1" /> Vista previa
                  </TabsTrigger>
                )}
          </TabsList>
          <TabsContent value="meta" className="mt-4">
            {gradesLoading && editingId ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm">Cargando catálogo de cursos…</span>
              </div>
            ) : (
              <div className={readOnly ? "pointer-events-none opacity-60" : ""}>
                <AssessmentMetaForm
                  meta={assessment.meta}
                  onChange={(m) => setAssessmentByUser({ ...assessment, meta: m })}
                  templates={templates}
                  subjects={subjects}
                  grades={grades}
                  teachers={teachers}
                  restrictedAssignments={restrictedAssignments}
                  canChooseTeacher={canChooseTeacher}
                  lockedTeacherLabel={lockedTeacherLabel}
                  allowSelfAssignment={appSettings.allow_self_assignment}
                  readOnlyExceptOA={!isStaff && !!editingId && !readOnly && !!(assessment?.meta.gradeValue && assessment?.meta.subjectValue)}
                />
              </div>
            )}
          </TabsContent>
          <TabsContent value="content" className="mt-4">
            {isDesktop ? (
              <div className="grid grid-cols-2 gap-4">
                <div className={readOnly ? "pointer-events-none opacity-60" : ""}>
                  <QuestionList
                    questions={assessment.questions}
                    onChange={(qs) => setAssessmentByUser({ ...assessment, questions: qs })}
                    meta={assessment.meta}
                    gradeLabel={renderCtx.gradeLabel}
                    subjectLabel={renderCtx.subjectLabel}
                    creditsAvailable={creditsAvailable}
                    onCreditsUsed={refreshUsage}
                    isInstitutional={!!currentProfile?.colegioId}
                  />
                </div>
                <div className="sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto space-y-3">
                  <PreviewLayoutToolbar
                    meta={assessment.meta}
                    onMetaChange={(m) => setAssessmentByUser({ ...assessment, meta: m })}
                    canEdit={isStaff || canEditLayout}
                  />
                  <Card className="shadow-card">
                    <CardContent className="p-0">
                      <AssessmentPreview ctx={renderCtx} />
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : (
              <div className={readOnly ? "pointer-events-none opacity-60" : ""}>
                <QuestionList
                  questions={assessment.questions}
                  onChange={(qs) => setAssessmentByUser({ ...assessment, questions: qs })}
                  meta={assessment.meta}
                  gradeLabel={renderCtx.gradeLabel}
                  subjectLabel={renderCtx.subjectLabel}
                  creditsAvailable={creditsAvailable}
                  onCreditsUsed={refreshUsage}
                  isInstitutional={!!currentProfile?.colegioId}
                />
              </div>
            )}
          </TabsContent>
          {!isDesktop && (
            <TabsContent value="preview" className="mt-4 space-y-4">
              <PreviewLayoutToolbar
                meta={assessment.meta}
                onMetaChange={(m) => setAssessmentByUser({ ...assessment, meta: m })}
                canEdit={isStaff || canEditLayout}
              />
              <Card className="shadow-card">
                <CardContent className="p-0">
                  <AssessmentPreview ctx={renderCtx} />
                </CardContent>
              </Card>
            </TabsContent>
          )}
            </Tabs>
          );
        })()}
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
