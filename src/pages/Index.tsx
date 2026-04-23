import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import mammoth from "mammoth";
import { saveAs } from "file-saver";
import { Download, FileDown, Loader2, RefreshCw, Settings, Sparkles } from "lucide-react";

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
import { applyTemplate, type ChangeReport } from "@/lib/docx-processor";
import { exportHtmlToPdf } from "@/lib/pdf-export";
import {
  loadGrades,
  loadSubjects,
  sanitizeFileToken,
  type GradeOption,
  type SubjectOption,
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
  const [changes, setChanges] = useState<ChangeReport[]>([]);

  // Campos para componer el nombre de archivo según la convención del colegio:
  // {prefijo}_N°{n}_{Asignatura}_{Curso}
  const [docNumber, setDocNumber] = useState("1");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");

  // Auto-cargar logo institucional la primera vez que se abre la app
  useEffect(() => {
    setTemplates(loadTemplates());
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
    await processDocument(file, workingTemplate);
  };

  const processDocument = async (file: File, template: FormatTemplate) => {
    setStage("processing");
    setProgress(15);
    try {
      const buffer = await file.arrayBuffer();
      setProgress(40);
      const result = await applyTemplate(buffer, template, logo);
      setProgress(75);
      const previewBuffer = await result.blob.arrayBuffer();
      const html = await mammoth.convertToHtml({ arrayBuffer: previewBuffer });
      setProgress(95);
      setResultBlob(result.blob);
      setPreviewHtml(html.value);
      setChanges(result.changes);
      setProgress(100);
      setStage("ready");
      toast.success("Documento estandarizado correctamente");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo procesar el documento. ¿Es un .docx válido?");
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
    if (prefix && (subject.trim() || grade.trim() || docNumber.trim())) {
      const n = docNumber.trim() || "1";
      const subj = subject.trim().replace(/\s+/g, "");
      const grd = grade.trim().replace(/\s+/g, "");
      const parts = [prefix, `N°${n}`, subj || "Asignatura", grd || "Curso"];
      return parts.join("_");
    }
    return (originalFile?.name.replace(/\.docx$/i, "") ?? "documento") + " - estandarizado";
  };

  const handleDownloadDocx = () => {
    if (!resultBlob) return;
    saveAs(resultBlob, `${buildStandardFileName()}.docx`);
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
    setChanges([]);
    setStage("idle");
    setProgress(0);
  };

  return (
    <AppLayout>
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
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Historia"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grade" className="text-xs">Curso</Label>
                  <Input
                    id="grade"
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    placeholder="7Básico"
                  />
                </div>
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
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Preview */}
              <Card className="lg:col-span-2 shadow-card">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base">Vista previa</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReprocess} className="gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reaplicar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      Otro archivo
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border border-border bg-white shadow-inner overflow-hidden">
                    <div
                      className="docx-preview p-8 max-h-[640px] overflow-y-auto prose prose-sm max-w-none"
                      style={{
                        fontFamily: workingTemplate.typography.bodyFont,
                        textAlign: workingTemplate.body.alignment,
                      }}
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                    <Button onClick={handleDownloadDocx} className="gap-2 bg-gradient-primary">
                      <Download className="h-4 w-4" />
                      Descargar .docx
                    </Button>
                    <Button onClick={handleDownloadPdf} variant="outline" className="gap-2">
                      <FileDown className="h-4 w-4" />
                      Exportar a PDF
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Changes report */}
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
