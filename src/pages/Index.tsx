import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import mammoth from "mammoth";
import { saveAs } from "file-saver";
import { ChevronDown, Download, FileDown, Loader2, RefreshCw, Settings, Sparkles } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { TemplateCard } from "@/components/TemplateCard";
import { TemplateEditor } from "@/components/TemplateEditor";
import { FileDropzone } from "@/components/FileDropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

import schoolLogo from "@/assets/logo-colegio.jpg";

import {
  loadTemplates,
  loadLogo,
  saveLogo,
  saveInstitutionName,
  loadInstitutionName,
  type FormatTemplate,
} from "@/lib/templates";
import {
  applyTemplate,
  validateDocxStructure,
  type ChangeReport,
  type DocDiagnostics,
  type PreflightFinding,
} from "@/lib/docx-processor";
import { PreflightDialog } from "@/components/PreflightDialog";
import { exportHtmlToPdf } from "@/lib/pdf-export";
import { DocumentPreview } from "@/components/DocumentPreview";
import { DiscrepancyAlert } from "@/components/DiscrepancyAlert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  loadGrades,
  loadSubjects,
  loadTeachers,
  sanitizeFileToken,
  type GradeOption,
  type SubjectOption,
  type TeacherOption,
} from "@/lib/catalog";

type Stage = "idle" | "processing" | "ready";

const SCHOOL_DEFAULT_NAME = "New Little College La Florida";

const Index = () => {
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [workingTemplate, setWorkingTemplate] = useState<FormatTemplate | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [showCustomization, setShowCustomization] = useState(false);

  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [originalHtml, setOriginalHtml] = useState<string>("");
  const [diagnostics, setDiagnostics] = useState<DocDiagnostics | null>(null);
  const [changes, setChanges] = useState<ChangeReport[]>([]);

  // Preflight: diálogo cuando el .docx tiene elementos riesgosos
  const [preflightOpen, setPreflightOpen] = useState(false);
  const [preflightFindings, setPreflightFindings] = useState<PreflightFinding[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // Campos para componer el nombre de archivo según la convención del colegio:
  // {prefijo}_N°{n}_{Asignatura}_{Curso}
  const [docNumber, setDocNumber] = useState("1");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [teacher, setTeacher] = useState("");
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  // Auto-cargar logo institucional la primera vez que se abre la app
  useEffect(() => {
    setTemplates(loadTemplates());
    setSubjects(loadSubjects());
    setGrades(loadGrades());
    setTeachers(loadTeachers());
    const existing = loadLogo();
    if (existing) {
      setLogo(existing);
    } else {
      // Convertir el logo importado a dataURL y guardarlo
      fetch(schoolLogo)
        .then((r) => r.blob())
        .then((blob) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            saveLogo(dataUrl);
            setLogo(dataUrl);
          };
          reader.readAsDataURL(blob);
        })
        .catch(() => {});
    }
    if (!loadInstitutionName()) saveInstitutionName(SCHOOL_DEFAULT_NAME);
  }, []);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId],
  );

  // Cuando cambia la plantilla seleccionada, resetear la versión "trabajo"
  useEffect(() => {
    if (selected) setWorkingTemplate({ ...selected });
  }, [selected]);

  const handleFile = async (file: File) => {
    if (!workingTemplate) {
      toast.error("Selecciona primero una plantilla");
      return;
    }
    setOriginalFile(file);

    // Preflight: validar estructura antes de procesar
    try {
      const buffer = await file.arrayBuffer();
      const preflight = await validateDocxStructure(buffer);
      if (!preflight.ok && preflight.fatal) {
        toast.error(preflight.fatal.message);
        return;
      }
      if (preflight.findings.length > 0) {
        // Pedir confirmación antes de procesar
        setPreflightFindings(preflight.findings);
        setPendingFile(file);
        setPreflightOpen(true);
        return;
      }
    } catch (e) {
      console.error(e);
      toast.error("No se pudo leer el archivo. Asegúrate de que sea un .docx válido.");
      return;
    }

    await processDocument(file, workingTemplate);
  };

  const handlePreflightConfirm = async () => {
    setPreflightOpen(false);
    if (pendingFile && workingTemplate) {
      const file = pendingFile;
      setPendingFile(null);
      await processDocument(file, workingTemplate);
    }
  };

  const handlePreflightCancel = () => {
    setPreflightOpen(false);
    setPendingFile(null);
    setPreflightFindings([]);
  };

  const showProcessingError = (e: unknown) => {
    const err = e as { name?: string; stage?: string; detail?: string; message?: string };
    const stage = err?.stage;
    const detail = err?.detail || err?.message || String(e);
    const technical = stage ? `[${stage}] ${detail}` : detail;
    const friendly = stage
      ? `Falló la pasada "${stage}". ${detail}`
      : `No se pudo procesar el documento. Detalle técnico: ${detail}`;

    toast.error(friendly, {
      duration: 12000,
      action: {
        label: "Copiar detalle",
        onClick: () => {
          navigator.clipboard?.writeText(technical).then(
            () => toast.success("Detalle técnico copiado"),
            () => toast.error("No se pudo copiar"),
          );
        },
      },
    });
  };

  const processDocument = async (file: File, template: FormatTemplate) => {
    setStage("processing");
    setProgress(15);
    try {
      const buffer = await file.arrayBuffer();
      // Buffer separado para mammoth del original (mammoth consume el buffer)
      const originalBufferForPreview = buffer.slice(0);
      setProgress(30);
      // Resolver labels legibles para el banner (no los `value` sanitizados)
      const teacherLabel = teachers.find((x) => x.value === teacher)?.label ?? "";
      const subjectLabel = subjects.find((x) => x.value === subject)?.label ?? "";
      const gradeLabel = grades.find((x) => x.value === grade)?.label ?? "";

      // Procesar y renderizar original en paralelo
      const [result, originalHtmlRes] = await Promise.all([
        applyTemplate(buffer, template, logo, {
          teacherLabel,
          subjectLabel,
          gradeLabel,
        }),
        mammoth.convertToHtml({ arrayBuffer: originalBufferForPreview }).catch(() => ({ value: "" })),
      ]);
      setProgress(75);
      const previewBuffer = await result.blob.arrayBuffer();
      const html = await mammoth.convertToHtml({ arrayBuffer: previewBuffer });
      setProgress(95);
      setResultBlob(result.blob);
      setPreviewHtml(html.value);
      setOriginalHtml(originalHtmlRes.value);
      setDiagnostics(result.diagnostics);
      setChanges(result.changes);
      setProgress(100);
      setStage("ready");
      toast.success("Documento estandarizado correctamente");
    } catch (e) {
      console.error(e);
      showProcessingError(e);
      setStage("idle");
      setProgress(0);
    }
  };

  const handleReprocess = async () => {
    if (originalFile && workingTemplate) await processDocument(originalFile, workingTemplate);
  };

  // Construir el nombre estandarizado del archivo según la convención del colegio
  const buildStandardFileName = (): string => {
    const prefix = workingTemplate?.fileNaming?.prefix;
    if (prefix && (subject.trim() || grade.trim() || docNumber.trim() || teacher.trim())) {
      const n = docNumber.trim() || "1";
      const subj = sanitizeFileToken(subject);
      const grd = sanitizeFileToken(grade);
      const tch = sanitizeFileToken(teacher);
      const parts = [prefix, `N°${n}`, subj || "Asignatura", grd || "Curso"];
      if (tch) parts.push(tch);
      return parts.join("_");
    }
    // Sin datos del paso 3: añadir marca de tiempo para evitar colisiones de caché
    const base = (originalFile?.name.replace(/\.docx$/i, "") ?? "documento") + " - estandarizado";
    const now = new Date();
    const stamp = `${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
    return `${base} ${stamp}`;
  };

  const handleDownloadDocx = () => {
    if (!resultBlob) return;
    // Crear un Blob nuevo siempre para evitar caché del navegador
    const fresh = new Blob([resultBlob], { type: resultBlob.type });
    saveAs(fresh, `${buildStandardFileName()}.docx`);
  };

  const handleDownloadPdf = () => {
    if (!previewHtml) return;
    try {
      exportHtmlToPdf(previewHtml, buildStandardFileName());
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleReset = () => {
    setOriginalFile(null);
    setResultBlob(null);
    setPreviewHtml("");
    setOriginalHtml("");
    setDiagnostics(null);
    setChanges([]);
    setStage("idle");
    setProgress(0);
  };

  return (
    <AppLayout>
      <PreflightDialog
        open={preflightOpen}
        fileName={pendingFile?.name}
        findings={preflightFindings}
        onConfirm={handlePreflightConfirm}
        onCancel={handlePreflightCancel}
      />
      {/* Hero */}
      <section className="mb-8 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            {logo && (
              <img
                src={logo}
                alt="Logo del colegio"
                className="h-14 w-14 object-contain rounded-md border border-border bg-white p-1"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Estandarizador de documentos
              </h1>
              <p className="text-muted-foreground mt-1.5">
                Elige una plantilla, sube un .docx y descárgalo con el formato unificado del colegio.
              </p>
            </div>
          </div>
          <Link to="/configuracion">
            <Button variant="outline" size="sm" className="gap-2">
              <Settings className="h-4 w-4" />
              Configuración
            </Button>
          </Link>
        </div>
      </section>

      {/* Step 1: Select template */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Badge className="bg-primary text-primary-foreground">1</Badge>
          <h2 className="text-lg font-semibold text-foreground">Elige una plantilla</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              selected={t.id === selectedId}
              onSelect={() => setSelectedId(t.id)}
            />
          ))}
        </div>
      </section>

      {/* Step 2: Customize (opcional) */}
      {workingTemplate && (
        <section className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge className="bg-primary text-primary-foreground">2</Badge>
              <h2 className="text-lg font-semibold text-foreground">Personaliza (opcional)</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCustomization((v) => !v)}
            >
              {showCustomization ? "Ocultar opciones" : "Ajustar parámetros"}
            </Button>
          </div>
          {showCustomization && (
            <TemplateEditor template={workingTemplate} onChange={setWorkingTemplate} />
          )}
        </section>
      )}

      {/* Step 3: Datos para nombre de archivo (convención del colegio) */}
      {workingTemplate?.fileNaming?.enabled && (
        <section className="mb-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Badge className="bg-primary text-primary-foreground">3</Badge>
            <h2 className="text-lg font-semibold text-foreground">Nombre del archivo</h2>
          </div>
          <Card className="shadow-card">
            <CardContent className="pt-6 space-y-4">
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="docnum" className="text-xs">Número</Label>
                  <Input
                    id="docnum"
                    value={docNumber}
                    onChange={(e) => setDocNumber(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-xs">Asignatura</Label>
                  <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger id="subject">
                      <SelectValue placeholder="Selecciona asignatura" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grade" className="text-xs">Curso</Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger id="grade">
                      <SelectValue placeholder="Selecciona curso" />
                    </SelectTrigger>
                    <SelectContent>
                      {grades.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="teacher" className="text-xs">Docente</Label>
                <Select value={teacher} onValueChange={setTeacher}>
                  <SelectTrigger id="teacher">
                    <SelectValue placeholder="Selecciona docente (queda registrado en el archivo)" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-md bg-muted/40 border border-border px-3 py-2 text-sm">
                <span className="text-muted-foreground">Nombre final:</span>{" "}
                <span className="font-mono font-medium text-foreground">
                  {buildStandardFileName()}.docx
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{workingTemplate.fileNaming.hint}</p>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Step 4: Upload + result */}
      {workingTemplate && (
        <section className="mb-8 animate-fade-in">
          <div className="flex items-center gap-2 mb-4">
            <Badge className="bg-primary text-primary-foreground">
              {workingTemplate.fileNaming?.enabled ? 4 : 3}
            </Badge>
            <h2 className="text-lg font-semibold text-foreground">Sube el documento</h2>
          </div>

          {stage === "idle" && <FileDropzone onFile={handleFile} />}

          {stage === "processing" && (
            <Card className="shadow-card">
              <CardContent className="py-10 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <div className="text-center">
                  <div className="font-medium">Aplicando formato…</div>
                  <div className="text-sm text-muted-foreground">
                    Procesando {originalFile?.name} en tu navegador
                  </div>
                </div>
                <Progress value={progress} className="w-full max-w-md" />
              </CardContent>
            </Card>
          )}

          {stage === "ready" && (
            <div className="space-y-6">
              {/* Acciones superiores */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-foreground">Vista previa</h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleReprocess} className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Reaplicar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleReset}>
                    Otro archivo
                  </Button>
                </div>
              </div>

              {/* Reporte de auto-QA del servidor (elemento principal) */}
              {diagnostics && (
                <DiscrepancyAlert diagnostics={diagnostics} />
              )}

              {/* Comparación detallada (opcional, colapsada por defecto) */}
              <Collapsible>
                <CollapsibleTrigger className="group flex w-full items-center justify-between rounded-md border border-border bg-muted/30 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
                  <span>Ver comparación detallada (opcional)</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <DocumentPreview
                    originalHtml={originalHtml}
                    processedHtml={previewHtml}
                    originalFileName={originalFile?.name}
                    processedFileName={`${buildStandardFileName()}.docx`}
                    template={workingTemplate}
                    originalPages={diagnostics?.originalPages}
                    processedPages={diagnostics?.processedPages}
                  />
                </CollapsibleContent>
              </Collapsible>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Botones de descarga */}
                <Card className="lg:col-span-2 shadow-card">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Button onClick={handleDownloadDocx} className="gap-2 bg-gradient-primary">
                        <Download className="h-4 w-4" />
                        Descargar .docx
                      </Button>
                      <Button onClick={handleDownloadPdf} variant="outline" className="gap-2">
                        <FileDown className="h-4 w-4" />
                        Exportar a PDF
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Si no ves los cambios, asegúrate de abrir la versión recién descargada (no el archivo original).
                    </p>
                  </CardContent>
                </Card>

                {/* Reporte de cambios */}
                <Card className="shadow-card h-fit">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-accent" />
                      Cambios aplicados
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {changes.map((c, i) => (
                        <li key={i} className="border-l-2 border-primary pl-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                            {c.category}
                          </div>
                          <div className="text-sm text-foreground mt-0.5">{c.description}</div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </section>
      )}

      {!workingTemplate && (
        <Card className="shadow-card border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Selecciona una plantilla arriba para comenzar.
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
};

export default Index;
