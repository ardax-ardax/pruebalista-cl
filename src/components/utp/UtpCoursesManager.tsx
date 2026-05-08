import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile } from "@/lib/profiles";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { GraduationCap, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

interface AdminCourse {
  id: string;
  grade_value: string;
  label: string;
  level: string;
  sort_order: number;
  created_by: string | null;
  colegio_id: string | null;
}

const LEVELS = ["Básica", "Media"] as const;

const GRADES_BY_LEVEL: Record<string, { value: string; label: string }[]> = {
  "Básica": [
    { value: "1º", label: "1º Básico" },
    { value: "2º", label: "2º Básico" },
    { value: "3º", label: "3º Básico" },
    { value: "4º", label: "4º Básico" },
    { value: "5º", label: "5º Básico" },
    { value: "6º", label: "6º Básico" },
    { value: "7º", label: "7º Básico" },
    { value: "8º", label: "8º Básico" },
  ],
  "Media": [
    { value: "I", label: "I Medio" },
    { value: "II", label: "II Medio" },
    { value: "III", label: "III Medio" },
    { value: "IV", label: "IV Medio" },
  ],
};
const SECTION_LETTERS = ["A", "B", "C", "D", "E", "F"];

function buildCourseLabels(level: string, gradeKey: string, letter: string) {
  const grade = GRADES_BY_LEVEL[level]?.find((g) => g.value === gradeKey);
  if (!grade) return { label: "", slug: "" };
  const label = `${grade.label}${letter ? ` ${letter}` : ""}`;
  const baseSlug = level === "Básica" ? `${grade.value}Básico` : `${grade.value}Medio`;
  return { label, slug: `${baseSlug}${letter}` };
}

export default function UtpCoursesManager() {
  const { user } = useAuth();
  const [colegioId, setColegioId] = useState<string | null>(null);
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [wizardLevel, setWizardLevel] = useState<string>("Básica");
  const [wizardGrade, setWizardGrade] = useState<string>("");
  const [wizardLetter, setWizardLetter] = useState<string>("A");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_courses").select("*").order("sort_order");
    setCourses((data ?? []) as AdminCourse[]);
    setLoading(false);
  };

  useEffect(() => {
    getMyProfile().then((p) => setColegioId(p?.colegioId ?? null));
    refresh();
  }, []);

  const openNew = () => {
    setIsNew(true);
    setEditingId(null);
    setWizardLevel("Básica");
    setWizardGrade("");
    setWizardLetter("A");
    setOpen(true);
  };

  const openEdit = (c: AdminCourse) => {
    setIsNew(false);
    setEditingId(c.id);
    // Intentar derivar wizard a partir de label/level
    setWizardLevel(c.level === "ElectivoMedia" ? "Media" : c.level);
    const grade = GRADES_BY_LEVEL[c.level === "ElectivoMedia" ? "Media" : c.level] ?? [];
    const matched = grade.find((g) => c.grade_value.startsWith(g.value));
    setWizardGrade(matched?.value ?? "");
    const letter = c.grade_value.slice(-1);
    setWizardLetter(SECTION_LETTERS.includes(letter) ? letter : "A");
    setOpen(true);
  };

  const computed = buildCourseLabels(wizardLevel, wizardGrade, wizardLetter);

  const handleSave = async () => {
    if (!wizardGrade || !wizardLetter) {
      toast.error("Completa Nivel, Grado y Letra");
      return;
    }
    if (!colegioId) {
      toast.error("Tu cuenta no está vinculada a un colegio.");
      return;
    }
    setSaving(true);
    const maxSort = courses.reduce((m, c) => Math.max(m, c.sort_order), -1);
    const row = {
      grade_value: computed.slug,
      label: computed.label,
      level: wizardLevel,
      sort_order: isNew ? maxSort + 1 : (courses.find((c) => c.id === editingId)?.sort_order ?? 0),
    };
    let error;
    if (isNew) {
      ({ error } = await supabase.from("admin_courses").insert({
        ...row,
        created_by: user?.id ?? null,
        colegio_id: colegioId,
      }));
    } else if (editingId) {
      ({ error } = await supabase.from("admin_courses").update(row).eq("id", editingId));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isNew ? "Curso creado" : "Curso actualizado");
    setOpen(false);
    refresh();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("admin_courses").delete().eq("id", deleteId);
    if (error) { toast.error(error.message); return; }
    toast.success("Curso eliminado");
    setDeleteId(null);
    refresh();
  };

  const isOwn = (c: AdminCourse) => c.created_by === user?.id;

  return (
    <>
      <Card className="shadow-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="h-5 w-5 text-primary" /> Cursos del colegio
            </CardTitle>
            <CardDescription>
              El nombre se genera automáticamente como <strong>[Grado] [Nivel] [Letra]</strong>. No puede editarse manualmente.
            </CardDescription>
          </div>
          <Button size="sm" onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> Nuevo curso
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : courses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No hay cursos definidos.</p>
          ) : (
            <div className="space-y-1">
              {courses.map((c) => {
                const own = isOwn(c);
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
                    <span className="font-medium text-sm flex-1">{c.label}</span>
                    <Badge variant="outline" className="text-[10px]">{c.level}</Badge>
                    <Badge variant={own ? "default" : "secondary"} className="text-[10px]">
                      {own ? "Mi colegio" : "Global"}
                    </Badge>
                    {own && (
                      <>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{isNew ? "Nuevo Curso" : "Editar Curso"}</DialogTitle>
            <DialogDescription>El nombre se construye automáticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px]">Nivel</Label>
                <Select value={wizardLevel} onValueChange={(v) => { setWizardLevel(v); setWizardGrade(""); }}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => <SelectItem key={l} value={l}>{l === "Básica" ? "Enseñanza Básica" : "Enseñanza Media"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Grado</Label>
                <Select value={wizardGrade} onValueChange={setWizardGrade}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {(GRADES_BY_LEVEL[wizardLevel] ?? []).map((g) => (
                      <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Letra</Label>
                <Select value={wizardLetter} onValueChange={setWizardLetter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTION_LETTERS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nombre del curso (automático)</Label>
              <Input value={computed.label || "—"} readOnly disabled className="bg-muted font-medium" />
              <p className="text-[10px] text-muted-foreground">
                Identificador interno: <code>{computed.slug || "—"}</code>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !wizardGrade} className="gap-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isNew ? "Crear" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar curso?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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
