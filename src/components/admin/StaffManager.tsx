// Panel de Gestión de Personal — exclusivo para Admin.
// Permite (a) cambiar el rol de cada usuario y (b) administrar las
// asignaciones docente ↔ curso ↔ asignatura usadas para filtrar el catálogo
// de OAs en AssessmentMetaForm.
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { listProfiles, profileLabel, type Profile } from "@/lib/profiles";
import {
  addAssignment,
  listAllAssignments,
  removeAssignment,
  type TeacherAssignment,
} from "@/lib/teacher-assignments";
import {
  getSubjectsForGrade,
  loadGrades,
  loadSubjects,
  type GradeOption,
  type SubjectOption,
} from "@/lib/catalog";

type AppRole = "admin" | "utp_head" | "user";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  utp_head: "Jefe UTP",
  user: "Docente",
};

const ROLE_PRIORITY: Record<AppRole, number> = { admin: 3, utp_head: 2, user: 1 };

const topRole = (roles: AppRole[]): AppRole | null => {
  if (roles.length === 0) return null;
  return roles.reduce<AppRole>(
    (acc, r) => ((ROLE_PRIORITY[r] ?? 0) > (ROLE_PRIORITY[acc] ?? 0) ? r : acc),
    roles[0],
  );
};

export const StaffManager = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Map<string, AppRole>>(new Map());
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [grades] = useState<GradeOption[]>(() => loadGrades());
  const [subjects] = useState<SubjectOption[]>(() => loadSubjects());

  // Form de nueva asignación
  const [newTeacher, setNewTeacher] = useState<string>("");
  const [newGrade, setNewGrade] = useState<string>("");
  const [newSubject, setNewSubject] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const [profs, rolesRes, asg] = await Promise.all([
      listProfiles(),
      supabase.from("user_roles").select("user_id, role"),
      listAllAssignments(),
    ]);
    setProfiles(profs);
    const map = new Map<string, AppRole>();
    const grouped = new Map<string, AppRole[]>();
    for (const r of (rolesRes.data ?? []) as { user_id: string; role: AppRole }[]) {
      const arr = grouped.get(r.user_id) ?? [];
      arr.push(r.role);
      grouped.set(r.user_id, arr);
    }
    grouped.forEach((roles, uid) => {
      const t = topRole(roles);
      if (t) map.set(uid, t);
    });
    setRolesByUser(map);
    setAssignments(asg);
  };

  useEffect(() => { refresh(); }, []);

  const subjectsForNewGrade = useMemo(() => {
    if (!newGrade) return [];
    return getSubjectsForGrade(newGrade, subjects, grades);
  }, [newGrade, subjects, grades]);

  const handleRoleChange = async (userId: string, role: AppRole) => {
    setBusy(true);
    try {
      // Reemplazar todos los roles del usuario por el seleccionado.
      const { error: delErr } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (insErr) throw insErr;
      toast.success(`Rol actualizado a ${ROLE_LABELS[role]}`);
      await refresh();
    } catch (e) {
      toast.error("No se pudo actualizar el rol: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!newTeacher || !newGrade || !newSubject) {
      toast.error("Selecciona docente, curso y asignatura");
      return;
    }
    setBusy(true);
    const res = await addAssignment(newTeacher, newGrade, newSubject);
    setBusy(false);
    if (!res.ok) {
      toast.error("No se pudo crear: " + (res.error ?? ""));
      return;
    }
    toast.success("Asignación creada");
    setNewSubject("");
    await refresh();
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!confirm("¿Eliminar esta asignación?")) return;
    const res = await removeAssignment(id);
    if (!res.ok) {
      toast.error("No se pudo eliminar: " + (res.error ?? ""));
      return;
    }
    toast.success("Asignación eliminada");
    await refresh();
  };

  // Agrupa asignaciones por docente para mostrarlas ordenadas.
  const assignmentsByTeacher = useMemo(() => {
    const m = new Map<string, TeacherAssignment[]>();
    for (const a of assignments) {
      const arr = m.get(a.teacher_user_id) ?? [];
      arr.push(a);
      m.set(a.teacher_user_id, arr);
    }
    return m;
  }, [assignments]);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const gradeLabel = (v: string) => grades.find((g) => g.value === v)?.label ?? v;
  const subjectLabel = (v: string) => subjects.find((s) => s.value === v)?.label ?? v;

  return (
    <Card className="shadow-card mb-8 border-primary/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Gestión de Personal
        </CardTitle>
        <CardDescription>
          Solo administradores. Asigna roles del sistema y vincula a cada docente con
          los cursos y asignaturas que dicta. Esto controla qué OAs puede ver al crear pruebas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-10">
        {/* Roles */}
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Roles de usuarios</h3>
            <p className="text-xs text-muted-foreground">
              Docente: solo ve sus pruebas y los OAs de sus cursos asignados. Jefe UTP: supervisa
              todas las pruebas. Administrador: acceso total.
            </p>
          </div>
          {profiles.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay usuarios registrados aún.</p>
          ) : (
            <div className="rounded-md border border-border divide-y">
              {profiles.map((p) => {
                const current = rolesByUser.get(p.id) ?? "user";
                return (
                  <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {profileLabel(p, p.id)}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {ROLE_LABELS[current as AppRole]}
                    </Badge>
                    <Select
                      value={current}
                      onValueChange={(v) => handleRoleChange(p.id, v as AppRole)}
                      disabled={busy}
                    >
                      <SelectTrigger className="h-8 w-[180px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Docente</SelectItem>
                        <SelectItem value="utp_head">Jefe UTP</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Asignaciones */}
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Asignaciones docente ↔ curso ↔ asignatura</h3>
            <p className="text-xs text-muted-foreground">
              Cada combinación permitirá al docente seleccionar ese curso y asignatura
              al crear pruebas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 rounded-md border border-dashed border-border p-3">
            <Select value={newTeacher} onValueChange={(v) => { setNewTeacher(v); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Docente" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{profileLabel(p, p.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={newGrade}
              onValueChange={(v) => { setNewGrade(v); setNewSubject(""); }}
            >
              <SelectTrigger className="h-9"><SelectValue placeholder="Curso" /></SelectTrigger>
              <SelectContent>
                {grades.map((g) => (
                  <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={newSubject}
              onValueChange={setNewSubject}
              disabled={!newGrade}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={newGrade ? "Asignatura" : "Primero el curso"} />
              </SelectTrigger>
              <SelectContent>
                {subjectsForNewGrade.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddAssignment} disabled={busy} className="gap-2">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>

          {assignmentsByTeacher.size === 0 ? (
            <p className="text-xs text-muted-foreground">Aún no hay asignaciones registradas.</p>
          ) : (
            <div className="rounded-md border border-border divide-y">
              {Array.from(assignmentsByTeacher.entries()).map(([teacherId, items]) => {
                const p = profileById.get(teacherId);
                return (
                  <div key={teacherId} className="p-3 space-y-2">
                    <div className="text-sm font-medium">
                      {profileLabel(p, teacherId)}
                      {p?.email ? <span className="text-xs text-muted-foreground ml-2">{p.email}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
                        >
                          <span className="font-medium">{gradeLabel(a.grade_value)}</span>
                          <span className="text-muted-foreground">·</span>
                          <span>{subjectLabel(a.subject_value)}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveAssignment(a.id)}
                            className="ml-1 text-destructive hover:text-destructive/80"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
};
