import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Save, Trash2, Pencil, Upload, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { loadSubjects, getSubjectsForGrade, type SubjectOption } from "@/lib/catalog";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import { getOAs, type Indicator, type OA } from "@/lib/curriculum-data";
import { loadOverridesFromCloud, listOverrides, removeOverride, saveOverride } from "@/lib/curriculum-overrides";
import { CsvOaImporter } from "./CsvOaImporter";

interface DraftIndicator extends Indicator { _id: string; }

interface DraftOA {
  code: string;
  description: string;
  eje: string;
  indicators: DraftIndicator[];
}

const PAGE_SIZE = 20;
const uid = () => Math.random().toString(36).slice(2, 10);

const toDraft = (oa: OA): DraftOA => ({
  code: oa.code,
  description: oa.description,
  eje: oa.eje ?? "",
  indicators: (oa.indicators ?? []).map((i) => ({ ...i, _id: uid() })),
});

const blankDraft = (): DraftOA => ({
  code: "",
  description: "",
  eje: "",
  indicators: [{ _id: uid(), code: "1.1", description: "" }],
});

export const CurriculumManager = () => {
  const { grades } = useAdminCourses();
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [grade, setGrade] = useState("");
  const [subject, setSubject] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Edit state
  const [editGrade, setEditGrade] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editing, setEditing] = useState<DraftOA | null>(null);
  const [editingOriginalCode, setEditingOriginalCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ code: string; grade: string; subject: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSubjects(loadSubjects());
    loadOverridesFromCloud({ force: true }).then(() => setLoaded(true));
  }, []);

  const availableSubjects = useMemo(
    () => (grade ? getSubjectsForGrade(grade, subjects, grades) : []),
    [grade, subjects, grades],
  );

  const editAvailableSubjects = useMemo(
    () => (editGrade ? getSubjectsForGrade(editGrade, subjects, grades) : []),
    [editGrade, subjects, grades],
  );

  // Get ALL OAs from cache, optionally filtered
  const allOAs = useMemo(() => {
    const overrides = listOverrides(grade || undefined, subject || undefined);
    return overrides.map((o) => ({
      code: o.oa_code,
      description: o.oa_description,
      eje: o.eje,
      indicators: o.indicators ?? [],
      grade_value: o.grade_value,
      subject_value: o.subject_value,
    }));
  }, [grade, subject, loaded]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allOAs;
    const q = search.toLowerCase();
    return allOAs.filter(
      (oa) =>
        oa.code.toLowerCase().includes(q) ||
        oa.description.toLowerCase().includes(q) ||
        (oa.eje ?? "").toLowerCase().includes(q),
    );
  }, [allOAs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [grade, subject, search]);

  const refreshList = () => {
    loadOverridesFromCloud({ force: true }).then(() => setLoaded((v) => !v));
    // Toggle loaded to force useMemo recalc
    setTimeout(() => setLoaded((v) => !v), 100);
  };

  const startEdit = (oa: typeof allOAs[0]) => {
    setEditing(toDraft(oa));
    setEditingOriginalCode(oa.code);
    setEditGrade(oa.grade_value);
    setEditSubject(oa.subject_value);
  };

  const startNew = () => {
    setEditing(blankDraft());
    setEditingOriginalCode(null);
    setEditGrade(grade);
    setEditSubject(subject);
  };

  const cancelEdit = () => { setEditing(null); setEditingOriginalCode(null); };

  const updateIndicator = (id: string, patch: Partial<Indicator>) => {
    if (!editing) return;
    setEditing({ ...editing, indicators: editing.indicators.map((i) => (i._id === id ? { ...i, ...patch } : i)) });
  };

  const addIndicator = () => {
    if (!editing) return;
    const next = editing.indicators.length + 1;
    setEditing({ ...editing, indicators: [...editing.indicators, { _id: uid(), code: `${next}.1`, description: "" }] });
  };

  const removeIndicator = (id: string) => {
    if (!editing) return;
    setEditing({ ...editing, indicators: editing.indicators.filter((i) => i._id !== id) });
  };

  const handleSave = async () => {
    if (!editing || !editGrade || !editSubject) {
      toast.error("Selecciona grado y asignatura");
      return;
    }
    const code = editing.code.trim();
    if (!code) { toast.error("El código del OA es obligatorio"); return; }
    if (!editing.description.trim()) { toast.error("La descripción del OA es obligatoria"); return; }

    setSaving(true);
    try {
      if (editingOriginalCode && editingOriginalCode !== code) {
        await removeOverride(editGrade, editSubject, editingOriginalCode);
      }
      const res = await saveOverride({
        grade_value: editGrade, subject_value: editSubject, oa_code: code,
        oa_description: editing.description.trim(),
        eje: editing.eje.trim() || undefined,
        indicators: editing.indicators.filter((i) => i.code.trim() && i.description.trim()).map(({ _id, ...rest }) => rest),
      });
      if (res.cloud) toast.success("OA guardado");
      else toast.error("Error al guardar: " + (res.error ?? "desconocido"));
      cancelEdit();
      refreshList();
    } finally { setSaving(false); }
  };

  const handleDelete = async (code: string, g: string, s: string) => {
    const r = await removeOverride(g, s, code);
    if (r.cloud) toast.success("OA eliminado");
    else toast.error("Error al eliminar: " + (r.error ?? "desconocido"));
    setConfirmDelete(null);
    refreshList();
  };

  return (
    <Card className="shadow-card mb-8">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-lg">Gestión Curricular</CardTitle>
            <CardDescription>
              Administra los Objetivos de Aprendizaje y sus Indicadores de Evaluación.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" onClick={() => setCsvOpen(true)}>
              <Upload className="h-3.5 w-3.5" /> Importar CSV / Excel
            </Button>
            <Button size="sm" className="gap-2" onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> Nuevo OA
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Filtrar por Curso</Label>
            <Select value={grade} onValueChange={(v) => { setGrade(v === "__all__" ? "" : v); setSubject(""); }}>
              <SelectTrigger><SelectValue placeholder="Todos los cursos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los cursos</SelectItem>
                {grades.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Filtrar por Asignatura</Label>
            <Select value={subject} onValueChange={(v) => setSubject(v === "__all__" ? "" : v)} disabled={!grade}>
              <SelectTrigger><SelectValue placeholder={grade ? "Todas las asignaturas" : "Primero el curso"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las asignaturas</SelectItem>
                {availableSubjects.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Código, descripción o eje…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Results summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{filtered.length} OA{filtered.length === 1 ? "" : "s"} encontrado{filtered.length === 1 ? "" : "s"}</span>
          {totalPages > 1 && (
            <span>Página {currentPage + 1} de {totalPages}</span>
          )}
        </div>

        {/* OA list */}
        <div className="space-y-2 rounded-md border border-border p-2 max-h-[500px] overflow-y-auto">
          {pageItems.length === 0 && (
            <p className="text-xs text-muted-foreground p-3 text-center">
              {allOAs.length === 0 ? "No hay OAs cargados. Crea el primero o importa desde archivo." : "Sin resultados para esta búsqueda."}
            </p>
          )}
          {pageItems.map((oa, idx) => (
            <div key={`${oa.grade_value}-${oa.subject_value}-${oa.code}-${idx}`} className="rounded-md border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs leading-snug min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{oa.code}</span>
                    <Badge variant="outline" className="text-[10px] h-5">{oa.grade_value}</Badge>
                    <Badge variant="outline" className="text-[10px] h-5">{oa.subject_value}</Badge>
                    {oa.eje && <span className="text-muted-foreground">· {oa.eje}</span>}
                  </div>
                  <div className="text-muted-foreground mt-1 line-clamp-2">{oa.description}</div>
                  {oa.indicators?.length > 0 && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {oa.indicators.length} indicador{oa.indicators.length > 1 ? "es" : ""}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => startEdit(oa)}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-destructive"
                          onClick={() => setConfirmDelete({ code: oa.code, grade: oa.grade_value, subject: oa.subject_value })}>
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) p = i;
              else if (currentPage < 4) p = i;
              else if (currentPage > totalPages - 5) p = totalPages - 7 + i;
              else p = currentPage - 3 + i;
              return (
                <Button
                  key={p}
                  size="sm"
                  variant={p === currentPage ? "default" : "outline"}
                  className="w-8 h-8 p-0"
                  onClick={() => setPage(p)}
                >
                  {p + 1}
                </Button>
              );
            })}
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages - 1} onClick={() => setPage(currentPage + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>

      {/* Edit/New dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) cancelEdit(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingOriginalCode ? `Editar ${editingOriginalCode}` : "Nuevo Objetivo de Aprendizaje"}</DialogTitle>
            <DialogDescription>Los cambios se guardan en la base de datos y se aplican a toda la app.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Grado</Label>
                  <Select value={editGrade} onValueChange={(v) => { setEditGrade(v); setEditSubject(""); }}>
                    <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                    <SelectContent>
                      {grades.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Asignatura</Label>
                  <Select value={editSubject} onValueChange={setEditSubject} disabled={!editGrade}>
                    <SelectTrigger><SelectValue placeholder={editGrade ? "Selecciona" : "Primero el grado"} /></SelectTrigger>
                    <SelectContent>
                      {editAvailableSubjects.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código (ej: OA 03)</Label>
                  <Input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Eje (opcional)</Label>
                  <Input value={editing.eje} onChange={(e) => setEditing({ ...editing, eje: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Descripción del OA</Label>
                <Textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Indicadores de Evaluación</Label>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={addIndicator}>
                    <Plus className="h-3.5 w-3.5" /> Agregar
                  </Button>
                </div>
                <div className="mt-1 space-y-2">
                  {editing.indicators.map((i) => (
                    <div key={i._id} className="grid grid-cols-[80px_1fr_auto] gap-2 items-start">
                      <Input className="h-8 text-xs" value={i.code} onChange={(e) => updateIndicator(i._id, { code: e.target.value })} placeholder="1.1" />
                      <Textarea rows={2} className="text-xs" value={i.description} onChange={(e) => updateIndicator(i._id, { description: e.target.value })} placeholder="Descripción del indicador…" />
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeIndicator(i._id)} title="Eliminar">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este OA?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará permanentemente de la base de datos. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete.code, confirmDelete.grade, confirmDelete.subject)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvOaImporter open={csvOpen} onOpenChange={setCsvOpen} onImported={refreshList} />
    </Card>
  );
};
