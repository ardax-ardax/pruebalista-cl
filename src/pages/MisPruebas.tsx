import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Copy, FilePlus2, Library, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAssessment, listAssessmentsWithOwner, upsertAssessment } from "@/lib/assessment-storage";
import { listProfiles, profileLabel, getMyProfile, type Profile } from "@/lib/profiles";
import { loadGrades, loadSubjects } from "@/lib/catalog";
import type { Assessment, AssessmentStatus } from "@/lib/assessment-schema";
import { ASSESSMENT_STATUS_LABEL, newAssessmentId } from "@/lib/assessment-schema";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Item { assessment: Assessment; userId: string; }

const ALL = "__all__";

const MisPruebas = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subjects] = useState(() => loadSubjects());
  const [grades] = useState(() => loadGrades());
  const [showAll, setShowAll] = useState(false);
  const [teacherFilter, setTeacherFilter] = useState<string>(ALL);
  const [subjectFilter, setSubjectFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const navigate = useNavigate();
  const { user, isStaff, isUtpHead } = useAuth();
  const [isAutonomous, setIsAutonomous] = useState(true); // default true until checked

  // Check if user is autonomous (no colegio_id)
  useEffect(() => {
    if (!user || isStaff) { setIsAutonomous(!isStaff); return; }
    supabase
      .from("profiles")
      .select("colegio_id")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAutonomous(!(data as { colegio_id: string | null } | null)?.colegio_id);
      });
  }, [user?.id, isStaff]);

  const refresh = async () => {
    const all = await listAssessmentsWithOwner();
    setItems(all);
  };

  useEffect(() => { refresh(); }, []);

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
    const ids = Array.from(new Set(items.map((i) => i.userId)));
    return ids
      .map((id) => ({ id, label: profileLabel(profileById.get(id), id) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items, profileById, isStaff]);

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
        meta: { ...a.meta, title: `Copia de ${a.meta.title || "Sin título"}` },
      };
      await upsertAssessment(copy);
      toast.success("Prueba duplicada");
      navigate(`/?id=${newId}`);
    } catch (e) {
      toast.error("No se pudo duplicar: " + (e as Error).message);
    }
  };

  const labelOf = (arr: { value: string; label: string }[], v: string) =>
    arr.find((x) => x.value === v)?.label ?? "—";

  const subjectOptions = useMemo(() => {
    if (!isStaff) return [];
    const values = Array.from(new Set(items.map((i) => i.assessment.meta.subjectValue).filter(Boolean)));
    return values
      .map((v) => ({ value: v, label: subjects.find((s) => s.value === v)?.label ?? v }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items, subjects, isStaff]);

  const visible = (() => {
    if (!isStaff || !showAll) {
      let list = items.filter((i) => i.userId === user?.id);
      if (statusFilter !== ALL) list = list.filter((i) => i.assessment.status === statusFilter);
      return list;
    }
    let list = items;
    if (teacherFilter !== ALL) list = list.filter((i) => i.userId === teacherFilter);
    if (subjectFilter !== ALL) list = list.filter((i) => i.assessment.meta.subjectValue === subjectFilter);
    if (statusFilter !== ALL) list = list.filter((i) => i.assessment.status === statusFilter);
    return list;
  })();

  return (
    <AppLayout>
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
            {isStaff && (
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
            {visible.map(({ assessment: a, userId }) => {
              const counted = a.questions.filter((q) => q.type !== "section-title" && q.type !== "info-block").length;
              const isOwn = userId === user?.id;
              const authorLabel = isStaff && !isOwn
                ? profileLabel(profileById.get(userId), userId)
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
                <Card key={a.id} className="shadow-card">
                  <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        {a.meta.title || "Sin título"}
                        <Badge className={`text-[10px] px-1.5 py-0 font-medium ${statusBadge.cls}`}>{statusBadge.label}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{labelOf(subjects, a.meta.subjectValue)}</span>
                        <span>·</span>
                        <span>{labelOf(grades, a.meta.gradeValue)}</span>
                        <span>·</span>
                        <span>{counted} pregunta{counted === 1 ? "" : "s"}</span>
                        <span>·</span>
                        <span>Actualizada {new Date(a.updatedAt).toLocaleString()}</span>
                        {authorLabel && (<><span>·</span><span className="font-medium">{authorLabel}</span></>)}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/?id=${a.id}`)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicate(a)}>
                      <Copy className="h-4 w-4" /> Duplicar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id, a.meta.title)}>
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MisPruebas;
