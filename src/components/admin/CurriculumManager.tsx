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
import { Plus, RotateCcw, Save, Trash2, Pencil, Cloud, CloudOff } from "lucide-react";
import { toast } from "sonner";

import { loadSubjects, getSubjectsForGrade, type GradeOption, type SubjectOption } from "@/lib/catalog";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import { getOAs, type Indicator, type OA } from "@/lib/curriculum-data";
import {
  findOverride, loadOverridesFromCloud, removeOverride, saveOverride,
} from "@/lib/curriculum-overrides";

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
  const [confirmReset, setConfirmReset] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [cloudOk, setCloudOk] = useState<boolean | null>(null);

  // Carga inicial: catálogos + sincroniza overrides desde la nube.
  useEffect(() => {
    setGrades(loadGrades());
    setSubjects(loadSubjects());
    loadOverridesFromCloud().then((r) => {
      setCloudOk(r.ok);
      if (r.ok) refreshList();
    });
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

  const startEdit = (oa: OA) => {
    setEditing(toDraft(oa));
    setEditingOriginalCode(oa.code);
  };

  const startNew = () => {
    setEditing(blankDraft());
    setEditingOriginalCode(null);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditingOriginalCode(null);
  };

  const updateIndicator = (id: string, patch: Partial<Indicator>) => {
    if (!editing) return;
    setEditing({
      ...editing,
      indicators: editing.indicators.map((i) => (i._id === id ? { ...i, ...patch } : i)),
    });
  };

  const addIndicator = () => {
    if (!editing) return;
    const next = editing.indicators.length + 1;
    setEditing({
      ...editing,
      indicators: [...editing.indicators, { _id: uid(), code: `${next}.1`, description: "" }],
    });
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
      // Si renombramos el código, eliminamos el override antiguo.
      if (editingOriginalCode && editingOriginalCode !== code) {
        await removeOverride(grade, subject, editingOriginalCode);
      }
      const res = await saveOverride({
        grade_value: grade,
        subject_value: subject,
        oa_code: code,
        oa_description: editing.description.trim(),
        eje: editing.eje.trim() || undefined,
        indicators: editing.indicators
          .filter((i) => i.code.trim() && i.description.trim())
          .map(({ _id, ...rest }) => rest),
      });
      if (res.cloud) toast.success("Cambios guardados en la base de datos");
      else toast.warning("Guardado local. No se pudo sincronizar a la nube" + (res.error ? `: ${res.error}` : ""));
      cancelEdit();
      refreshList();
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (code: string) => {
    const r = await removeOverride(grade, subject, code);
    if (r.cloud) toast.success("Restaurado a versión base");
    else toast.warning("Restaurado localmente" + (r.error ? `: ${r.error}` : ""));
    setConfirmReset(null);
    refreshList();
  };

  const hasOverride = (code: string) => !!findOverride(grade, subject, code);

  return (
    <Card className="shadow-card mb-8">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          Gestión Curricular
          {cloudOk === true && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Cloud className="h-3 w-3" /> Sincronizado
            </Badge>
          )}
          {cloudOk === false && (
            <Badge variant="outline" className="text-[10px] gap-1">
              <CloudOff className="h-3 w-3" /> Solo local
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Edita el texto de los Objetivos de Aprendizaje y sus Indicadores de Evaluación.
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
              <SelectTrigger>
                <SelectValue placeholder={grade ? "Selecciona" : "Primero el curso"} />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {grade && subject && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{oas.length} OA disponible{oas.length === 1 ? "" : "s"}.</p>
            <Button size="sm" variant="outline" className="gap-2" onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> Nuevo OA
            </Button>
          </div>
        )}

        {grade && subject && (
          <div className="space-y-2 rounded-md border border-border p-2 max-h-96 overflow-y-auto">
            {oas.length === 0 && (
              <p className="text-xs text-muted-foreground p-3">No hay OAs cargados todavía. Crea el primero.</p>
            )}
            {oas.map((oa) => {
              const overridden = hasOverride(oa.code);
              return (
                <div key={oa.code} className="rounded-md border border-border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-xs leading-snug min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{oa.code}</span>
                        {oa.eje && <span className="text-muted-foreground">· {oa.eje}</span>}
                        {overridden && <Badge className="bg-accent text-accent-foreground text-[10px]">Modificado</Badge>}
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
                      {overridden && (
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-muted-foreground"
                                onClick={() => setConfirmReset(oa.code)}>
                          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Editor modal */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) cancelEdit(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingOriginalCode ? `Editar ${editingOriginalCode}` : "Nuevo Objetivo de Aprendizaje"}</DialogTitle>
            <DialogDescription>
              Los cambios se guardan como override y reemplazan al texto base en toda la app.
            </DialogDescription>
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
                <Textarea
                  rows={3}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
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
                      <Input
                        className="h-8 text-xs"
                        value={i.code}
                        onChange={(e) => updateIndicator(i._id, { code: e.target.value })}
                        placeholder="1.1"
                      />
                      <Textarea
                        rows={2}
                        className="text-xs"
                        value={i.description}
                        onChange={(e) => updateIndicator(i._id, { description: e.target.value })}
                        placeholder="Descripción del indicador…"
                      />
                      <Button size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => removeIndicator(i._id)} title="Eliminar">
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

      <AlertDialog open={!!confirmReset} onOpenChange={(o) => !o && setConfirmReset(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar OA a la versión base?</AlertDialogTitle>
            <AlertDialogDescription>
              Se elimina el override y se vuelve al texto e indicadores originales del Mineduc.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmReset && handleReset(confirmReset)}>
              Restaurar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
