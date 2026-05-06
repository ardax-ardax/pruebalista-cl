import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  Loader2,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile } from "@/lib/profiles";
import { togglePublicInstitution } from "@/lib/question-bank";
import type { Question } from "@/lib/assessment-schema";

interface AssessmentRow {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  utpFeedback: string | null;
  docenteName: string;
  docenteEmail: string;
  userId: string;
  data: Record<string, unknown> | null;
}

const STATUS_CONFIG: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pendiente_revision: {
    label: "Pendiente",
    icon: Clock,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  aprobado: {
    label: "Aprobada",
    icon: CheckCircle2,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  rechazado: {
    label: "Rechazada",
    icon: AlertTriangle,
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  },
};

export function UtpReviewCenter() {
  const { user } = useAuth();
  const [pendingAssessments, setPendingAssessments] = useState<AssessmentRow[]>([]);
  const [recentAssessments, setRecentAssessments] = useState<AssessmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AssessmentRow | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedQuestions, setSelectedQuestions] = useState<Array<{ prompt?: string; bankId?: string; isPublic: boolean }>>([]);
  const [noColegioLinked, setNoColegioLinked] = useState(false);

  const load = async () => {
    const profile = await getMyProfile();
    if (!profile?.colegioId) {
      setNoColegioLinked(true);
      setLoading(false);
      return;
    }

    // Get all docentes from same colegio
    const { data: colegioProfiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .eq("colegio_id", profile.colegioId);

    if (!colegioProfiles || colegioProfiles.length === 0) {
      setLoading(false);
      return;
    }

    const profileMap = new Map(
      colegioProfiles.map((p) => [p.id, { name: p.display_name || "Sin nombre", email: p.email || "" }])
    );
    const userIds = colegioProfiles.map((p) => p.id);

    // Pending assessments
    const { data: pendingData } = await supabase
      .from("assessments")
      .select("id, title, status, updated_at, created_at, utp_feedback, user_id, data")
      .in("user_id", userIds)
      .eq("status", "pendiente_revision")
      .order("updated_at", { ascending: false });

    // Recent reviewed
    const { data: recentData } = await supabase
      .from("assessments")
      .select("id, title, status, updated_at, created_at, utp_feedback, user_id, data")
      .in("user_id", userIds)
      .in("status", ["aprobado", "rechazado"])
      .order("updated_at", { ascending: false })
      .limit(10);

    const mapRow = (r: { id: string; title: string; status: string; updated_at: string; created_at: string; utp_feedback: string | null; user_id: string; data: unknown }): AssessmentRow => {
      const p = profileMap.get(r.user_id);
      return {
        id: r.id,
        title: r.title || "Sin título",
        status: r.status,
        updatedAt: r.updated_at,
        createdAt: r.created_at,
        utpFeedback: r.utp_feedback,
        docenteName: p?.name ?? "Desconocido",
        docenteEmail: p?.email ?? "",
        userId: r.user_id,
        data: r.data as Record<string, unknown> | null,
      };
    };

    setPendingAssessments((pendingData ?? []).map(mapRow));
    setRecentAssessments((recentData ?? []).map(mapRow));
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user?.id]);

  const handleApprove = async () => {
    if (!selected) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("assessments")
      .update({ status: "aprobado", utp_feedback: "Evaluación aprobada por UTP." })
      .eq("id", selected.id);
    setSubmitting(false);
    if (error) {
      toast.error("Error al aprobar: " + error.message);
      return;
    }
    toast.success(`"${selected.title}" aprobada exitosamente.`);
    setSelected(null);
    load();
  };

  const handleReject = async () => {
    if (!selected || !feedbackText.trim()) {
      toast.error("Escribe las observaciones antes de rechazar.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase
      .from("assessments")
      .update({ status: "rechazado", utp_feedback: feedbackText.trim() })
      .eq("id", selected.id);
    setSubmitting(false);
    if (error) {
      toast.error("Error al rechazar: " + error.message);
      return;
    }
    toast.success(`"${selected.title}" rechazada con observaciones.`);
    setSelected(null);
    setShowReject(false);
    setFeedbackText("");
    load();
  };

  const openReview = async (a: AssessmentRow) => {
    setSelected(a);
    setShowReject(false);
    setFeedbackText("");
    setSelectedQuestions([]);

    // Load questions from assessment data and match with bank entries
    if (a.status === "aprobado" && a.data) {
      const questions = (a.data as Record<string, unknown>).questions as Question[] | undefined;
      if (questions && questions.length > 0) {
        const evaluable = questions.filter((q) => q.type !== "info-block" && q.type !== "section-title");
        // Try to find matching bank entries for this user's questions
        const { data: bankRows } = await supabase
          .from("question_bank")
          .select("id, prompt_preview, is_public_institution")
          .eq("user_id", a.userId)
          .limit(500);

        // Match by prompt preview
        const bankMap = new Map((bankRows ?? []).map((r) => [(r.prompt_preview ?? "").slice(0, 60), r]));

        setSelectedQuestions(
          evaluable.map((q) => {
            const preview = (q.prompt || "").slice(0, 60);
            const match = bankMap.get(preview);
            return {
              prompt: q.prompt,
              bankId: match?.id,
              isPublic: match ? (match as Record<string, unknown>).is_public_institution === true : false,
            };
          })
        );
      }
    }
  };

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" });

  const extractMeta = (data: Record<string, unknown> | null) => {
    if (!data) return { subject: "", grade: "", questionCount: 0 };
    const meta = (data as Record<string, unknown>).meta as Record<string, unknown> | undefined;
    const questions = (data as Record<string, unknown>).questions as unknown[] | undefined;
    return {
      subject: (meta?.subjectLabel as string) || (meta?.subjectValue as string) || "",
      grade: (meta?.gradeLabel as string) || (meta?.gradeValue as string) || "",
      questionCount: questions?.length ?? 0,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando evaluaciones…
      </div>
    );
  }

  if (noColegioLinked) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-12 text-center space-y-3">
          <Building2 className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Tu cuenta aún no ha sido vinculada a un colegio. Contacta al administrador para que te asigne a uno.
          </p>
        </CardContent>
      </Card>
    );
  }

  const renderStatusBadge = (status: string) => {
    const cfg = STATUS_CONFIG[status];
    if (!cfg) return <Badge variant="outline">{status}</Badge>;
    const Icon = cfg.icon;
    return (
      <Badge className={`text-[10px] gap-1 ${cfg.color}`}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  };

  const renderTable = (rows: AssessmentRow[], emptyMsg: string) => {
    if (rows.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
          {emptyMsg}
        </div>
      );
    }
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evaluación</TableHead>
              <TableHead className="hidden sm:table-cell">Docente</TableHead>
              <TableHead className="hidden sm:table-cell">Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((a) => (
              <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openReview(a)}>
                <TableCell>
                  <div className="font-medium text-sm text-foreground truncate max-w-[200px]">{a.title}</div>
                  <div className="text-[10px] text-muted-foreground sm:hidden">{a.docenteName}</div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{a.docenteName}</TableCell>
                <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{formatDate(a.updatedAt)}</TableCell>
                <TableCell>{renderStatusBadge(a.status)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" title="Revisar">
                    <Eye className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  const selectedMeta = selected ? extractMeta(selected.data) : null;

  return (
    <div className="space-y-6">
      {/* Pending */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            Evaluaciones por Revisar
            {pendingAssessments.length > 0 && (
              <Badge variant="destructive" className="text-[10px] ml-1">{pendingAssessments.length}</Badge>
            )}
          </CardTitle>
          <CardDescription>Evaluaciones enviadas por los docentes del colegio que esperan tu revisión.</CardDescription>
        </CardHeader>
        <CardContent>
          {renderTable(pendingAssessments, "No hay evaluaciones pendientes de revisión.")}
        </CardContent>
      </Card>

      {/* Recent */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            Historial Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {renderTable(recentAssessments, "Aún no se han revisado evaluaciones.")}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setShowReject(false); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">{selected?.title}</DialogTitle>
            <DialogDescription>
              Enviada por <span className="font-medium text-foreground">{selected?.docenteName}</span>
              {selected?.docenteEmail && ` (${selected.docenteEmail})`}
              {" · "}
              {selected && formatDate(selected.updatedAt)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {/* Assessment summary */}
            {selectedMeta && (
              <div className="grid grid-cols-3 gap-3">
                {selectedMeta.subject && (
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Asignatura</div>
                    <div className="text-sm font-medium text-foreground mt-0.5">{selectedMeta.subject}</div>
                  </div>
                )}
                {selectedMeta.grade && (
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Curso</div>
                    <div className="text-sm font-medium text-foreground mt-0.5">{selectedMeta.grade}</div>
                  </div>
                )}
                {selectedMeta.questionCount > 0 && (
                  <div className="rounded-lg bg-muted/50 p-3 text-center">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Preguntas</div>
                    <div className="text-sm font-medium text-foreground mt-0.5">{selectedMeta.questionCount}</div>
                  </div>
                )}
              </div>
            )}

            {/* Current status */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Estado actual:</span>
              {selected && renderStatusBadge(selected.status)}
            </div>

            {/* Questions with institutional highlight switch */}
            {selectedQuestions.length > 0 && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Destacar en Banco Institucional</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedQuestions.map((q, i) => (
                    <div key={q.bankId || i} className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1.5">
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium mr-1.5">P{i + 1}.</span>
                        <span className="text-xs text-muted-foreground truncate">{q.prompt?.slice(0, 80) || "(sin enunciado)"}</span>
                      </div>
                      {q.bankId && (
                        <Switch
                          checked={q.isPublic}
                          onCheckedChange={async (checked) => {
                            const ok = await togglePublicInstitution(q.bankId!, checked);
                            if (ok) {
                              setSelectedQuestions((prev) =>
                                prev.map((sq) => sq.bankId === q.bankId ? { ...sq, isPublic: checked } : sq)
                              );
                              toast.success(checked ? "Pregunta destacada" : "Pregunta removida del banco");
                            } else {
                              toast.error("Error al actualizar");
                            }
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous feedback */}
            {selected?.utpFeedback && (
              <div className="rounded-lg border border-border p-3 bg-muted/30">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Feedback anterior</div>
                <p className="text-sm text-foreground">{selected.utpFeedback}</p>
              </div>
            )}

            {/* Reject form */}
            {showReject && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Observaciones pedagógicas</label>
                <Textarea
                  placeholder="Escribe tu feedback para el docente…"
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selected?.status === "pendiente_revision" && !showReject && (
              <>
                <Button variant="outline" onClick={() => setShowReject(true)} className="gap-2 text-orange-700 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950">
                  <ThumbsDown className="h-4 w-4" />
                  Rechazar con Observaciones
                </Button>
                <Button onClick={handleApprove} disabled={submitting} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsUp className="h-4 w-4" />}
                  Aprobar
                </Button>
              </>
            )}
            {showReject && (
              <>
                <Button variant="ghost" onClick={() => setShowReject(false)}>Cancelar</Button>
                <Button onClick={handleReject} disabled={submitting} variant="destructive" className="gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ThumbsDown className="h-4 w-4" />}
                  Enviar Rechazo
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
