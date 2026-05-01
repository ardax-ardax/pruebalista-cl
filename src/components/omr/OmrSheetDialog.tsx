import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  listCourses,
  listStudentsByCourse,
  type Course,
  type Student,
} from "@/lib/courses";
import { renderOmrDocument, openOmrPrintWindow } from "@/lib/omr-sheet";
import type { Assessment } from "@/lib/assessment-schema";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assessment: Assessment;
  institutionName: string;
}

type Mode = "training" | "operational";

export const OmrSheetDialog = ({ open, onOpenChange, assessment, institutionName }: Props) => {
  const [mode, setMode] = useState<Mode>("training");
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoadingCourses(true);
    listCourses()
      .then((cs) => setCourses(cs))
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoadingCourses(false));
  }, [open]);

  useEffect(() => {
    if (mode !== "operational" || !courseId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    listStudentsByCourse(courseId)
      .then((s) => setStudents(s))
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoadingStudents(false));
  }, [mode, courseId]);

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId],
  );

  const handlePrint = async () => {
    setPrinting(true);
    try {
      const html = renderOmrDocument(
        assessment,
        {
          institutionName,
          assessmentTitle: assessment.meta.title || "Evaluación",
          assessmentId: assessment.id,
          courseName: selectedCourse?.name,
        },
        mode === "operational" ? students : null,
      );
      openOmrPrintWindow(html);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPrinting(false);
    }
  };

  const canPrint =
    mode === "training" ||
    (mode === "operational" && courseId !== "" && students.length > 0 && !loadingStudents);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-4 w-4" /> Hoja de Respuestas (OMR)
          </DialogTitle>
          <DialogDescription>
            Imprime una hoja de respuestas con marcas fiduciales y burbujas calibradas en milímetros, lista para escaneo automático.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Modo de impresión</Label>
            <RadioGroup
              value={mode}
              onValueChange={(v) => setMode(v as Mode)}
              className="mt-2 grid grid-cols-1 gap-2"
            >
              <label className="flex items-start gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="training" className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Entrenamiento (en blanco)</div>
                  <p className="text-xs text-muted-foreground">
                    Una sola hoja vacía. El alumno escribe nombre y RUT a mano.
                  </p>
                </div>
              </label>
              <label className="flex items-start gap-2 rounded-md border border-border p-3 cursor-pointer hover:bg-muted/40">
                <RadioGroupItem value="operational" className="mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium">Operacional (pre-rellena)</div>
                  <p className="text-xs text-muted-foreground">
                    Una hoja por alumno con nombre, curso y RUT impresos.
                  </p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {mode === "operational" && (
            <div>
              <Label className="text-xs">Curso</Label>
              <Select value={courseId} onValueChange={setCourseId} disabled={loadingCourses}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCourses ? "Cargando…" : "Selecciona curso"} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} · {c.level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {courseId && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {loadingStudents ? (
                    <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Cargando alumnos…</span>
                  ) : (
                    `${students.length} alumno${students.length === 1 ? "" : "s"} en este curso`
                  )}
                </p>
              )}
            </div>
          )}

          <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
            <strong className="text-foreground">Vista técnica:</strong> A4 vertical, 4 marcas fiduciales (10 mm),
            burbujas A–E ({" "}
            {assessment.questions.filter((q) => q.type !== "section-title" && q.type !== "info-block").length}
            {" "}preguntas), bloque RUT con dígito verificador. ID de prueba:{" "}
            <code className="font-mono">{assessment.id.slice(0, 8)}</code>.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={printing}>Cancelar</Button>
          <Button onClick={handlePrint} disabled={!canPrint || printing}>
            <Printer className="h-4 w-4" />
            {printing ? "Abriendo…" : "Imprimir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
