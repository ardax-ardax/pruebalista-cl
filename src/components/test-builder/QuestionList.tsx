import { useCallback, useMemo, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, ChevronsDownUp, ChevronsUpDown, FileText, Hash, Info, Library, ListChecks, Plus, Sparkles, Type } from "lucide-react";
import {
  computeTotalPoints,
  newQuestion,
  PAES_VARIANTS,
  SIMCE_QUESTION_GOAL,
  type AssessmentMeta,
  type Question,
  type QuestionType,
} from "@/lib/assessment-schema";
import { loadTemplates } from "@/lib/templates";
import { Progress } from "@/components/ui/progress";
import { QuestionEditor } from "./QuestionEditor";
import { AIGenerateDialog } from "./AIGenerateDialog";
import { QuestionBankDialog } from "./QuestionBankDialog";

interface Props {
  questions: Question[];
  onChange: (qs: Question[]) => void;
  meta: AssessmentMeta;
  gradeLabel: string;
  subjectLabel: string;
  creditsAvailable?: number;
  onCreditsUsed?: () => void;
}

const ADDABLE: { type: QuestionType; label: string; icon: typeof Plus }[] = [
  { type: "multiple-choice", label: "Selección múltiple", icon: ListChecks },
  { type: "true-false", label: "Verdadero / Falso", icon: CheckSquare },
  { type: "short-answer", label: "Desarrollo", icon: Type },
  { type: "info-block", label: "Bloque info", icon: Info },
  { type: "section-title", label: "Sección", icon: Hash },
];

const visibleNumber = (qs: Question[], i: number): number | null => {
  const q = qs[i];
  if (q.type === "section-title" || q.type === "info-block") return null;
  let n = 0;
  for (let k = 0; k <= i; k++) {
    const t = qs[k].type;
    if (t === "section-title") {
      n = 0;
      continue;
    }
    if (t === "info-block") continue;
    n++;
  }
  return n;
};

const SortableQuestionItem = (props: {
  question: import("@/lib/assessment-schema").Question;
  index: number;
  visibleNumber: number | null;
  onChange: (q: import("@/lib/assessment-schema").Question) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  canUp: boolean;
  canDown: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.question.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <QuestionEditor
        {...props}
        dragHandleProps={listeners}
      />
    </div>
  );
};

export const QuestionList = ({ questions, onChange, meta, gradeLabel, subjectLabel, creditsAvailable, onCreditsUsed }: Props) => {
  const mcOpts = meta.defaultMcOptions ?? 4;
  const tfStmts = meta.defaultTfStatements ?? 3;

  const [aiOpen, setAiOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const add = (type: QuestionType) => onChange([...questions, newQuestion(type, { mcOptions: mcOpts, tfStatements: tfStmts })]);
  const update = (i: number, q: Question) => {
    const next = questions.slice();
    next[i] = q;
    onChange(next);
  };
  const remove = (i: number) => onChange(questions.filter((_, k) => k !== i));
  const duplicate = (i: number) => {
    const copy = { ...questions[i], id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
    const next = [...questions.slice(0, i + 1), copy, ...questions.slice(i + 1)];
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = questions.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = questions.findIndex((q) => q.id === active.id);
    const newIndex = questions.findIndex((q) => q.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(questions, oldIndex, newIndex));
  };

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const allCollapsed = questions.length > 0 && collapsedIds.size === questions.length;
  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedIds(new Set());
    } else {
      setCollapsedIds(new Set(questions.map((q) => q.id)));
    }
  };

  const total = computeTotalPoints(questions);
  const counted = questions.filter((q) => q.type !== "section-title" && q.type !== "info-block").length;

  // Detecta el essayMode del template actual (SIMCE / PAES) para restringir tipos.
  const essayMode = useMemo(() => {
    const t = loadTemplates().find((tt) => tt.id === meta.templateId);
    return t?.essayMode ?? null;
  }, [meta.templateId]);
  // PAES: solo selección múltiple (formato oficial DEMRE).
  // SIMCE: selección múltiple + bloque info (textos de lectura) + secciones.
  // Sin essayMode: todos los tipos disponibles.
  const addable =
    essayMode === "paes"
      ? ADDABLE.filter((it) => it.type === "multiple-choice")
      : essayMode === "simce"
      ? ADDABLE.filter((it) => it.type !== "short-answer" && it.type !== "true-false")
      : ADDABLE;

  // Meta de preguntas según variante PAES o SIMCE.
  const questionGoal = useMemo(() => {
    if (essayMode === "paes") {
      return PAES_VARIANTS.find((v) => v.value === meta.paesVariant)?.questionGoal ?? 65;
    }
    if (essayMode === "simce") return SIMCE_QUESTION_GOAL;
    return null;
  }, [essayMode, meta.paesVariant]);

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium mr-2">Agregar:</span>
          {addable.map((it) => {
            const Icon = it.icon;
            return (
              <Button key={it.type} type="button" size="sm" variant="outline" onClick={() => add(it.type)}>
                <Icon className="h-4 w-4" /> {it.label}
              </Button>
            );
          })}
          <Button type="button" size="sm" variant="default" onClick={() => setAiOpen(true)}>
            <Sparkles className="h-4 w-4" /> Generar con IA
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setBankOpen(true)}>
            <Library className="h-4 w-4" /> Desde banco
          </Button>
          <span className="ml-auto flex items-center gap-2">
            {questions.length > 1 && (
              <Button type="button" size="sm" variant="ghost" onClick={toggleAll} title={allCollapsed ? "Expandir todo" : "Colapsar todo"}>
                {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
                {allCollapsed ? "Expandir" : "Colapsar"}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {counted} pregunta{counted === 1 ? "" : "s"} · {total} pt{total === 1 ? "" : "s"}
            </span>
          </span>
        </CardContent>
      </Card>

      {questionGoal !== null && (
        <Card className="shadow-card border-primary/30">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">
                Progreso oficial {essayMode === "paes" ? "PAES" : "SIMCE"}
              </span>
              <span className="font-mono text-muted-foreground">
                {counted} / {questionGoal} preguntas
              </span>
            </div>
            <Progress value={Math.min(100, (counted / questionGoal) * 100)} className="h-2" />
            {counted < questionGoal && (
              <p className="text-xs text-muted-foreground">
                Faltan {questionGoal - counted} para completar el ensayo oficial.
              </p>
            )}
            {counted >= questionGoal && (
              <p className="text-xs text-emerald-600">Meta oficial alcanzada ✓</p>
            )}
          </CardContent>
        </Card>
      )}
      {questions.length === 0 ? (
        <Card className="shadow-card border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            Aún no has agregado preguntas. Empieza con una selección múltiple o un título de sección.
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {questions.map((q, i) => (
                <SortableQuestionItem
                  key={q.id}
                  question={q}
                  index={i}
                  visibleNumber={visibleNumber(questions, i)}
                  onChange={(nq) => update(i, nq)}
                  onDelete={() => remove(i)}
                  onDuplicate={() => duplicate(i)}
                  onMoveUp={() => move(i, -1)}
                  onMoveDown={() => move(i, 1)}
                  canUp={i > 0}
                  canDown={i < questions.length - 1}
                  collapsed={collapsedIds.has(q.id)}
                  onToggleCollapse={() => toggleCollapse(q.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AIGenerateDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        linkedOA={meta.linkedOA ?? []}
        gradeValue={meta.gradeValue}
        gradeLabel={gradeLabel}
        subjectValue={meta.subjectValue}
        subjectLabel={subjectLabel}
        essayMode={essayMode}
        onGenerated={(q) => onChange([...questions, q])}
        creditsAvailable={creditsAvailable}
        onCreditsUsed={onCreditsUsed}
        defaultMcOptions={mcOpts}
        defaultTfStatements={tfStmts}
      />

      <QuestionBankDialog
        open={bankOpen}
        onOpenChange={setBankOpen}
        onImport={(qs) => onChange([...questions, ...qs])}
      />
    </div>
  );
};
