// Panel de Gestión de Personal — exclusivo para Admin.
// UI compacta con scroll interno. Permite (a) cambiar el rol de cada usuario,
// (b) administrar las asignaciones docente ↔ curso ↔ asignatura, y (c)
// sincronizar perfiles desde Auth si la tabla profiles está incompleta.
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, ShieldCheck, RefreshCw, Users, Mail } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import {
  bulkInviteEmails,
  deleteInvitation,
  listInvitations,
  type InvitationRole,
  type PendingInvitation,
} from "@/lib/invitations";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { listProfiles, profileLabel, syncProfilesFromAuth, type Profile } from "@/lib/profiles";
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

type AppRole = "admin" | "utp_head" | "docente";

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrador",
  utp_head: "Jefe UTP",
  docente: "Docente",
};

const ROLE_PRIORITY: Record<AppRole, number> = { admin: 3, utp_head: 2, docente: 1 };

const topRole = (roles: AppRole[]): AppRole | null => {
  if (roles.length === 0) return null;
  return roles.reduce<AppRole>(
    (acc, r) => ((ROLE_PRIORITY[r] ?? 0) > (ROLE_PRIORITY[acc] ?? 0) ? r : acc),
    roles[0],
  );
};

export const StaffManager = () => {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Map<string, AppRole>>(new Map());
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [grades] = useState<GradeOption[]>(() => loadGrades());
  const [subjects] = useState<SubjectOption[]>(() => loadSubjects());
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form de nueva asignación
  const [newTeacher, setNewTeacher] = useState<string>("");
  const [newGrade, setNewGrade] = useState<string>("");
  const [newSubject, setNewSubject] = useState<string>("");
  const [newLetter, setNewLetter] = useState<string>("A");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Invitaciones masivas
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [bulkText, setBulkText] = useState("");
  const [bulkRole, setBulkRole] = useState<InvitationRole>("docente");
  const [importing, setImporting] = useState(false);

  const refresh = async () => {
    const [profsRes, rolesRes, asg, invs] = await Promise.all([
      listProfiles(),
      supabase.from("user_roles").select("user_id, role"),
      listAllAssignments(),
      listInvitations(),
    ]);
    setProfiles(profsRes.profiles);
    setLoadError(profsRes.error);
    if (profsRes.error) {
      toast.error("No se pudo cargar perfiles: " + profsRes.error);
    }
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
    setInvitations(invs);
  };

  const handleBulkImport = async () => {
    if (!bulkText.trim()) {
      toast.error("Pega al menos un correo");
      return;
    }
    setImporting(true);
    const res = await bulkInviteEmails(bulkText, bulkRole, user?.id ?? null);
    setImporting(false);
    if (!res.ok) {
      toast.error("No se pudo importar: " + (res.error ?? ""));
      return;
    }
    const r = res.result!;
    const parts: string[] = [];
    parts.push(`${r.inserted} invitación${r.inserted === 1 ? "" : "es"} creada${r.inserted === 1 ? "" : "s"}`);
    if (r.skipped > 0) parts.push(`${r.skipped} ya existía${r.skipped === 1 ? "" : "n"}`);
    if (r.invalid.length > 0) parts.push(`${r.invalid.length} correo${r.invalid.length === 1 ? "" : "s"} inválido${r.invalid.length === 1 ? "" : "s"}`);
    toast.success(parts.join(" · "));
    setBulkText("");
    await refresh();
  };

  const handleDeleteInvitation = async (id: string) => {
    if (!confirm("¿Eliminar esta invitación?")) return;
    const res = await deleteInvitation(id);
    if (!res.ok) {
      toast.error("No se pudo eliminar: " + (res.error ?? ""));
      return;
    }
    toast.success("Invitación eliminada");
    await refresh();
  };

  // Recarga cuando cambia la sesión (evita la condición de carrera con auth).
  useEffect(() => {
    if (!user) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSync = async () => {
    setSyncing(true);
    const res = await syncProfilesFromAuth();
    setSyncing(false);
    if (!res.ok) {
      toast.error("No se pudo sincronizar: " + (res.error ?? ""));
      return;
    }
    toast.success(`Sincronizados ${res.synced ?? 0} perfiles (${res.total ?? 0} usuarios en Auth).`);
    await refresh();
  };

  const subjectsForNewGrade = useMemo(() => {
    if (!newGrade) return [];
    return getSubjectsForGrade(newGrade, subjects, grades);
  }, [newGrade, subjects, grades]);

  const handleRoleChange = async (userId: string, role: AppRole) => {
    setBusy(true);
    try {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role });
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
    const res = await addAssignment(newTeacher, newGrade, newSubject, newLetter);
    setBusy(false);
    if (!res.ok) {
      toast.error("No se pudo crear: " + (res.error ?? ""));
      return;
    }
    toast.success("Asignación creada");
    setNewSubject("");
    setNewLetter("A");
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Gestión de Personal
            </CardTitle>
            <CardDescription>
              Asigna roles del sistema y vincula a cada docente con sus cursos y asignaturas.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar perfiles desde Auth
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loadError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Error al cargar perfiles: {loadError}
          </div>
        )}

        {/* Roles */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Roles de usuarios</h3>
            <Badge variant="secondary" className="text-[10px]">{profiles.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Docente: solo sus pruebas. Jefe UTP: supervisa todas. Admin: acceso total.
          </p>

          <div className="rounded-md border border-border max-h-[280px] overflow-y-auto">
            {profiles.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No hay perfiles cargados. Usa “Sincronizar perfiles desde Auth”.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Usuario</th>
                    <th className="text-left font-medium px-3 py-2 hidden sm:table-cell">Email</th>
                    <th className="text-left font-medium px-3 py-2 w-[170px]">Rol</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => {
                    const current = (rolesByUser.get(p.id) ?? "docente") as AppRole;
                    return (
                      <tr key={p.id} className="border-t border-border">
                        <td className="px-3 py-1.5">
                          <div className="font-medium truncate max-w-[200px]">
                            {profileLabel(p, p.id)}
                          </div>
                          <div className="text-[11px] text-muted-foreground sm:hidden truncate max-w-[200px]">
                            {p.email}
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-xs text-muted-foreground hidden sm:table-cell truncate max-w-[220px]">
                          {p.email}
                        </td>
                        <td className="px-3 py-1.5">
                          <Select
                            value={current}
                            onValueChange={(v) => handleRoleChange(p.id, v as AppRole)}
                            disabled={busy}
                          >
                            <SelectTrigger className="h-8 w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="docente">Docente</SelectItem>
                              <SelectItem value="utp_head">Jefe UTP</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Asignaciones */}
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Asignaciones docente · curso · asignatura</h3>
          <p className="text-xs text-muted-foreground">
            Define qué cursos y asignaturas puede usar cada docente al crear pruebas.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_auto] gap-2 rounded-md border border-dashed border-border p-2.5">
            <Select value={newTeacher} onValueChange={setNewTeacher}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Docente" /></SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{profileLabel(p, p.id)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newGrade} onValueChange={(v) => { setNewGrade(v); setNewSubject(""); }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Curso" /></SelectTrigger>
              <SelectContent>
                {grades.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={newLetter} onValueChange={setNewLetter}>
              <SelectTrigger className="h-9 w-[70px]"><SelectValue placeholder="Letra" /></SelectTrigger>
              <SelectContent>
                {["A", "B", "C", "D", "E", "F"].map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={newSubject} onValueChange={setNewSubject} disabled={!newGrade}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder={newGrade ? "Asignatura" : "Primero el curso"} />
              </SelectTrigger>
              <SelectContent>
                {subjectsForNewGrade.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAddAssignment} disabled={busy} className="gap-2 h-9">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          </div>

          <div className="rounded-md border border-border max-h-[260px] overflow-y-auto divide-y">
            {assignmentsByTeacher.size === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Aún no hay asignaciones registradas.
              </p>
            ) : (
              Array.from(assignmentsByTeacher.entries()).map(([teacherId, items]) => {
                const p = profileById.get(teacherId);
                return (
                  <div key={teacherId} className="px-3 py-2 space-y-1.5">
                    <div className="text-xs font-medium truncate">
                      {profileLabel(p, teacherId)}
                      {p?.email ? <span className="text-muted-foreground ml-2">{p.email}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px]"
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
              })
            )}
          </div>
        </section>

        {/* Importación masiva por email */}
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Importación masiva por email</h3>
            <Badge variant="secondary" className="text-[10px]">{invitations.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Pega una lista de correos (separados por coma, espacio o salto de línea). Al iniciar sesión por primera vez, cada usuario recibirá automáticamente el rol indicado.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2">
            <Textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="profesor1@cnlc.cl, profesor2@cnlc.cl&#10;profesor3@cnlc.cl"
              rows={3}
              className="text-xs"
            />
            <div className="flex flex-col gap-2">
              <Select value={bulkRole} onValueChange={(v) => setBulkRole(v as InvitationRole)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="docente">Docente</SelectItem>
                  <SelectItem value="utp_head">Jefe UTP</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
              <Button
                onClick={handleBulkImport}
                disabled={importing || !bulkText.trim()}
                size="sm"
                className="gap-2"
              >
                <Plus className="h-3.5 w-3.5" />
                {importing ? "Importando…" : "Importar"}
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border max-h-[220px] overflow-y-auto">
            {invitations.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Aún no hay invitaciones pendientes.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-3 py-2">Email</th>
                    <th className="text-left font-medium px-3 py-2 w-[120px]">Rol</th>
                    <th className="text-left font-medium px-3 py-2 w-[110px]">Estado</th>
                    <th className="px-3 py-2 w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-3 py-1.5 truncate max-w-[260px]">{inv.email}</td>
                      <td className="px-3 py-1.5 text-xs">{ROLE_LABELS[inv.role]}</td>
                      <td className="px-3 py-1.5">
                        {inv.consumed_at ? (
                          <Badge variant="secondary" className="text-[10px]">Consumida</Badge>
                        ) : (
                          <Badge className="text-[10px]">Pendiente</Badge>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteInvitation(inv.id)}
                          className="text-destructive hover:text-destructive/80"
                          title="Eliminar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </CardContent>
    </Card>
  );
};
