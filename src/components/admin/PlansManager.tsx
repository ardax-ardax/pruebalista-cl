import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlans, type Plan } from "@/hooks/usePlans";
import { toast } from "sonner";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { BUILT_IN_TEMPLATES } from "@/lib/templates";

const TEMPLATE_OPTIONS = BUILT_IN_TEMPLATES.map((t) => ({ id: t.id, name: t.name }));

const emptyPlan = (nextOrder: number): Omit<Plan, "created_at"> => ({
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
  sort_order: nextOrder,
});

function SortableRow({
  plan,
  userCount,
  onEdit,
  onDelete,
  limitLabel,
}: {
  plan: Plan;
  userCount: number;
  onEdit: (p: Plan) => void;
  onDelete: (id: string) => void;
  limitLabel: (v: number | null) => string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: plan.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <button
          className="cursor-grab active:cursor-grabbing touch-none p-1 text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {plan.id}
        {plan.is_default && <Badge variant="secondary" className="ml-2 text-[9px]">default</Badge>}
      </TableCell>
      <TableCell className="font-medium">{plan.label}</TableCell>
      <TableCell className="text-center">{limitLabel(plan.max_assessments)}</TableCell>
      <TableCell className="text-center">{limitLabel(plan.max_assignments)}</TableCell>
      <TableCell className="text-center">{plan.can_export_docx ? "✓" : "✗"}</TableCell>
      <TableCell className="text-center">{plan.show_watermark ? "✓" : "✗"}</TableCell>
      <TableCell className="text-center">{plan.default_credits}</TableCell>
      <TableCell className="text-center">{userCount}</TableCell>
      <TableCell className="text-right space-x-1">
        <Button size="icon" variant="ghost" onClick={() => onEdit(plan)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive"
          onClick={() => onDelete(plan.id)}
          disabled={plan.is_default || userCount > 0}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function PlansManager() {
  const { plans, refresh } = usePlans();
  const [editing, setEditing] = useState<Omit<Plan, "created_at"> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userCounts, setUserCounts] = useState<Record<string, number>>({});
  const [localPlans, setLocalPlans] = useState<Plan[]>([]);

  // Admin courses for restriction
  const [adminCourses, setAdminCourses] = useState<{ id: string; label: string }[]>([]);
  const [planCourseMap, setPlanCourseMap] = useState<Record<string, string[]>>({});
  const [editingCourses, setEditingCourses] = useState<string[]>([]);

  useEffect(() => {
    setLocalPlans(plans);
  }, [plans]);

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

  // Load admin courses + plan restrictions
  useEffect(() => {
    supabase.from("admin_courses").select("id, label").order("sort_order").then(({ data }) => {
      setAdminCourses((data ?? []) as { id: string; label: string }[]);
    });
    supabase.from("plan_allowed_courses").select("plan_id, course_id").then(({ data }) => {
      const map: Record<string, string[]> = {};
      (data ?? []).forEach((r: { plan_id: string; course_id: string }) => {
        if (!map[r.plan_id]) map[r.plan_id] = [];
        map[r.plan_id].push(r.course_id);
      });
      setPlanCourseMap(map);
    });
  }, [plans]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localPlans.findIndex((p) => p.id === active.id);
    const newIndex = localPlans.findIndex((p) => p.id === over.id);
    const reordered = arrayMove(localPlans, oldIndex, newIndex);
    setLocalPlans(reordered);

    // Persist new sort_order values
    const updates = reordered.map((p, i) => ({ id: p.id, sort_order: i }));
    for (const u of updates) {
      await supabase.from("plans").update({ sort_order: u.sort_order } as never).eq("id", u.id);
    }
    refresh();
  };

  const openNew = () => {
    const maxOrder = localPlans.reduce((max, p) => Math.max(max, p.sort_order), -1);
    setEditing(emptyPlan(maxOrder + 1));
    setEditingCourses([]);
    setIsNew(true);
  };

  const openEdit = (p: Plan) => {
    setEditing({ ...p });
    setEditingCourses(planCourseMap[p.id] ?? []);
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
      can_use_omr: editing.can_use_omr,
      allowed_templates: editing.allowed_templates,
      default_credits: editing.default_credits,
      is_default: editing.is_default,
      sort_order: editing.sort_order,
    };

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

    // Save allowed courses
    await supabase.from("plan_allowed_courses").delete().eq("plan_id", editing.id);
    if (editingCourses.length > 0) {
      await supabase.from("plan_allowed_courses").insert(
        editingCourses.map((cid) => ({ plan_id: editing.id, course_id: cid }))
      );
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
            <CardDescription>Gestiona los planes disponibles para los docentes. Arrastra para reordenar.</CardDescription>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> Nuevo plan
          </Button>
        </CardHeader>
        <CardContent>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
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
              <SortableContext items={localPlans.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {localPlans.map((p) => (
                    <SortableRow
                      key={p.id}
                      plan={p}
                      userCount={userCounts[p.id] ?? 0}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      limitLabel={limitLabel}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </DndContext>
        </CardContent>
      </Card>

      {/* Edit / Create Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuevo Plan" : `Editar: ${editing?.label}`}</DialogTitle>
            <DialogDescription>Configura las características del plan</DialogDescription>
          </DialogHeader>
          {editing && (
           <ScrollArea className="max-h-[60vh] pr-4">
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
                {/* Plantillas permitidas */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label>Todas las plantillas</Label>
                    <Switch
                      checked={editing.allowed_templates === null}
                      onCheckedChange={(v) => setEditing({ ...editing, allowed_templates: v ? null : TEMPLATE_OPTIONS.map((t) => t.id) })}
                    />
                  </div>
                  {editing.allowed_templates !== null && (
                    <div className="space-y-1.5 pl-1">
                      {TEMPLATE_OPTIONS.map((t) => {
                        const checked = editing.allowed_templates?.includes(t.id) ?? false;
                        return (
                          <div key={t.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`tpl-${t.id}`}
                              checked={checked}
                              onCheckedChange={(v) => {
                                const cur = editing.allowed_templates ?? [];
                                setEditing({
                                  ...editing,
                                  allowed_templates: v ? [...cur, t.id] : cur.filter((x) => x !== t.id),
                                });
                              }}
                            />
                            <label htmlFor={`tpl-${t.id}`} className="text-sm cursor-pointer">{t.name}</label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* Cursos permitidos */}
                {adminCourses.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <Label>Todos los cursos</Label>
                    <Switch
                      checked={editingCourses.length === 0}
                      onCheckedChange={(v) => setEditingCourses(v ? [] : adminCourses.map((c) => c.id))}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Vacío = sin restricción de cursos</p>
                  {editingCourses.length > 0 && (
                    <div className="space-y-1.5 pl-1 max-h-40 overflow-y-auto">
                      {adminCourses.map((c) => {
                        const checked = editingCourses.includes(c.id);
                        return (
                          <div key={c.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`course-${c.id}`}
                              checked={checked}
                              onCheckedChange={(v) => {
                                setEditingCourses(
                                  v ? [...editingCourses, c.id] : editingCourses.filter((x) => x !== c.id)
                                );
                              }}
                            />
                            <label htmlFor={`course-${c.id}`} className="text-sm cursor-pointer">{c.label}</label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                )}
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
