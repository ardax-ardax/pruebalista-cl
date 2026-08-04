// Panel de administración avanzada de usuarios (solo admin).
// Cambio manual de plan + vencimiento, ajuste de créditos IA, vinculación a
// colegio y eliminación definitiva de la cuenta con confirmación fuerte.
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Coins, History, Save, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { usePlans } from "@/hooks/usePlans";
import { useAuth } from "@/hooks/useAuth";
import { profileLabel, type Profile } from "@/lib/profiles";
import {
  deleteUserAccount, listAllUsage, listAuthInfo, listColegios, listContentCounts,
  listUserAssessmentHistory, previewDeleteUser, setUserColegio,
  setUserCredits, setUserPlan, syncAllExpiredPlans,
  type AuthInfoRow, type ColegioOption, type DeleteUserCounts, type UserAssessmentHistoryItem,
  type UserContentCounts, type UserUsageRow,
} from "@/lib/admin-users";


const NO_COLEGIO = "__none__";

interface Props {
  profiles: Profile[];
  rolesByUser: Map<string, "admin" | "utp_head" | "docente">;
  onChanged: () => Promise<void> | void;
}

export const UserAdminPanel = ({ profiles, rolesByUser, onChanged }: Props) => {
  const { plans } = usePlans();
  const { isAdmin } = useAuth();
  const [usage, setUsage] = useState<Map<string, UserUsageRow>>(new Map());
  const [colegios, setColegios] = useState<ColegioOption[]>([]);
  const [creditDraft, setCreditDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  // Métricas (solo admin)
  const [authInfo, setAuthInfo] = useState<Map<string, AuthInfoRow>>(new Map());
  const [contentCounts, setContentCounts] = useState<Map<string, UserContentCounts>>(new Map());

  // Historial de actividad
  const [historyUser, setHistoryUser] = useState<Profile | null>(null);
  const [history, setHistory] = useState<UserAssessmentHistoryItem[] | null>(null);

  // Confirmación de baja de UTP
  const [utpWarn, setUtpWarn] = useState<{ userId: string; label: string } | null>(null);

  // Eliminación
  const [target, setTarget] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<DeleteUserCounts | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  const defaultPlan = useMemo(
    () => plans.find((p) => p.is_default)?.id ?? "free",
    [plans],
  );

  const reloadUsage = async () => {
    await syncAllExpiredPlans();
    setUsage(await listAllUsage());
  };

  useEffect(() => {
    reloadUsage();
    listColegios().then(setColegios);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    listAuthInfo().then(setAuthInfo);
    listContentCounts().then(setContentCounts);
  }, [isAdmin]);

  const openHistory = async (p: Profile) => {
    setHistoryUser(p);
    setHistory(null);
    setHistory(await listUserAssessmentHistory(p.id));
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";
  const fmtDateTime = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleString("es-CL", {
          day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
        })
      : "—";


  const handlePlanChange = async (userId: string, planId: string) => {
    setBusyId(userId);
    // Plan pagado sin fecha: se propone 1 mes desde hoy (editable en la fila).
    let expires: string | null = null;
    if (planId !== defaultPlan) {
      const existing = usage.get(userId)?.planExpiresAt;
      if (existing && new Date(existing) > new Date()) {
        expires = existing;
      } else {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        expires = d.toISOString();
      }
    }
    const res = await setUserPlan(userId, planId, expires);
    setBusyId(null);
    if (!res.ok) {
      toast.error("No se pudo cambiar el plan: " + res.error);
      return;
    }
    toast.success(expires ? "Plan actualizado (vence en 1 mes, ajústalo si quieres)" : "Plan actualizado");
    await reloadUsage();
  };

  const handleExpiresChange = async (userId: string, value: string) => {
    const row = usage.get(userId);
    if (!row) return;
    setBusyId(userId);
    const iso = value ? new Date(`${value}T23:59:59`).toISOString() : null;
    const res = await setUserPlan(userId, row.planType, iso);
    setBusyId(null);
    if (!res.ok) {
      toast.error("No se pudo guardar la fecha: " + res.error);
      return;
    }
    toast.success("Fecha de vencimiento actualizada");
    await reloadUsage();
  };

  const handleSaveCredits = async (userId: string) => {
    const raw = creditDraft[userId];
    const value = Number(raw);
    if (raw === undefined || raw === "" || Number.isNaN(value)) {
      toast.error("Ingresa un número válido");
      return;
    }
    setBusyId(userId);
    const res = await setUserCredits(userId, value);
    setBusyId(null);
    if (!res.ok) {
      toast.error("No se pudieron guardar los créditos: " + res.error);
      return;
    }
    toast.success("Créditos actualizados");
    setCreditDraft((d) => {
      const next = { ...d };
      delete next[userId];
      return next;
    });
    await reloadUsage();
  };

  const applyColegio = async (userId: string, colegioId: string | null) => {
    setBusyId(userId);
    const res = await setUserColegio(userId, colegioId);
    setBusyId(null);
    if (!res.ok) {
      toast.error("No se pudo actualizar el colegio: " + res.error);
      return;
    }
    toast.success(colegioId ? "Usuario asociado al colegio" : "Usuario desasociado del colegio");
    await onChanged();
  };

  const handleColegioChange = async (p: Profile, value: string) => {
    const colegioId = value === NO_COLEGIO ? null : value;
    const isUtp = rolesByUser.get(p.id) === "utp_head";
    if (!colegioId && isUtp && p.colegioId) {
      setUtpWarn({ userId: p.id, label: profileLabel(p, p.id) });
      return;
    }
    await applyColegio(p.id, colegioId);
  };

  const openDelete = async (p: Profile) => {
    setTarget(p);
    setConfirmEmail("");
    setCounts(null);
    const res = await previewDeleteUser(p.id);
    if (!res.ok) {
      toast.error("No se pudo leer el resumen: " + res.error);
      return;
    }
    setCounts(res.counts ?? null);
  };

  const confirmDelete = async () => {
    if (!target) return;
    setDeleting(true);
    const res = await deleteUserAccount(target.id);
    setDeleting(false);
    if (!res.ok) {
      toast.error("No se pudo eliminar: " + res.error);
      return;
    }
    toast.success("Usuario eliminado definitivamente");
    setTarget(null);
    await reloadUsage();
    await onChanged();
  };

  const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Planes, créditos y colegio</h3>
        <Badge variant="secondary" className="text-[10px]">{profiles.length}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Cambia manualmente el plan (con vencimiento), ajusta los créditos IA, vincula al colegio o elimina la cuenta.
        Los planes vencidos se degradan automáticamente al plan por defecto.
      </p>

      <div className="rounded-md border border-border max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Usuario</th>
              {isAdmin && <th className="text-left font-medium px-3 py-2 w-[170px]">Nombre completo</th>}
              {isAdmin && <th className="text-left font-medium px-3 py-2 w-[110px]">Registro</th>}
              {isAdmin && <th className="text-left font-medium px-3 py-2 w-[140px]">Último acceso</th>}
              {isAdmin && <th className="text-left font-medium px-3 py-2 w-[90px]">Pruebas</th>}
              {isAdmin && <th className="text-left font-medium px-3 py-2 w-[90px]">Preguntas</th>}
              <th className="text-left font-medium px-3 py-2 w-[150px]">Plan</th>
              <th className="text-left font-medium px-3 py-2 w-[150px]">Vence</th>
              <th className="text-left font-medium px-3 py-2 w-[150px]">Créditos IA</th>
              <th className="text-left font-medium px-3 py-2 w-[180px]">Colegio</th>
              <th className="px-3 py-2 w-[88px]" />
            </tr>

          </thead>
          <tbody>
            {profiles.map((p) => {
              const row = usage.get(p.id);
              const plan = row?.planType ?? defaultPlan;
              const isPaid = plan !== defaultPlan;
              const draft = creditDraft[p.id];
              const disabled = busyId === p.id;
              const info = authInfo.get(p.id);
              const cc = contentCounts.get(p.id);
              return (
                <tr key={p.id} className="border-t border-border align-top">
                  <td className="px-3 py-1.5">
                    <div className="font-medium truncate max-w-[180px]">{profileLabel(p, p.id)}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{p.email}</div>
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-1.5">
                      <span className="text-xs truncate block max-w-[170px]">
                        {info?.fullName ?? p.displayName ?? "—"}
                      </span>
                    </td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{fmtDate(info?.createdAt ?? null)}</td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{fmtDateTime(info?.lastSignInAt ?? null)}</td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-1.5 text-xs tabular-nums">{cc?.assessments ?? 0}</td>
                  )}
                  {isAdmin && (
                    <td className="px-3 py-1.5 text-xs tabular-nums">{cc?.questions ?? 0}</td>
                  )}

                  <td className="px-3 py-1.5">
                    <Select value={plan} onValueChange={(v) => handlePlanChange(p.id, v)} disabled={disabled}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {plans.map((pl) => (
                          <SelectItem key={pl.id} value={pl.id}>{pl.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    {isPaid ? (
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={toDateInput(row?.planExpiresAt ?? null)}
                        onChange={(e) => handleExpiresChange(p.id, e.target.value)}
                        disabled={disabled}
                      />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        className="h-8 w-20 text-xs"
                        value={draft ?? String(row?.creditsAvailable ?? 0)}
                        onChange={(e) => setCreditDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                        disabled={disabled}
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8"
                        title="Guardar créditos"
                        onClick={() => handleSaveCredits(p.id)}
                        disabled={disabled || draft === undefined}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Coins className="h-3 w-3" /> actual: {row?.creditsAvailable ?? 0}
                    </div>
                  </td>
                  <td className="px-3 py-1.5">
                    <Select
                      value={p.colegioId ?? NO_COLEGIO}
                      onValueChange={(v) => handleColegioChange(p, v)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_COLEGIO}>Sin colegio</SelectItem>
                        {colegios.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                    {isAdmin && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title="Ver historial"
                        onClick={() => openHistory(p)}
                      >
                        <History className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      title="Eliminar usuario"
                      onClick={() => openDelete(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Historial de actividad (solo admin) */}
      <Dialog open={!!historyUser} onOpenChange={(o) => !o && setHistoryUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Historial de {historyUser ? profileLabel(historyUser, historyUser.id) : ""}
            </DialogTitle>
            <DialogDescription>
              Últimas pruebas creadas por este usuario, de la más reciente a la más antigua.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] overflow-auto rounded-md border border-border divide-y divide-border">
            {history === null ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">Cargando historial…</div>
            ) : history.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                Este usuario aún no ha creado pruebas.
              </div>
            ) : (
              history.map((h) => (
                <div key={h.id} className="px-3 py-2 text-xs space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{h.title || "Sin título"}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{h.status}</Badge>
                  </div>
                  <div className="text-muted-foreground">
                    {fmtDateTime(h.createdAt)}
                    {(h.gradeLabel || h.subjectLabel) && " · "}
                    {[h.gradeLabel, h.subjectLabel].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryUser(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Advertencia al desasociar un Jefe UTP */}

      <Dialog open={!!utpWarn} onOpenChange={(o) => !o && setUtpWarn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Desasociar Jefe UTP
            </DialogTitle>
            <DialogDescription>
              {utpWarn?.label} tiene rol Jefe UTP. Si lo desasocias, el colegio puede quedar sin
              UTP responsable y perderá acceso a su panel institucional.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUtpWarn(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const id = utpWarn!.userId;
                setUtpWarn(null);
                await applyColegio(id, null);
              }}
            >
              Desasociar igualmente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminación definitiva */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Eliminar usuario
            </DialogTitle>
            <DialogDescription>
              Esta acción es irreversible. Se elimina al usuario y su acceso a la plataforma.
              Sus pruebas y preguntas <strong>se conservarán</strong> en la base general, visibles
              para el administrador como “Usuario eliminado”.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs space-y-1">
              {counts ? (
                <>
                  <div>Pruebas / evaluaciones creadas: <strong>{counts.assessments}</strong> (se conservan)</div>
                  <div>Preguntas en banco: <strong>{counts.questions}</strong> (se conservan)</div>
                  <div>Asignaciones curso/asignatura: <strong>{counts.assignments}</strong> (se eliminan)</div>
                  <div>Tickets de soporte: <strong>{counts.tickets}</strong></div>
                </>
              ) : (
                <div className="text-muted-foreground">Calculando contenido asociado…</div>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Escribe <span className="font-mono">{target?.email}</span> para confirmar
              </Label>
              <Input
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={target?.email ?? ""}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={
                deleting ||
                !target?.email ||
                confirmEmail.trim().toLowerCase() !== (target?.email ?? "").toLowerCase()
              }
              onClick={confirmDelete}
            >
              {deleting ? "Eliminando…" : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
