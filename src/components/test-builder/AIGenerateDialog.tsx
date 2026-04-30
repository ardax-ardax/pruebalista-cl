import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateQuestion } from "@/lib/assessment-ai";
import { findOA } from "@/lib/curriculum-data";
import type { Question, QuestionType } from "@/lib/assessment-schema";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  linkedOA: string[];
  gradeValue: string;
  gradeLabel: string;
  subjectValue: string;
  subjectLabel: string;
  onGenerated: (q: Question) => void;
}

type SupportedType = Extract<QuestionType, "multiple-choice" | "true-false" | "short-answer">;

export const AIGenerateDialog = ({
  open, onOpenChange, linkedOA, gradeValue, gradeLabel, subjectValue, subjectLabel, onGenerated,
}: Props) => {
  const [oaCode, setOaCode] = useState<string>(linkedOA[0] ?? "");
  const [type, setType] = useState<SupportedType>("multiple-choice");
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!oaCode) { toast.error("Selecciona un OA"); return; }
    const oa = findOA(gradeValue, subjectValue, oaCode);
    if (!oa) { toast.error("OA no encontrado"); return; }
    setLoading(true);
    try {
      const q = await generateQuestion({
        oaCode: oa.code,
        oaDescription: oa.description,
        gradeLabel,
        subjectLabel,
        questionType: type,
      });
      onGenerated(q);
      toast.success("Pregunta generada");
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const noOA = linkedOA.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Generar pregunta con IA
          </DialogTitle>
          <DialogDescription>
            La IA propone una pregunta alineada al OA seleccionado. Podrás editarla luego.
          </DialogDescription>
        </DialogHeader>

        {noOA ? (
          <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            Aún no has vinculado OAs a esta evaluación. Ve a la pestaña <strong>Datos</strong> y selecciona al menos un Objetivo de Aprendizaje.
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Objetivo de Aprendizaje</Label>
              <Select value={oaCode} onValueChange={setOaCode}>
                <SelectTrigger><SelectValue placeholder="Selecciona OA" /></SelectTrigger>
                <SelectContent>
                  {linkedOA.map((code) => {
                    const oa = findOA(gradeValue, subjectValue, code);
                    return (
                      <SelectItem key={code} value={code}>
                        {code}{oa ? ` — ${oa.description.slice(0, 80)}${oa.description.length > 80 ? "…" : ""}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo de pregunta</Label>
              <Select value={type} onValueChange={(v) => setType(v as SupportedType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple-choice">Selección múltiple</SelectItem>
                  <SelectItem value="true-false">Verdadero / Falso</SelectItem>
                  <SelectItem value="short-answer">Desarrollo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={loading || noOA}>
            <Sparkles className="h-4 w-4" /> {loading ? "Generando…" : "Generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
