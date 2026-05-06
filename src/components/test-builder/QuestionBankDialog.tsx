import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Library, Lock, Search, ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import { searchBank, searchInstitutionalBank, type QuestionBankRow, type BankFilters } from "@/lib/question-bank";
import { newId, QUESTION_TYPE_LABEL, type Question, type QuestionType } from "@/lib/assessment-schema";
import { loadSubjects } from "@/lib/catalog";
import { useAdminCourses } from "@/hooks/useAdminCourses";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onImport: (questions: Question[]) => void;
}

const TYPES: { value: string; label: string }[] = [
  { value: "multiple-choice", label: "Selección múltiple" },
  { value: "true-false", label: "Verdadero / Falso" },
  { value: "short-answer", label: "Desarrollo" },
];

const DIFFICULTIES: { value: string; label: string }[] = [
  { value: "fácil", label: "Fácil" },
  { value: "medio", label: "Medio" },
  { value: "difícil", label: "Difícil" },
];

type TabValue = "mine" | "institution";

export function QuestionBankDialog({ open, onOpenChange, onImport }: Props) {
  const subjects = loadSubjects();
  const { grades } = useAdminCourses();

  const [tab, setTab] = useState<TabValue>("mine");
  const [rows, setRows] = useState<QuestionBankRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<BankFilters>({});
  const [searchText, setSearchText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const f: BankFilters = { ...filters };
    if (searchText.trim()) {
      const txt = searchText.trim();
      // If search looks like an OA code (e.g. "OA 05", "OA05"), set oa_code filter
      if (/^oa\s*\d+$/i.test(txt)) {
        f.oa_code = txt.replace(/\s+/g, " ").toUpperCase();
      } else {
        f.search = txt;
      }
    }
    const data = tab === "institution"
      ? await searchInstitutionalBank(f)
      : await searchBank(f);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setExpandedId(null);
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setExpandedId(null);
      setFilters({});
      setSearchText("");
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = () => {
    const picked = rows.filter((r) => selected.has(r.id));
    const isInstitutional = tab === "institution";
    const questions: Question[] = picked.map((r) => ({
      ...(r.question_data as unknown as Question),
      id: newId(),
      ...(isInstitutional ? { readOnly: true } : {}),
    }));
    onImport(questions);
    onOpenChange(false);
  };

  const setFilter = (key: keyof BankFilters, val: string) => {
    const next = { ...filters };
    if (val === "__all__") delete next[key];
    else next[key] = val;
    setFilters(next);
  };

  const renderQuestionRow = (row: QuestionBankRow) => {
    const isExpanded = expandedId === row.id;
    const qData = row.question_data as unknown as Question;
    const isInstitutional = tab === "institution";

    return (
      <div key={row.id} className="rounded-md border transition-colors hover:bg-muted/50">
        <div className="flex items-start gap-3 p-3 cursor-pointer" onClick={() => toggle(row.id)}>
          <Checkbox
            checked={selected.has(row.id)}
            onCheckedChange={() => toggle(row.id)}
            className="mt-0.5"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="secondary" className="text-[10px]">
                {QUESTION_TYPE_LABEL[row.question_type as QuestionType] ?? row.question_type}
              </Badge>
              {row.difficulty && <Badge variant="outline" className="text-[10px] capitalize">{row.difficulty}</Badge>}
              {row.source === "ai" && <Badge className="bg-primary/10 text-primary text-[10px]">IA</Badge>}
              {isInstitutional && (
                <Badge variant="outline" className="text-[10px] gap-1 text-amber-700 border-amber-300 dark:text-amber-400 dark:border-amber-700">
                  <Lock className="h-2.5 w-2.5" /> Solo lectura
                </Badge>
              )}
            </div>
            <p className="text-sm">{row.title || qData.prompt || row.prompt_preview || "(sin enunciado)"}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 shrink-0"
            onClick={(e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : row.id); }}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {isExpanded && (
          <div className="px-3 pb-3 pt-0 border-t border-border/50 space-y-2">
            {qData.prompt && (
              <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-2">
                {qData.prompt}
              </div>
            )}

            {qData.type === "multiple-choice" && qData.options && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Alternativas:</p>
                {qData.options.map((opt, i) => (
                  <div key={i} className={`flex items-start gap-2 text-sm rounded px-2 py-1 ${opt.correct ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
                    {opt.correct
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      : <XCircle className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                    }
                    <span className="font-medium mr-1">{String.fromCharCode(65 + i)})</span>
                    <span>{opt.text}</span>
                  </div>
                ))}
              </div>
            )}

            {qData.type === "true-false" && qData.statements && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Afirmaciones:</p>
                {qData.statements.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm rounded px-2 py-1">
                    <Badge variant={s.answer === "V" ? "default" : "destructive"} className="text-[10px] shrink-0 mt-0.5">
                      {s.answer}
                    </Badge>
                    <span>{s.text}</span>
                  </div>
                ))}
              </div>
            )}

            {qData.type === "short-answer" && (
              <p className="text-xs text-muted-foreground italic">
                Pregunta de desarrollo · {qData.answerLines ?? 4} líneas de respuesta
              </p>
            )}

            <div className="flex gap-2 text-[10px] text-muted-foreground flex-wrap">
              {row.oa_code && <span>OA: {row.oa_code}</span>}
              {qData.points !== undefined && <span>Pts: {qData.points}</span>}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" /> Banco de Preguntas
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2 mb-3">
            <TabsTrigger value="mine" className="gap-1.5 text-xs sm:text-sm">
              <Library className="h-3.5 w-3.5" /> Mis Preguntas
            </TabsTrigger>
            <TabsTrigger value="institution" className="gap-1.5 text-xs sm:text-sm">
              <Building2 className="h-3.5 w-3.5" /> Banco del Colegio
            </TabsTrigger>
          </TabsList>

          {/* Shared filters */}
          <div className="flex flex-wrap gap-2 items-end mb-3">
            <div className="flex-1 min-w-[140px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-9 text-xs"
                  placeholder={tab === "institution" ? "Buscar por enunciado o código OA…" : "Buscar..."}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && load()}
                />
              </div>
            </div>
            <MiniSelect value={filters.question_type} onChange={(v) => setFilter("question_type", v)} options={TYPES} placeholder="Tipo" />
            <MiniSelect value={filters.subject_value} onChange={(v) => setFilter("subject_value", v)}
              options={subjects.map((s) => ({ value: s.value, label: s.label }))} placeholder="Asignatura" />
            <MiniSelect value={filters.grade_value} onChange={(v) => setFilter("grade_value", v)}
              options={grades.map((g) => ({ value: g.value, label: g.label }))} placeholder="Nivel" />
            {tab === "institution" && (
              <MiniSelect value={filters.difficulty} onChange={(v) => setFilter("difficulty", v)} options={DIFFICULTIES} placeholder="Dificultad" />
            )}
            <Button size="sm" variant="outline" onClick={load}>Filtrar</Button>
          </div>

          <TabsContent value="mine" className="flex-1 overflow-y-auto space-y-1 min-h-0 mt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Cargando…</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin resultados</p>
            ) : (
              rows.map(renderQuestionRow)
            )}
          </TabsContent>

          <TabsContent value="institution" className="flex-1 overflow-y-auto space-y-1 min-h-0 mt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Cargando…</p>
            ) : rows.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Building2 className="h-8 w-8 mx-auto opacity-40 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No hay preguntas destacadas en el banco de tu colegio.
                </p>
                <p className="text-xs text-muted-foreground">
                  La UTP puede destacar preguntas desde el centro de revisión.
                </p>
              </div>
            ) : (
              rows.map(renderQuestionRow)
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={selected.size === 0} onClick={handleImport}>
            Importar {selected.size > 0 ? `(${selected.size})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MiniSelect({ value, onChange, options, placeholder }: {
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <Select value={value ?? "__all__"} onValueChange={onChange}>
      <SelectTrigger className="h-9 text-xs w-[120px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
