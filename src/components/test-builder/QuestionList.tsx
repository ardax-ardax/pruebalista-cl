import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckSquare, FileText, Hash, Info, ListChecks, Plus, Type } from "lucide-react";
import {
  computeTotalPoints,
  newQuestion,
  type Question,
  type QuestionType,
} from "@/lib/assessment-schema";
import { QuestionEditor } from "./QuestionEditor";

interface Props {
  questions: Question[];
  onChange: (qs: Question[]) => void;
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

export const QuestionList = ({ questions, onChange }: Props) => {
  const add = (type: QuestionType) => onChange([...questions, newQuestion(type)]);
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

  const total = computeTotalPoints(questions);
  const counted = questions.filter((q) => q.type !== "section-title" && q.type !== "info-block").length;

  return (
    <div className="space-y-4">
      <Card className="shadow-card">
        <CardContent className="p-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium mr-2">Agregar:</span>
          {ADDABLE.map((it) => {
            const Icon = it.icon;
            return (
              <Button key={it.type} type="button" size="sm" variant="outline" onClick={() => add(it.type)}>
                <Icon className="h-4 w-4" /> {it.label}
              </Button>
            );
          })}
          <span className="ml-auto text-xs text-muted-foreground">
            {counted} pregunta{counted === 1 ? "" : "s"} · {total} pt{total === 1 ? "" : "s"}
          </span>
        </CardContent>
      </Card>

      {questions.length === 0 ? (
        <Card className="shadow-card border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
            Aún no has agregado preguntas. Empieza con una selección múltiple o un título de sección.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {questions.map((q, i) => (
            <QuestionEditor
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
