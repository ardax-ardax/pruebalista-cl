import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Ban, Coins } from "lucide-react";
import { toast } from "sonner";
import { generateQuestion } from "@/lib/assessment-ai";
import { findOA } from "@/lib/curriculum-data";
import { useAIEnabled } from "@/hooks/useAIEnabled";
import type { Question, QuestionType } from "@/lib/assessment-schema";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  linkedOA: string[];
  gradeValue: string;
  gradeLabel: string;
  subjectValue: string;
  subjectLabel: string;
  essayMode?: "simce" | "paes" | null;
  onGenerated: (q: Question) => void;
  creditsAvailable?: number;
  onCreditsUsed?: () => void;
  defaultMcOptions?: number;
  defaultTfStatements?: number;
}

type SupportedType = Extract<QuestionType, "multiple-choice" | "true-false" | "short-answer">;

export const AIGenerateDialog = ({
  open, onOpenChange, linkedOA, gradeValue, gradeLabel, subjectValue, subjectLabel, essayMode, onGenerated,
  creditsAvailable, onCreditsUsed, defaultMcOptions = 4, defaultTfStatements = 3,
}: Props) => {
  const [oaCode, setOaCode] = useState<string>(linkedOA[0] ?? "");
  const [type, setType] = useState<SupportedType>("multiple-choice");
  const [selectedIndicators, setSelectedIndicators] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { aiEnabled, reason: aiDisabledReason, loading: aiLoading } = useAIEnabled();

  const oa = useMemo(
    () => (oaCode ? findOA(gradeValue, subjectValue, oaCode) : undefined),
    [oaCode, gradeValue, subjectValue],
  );
  const indicators = oa?.indicators ?? [];

  useEffect(() => { setSelectedIndicators([]); }, [oaCode]);

  useEffect(() => {
    if (oaCode && !linkedOA.includes(oaCode)) setOaCode(linkedOA[0] ?? "");
  }, [linkedOA, oaCode]);

  useEffect(() => {
    if ((essayMode === "paes" || essayMode === "simce") && type !== "multiple-choice") {
      setType("multiple-choice");
    }
  }, [essayMode, type]);

  const toggleIndicator = (code: string, checked: boolean) => {
    setSelectedIndicators((prev) =>
      checked ? [...prev, code] : prev.filter((c) => c !== code),
    );
  };

  const noCredits = creditsAvailable !== undefined && creditsAvailable <= 0;

  const handleGenerate = async () => {
    if (!oaCode) { toast.error("Selecciona un OA"); return; }
    if (!oa) { toast.error("OA no encontrado"); return; }
    if (noCredits) { toast.error("No tienes créditos disponibles"); return; }
    setLoading(true);
    try {
      const chosen = indicators.filter((i) => selectedIndicators.includes(i.code));
      const q = await generateQuestion({
        oaCode: oa.code,
        oaDescription: oa.description,
        gradeLabel,
        subjectLabel,
        questionType: type,
        indicators: chosen.length > 0 ? chosen : undefined,
      });
      onGenerated(q);
      onCreditsUsed?.();
      toast.success(
        chosen.length > 0
          ? `Pregunta generada (enfoque en ${chosen.length} indicador${chosen.length === 1 ? "" : "es"})`
          : "Pregunta generada · Se descontó 1 crédito",
      );
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

        {/* Créditos disponibles */}
        {creditsAvailable !== undefined && (
          <div className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${noCredits ? "border-destructive bg-destructive/10 text-destructive" : "border-border bg-muted/50 text-muted-foreground"}`}>
            <Coins className="h-4 w-4" />
            <span>Créditos disponibles: <strong>{creditsAvailable}</strong></span>
            {noCredits && <span className="ml-auto text-xs">Necesitas créditos para generar preguntas</span>}
          </div>
        )}

        {!aiEnabled && !aiLoading ? (
          <Alert variant="destructive">
            <Ban className="h-4 w-4" />
            <AlertDescription className="whitespace-pre-wrap">{aiDisabledReason}</AlertDescription>
          </Alert>
        ) : noOA ? (
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
                    const o = findOA(gradeValue, subjectValue, code);
                    return (
                      <SelectItem key={code} value={code}>
                        {code}{o ? ` — ${o.description.slice(0, 80)}${o.description.length > 80 ? "…" : ""}` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {oaCode && (
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Indicadores de Evaluación (opcional)</Label>
                  <span className="text-xs text-muted-foreground">
                    {selectedIndicators.length}/{indicators.length}
                  </span>
                </div>
                {indicators.length === 0 ? (
                  <p className="text-xs text-muted-foreground rounded-md border border-dashed border-border p-3 mt-1">
                    Este OA aún no tiene indicadores cargados. La IA usará el OA completo.
                  </p>
                ) : (
                  <div className="mt-1 space-y-1 rounded-md border border-border p-2 max-h-48 overflow-y-auto">
                    {indicators.map((i) => {
                      const checked = selectedIndicators.includes(i.code);
                      return (
                        <label key={i.code} className="flex items-start gap-2 cursor-pointer hover:bg-muted/50 rounded p-1">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) => toggleIndicator(i.code, !!v)}
                            className="mt-0.5"
                          />
                          <div className="text-xs leading-snug">
                            <span className="font-semibold">{i.code}</span>
                            <span className="ml-1 text-muted-foreground">{i.description}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Si no seleccionas indicadores, la IA evalúa el OA en general.
                </p>
              </div>
            )}

            <div>
              <Label className="text-xs">Tipo de pregunta</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as SupportedType)}
                disabled={essayMode === "paes" || essayMode === "simce"}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="multiple-choice">Selección múltiple</SelectItem>
                  {essayMode !== "paes" && essayMode !== "simce" && (
                    <>
                      <SelectItem value="true-false">Verdadero / Falso</SelectItem>
                      <SelectItem value="short-answer">Desarrollo</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
              {(essayMode === "paes" || essayMode === "simce") && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Formato {essayMode === "paes" ? "PAES" : "SIMCE"}: solo selección múltiple.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={handleGenerate} disabled={loading || noOA || !aiEnabled || noCredits}>
            <Sparkles className="h-4 w-4" /> {loading ? "Generando…" : noCredits ? "Sin créditos" : "Generar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
