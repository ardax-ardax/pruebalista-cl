import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import {
  newId,
  newStatement,
  QUESTION_TYPE_LABEL,
  type Option,
  type Question,
  type TfStatement,
} from "@/lib/assessment-schema";
import { ImageCropEditor } from "./ImageCropEditor";
import { RichTextInput } from "./RichTextInput";

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

  const updateStatement = (id: string, patch: Partial<TfStatement>) => {
    const sts = (question.statements ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s));
    update({ statements: sts });
  };

  const addStatement = () => {
    update({ statements: [...(question.statements ?? []), newStatement("V")] });
  };

  const removeStatement = (id: string) => {
    update({ statements: (question.statements ?? []).filter((s) => s.id !== id) });
  };

  const isCounted = question.type !== "section-title" && question.type !== "info-block";
  const isTf = question.type === "true-false";

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
            <div>
              <Label className="text-xs">Título del enunciado</Label>
              <Input
                placeholder="Ej: Comprensión de lectura · Texto 1"
                value={question.title ?? ""}
                onChange={(e) => update({ title: e.target.value })}
                className="font-semibold"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
              <div>
                <Label className="text-xs">Enunciado</Label>
                <RichTextInput
                  placeholder={isTf ? "Instrucción del ítem (ej: Marca V o F según corresponda)" : "Escribe la pregunta…"}
                  value={question.prompt}
                  onChange={(html) => update({ prompt: html })}
                  rows={3}
                />
              </div>
              {!isTf && (
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
              )}
            </div>
            <div>
              <Label className="text-xs mb-1 block">Imagen del enunciado (opcional)</Label>
              <ImageCropEditor
                value={question.image}
                allowFullWidth={question.type === "multiple-choice"}
                onChange={(img) => {
                  // En selección múltiple con imagen, forzamos layout en columna (imagen derecha).
                  if (question.type === "multiple-choice" && img) {
                    update({ image: img, imageLayout: "side-right" });
                  } else {
                    update({ image: img });
                  }
                }}
              />
              {question.type === "multiple-choice" && question.image && (
                <p className="mt-1 text-xs text-muted-foreground">
                  En selección múltiple la imagen ocupa una columna a la derecha de las opciones; usá el control de ancho para ajustar su tamaño dentro de la columna.
                </p>
              )}
            </div>
          </>
        )}

        {question.type === "multiple-choice" && (
          <div className="space-y-3">
            <Label className="text-xs">Opciones</Label>
            {(question.options ?? []).map((o, i) => (
              <div key={o.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-semibold text-muted-foreground">
                    {String.fromCharCode(97 + i)})
                  </span>
                  <Input
                    value={o.text}
                    onChange={(e) => updateOption(o.id, { text: e.target.value })}
                    placeholder="Texto de la opción"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={o.correct ? "default" : "outline"}
                    onClick={() => {
                      const opts = (question.options ?? []).map((x) => ({ ...x, correct: x.id === o.id }));
                      update({ options: opts });
                    }}
                  >
                    {o.correct ? "Correcta" : "Marcar"}
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeOption(o.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="pl-8">
                  <ImageCropEditor compact value={o.image} onChange={(img) => updateOption(o.id, { image: img })} />
                </div>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={addOption}>
              <Plus className="h-4 w-4" /> Agregar opción
            </Button>
          </div>
        )}

        {isTf && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Afirmaciones</Label>
              <span className="text-xs text-muted-foreground">
                Total: {(question.statements ?? []).reduce((s, st) => s + (st.points ?? 0), 0)} pts
              </span>
            </div>
            {(question.statements ?? []).map((st, i) => (
              <div key={st.id} className="rounded-md border border-border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-8 pt-2 text-center text-xs font-semibold text-muted-foreground">
                    {i + 1}.
                  </span>
                  <div className="flex flex-col gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={st.answer === "V" ? "default" : "outline"}
                      onClick={() => updateStatement(st.id, { answer: "V" })}
                    >
                      V
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={st.answer === "F" ? "default" : "outline"}
                      onClick={() => updateStatement(st.id, { answer: "F" })}
                    >
                      F
                    </Button>
                  </div>
                  <div className="flex-1">
                    <Textarea
                      value={st.text}
                      onChange={(e) => updateStatement(st.id, { text: e.target.value })}
                      placeholder="Escribe la afirmación…"
                      rows={2}
                    />
                  </div>
                  <div className="w-20">
                    <Label className="text-xs">Pts</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.5"
                      value={st.points ?? 0}
                      onChange={(e) => updateStatement(st.id, { points: Number(e.target.value) || 0 })}
                    />
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeStatement(st.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="pl-10">
                  <ImageCropEditor compact value={st.image} onChange={(img) => updateStatement(st.id, { image: img })} />
                </div>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={addStatement}>
              <Plus className="h-4 w-4" /> Agregar afirmación
            </Button>
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
