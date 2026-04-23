import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Copy, Trash2 } from "lucide-react";
import { newId, QUESTION_TYPE_LABEL, type Option, type Question } from "@/lib/assessment-schema";
import { ImageCropEditor } from "./ImageCropEditor";

interface Props {
  question: Question;
  index: number;
  visibleNumber: number | null;
  onChange: (q: Question) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canUp: boolean;
  canDown: boolean;
}

export const QuestionEditor = ({
  question, visibleNumber, onChange, onDelete, onDuplicate, onMoveUp, onMoveDown, canUp, canDown,
}: Props) => {
  const update = (patch: Partial<Question>) => onChange({ ...question, ...patch });

  const updateOption = (id: string, patch: Partial<Option>) => {
    const opts = (question.options ?? []).map((o) => (o.id === id ? { ...o, ...patch } : o));
    update({ options: opts });
  };

  const addOption = () => {
    const opts = [...(question.options ?? []), { id: newId(), text: "", correct: false }];
    update({ options: opts });
  };

  const removeOption = (id: string) => {
    const opts = (question.options ?? []).filter((o) => o.id !== id);
    update({ options: opts });
  };

  const isCounted = question.type !== "section-title" && question.type !== "info-block";

  return (
    <Card className="shadow-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-secondary px-2 text-xs font-semibold text-secondary-foreground">
            {visibleNumber !== null ? visibleNumber : "—"}
          </span>
          <span className="text-xs text-muted-foreground">{QUESTION_TYPE_LABEL[question.type]}</span>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" size="icon" variant="ghost" disabled={!canUp} onClick={onMoveUp} title="Subir">
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" disabled={!canDown} onClick={onMoveDown} title="Bajar">
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onDuplicate} title="Duplicar">
              <Copy className="h-4 w-4" />
            </Button>
            <Button type="button" size="icon" variant="ghost" onClick={onDelete} title="Eliminar">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {question.type === "section-title" && (
          <Input
            placeholder="Título de la sección (ej: Ítem I — Selección múltiple)"
            value={question.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
          />
        )}
        {question.type === "info-block" && (
          <Textarea
            placeholder="Texto de instrucción o contexto…"
            value={question.prompt}
            onChange={(e) => update({ prompt: e.target.value })}
          />
        )}
        {isCounted && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
              <div>
                <Label className="text-xs">Enunciado</Label>
                <Textarea
                  placeholder="Escribe la pregunta…"
                  value={question.prompt}
                  onChange={(e) => update({ prompt: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Puntaje</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.5"
                  value={question.points ?? 0}
                  onChange={(e) => update({ points: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Imagen (opcional)</Label>
              <ImageCropEditor value={question.image} onChange={(img) => update({ image: img })} />
            </div>
          </>
        )}

        {(question.type === "multiple-choice" || question.type === "true-false") && (
          <div className="space-y-2">
            <Label className="text-xs">Opciones</Label>
            {(question.options ?? []).map((o, i) => (
              <div key={o.id} className="flex items-center gap-2">
                <span className="w-6 text-center text-xs font-semibold text-muted-foreground">
                  {String.fromCharCode(97 + i)})
                </span>
                <Input
                  value={o.text}
                  onChange={(e) => updateOption(o.id, { text: e.target.value })}
                  placeholder="Texto de la opción"
                  disabled={question.type === "true-false"}
                />
                <Button
                  type="button"
                  size="sm"
                  variant={o.correct ? "default" : "outline"}
                  onClick={() => {
                    // exclusivo: solo una correcta
                    const opts = (question.options ?? []).map((x) => ({ ...x, correct: x.id === o.id }));
                    update({ options: opts });
                  }}
                >
                  {o.correct ? "Correcta" : "Marcar"}
                </Button>
                {question.type === "multiple-choice" && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(o.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {question.type === "multiple-choice" && (
              <Button type="button" size="sm" variant="outline" onClick={addOption}>
                Agregar opción
              </Button>
            )}
          </div>
        )}

        {question.type === "short-answer" && (
          <div>
            <Label className="text-xs">Líneas para respuesta</Label>
            <Select
              value={String(question.answerLines ?? 3)}
              onValueChange={(v) => update({ answerLines: Number(v) })}
            >
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
