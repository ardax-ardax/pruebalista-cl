import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { BookOpen, GripVertical, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

interface AdminSubject {
  id: string;
  subject_value: string;
  subject_label: string;
  levels: string[];
  sort_order: number;
}

const LEVEL_OPTIONS = [
  { value: "Básica", label: "Básica" },
  { value: "Media", label: "Media" },
  { value: "ElectivoMedia", label: "Electivo Media" },
] as const;

const levelBadgeColor = (level: string) => {
  if (level === "Básica") return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
  if (level === "Media") return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
  return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
};

function SortableSubjectRow({
  subject,
  onEdit,
  onDelete,
}: {
  subject: AdminSubject;
  onEdit: (s: AdminSubject) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: subject.id,
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
      <TableCell className="font-medium">{subject.subject_label}</TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">{subject.subject_value}</TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {subject.levels.map((l) => (
            <Badge key={l} variant="secondary" className={`text-[10px] ${levelBadgeColor(l)}`}>
              {l === "ElectivoMedia" ? "Electivo" : l}
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right space-x-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(subject)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(subject.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function AdminSubjectsManager() {
  const [subjects, setSubjects] = useState<AdminSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AdminSubject> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("admin_subjects")
      .select("*")
      .order("sort_order");
    setSubjects((data ?? []) as AdminSubject[]);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const filtered = subjects.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.subject_label.toLowerCase().includes(q) || s.subject_value.toLowerCase().includes(q);
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = subjects.findIndex((s) => s.id === active.id);
    const newIndex = subjects.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(subjects, oldIndex, newIndex);
    setSubjects(reordered);

    for (let i = 0; i < reordered.length; i++) {
      await supabase.from("admin_subjects").update({ sort_order: i } as never).eq("id", reordered[i].id);
    }
  };

  const openNew = () => {
    const maxSort = subjects.reduce((m, s) => Math.max(m, s.sort_order), -1);
    setEditing({ subject_value: "", subject_label: "", levels: ["Básica", "Media"], sort_order: maxSort + 1 });
    setIsNew(true);
  };

  const openEdit = (s: AdminSubject) => {
    setEditing({ ...s });
    setIsNew(false);
  };

  const toggleLevel = (level: string) => {
    if (!editing) return;
    const cur = editing.levels ?? [];
    const next = cur.includes(level) ? cur.filter((l) => l !== level) : [...cur, level];
    setEditing({ ...editing, levels: next });
  };

  const handleSave = async () => {
    if (!editing?.subject_value?.trim() || !editing?.subject_label?.trim()) {
      toast.error("Valor y nombre son obligatorios");
      return;
    }
    if (!editing.levels || editing.levels.length === 0) {
      toast.error("Selecciona al menos un nivel");
      return;
    }
    setSaving(true);
    const row = {
      subject_value: editing.subject_value!.trim(),
      subject_label: editing.subject_label!.trim(),
      levels: editing.levels!,
      sort_order: editing.sort_order ?? 0,
    };

    const { error } = isNew
      ? await supabase.from("admin_subjects").insert(row)
      : await supabase.from("admin_subjects").update(row).eq("id", editing.id!);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Asignatura creada" : "Asignatura actualizada");
    setEditing(null);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("admin_subjects").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Asignatura eliminada");
    setDeleteId(null);
    refresh();
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Asignaturas
            </CardTitle>
            <CardDescription>
              Define las asignaturas del sistema y en qué niveles se imparten. Arrastra para reordenar.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> Nueva asignatura
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <Input
              placeholder="Buscar asignatura..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "Sin resultados." : "No hay asignaturas definidas."}
            </p>
          ) : (
            <div className="max-h-[500px] overflow-y-auto">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Niveles</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <SortableContext items={filtered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {filtered.map((s) => (
                        <SortableSubjectRow
                          key={s.id}
                          subject={s}
                          onEdit={openEdit}
                          onDelete={setDeleteId}
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit/Create Dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nueva Asignatura" : `Editar: ${editing?.subject_label}`}</DialogTitle>
            <DialogDescription>Define la asignatura y sus niveles.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <Label>Nombre visible</Label>
                <Input
                  value={editing.subject_label ?? ""}
                  onChange={(e) => setEditing({ ...editing, subject_label: e.target.value })}
                  placeholder="Ej: Matemática"
                />
              </div>
              <div className="space-y-1">
                <Label>Valor interno (slug)</Label>
                <Input
                  value={editing.subject_value ?? ""}
                  onChange={(e) => setEditing({ ...editing, subject_value: e.target.value })}
                  placeholder="Ej: Matemática"
                  disabled={!isNew}
                />
                <p className="text-[10px] text-muted-foreground">Identificador único, no puede cambiarse después.</p>
              </div>
              <div className="space-y-2">
                <Label>Niveles donde se imparte</Label>
                {LEVEL_OPTIONS.map((l) => (
                  <div key={l.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`level-${l.value}`}
                      checked={editing.levels?.includes(l.value) ?? false}
                      onCheckedChange={() => toggleLevel(l.value)}
                    />
                    <label htmlFor={`level-${l.value}`} className="text-sm cursor-pointer">{l.label}</label>
                  </div>
                ))}
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

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar asignatura?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará esta asignatura del catálogo. Si está asignada a algún curso, se perderá esa relación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
