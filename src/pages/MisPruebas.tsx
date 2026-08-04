import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, FilePlus2, Library, Lock, Pencil, Trash2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { deleteAssessment, listAssessmentsWithOwnerPaged, upsertAssessment, ASSESSMENTS_PAGE_SIZE, type AssessmentListFilters } from "@/lib/assessment-storage";
import { listProfiles, profileLabel, type Profile } from "@/lib/profiles";
import { loadSubjects } from "@/lib/catalog";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import type { Assessment, AssessmentStatus } from "@/lib/assessment-schema";
import { ASSESSMENT_STATUS_LABEL, newAssessmentId } from "@/lib/assessment-schema";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import { supabase } from "@/integrations/supabase/client";

interface Item { assessment: Assessment; userId: string | null; }

const DELETED_USER = "__deleted__";
const DELETED_USER_LABEL = "Usuario eliminado";

const ALL = "__all__";

const PAGE_SIZE = ASSESSMENTS_PAGE_SIZE;

const FILTERS_KEY = "pruebalista.misPruebas.filters.v1";

interface SavedFilters {
  showAll: boolean;
  teacherFilter: string;
  subjectFilter: string;
  statusFilter: string;
}

const loadSavedFilters = (): SavedFilters => {
  try {
    const raw = localStorage.getItem(FILTERS_KEY);
    if (!raw) throw new Error("empty");
    const p = JSON.parse(raw) as Partial<SavedFilters>;
    return {
      showAll: !!p.showAll,
      teacherFilter: p.teacherFilter ?? ALL,
      subjectFilter: p.subjectFilter ?? ALL,
      statusFilter: p.statusFilter ?? ALL,
    };
  } catch {
    return { showAll: false, teacherFilter: ALL, subjectFilter: ALL, statusFilter: ALL };
  }
};

const MisPruebas = ({ embedded = false }: { embedded?: boolean }) => {
  const saved = useState(loadSavedFilters)[0];
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subjects] = useState(() => loadSubjects());
  const { grades } = useAdminCourses();
  const [showAll, setShowAll] = useState(embedded || saved.showAll);
  const [teacherFilter, setTeacherFilter] = useState<string>(saved.teacherFilter);
  const [subjectFilter, setSubjectFilter] = useState<string>(saved.subjectFilter);
  const [statusFilter, setStatusFilter] = useState<string>(saved.statusFilter);
  const navigate = useNavigate();
  const { user, isStaff, isUtpHead } = useAuth();
  const { maxAssessments } = useUserUsage();
  const [isAutonomous, setIsAutonomous] = useState(true); // default true until checked

  // Check if user is autonomous (no colegio_id)
  useEffect(() => {
    if (!user || isStaff) { setIsAutonomous(!isStaff); return; }
    let cancelled = false;
    void (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("colegio_id")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancelled) {
          setIsAutonomous(!(data as { colegio_id: string | null } | null)?.colegio_id);
        }
      } catch {
        if (!cancelled) setIsAutonomous(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, isStaff]);

  const currentFilters = useMemo<AssessmentListFilters>(() => {
    const f: AssessmentListFilters = {};
    if (!isStaff || (!embedded && !showAll)) {
      f.userId = user?.id;
    } else if (teacherFilter !== ALL) {
      f.userId = teacherFilter === DELETED_USER ? null : teacherFilter;
    }
    if (isStaff && showAll && subjectFilter !== ALL) f.subjectValue = subjectFilter;
    if (statusFilter !== ALL) f.status = statusFilter;
    return f;
  }, [embedded, isStaff, showAll, teacherFilter, subjectFilter, statusFilter, user?.id]);

  const fetchPage = async (p: number, append: boolean) => {
    const res = await listAssessmentsWithOwnerPaged(currentFilters, p, PAGE_SIZE);
    setItems((prev) => (append ? [...prev, ...res.items] : res.items));
    setTotal(res.total);
    setHasMore(res.hasMore);
    setPage(p);
  };

  const refresh = async () => { await fetchPage(0, false); };

  // Persistir filtros y recargar desde la primera página al cambiarlos.
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ showAll, teacherFilter, subjectFilter, statusFilter }));
    } catch { /* ignore */ }
    fetchPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, currentFilters]);

  const loadMore = async () => {
    setLoadingMore(true);
    await fetchPage(page + 1, true);
    setLoadingMore(false);
  };

  useEffect(() => {
    if (!isStaff) { setProfiles([]); return; }
    listProfiles().then((r) => setProfiles(r.profiles));
  }, [isStaff]);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const teacherOptions = useMemo(() => {
    if (!isStaff) return [];
    const opts = profiles.map((p) => ({ id: p.id, label: profileLabel(p, p.id) }));
    opts.sort((a, b) => a.label.localeCompare(b.label));
    return [...opts, { id: DELETED_USER, label: DELETED_USER_LABEL }];
  }, [profiles, isStaff]);

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`¿Eliminar la prueba "${title || "Sin título"}"?`)) return;
    try {
      await deleteAssessment(id);
      await refresh();
      toast.success("Prueba eliminada");
    } catch (e) {
      toast.error("No se pudo eliminar: " + (e as Error).message);
    }
  };

  const handleDuplicate = async (a: Assessment) => {
    try {
      const newId = newAssessmentId();
      const copy: Assessment = {
        ...a,
        id: newId,
        status: "borrador",
        utpFeedback: null,
        updatedAt: Date.now(),
        meta: { ...a.meta, title: `Copia de ${a.meta?.title || "Sin título"}` },
      };
      await upsertAssessment(copy);
      toast.success("Prueba duplicada");
      navigate(`/crear-prueba?id=${newId}`);
    } catch (e) {
      toast.error("No se pudo duplicar: " + (e as Error).message);
    }
  };

  const labelOf = (arr: { value: string; label: string }[], v: string) =>
    arr.find((x) => x.value === v)?.label ?? "—";

  const subjectOptions = useMemo(() => {
    if (!isStaff) return [];
    return [...subjects].sort((a, b) => a.label.localeCompare(b.label));
  }, [subjects, isStaff]);

  // Compute which of the user's own assessments are "active" (not blocked by plan limit).
  // Blocked = beyond the last N (by updatedAt) when maxAssessments is set.
  const blockedAssessmentIds = useMemo(() => {
    if (isStaff || maxAssessments === null) return new Set<string>();
    const own = items.filter((i) => i.userId === user?.id);
    if (own.length <= maxAssessments) return new Set<string>();
    const sorted = [...own].sort((a, b) => b.assessment.updatedAt - a.assessment.updatedAt);
    return new Set(sorted.slice(maxAssessments).map((i) => i.assessment.id));
  }, [items, maxAssessments, isStaff, user?.id]);

  const visible = items;
  const paged = items;


  return (
    <PageShell embedded={embedded}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mis pruebas</h1>
            <p className="text-sm text-muted-foreground">
              {isStaff
                ? (isUtpHead ? "Jefe UTP: puedes ver todas las pruebas o filtrar por docente." : "Administrador: puedes ver todas las pruebas o filtrar por docente.")
                : "Tus pruebas guardadas en la nube. Solo tú puedes verlas."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isStaff && !embedded && (
              <Button variant="outline" size="sm" onClick={() => { setShowAll((v) => !v); setTeacherFilter(ALL); setSubjectFilter(ALL); setStatusFilter(ALL); }}>
                {showAll ? "Ver solo mías" : "Ver todas"}
              </Button>
            )}
            {isStaff && showAll && (
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Asignatura" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todas las asignaturas</SelectItem>
                  {subjectOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isStaff && showAll && (
              <Select value={teacherFilter} onValueChange={setTeacherFilter}>
                <SelectTrigger className="h-9 w-[220px]">
                  <SelectValue placeholder="Docente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los docentes</SelectItem>
                  {teacherOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {(!isAutonomous || isStaff) && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[200px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos los estados</SelectItem>
                  <SelectItem value="borrador">Borrador</SelectItem>
                  <SelectItem value="pendiente_revision">Pendiente de Revisión</SelectItem>
                  <SelectItem value="aprobado">Aprobado</SelectItem>
                  <SelectItem value="rechazado">Rechazado</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button asChild size="sm">
              <Link to="/crear-prueba"><FilePlus2 className="h-4 w-4" /> Nueva prueba</Link>
            </Button>
          </div>
        </div>

        {visible.length === 0 ? (
          <Card className="shadow-card border-dashed">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              <Library className="mx-auto h-10 w-10 mb-3 opacity-50" />
              Aún no hay pruebas. Crea una y pulsa <strong>Guardar</strong>.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {paged.map(({ assessment: a, userId }) => {
              const meta = a.meta ?? ({} as typeof a.meta);
              const counted = (a.questions ?? []).filter((q) => q.type !== "section-title" && q.type !== "info-block").length;

              const isOwn = userId === user?.id;
              const isBlocked = blockedAssessmentIds.has(a.id);
              const authorLabel = isStaff && !isOwn
                ? (userId ? profileLabel(profileById.get(userId), userId) : DELETED_USER_LABEL)
                : null;
              const statusBadge = (() => {
                const s = a.status ?? "borrador";
                const map: Record<string, { label: string; cls: string }> = {
                  borrador: { label: "Borrador", cls: "bg-muted text-muted-foreground" },
                  pendiente_revision: { label: "Pendiente", cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
                  aprobado: { label: "Aprobado", cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
                  rechazado: { label: "Rechazado", cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
                };
                return map[s] ?? map.borrador;
              })();
              return (
                <Card key={a.id} className={`shadow-card ${isBlocked ? "opacity-60" : ""}`}>
                  <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {isBlocked && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Lock className="h-4 w-4 text-amber-500 shrink-0" />
                            </TooltipTrigger>
                            <TooltipContent>Excede el límite de tu plan. Solo lectura.</TooltipContent>
                          </Tooltip>
                        )}
                        {meta.title || "Sin título"}
                        {(!isAutonomous || isStaff) && (
                          <Badge className={`text-[10px] px-1.5 py-0 font-medium ${statusBadge.cls}`}>{statusBadge.label}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{labelOf(subjects, meta.subjectValue)}</span>
                        <span>·</span>
                        <span>{labelOf(grades, meta.gradeValue)}</span>
                        <span>·</span>
                        <span>{counted} pregunta{counted === 1 ? "" : "s"}</span>
                        <span>·</span>
                        <span>Actualizada {new Date(a.updatedAt).toLocaleString()}</span>
                        {authorLabel && (<><span>·</span><span className="font-medium">{authorLabel}</span></>)}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" disabled={isBlocked} onClick={() => navigate(`/crear-prueba?id=${a.id}`)}>
                      <Pencil className="h-4 w-4" /> {isBlocked ? "Bloqueada" : "Editar"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicate(a)}>
                      <Copy className="h-4 w-4" /> Duplicar
                    </Button>
                    {(() => {
                      const canDelete = (a.status ?? "borrador") === "borrador";
                      return (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span>
                              <Button size="sm" variant="ghost" disabled={isBlocked || !canDelete} onClick={() => handleDelete(a.id, meta.title)}>
                                <Trash2 className="h-4 w-4" /> Eliminar
                              </Button>
                            </span>
                          </TooltipTrigger>
                          {!canDelete && (
                            <TooltipContent>Solo puedes eliminar pruebas en estado Borrador.</TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })()}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {items.length > 0 && (
          <div className="flex flex-col items-center gap-1 pt-2">
            {hasMore && (
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "Cargando…" : `Cargar más (${total - items.length} restantes)`}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Mostrando {items.length} de {total}
            </span>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default MisPruebas;
