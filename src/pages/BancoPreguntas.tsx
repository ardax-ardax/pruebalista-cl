import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Search, Library, ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { searchBank, deleteFromBank, hideFromBank, type QuestionBankRow, type BankFilters } from "@/lib/question-bank";
import { loadSubjects } from "@/lib/catalog";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import { QUESTION_TYPE_LABEL, type QuestionType, type Question } from "@/lib/assessment-schema";
import { listProfiles, profileLabel, type Profile } from "@/lib/profiles";

const TYPES: { value: QuestionType; label: string }[] = [
  { value: "multiple-choice", label: "Selección múltiple" },
  { value: "true-false", label: "Verdadero / Falso" },
  { value: "short-answer", label: "Desarrollo" },
];

const DIFFICULTIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
];

const SOURCES = [
  { value: "ai", label: "IA" },
  { value: "manual", label: "Manual" },
];

function QuestionDetails({ question }: { question: Question }) {
  if (question.type === "multiple-choice" && question.options) {
    const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
    return (
      <div className="mt-2 space-y-1">
        {question.options.map((opt, i) => (
          <div
            key={opt.id}
            className={`flex items-start gap-2 text-sm rounded px-2 py-0.5 ${
              opt.correct
                ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300 font-medium"
                : "text-muted-foreground"
            }`}
          >
            <span className="font-mono text-xs mt-0.5">{letters[i] ?? i + 1})</span>
            <span className="flex-1">{opt.text}</span>
            {opt.correct && <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />}
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "true-false" && question.statements) {
    return (
      <div className="mt-2 space-y-1">
        {question.statements.map((st) => (
          <div key={st.id} className="flex items-start gap-2 text-sm">
            <Badge
              variant="outline"
              className={`text-[10px] shrink-0 mt-0.5 ${
                st.answer === "V"
                  ? "border-green-500 text-green-700 dark:text-green-400"
                  : "border-red-500 text-red-700 dark:text-red-400"
              }`}
            >
              {st.answer}
            </Badge>
            <span className="text-muted-foreground">{st.text}</span>
          </div>
        ))}
      </div>
    );
  }

  if (question.type === "short-answer") {
    return (
      <div className="mt-2 text-sm text-muted-foreground italic">
        Respuesta de desarrollo ({question.answerLines ?? 3} líneas)
        {question.rubric && (
          <div className="mt-1 text-xs not-italic">
            <span className="font-medium">Pauta:</span> {question.rubric}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export default function BancoPreguntas() {
  const { isAdmin, isStaff, user } = useAuth();
  const subjects = loadSubjects();
  const grades = loadGrades();

  const [rows, setRows] = useState<QuestionBankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filters, setFilters] = useState<BankFilters>({});
  const [searchText, setSearchText] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const load = async (f: BankFilters = filters) => {
    setLoading(true);
    const data = await searchBank(f);
    setRows(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (isStaff) {
      listProfiles().then((r) => setProfiles(r.profiles));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    const f: BankFilters = { ...filters };
    if (searchText.trim()) f.search = searchText.trim();
    else delete f.search;
    setFilters(f);
    load(f);
  };

  const setFilter = (key: keyof BankFilters, val: string) => {
    const next = { ...filters };
    if (val === "__all__") delete next[key];
    else next[key] = val;
    setFilters(next);
    load(next);
  };

  const handleDelete = async (id: string) => {
    if (isAdmin) {
      if (!confirm("¿Eliminar esta pregunta del banco permanentemente?")) return;
      const ok = await deleteFromBank(id);
      if (ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success("Pregunta eliminada");
      } else {
        toast.error("No se pudo eliminar");
      }
    } else {
      if (!confirm("¿Eliminar esta pregunta del banco?")) return;
      const ok = await hideFromBank(id, user!.id);
      if (ok) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        toast.success("Pregunta eliminada");
      } else {
        toast.error("No se pudo eliminar");
      }
    }
  };

  const getAuthorName = (userId: string) => {
    const p = profiles.find((pr) => pr.id === userId);
    return profileLabel(p, userId);
  };

  const canDelete = (row: QuestionBankRow) =>
    isAdmin || row.user_id === user?.id;

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Library className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Banco de Preguntas</h1>
          <Badge variant="outline" className="ml-auto">{rows.length} preguntas</Badge>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground mb-1 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar por enunciado..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                />
              </div>
            </div>
            <FilterSelect label="Tipo" value={filters.question_type} onChange={(v) => setFilter("question_type", v)}
              options={TYPES.map((t) => ({ value: t.value, label: t.label }))} />
            <FilterSelect label="Asignatura" value={filters.subject_value} onChange={(v) => setFilter("subject_value", v)}
              options={subjects.map((s) => ({ value: s.value, label: s.label }))} />
            <FilterSelect label="Nivel" value={filters.grade_value} onChange={(v) => setFilter("grade_value", v)}
              options={grades.map((g) => ({ value: g.value, label: g.label }))} />
            {isStaff && <FilterSelect label="Dificultad" value={filters.difficulty} onChange={(v) => setFilter("difficulty", v)}
              options={DIFFICULTIES} />}
            <FilterSelect label="Origen" value={filters.source} onChange={(v) => setFilter("source", v)}
              options={SOURCES} />
            <Button size="sm" onClick={applyFilters}>Buscar</Button>
          </CardContent>
        </Card>

        {/* Lista */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Cargando…</p>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Library className="mx-auto h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">No hay preguntas en el banco con los filtros seleccionados.</p>
              <p className="text-xs mt-1">Las preguntas se agregan automáticamente al guardar una evaluación.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => {
              const qData = row.question_data as Question;
              const isExpanded = expandedIds.has(row.id);
              return (
                <Card key={row.id} className="shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-[10px]">
                            {QUESTION_TYPE_LABEL[row.question_type as QuestionType] ?? row.question_type}
                          </Badge>
                          {isStaff && row.difficulty && (
                            <Badge variant="outline" className="text-[10px] capitalize">{row.difficulty}</Badge>
                          )}
                          {row.source === "ai" && (
                            <Badge className="bg-primary/10 text-primary text-[10px]">IA</Badge>
                          )}
                          {row.oa_code && (
                            <Badge variant="outline" className="text-[10px]">{row.oa_code}</Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">
                          {qData.prompt || row.title || row.prompt_preview || "(sin enunciado)"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {row.subject_value && <span>{subjects.find((s) => s.value === row.subject_value)?.label ?? row.subject_value}</span>}
                          {row.grade_value && <span>{grades.find((g) => g.value === row.grade_value)?.label ?? row.grade_value}</span>}
                          {isStaff && <span className="italic">por {getAuthorName(row.user_id)}</span>}
                          <span>{new Date(row.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleExpand(row.id)}
                          title={isExpanded ? "Colapsar" : "Ver detalle"}
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                        {canDelete(row) && (
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {isExpanded && <QuestionDetails question={qData} />}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="min-w-[130px]">
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <Select value={value ?? "__all__"} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
