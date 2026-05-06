import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { profileLabel, type Profile } from "@/lib/profiles";

interface Colegio {
  id: string;
  nombre: string;
  logo_url: string | null;
  created_at: string;
}

interface ColegioMember {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
}

export const ColegiosManager = () => {
  const { user } = useAuth();
  const [colegios, setColegios] = useState<Colegio[]>([]);
  const [members, setMembers] = useState<Map<string, ColegioMember[]>>(new Map());
  const [unlinkedUsers, setUnlinkedUsers] = useState<Array<{ id: string; email: string | null; display_name: string | null }>>([]);
  const [selectedUserToLink, setSelectedUserToLink] = useState<string>("");
  const [newNombre, setNewNombre] = useState("");
  const [newUtpEmail, setNewUtpEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = async () => {
    const { data, error } = await supabase
      .from("colegios")
      .select("id, nombre, logo_url, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Error cargando colegios: " + error.message);
      return;
    }
    setColegios(data ?? []);

    // Load members for each colegio
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, display_name, colegio_id")
      .not("colegio_id", "is", null);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role");

    const roleMap = new Map<string, string>();
    for (const r of roles ?? []) {
      const existing = roleMap.get(r.user_id);
      if (!existing || r.role === "utp_head" || r.role === "admin") {
        roleMap.set(r.user_id, r.role);
      }
    }

    const memberMap = new Map<string, ColegioMember[]>();
    for (const p of (profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null; colegio_id: string }>) {
      const arr = memberMap.get(p.colegio_id) ?? [];
      arr.push({
        id: p.id,
        email: p.email,
        display_name: p.display_name,
        role: roleMap.get(p.id) ?? "docente",
      });
      memberMap.set(p.colegio_id, arr);
    }
    setMembers(memberMap);

    // Load unlinked users (no colegio_id)
    const { data: unlinked } = await supabase
      .from("profiles")
      .select("id, email, display_name")
      .is("colegio_id", null);
    setUnlinkedUsers(unlinked ?? []);
  };

  const handleLinkUser = async (userId: string, colegioId: string) => {
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ colegio_id: colegioId })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      toast.error("Error al vincular: " + error.message);
      return;
    }
    toast.success("Usuario vinculado al colegio.");
    setSelectedUserToLink("");
    await refresh();
  };

  const handleUnlinkUser = async (userId: string, displayLabel: string) => {
    if (!confirm(`¿Desvincular a "${displayLabel}" de este colegio?`)) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ colegio_id: null })
      .eq("id", userId);
    setBusy(false);
    if (error) {
      toast.error("Error al desvincular: " + error.message);
      return;
    }
    toast.success("Usuario desvinculado del colegio.");
    await refresh();
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleCreate = async () => {
    if (!newNombre.trim()) {
      toast.error("Ingresa el nombre del colegio");
      return;
    }
    if (!newUtpEmail.trim()) {
      toast.error("Ingresa el email del Jefe UTP");
      return;
    }

    setBusy(true);
    try {
      // Create colegio
      const { data: colegio, error: colegioErr } = await supabase
        .from("colegios")
        .insert({ nombre: newNombre.trim(), created_by: user?.id })
        .select("id")
        .single();
      if (colegioErr) throw colegioErr;

      // Create pending invitation for UTP with colegio_id
      const { error: invErr } = await supabase
        .from("pending_invitations")
        .upsert(
          {
            email: newUtpEmail.trim().toLowerCase(),
            role: "utp_head" as const,
            invited_by: user?.id,
            colegio_id: colegio.id,
          },
          { onConflict: "email", ignoreDuplicates: false }
        );
      if (invErr) throw invErr;

      toast.success(`Colegio "${newNombre.trim()}" creado. Invitación UTP enviada a ${newUtpEmail.trim()}.`);
      setNewNombre("");
      setNewUtpEmail("");
      await refresh();
    } catch (e) {
      toast.error("Error: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Eliminar el colegio "${nombre}"? Los usuarios vinculados quedarán sin colegio.`)) return;
    setBusy(true);
    const { error } = await supabase.from("colegios").delete().eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("No se pudo eliminar: " + error.message);
      return;
    }
    toast.success("Colegio eliminado");
    await refresh();
  };

  const ROLE_LABELS: Record<string, string> = {
    admin: "Admin",
    utp_head: "Jefe UTP",
    docente: "Docente",
  };

  return (
    <Card className="shadow-card mb-8 border-primary/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Gestión de Colegios
        </CardTitle>
        <CardDescription>
          Crea colegios y asigna un Jefe UTP responsable. Al registrarse con el email indicado, recibirá automáticamente el rol de Jefe UTP vinculado a ese colegio.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create form */}
        <div className="rounded-md border border-dashed border-border p-3 space-y-3">
          <h4 className="text-sm font-medium">Nuevo colegio</h4>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <div>
              <Label className="text-xs">Nombre del colegio</Label>
              <Input
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                placeholder="Ej: Colegio San Martín"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Email del Jefe UTP</Label>
              <Input
                type="email"
                value={newUtpEmail}
                onChange={(e) => setNewUtpEmail(e.target.value)}
                placeholder="utp@colegio.cl"
                className="h-9"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreate} disabled={busy} className="gap-2 h-9">
                <Plus className="h-4 w-4" />
                Crear
              </Button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold">Colegios registrados</h4>
            <Badge variant="secondary" className="text-[10px]">{colegios.length}</Badge>
          </div>

          {colegios.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              No hay colegios creados aún.
            </p>
          ) : (
            <div className="rounded-md border border-border divide-y">
              {colegios.map((c) => {
                const mems = members.get(c.id) ?? [];
                const isExpanded = expandedId === c.id;
                return (
                  <div key={c.id} className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm truncate">{c.nombre}</span>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          <Users className="h-3 w-3 mr-1" />
                          {mems.length}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          className="text-xs h-7"
                        >
                          {isExpanded ? "Ocultar" : "Ver miembros"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive/80"
                          onClick={() => handleDelete(c.id, c.nombre)}
                          disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 pl-2 space-y-1">
                        {mems.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sin miembros aún.</p>
                        ) : (
                          mems.map((m) => (
                            <div key={m.id} className="flex items-center gap-2 text-xs">
                              <span className="truncate max-w-[200px]">
                                {m.display_name || m.email || m.id.slice(0, 8)}
                              </span>
                              <Badge variant="secondary" className="text-[10px]">
                                {ROLE_LABELS[m.role] ?? m.role}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
