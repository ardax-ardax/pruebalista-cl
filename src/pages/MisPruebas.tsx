import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { FilePlus2, Library, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAssessment, listAssessmentsWithOwner } from "@/lib/assessment-storage";
import { listProfiles, profileLabel, type Profile } from "@/lib/profiles";
import { loadGrades, loadSubjects } from "@/lib/catalog";
import type { Assessment, AssessmentStatus } from "@/lib/assessment-schema";
import { ASSESSMENT_STATUS_LABEL } from "@/lib/assessment-schema";
import { useAuth } from "@/hooks/useAuth";

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
    if (!isStaff || !showAll) return items.filter((i) => i.userId === user?.id);
    let list = items;
    if (teacherFilter !== ALL) list = list.filter((i) => i.userId === teacherFilter);
    if (subjectFilter !== ALL) list = list.filter((i) => i.assessment.meta.subjectValue === subjectFilter);
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
              <Button variant="outline" size="sm" onClick={() => { setShowAll((v) => !v); setTeacherFilter(ALL); setSubjectFilter(ALL); }}>
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
            <Button asChild size="sm">
              <Link to="/"><FilePlus2 className="h-4 w-4" /> Nueva prueba</Link>
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
              return (
                <Card key={a.id} className="shadow-card">
                  <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.meta.title || "Sin título"}</div>
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
