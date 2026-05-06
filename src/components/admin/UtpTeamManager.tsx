import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Plus, Trash2, UserPlus, Users, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile } from "@/lib/profiles";

interface TeamMember {
  id: string;
  email: string | null;
  displayName: string | null;
}

interface PendingInv {
  id: string;
  email: string;
  createdAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function UtpTeamManager() {
  const { user } = useAuth();
  const [colegioId, setColegioId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pending, setPending] = useState<PendingInv[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const profile = await getMyProfile();
    if (!profile?.colegioId) {
      setLoading(false);
      return;
    }
    setColegioId(profile.colegioId);
    console.log("[UtpTeamManager] colegio_id del usuario actual:", profile.colegioId);

    const { data: teamData } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .eq("colegio_id", profile.colegioId)
      .neq("id", user?.id ?? "");

    if (teamData) {
      setMembers(
        teamData.map((m) => ({
          id: m.id,
          email: m.email,
          displayName: m.display_name,
        }))
      );
    }

    const { data: invData } = await supabase
      .from("pending_invitations")
      .select("id, email, created_at")
      .eq("colegio_id", profile.colegioId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false });

    if (invData) {
      setPending(
        invData.map((i) => ({
          id: i.id,
          email: i.email,
          createdAt: i.created_at,
        }))
      );
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user?.id]);

  const handleAssign = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_RE.test(trimmed)) {
      toast.error("Ingresa un correo electrónico válido.");
      return;
    }
    if (!colegioId) {
      toast.error("No se encontró el colegio asociado a tu cuenta.");
      return;
    }

    setSubmitting(true);

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, colegio_id, email")
      .eq("email", trimmed)
      .maybeSingle();

    if (existingProfile) {
      if (existingProfile.colegio_id === colegioId) {
        toast.info("Este docente ya está vinculado a tu colegio.");
        setSubmitting(false);
        return;
      }
      if (existingProfile.colegio_id) {
        toast.error("Este docente ya pertenece a otro colegio.");
        setSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ colegio_id: colegioId })
        .eq("id", existingProfile.id);

      if (error) {
        toast.error("No se pudo vincular: " + error.message);
        setSubmitting(false);
        return;
      }

      toast.success(`${trimmed} vinculado al colegio exitosamente.`);
      setEmail("");
      setSubmitting(false);
      load();
      return;
    }

    const { error } = await supabase.from("pending_invitations").upsert(
      {
        email: trimmed,
        role: "docente" as const,
        colegio_id: colegioId,
        invited_by: user?.id ?? null,
      },
      { onConflict: "email", ignoreDuplicates: true }
    );

    if (error) {
      toast.error("No se pudo crear la invitación: " + error.message);
      setSubmitting(false);
      return;
    }

    toast.success(`Invitación enviada a ${trimmed}. Se vinculará automáticamente al registrarse.`);
    setEmail("");
    setSubmitting(false);
    load();
  };

  const handleRemoveInvitation = async (id: string) => {
    const { error } = await supabase.from("pending_invitations").delete().eq("id", id);
    if (error) {
      toast.error("Error al eliminar invitación.");
      return;
    }
    setPending((prev) => prev.filter((p) => p.id !== id));
    toast.success("Invitación eliminada.");
  };

  const initials = (name: string | null, em: string | null) => {
    const src = name || em || "?";
    return src
      .split(/[\s@]/)
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Cargando equipo…
      </div>
    );
  }

  if (!colegioId) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-12 text-center space-y-3">
          <Users className="h-10 w-10 mx-auto text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">
            Tu cuenta aún no ha sido vinculada a un colegio. Contacta al administrador para que te asigne a uno.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-card border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Vincular Nuevo Docente
          </CardTitle>
          <CardDescription>
            Ingresa el correo de Google del docente. Si ya tiene cuenta, se vinculará
            automáticamente. Si no, quedará como invitación pendiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="correo@gmail.com"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAssign()}
              className="flex-1"
            />
            <Button onClick={handleAssign} disabled={submitting} className="gap-2 shrink-0">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Asignar al Colegio
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            Equipo Docente
            <Badge variant="secondary" className="text-[10px] ml-1">{members.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aún no hay docentes vinculados a tu colegio.
            </p>
          ) : (
            <div className="space-y-2">
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-xs">{initials(m.displayName, m.email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{m.displayName || "Sin nombre"}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Activo
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {pending.length > 0 && (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              Invitaciones Pendientes
              <Badge variant="secondary" className="text-[10px] ml-1">{pending.length}</Badge>
            </CardTitle>
            <CardDescription>
              Estos correos se vincularán automáticamente cuando se registren con Google.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pending.map((inv) => (
                <div key={inv.id} className="flex items-center gap-3 rounded-lg border border-dashed border-border p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{inv.email}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Invitado el {new Date(inv.createdAt).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemoveInvitation(inv.id)} title="Eliminar invitación">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
