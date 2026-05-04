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
import { Plus, Save, Trash2, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";

import { loadSubjects, getSubjectsForGrade, type SubjectOption } from "@/lib/catalog";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import { getOAs, type Indicator, type OA } from "@/lib/curriculum-data";
import { loadOverridesFromCloud, removeOverride, saveOverride } from "@/lib/curriculum-overrides";
import { CsvOaImporter } from "./CsvOaImporter";

interface DraftIndicator extends Indicator { _id: string; }

interface DraftOA {
  code: string;
  description: string;
  eje: string;
  indicators: DraftIndicator[];
}

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
  const [oas, setOas] = useState<OA[]>([]);
  const [editing, setEditing] = useState<DraftOA | null>(null);
  const [editingOriginalCode, setEditingOriginalCode] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);

  useEffect(() => {
    setSubjects(loadSubjects());
    loadOverridesFromCloud().then(() => refreshList());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableSubjects = useMemo(
    () => (grade ? getSubjectsForGrade(grade, subjects, grades) : []),
    [grade, subjects, grades],
  );

  const refreshList = () => {
    if (grade && subject) setOas(getOAs(grade, subject));
    else setOas([]);
  };

  useEffect(() => { refreshList(); /* eslint-disable-next-line */ }, [grade, subject]);

  const startEdit = (oa: OA) => { setEditing(toDraft(oa)); setEditingOriginalCode(oa.code); };
  const startNew = () => { setEditing(blankDraft()); setEditingOriginalCode(null); };
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
    if (!editing || !grade || !subject) return;
    const code = editing.code.trim();
    if (!code) { toast.error("El código del OA es obligatorio"); return; }
    if (!editing.description.trim()) { toast.error("La descripción del OA es obligatoria"); return; }

    setSaving(true);
    try {
      if (editingOriginalCode && editingOriginalCode !== code) {
        await removeOverride(grade, subject, editingOriginalCode);
      }
      const res = await saveOverride({
        grade_value: grade, subject_value: subject, oa_code: code,
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

  const handleDelete = async (code: string) => {
    const r = await removeOverride(grade, subject, code);
    if (r.cloud) toast.success("OA eliminado");
    else toast.error("Error al eliminar: " + (r.error ?? "desconocido"));
    setConfirmDelete(null);
    refreshList();
  };

  return (
    <Card className="shadow-card mb-8">
      <CardHeader>
        <CardTitle className="text-lg">Gestión Curricular</CardTitle>
        <CardDescription>
          Administra los Objetivos de Aprendizaje y sus Indicadores de Evaluación.
          Los cambios se aplican a todos los docentes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Curso</Label>
            <Select value={grade} onValueChange={(v) => { setGrade(v); setSubject(""); }}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {grades.map((g) => (<SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Asignatura</Label>
            <Select value={subject} onValueChange={setSubject} disabled={!grade}>
              <SelectTrigger><SelectValue placeholder={grade ? "Selecciona" : "Primero el curso"} /></SelectTrigger>
              <SelectContent>
                {availableSubjects.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {grade && subject && (
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">{oas.length} OA disponible{oas.length === 1 ? "" : "s"}.</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => setCsvOpen(true)}>
                <Upload className="h-3.5 w-3.5" /> Importar CSV
              </Button>
              <Button size="sm" variant="outline" className="gap-2" onClick={startNew}>
                <Plus className="h-3.5 w-3.5" /> Nuevo OA
              </Button>
            </div>
          </div>
        )}

        {grade && subject && (
          <div className="space-y-2 rounded-md border border-border p-2 max-h-96 overflow-y-auto">
            {oas.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">No hay OAs cargados todavía. Crea el primero o importa desde CSV.</p>
            )}
            {oas.map((oa) => (
              <div key={oa.code} className="rounded-md border border-border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs leading-snug min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{oa.code}</span>
                      {oa.eje && <span className="text-muted-foreground">· {oa.eje}</span>}
                    </div>
                    <div className="text-muted-foreground mt-1">{oa.description}</div>
                    {oa.indicators?.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {oa.indicators.map((i) => (
                          <li key={i.code} className="text-[11px]">
                            <span className="font-medium">{i.code}</span>{" "}
                            <span className="text-muted-foreground">{i.description}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => startEdit(oa)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-destructive"
                            onClick={() => setConfirmDelete(oa.code)}>
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

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
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CsvOaImporter open={csvOpen} onOpenChange={setCsvOpen} onImported={refreshList} />
    </Card>
  );
};
