import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  ScanLine,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useUserUsage } from "@/hooks/useUserUsage";
import { listAssessments } from "@/lib/assessment-storage";
import { listAllStudents, type Student } from "@/lib/courses";
import { formatRut } from "@/lib/rut";
import { buildAnswerSlots, type AnswerSlot, type OptionLetter } from "@/lib/omr-geometry";
import { scanOmrSheet, type ScanMark } from "@/lib/omr-scan";
import {
  DEFAULT_GRADING,
  deleteGrading,
  gradeMarks,
  listGradings,
  saveGrading,
  summarizeGradings,
  type GradingSettings,
  type SavedGrading,
} from "@/lib/grading";
import type { Assessment } from "@/lib/assessment-schema";

const SETTINGS_KEY = "pruebalista:grading-settings";

interface SheetDraft {
  id: string;
  fileName: string;
  studentName: string;
  studentRut: string;
  marks: ScanMark[];
  confidence: number;
  warnings: string[];
  previewDataUrl: string;
  saving: boolean;
  saved: boolean;
  expanded: boolean;
}

const OPTION_VALUES: OptionLetter[] = ["A", "B", "C", "D", "E"];

function loadSettings(assessmentId: string): GradingSettings {
  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY}:${assessmentId}`);
    if (raw) return { ...DEFAULT_GRADING, ...JSON.parse(raw) };
  } catch {
    /* noop */
  }
  return DEFAULT_GRADING;
}

function persistSettings(assessmentId: string, s: GradingSettings) {
  try {
    localStorage.setItem(`${SETTINGS_KEY}:${assessmentId}`, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

const CorregirPruebas = () => {
  const { canUseOmr } = useUserUsage();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [assessmentId, setAssessmentId] = useState<string>("");
  const [settings, setSettings] = useState<GradingSettings>(DEFAULT_GRADING);
  const [students, setStudents] = useState<Student[]>([]);
  const [drafts, setDrafts] = useState<SheetDraft[]>([]);
  const [processing, setProcessing] = useState(false);
  const [history, setHistory] = useState<SavedGrading[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const assessment = useMemo(
    () => assessments.find((a) => a.id === assessmentId) ?? null,
    [assessments, assessmentId],
  );
  const slots: AnswerSlot[] = useMemo(
    () => (assessment ? buildAnswerSlots(assessment) : []),
    [assessment],
  );
  const gradableSlots = useMemo(() => slots.filter((s) => s.expected !== null).length, [slots]);

  useEffect(() => {
    listAssessments()
      .then((list) => setAssessments(list))
      .catch((e) => toast.error((e as Error).message));
    listAllStudents()
      .then(setStudents)
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    if (!assessmentId) return;
    setSettings(loadSettings(assessmentId));
    setDrafts([]);
    setLoadingHistory(true);
    listGradings(assessmentId)
      .then(setHistory)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoadingHistory(false));
  }, [assessmentId]);

  const updateSettings = (patch: Partial<GradingSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (assessmentId) persistSettings(assessmentId, next);
      return next;
    });
  };

  const findStudentByRut = useCallback(
    (rut: string | null) => {
      if (!rut) return null;
      const clean = rut.replace(/[.\-\s]/g, "").toUpperCase();
      return (
        students.find((s) => s.rut.replace(/[.\-\s]/g, "").toUpperCase() === clean) ?? null
      );
    },
    [students],
  );

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!assessment) {
      toast.error("Primero selecciona la prueba a corregir.");
      return;
    }
    setProcessing(true);
    const list = Array.from(files);
    for (const file of list) {
      try {
        const scan = await scanOmrSheet(file, assessment);
        if (scan.assessmentId && scan.assessmentId !== assessment.id) {
          const other = assessments.find((a) => a.id === scan.assessmentId);
          toast.error(
            other
              ? `"${file.name}" pertenece a otra prueba: ${other.meta.title || "sin título"}.`
              : `"${file.name}" pertenece a otra prueba (ID ${scan.assessmentId.slice(0, 8)}).`,
          );
          continue;
        }
        const student = findStudentByRut(scan.rut);
        setDrafts((prev) => [
          ...prev,
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            fileName: file.name,
            studentName: student ? `${student.last_name}, ${student.first_name}` : "",
            studentRut: scan.rut ? formatRut(scan.rut) : "",
            marks: scan.marks,
            confidence: scan.confidence,
            warnings: scan.warnings,
            previewDataUrl: scan.previewDataUrl,
            saving: false,
            saved: false,
            expanded: false,
          },
        ]);
      } catch (e) {
        toast.error(`${file.name}: ${(e as Error).message}`);
      }
    }
    setProcessing(false);
    if (fileRef.current) fileRef.current.value = "";
    if (cameraRef.current) cameraRef.current.value = "";
  };

  const patchDraft = (id: string, patch: Partial<SheetDraft>) =>
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const setMark = (draftId: string, slotIndex: number, value: OptionLetter | null) =>
    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draftId
          ? {
              ...d,
              marks: d.marks.map((m) =>
                m.slotIndex === slotIndex ? { ...m, marked: value, ambiguous: false } : m,
              ),
            }
          : d,
      ),
    );

  const handleSave = async (draft: SheetDraft) => {
    if (!assessment) return;
    patchDraft(draft.id, { saving: true });
    try {
      const result = gradeMarks(slots, draft.marks, settings);
      await saveGrading({
        assessmentId: assessment.id,
        assessmentTitle: assessment.meta.title || "Evaluación",
        studentName: draft.studentName.trim() || null,
        studentRut: draft.studentRut.trim() || null,
        courseLabel: assessment.meta.course ?? null,
        settings,
        result,
        confidence: draft.confidence,
      });
      patchDraft(draft.id, { saved: true, saving: false });
      const rows = await listGradings(assessment.id);
      setHistory(rows);
      toast.success("Corrección guardada.");
    } catch (e) {
      patchDraft(draft.id, { saving: false });
      toast.error((e as Error).message);
    }
  };

  const handleSaveAll = async () => {
    for (const d of drafts.filter((x) => !x.saved)) {
      // eslint-disable-next-line no-await-in-loop
      await handleSave(d);
    }
  };

  const handleDeleteGrading = async (id: string) => {
    try {
      await deleteGrading(id);
      setHistory((prev) => prev.filter((r) => r.id !== id));
      toast.success("Resultado eliminado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const stats = useMemo(() => summarizeGradings(history), [history]);

  if (!canUseOmr) {
    return (
      <AppLayout>
        <div className="container mx-auto max-w-3xl px-4 py-10">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="h-5 w-5 text-primary" /> Corrección automática por foto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Tu plan actual no incluye hojas de respuesta OMR ni corrección automática.
                Con esta función imprimes la hoja, tomas una foto y obtienes la nota al instante,
                sin consumir créditos de IA.
              </p>
              <Button asChild>
                <a href="/precios">Ver planes</a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto max-w-5xl px-4 py-6 space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ScanLine className="h-6 w-6 text-primary" /> Corregir por foto
          </h1>
          <p className="text-sm text-muted-foreground">
            Sube una foto por hoja de respuestas. La corrección se hace en tu dispositivo y
            no consume créditos de IA.
          </p>
        </header>

        {/* 1. Prueba y configuración */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">1. Prueba y escala de notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Prueba</Label>
                <Select value={assessmentId} onValueChange={setAssessmentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una prueba" />
                  </SelectTrigger>
                  <SelectContent>
                    {assessments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.meta.title || "Sin título"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Exigencia para nota 4,0 (%)</Label>
                <Input
                  type="number"
                  min={10}
                  max={99}
                  value={settings.passingPercent}
                  onChange={(e) =>
                    updateSettings({ passingPercent: Number(e.target.value) || DEFAULT_GRADING.passingPercent })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nota máxima</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.maxGrade}
                  onChange={(e) => updateSettings({ maxGrade: Number(e.target.value) || DEFAULT_GRADING.maxGrade })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nota mínima</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={settings.minGrade}
                  onChange={(e) => updateSettings({ minGrade: Number(e.target.value) || DEFAULT_GRADING.minGrade })}
                />
              </div>
            </div>
            {assessment && (
              <p className="text-xs text-muted-foreground">
                {gradableSlots} respuesta(s) con alternativa correcta definida
                {slots.length !== gradableSlots ? ` de ${slots.length} en la hoja` : ""}. Las
                preguntas de desarrollo se corrigen a mano.
              </p>
            )}
          </CardContent>
        </Card>

        {/* 2. Fotos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">2. Fotos de las hojas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => cameraRef.current?.click()} disabled={!assessment || processing}>
                <Camera className="mr-2 h-4 w-4" /> Tomar foto
              </Button>
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={!assessment || processing}
              >
                <Upload className="mr-2 h-4 w-4" /> Subir imágenes
              </Button>
              {processing && (
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Procesando…
                </span>
              )}
            </div>
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <p className="text-xs text-muted-foreground">
              Una foto por hoja. Encuadra la hoja completa, incluyendo los 4 cuadrados negros de
              las esquinas y el código QR, con buena luz y sin sombras.
            </p>
          </CardContent>
        </Card>

        {/* 3. Resultados detectados */}
        {drafts.length > 0 && (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
              <CardTitle className="text-base">3. Revisar y guardar</CardTitle>
              <Button size="sm" onClick={handleSaveAll} disabled={drafts.every((d) => d.saved)}>
                <Save className="mr-2 h-4 w-4" /> Guardar todo
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {drafts.map((draft) => {
                const result = gradeMarks(slots, draft.marks, settings);
                return (
                  <div key={draft.id} className="rounded-lg border p-3 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="grid flex-1 gap-2 sm:grid-cols-2 min-w-[240px]">
                        <div className="space-y-1">
                          <Label className="text-xs">Alumno</Label>
                          <Input
                            value={draft.studentName}
                            placeholder="Apellido, Nombre"
                            onChange={(e) => patchDraft(draft.id, { studentName: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">RUT</Label>
                          <Input
                            value={draft.studentRut}
                            placeholder="12.345.678-9"
                            onChange={(e) => patchDraft(draft.id, { studentRut: e.target.value })}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">
                          {result.grade.toFixed(1)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.correct} correctas · {result.incorrect} incorrectas ·{" "}
                          {result.blank} en blanco
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {result.scorePercent}% de logro
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Badge variant="outline">{draft.fileName}</Badge>
                      <Badge variant="outline">
                        Confianza {Math.round(draft.confidence * 100)}%
                      </Badge>
                      {draft.warnings.map((w) => (
                        <span key={w} className="flex items-center gap-1 text-amber-600">
                          <TriangleAlert className="h-3 w-3" /> {w}
                        </span>
                      ))}
                      {draft.saved && (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle2 className="h-3 w-3" /> Guardada
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => patchDraft(draft.id, { expanded: !draft.expanded })}
                      >
                        {draft.expanded ? (
                          <ChevronUp className="mr-2 h-4 w-4" />
                        ) : (
                          <ChevronDown className="mr-2 h-4 w-4" />
                        )}
                        Detalle respuesta por respuesta
                      </Button>
                      <Button size="sm" onClick={() => handleSave(draft)} disabled={draft.saving || draft.saved}>
                        {draft.saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Guardar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => setDrafts((prev) => prev.filter((d) => d.id !== draft.id))}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Descartar
                      </Button>
                    </div>

                    {draft.expanded && (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {result.answers.map((a) => {
                          const slot = slots[a.slotIndex];
                          const isTf = slot?.kind === "tf";
                          const optionCount = slot?.optionCount ?? 5;
                          return (
                            <div
                              key={a.slotIndex}
                              className={`flex items-center gap-2 rounded border px-2 py-1 text-xs ${
                                a.expected === null
                                  ? "border-dashed"
                                  : a.isCorrect
                                    ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/30"
                                    : "border-red-500/50 bg-red-50/50 dark:bg-red-950/30"
                              }`}
                            >
                              <span className="w-8 font-mono font-semibold">{a.num}.</span>
                              <Select
                                value={a.marked ?? "blank"}
                                onValueChange={(v) =>
                                  setMark(draft.id, a.slotIndex, v === "blank" ? null : (v as OptionLetter))
                                }
                              >
                                <SelectTrigger className="h-7 w-20 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="blank">—</SelectItem>
                                  {OPTION_VALUES.slice(0, optionCount).map((o, i) => (
                                    <SelectItem key={o} value={o}>
                                      {isTf ? (i === 0 ? "V" : "F") : o}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <span className="text-muted-foreground">
                                {a.expected
                                  ? `correcta: ${isTf ? (a.expected === "A" ? "V" : "F") : a.expected}`
                                  : "sin pauta"}
                              </span>
                              {a.ambiguous && <TriangleAlert className="h-3 w-3 text-amber-600" />}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* 4. Resultados guardados */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Resultados guardados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!assessmentId && (
              <p className="text-sm text-muted-foreground">Selecciona una prueba para ver sus resultados.</p>
            )}
            {loadingHistory && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
              </p>
            )}
            {stats && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Corregidas", value: stats.count },
                  { label: "Promedio", value: stats.average.toFixed(1) },
                  { label: "Aprobación", value: `${stats.approvalRate}%` },
                  { label: "Rango", value: `${stats.worst.toFixed(1)} – ${stats.best.toFixed(1)}` },
                ].map((s) => (
                  <div key={s.label} className="rounded-lg border p-3 text-center">
                    <div className="text-xl font-bold">{s.value}</div>
                    <div className="text-xs text-muted-foreground">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            {assessmentId && !loadingHistory && history.length === 0 && (
              <p className="text-sm text-muted-foreground">Aún no hay hojas corregidas para esta prueba.</p>
            )}
            {history.length > 0 && (
              <div className="divide-y rounded-lg border">
                {history.map((row) => (
                  <div key={row.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {row.student_name || row.student_rut || "Sin identificar"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {row.correct_count}/{row.total_slots} correctas ·{" "}
                        {Number(row.score_percent)}% · exigencia {row.passing_percent}% ·{" "}
                        {new Date(row.created_at).toLocaleDateString("es-CL")}
                      </div>
                    </div>
                    <Badge
                      className={
                        Number(row.grade) >= 4
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }
                    >
                      {Number(row.grade).toFixed(1)}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDeleteGrading(row.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <Separator />
            <p className="text-xs text-muted-foreground">
              Por ahora, los resultados de corrección son visibles solo para ti (el docente que
              los cargó).
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CorregirPruebas;
