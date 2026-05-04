import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlans, type Plan } from "@/hooks/usePlans";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { BUILT_IN_TEMPLATES } from "@/lib/templates";

const TEMPLATE_OPTIONS = BUILT_IN_TEMPLATES.map((t) => ({ id: t.id, name: t.name }));

const emptyPlan = (): Omit<Plan, "created_at"> => ({
  id: "",
  label: "",
  max_assessments: 10,
  max_assignments: 5,
  can_export_docx: false,
  show_watermark: true,
  can_edit_layout: true,
  can_use_omr: false,
  allowed_templates: null,
  default_credits: 20,
  is_default: false,
  sort_order: 0,
});

export default function PlansManager() {
  const { plans, refresh } = usePlans();
  const [editing, setEditing] = useState<Omit<Plan, "created_at"> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    supabase
      .from("user_usage")
      .select("plan_type")
      .then(({ data }) => {
        const counts: Record<string, number> = {};
        (data ?? []).forEach((r: { plan_type: string }) => {
          counts[r.plan_type] = (counts[r.plan_type] ?? 0) + 1;
        });
        setUserCounts(counts);
      });
  }, [plans]);

  const openNew = () => {
    setEditing(emptyPlan());
    setIsNew(true);
  };

  const openEdit = (p: Plan) => {
    setEditing({ ...p });
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.id.trim() || !editing.label.trim()) {
      toast.error("ID y nombre son obligatorios");
      return;
    }
    if (!/^[a-z0-9_-]+$/.test(editing.id)) {
      toast.error("El ID solo puede contener letras minúsculas, números, guiones y guiones bajos");
      return;
    }
    setSaving(true);

    const row = {
      id: editing.id,
      label: editing.label,
      max_assessments: editing.max_assessments,
      max_assignments: editing.max_assignments,
      can_export_docx: editing.can_export_docx,
      show_watermark: editing.show_watermark,
      can_edit_layout: editing.can_edit_layout,
      default_credits: editing.default_credits,
      is_default: editing.is_default,
      sort_order: editing.sort_order,
    };

    // If marking as default, unset others first
    if (editing.is_default) {
      await supabase.from("plans").update({ is_default: false }).neq("id", editing.id);
    }

    const { error } = isNew
      ? await supabase.from("plans").insert(row as never)
      : await supabase.from("plans").update(row as never).eq("id", editing.id);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isNew ? "Plan creado" : "Plan actualizado");
    setEditing(null);
    refresh();
  };

  const handleDelete = async (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (plan?.is_default) {
      toast.error("No puedes eliminar el plan por defecto");
      return;
    }
    if ((userCounts[id] ?? 0) > 0) {
      toast.error(`No puedes eliminar este plan porque tiene ${userCounts[id]} usuario(s) asignados`);
      return;
    }
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Plan eliminado");
    refresh();
  };

  const limitLabel = (v: number | null) => (v === null ? "∞" : v.toString());

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Planes</CardTitle>
            <CardDescription>Gestiona los planes disponibles para los docentes</CardDescription>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> Nuevo plan
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="text-center">Pruebas</TableHead>
                <TableHead className="text-center">Asignaciones</TableHead>
                <TableHead className="text-center">.docx</TableHead>
                <TableHead className="text-center">Marca agua</TableHead>
                <TableHead className="text-center">Créditos</TableHead>
                <TableHead className="text-center">Usuarios</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    {p.id}
                    {p.is_default && <Badge variant="secondary" className="ml-2 text-[9px]">default</Badge>}
                  </TableCell>
                  <TableCell className="font-medium">{p.label}</TableCell>
                  <TableCell className="text-center">{limitLabel(p.max_assessments)}</TableCell>
                  <TableCell className="text-center">{limitLabel(p.max_assignments)}</TableCell>
                  <TableCell className="text-center">{p.can_export_docx ? "✓" : "✗"}</TableCell>
                  <TableCell className="text-center">{p.show_watermark ? "✓" : "✗"}</TableCell>
                  <TableCell className="text-center">{p.default_credits}</TableCell>
                  <TableCell className="text-center">{userCounts[p.id] ?? 0}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDelete(p.id)}
                      disabled={p.is_default || (userCounts[p.id] ?? 0) > 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuevo Plan" : `Editar: ${editing?.label}`}</DialogTitle>
            <DialogDescription>Configura las características del plan</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label>ID (slug)</Label>
                <Input
                  value={editing.id}
                  onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                  disabled={!isNew}
                  placeholder="ej: premium"
                />
              </div>
              <div className="space-y-1">
                <Label>Nombre visible</Label>
                <Input
                  value={editing.label}
                  onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                  placeholder="ej: Plan Premium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Máx. pruebas</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.max_assessments ?? ""}
                    onChange={(e) => setEditing({ ...editing, max_assessments: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="∞ (vacío)"
                  />
                  <p className="text-[10px] text-muted-foreground">Vacío = sin límite</p>
                </div>
                <div className="space-y-1">
                  <Label>Máx. asignaciones</Label>
                  <Input
                    type="number"
                    min={0}
                    value={editing.max_assignments ?? ""}
                    onChange={(e) => setEditing({ ...editing, max_assignments: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="∞ (vacío)"
                  />
                  <p className="text-[10px] text-muted-foreground">Vacío = sin límite</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Créditos IA por defecto</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.default_credits}
                  onChange={(e) => setEditing({ ...editing, default_credits: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label>Orden</Label>
                <Input
                  type="number"
                  value={editing.sort_order}
                  onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Exportar .docx</Label>
                  <Switch checked={editing.can_export_docx} onCheckedChange={(v) => setEditing({ ...editing, can_export_docx: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Marca de agua en PDF</Label>
                  <Switch checked={editing.show_watermark} onCheckedChange={(v) => setEditing({ ...editing, show_watermark: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Puede editar layout</Label>
                  <Switch checked={editing.can_edit_layout} onCheckedChange={(v) => setEditing({ ...editing, can_edit_layout: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Hoja de respuesta OMR</Label>
                  <Switch checked={editing.can_use_omr} onCheckedChange={(v) => setEditing({ ...editing, can_use_omr: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Plan por defecto (nuevos usuarios)</Label>
                  <Switch checked={editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isNew ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
