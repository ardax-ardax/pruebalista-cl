import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Copy, Plus, Save, Trash2, Upload, X } from "lucide-react";

import { AppLayout } from "@/components/AppLayout";
import { TemplateEditor } from "@/components/TemplateEditor";
import { CatalogManager } from "@/components/CatalogManager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

import {
  BUILT_IN_TEMPLATES,
  duplicateTemplate,
  emptyTemplate,
  loadInstitutionName,
  loadLogo,
  loadTemplates,
  saveInstitutionName,
  saveLogo,
  saveTemplates,
  type FormatTemplate,
} from "@/lib/templates";
import {
  loadGrades,
  loadSubjects,
  resetGrades,
  resetSubjects,
  saveGrades,
  saveSubjects,
  type GradeOption,
  type SubjectOption,
} from "@/lib/catalog";

const Configuracion = () => {
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormatTemplate | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);

  useEffect(() => {
    setTemplates(loadTemplates());
    setLogo(loadLogo());
    setInstitutionName(loadInstitutionName());
    setSubjects(loadSubjects());
    setGrades(loadGrades());
  }, []);

  const updateSubjects = (next: SubjectOption[]) => {
    setSubjects(next);
    saveSubjects(next);
  };

  const updateGrades = (next: GradeOption[]) => {
    setGrades(next);
    saveGrades(next);
  };

  const handleResetSubjects = () => {
    setSubjects(resetSubjects());
    toast.success("Asignaturas restauradas");
  };

  const handleResetGrades = () => {
    setGrades(resetGrades());
    toast.success("Cursos restaurados");
  };

  const persist = (next: FormatTemplate[]) => {
    setTemplates(next);
    saveTemplates(next);
  };

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Sube una imagen (PNG, JPG)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setLogo(dataUrl);
      saveLogo(dataUrl);
      toast.success("Logo guardado");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogo(null);
    saveLogo(null);
    toast.success("Logo eliminado");
  };

  const handleSaveInstitution = () => {
    saveInstitutionName(institutionName);
    toast.success("Nombre del colegio guardado");
  };

  const startEdit = (t: FormatTemplate) => {
    setEditingId(t.id);
    setEditing({ ...t });
    setEditingName(t.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditing(null);
  };

  const saveEdit = () => {
    if (!editing) return;
    const updated: FormatTemplate = { ...editing, name: editingName };
    const next = templates.map((t) => (t.id === editing.id ? updated : t));
    persist(next);
    toast.success(`"${editingName}" guardada`);
    cancelEdit();
  };

  const handleDuplicate = (t: FormatTemplate) => {
    const dup = duplicateTemplate(t);
    const next = [...templates, dup];
    persist(next);
    toast.success(`Plantilla duplicada como "${dup.name}"`);
  };

  const handleDelete = (id: string) => {
    const next = templates.filter((t) => t.id !== id);
    persist(next);
    toast.success("Plantilla eliminada");
    setConfirmDeleteId(null);
    if (editingId === id) cancelEdit();
  };

  const handleResetBuiltIn = (id: string) => {
    const original = BUILT_IN_TEMPLATES.find((t) => t.id === id);
    if (!original) return;
    const next = templates.map((t) => (t.id === id ? { ...original } : t));
    persist(next);
    toast.success(`"${original.name}" restaurada a valores por defecto`);
  };

  const handleNew = () => {
    const t = emptyTemplate();
    t.name = "Nueva plantilla";
    const next = [...templates, t];
    persist(next);
    startEdit(t);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Link>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Configuración</h1>
      <p className="text-muted-foreground mb-8">
        Gestiona el logo del colegio y las plantillas de formato disponibles.
      </p>

      {/* Datos institucionales */}
      <Card className="shadow-card mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Datos del colegio</CardTitle>
          <CardDescription>
            El logo se reutiliza automáticamente en cualquier plantilla que lo incluya en el encabezado.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label>Logo del colegio</Label>
              <div className="flex items-center gap-4">
                <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden">
                  {logo ? (
                    <img src={logo} alt="Logo del colegio" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <label>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <span className="cursor-pointer">
                        <Upload className="h-3.5 w-3.5" />
                        {logo ? "Cambiar logo" : "Subir logo"}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleLogoUpload(f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {logo && (
                    <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-2 text-destructive">
                      <X className="h-3.5 w-3.5" />
                      Eliminar
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">PNG o JPG. Recomendado: fondo transparente, máx 1 MB.</p>
            </div>
            <div className="space-y-3">
              <Label htmlFor="institution">Nombre del colegio</Label>
              <Input
                id="institution"
                value={institutionName}
                onChange={(e) => setInstitutionName(e.target.value)}
                placeholder="Ej: Colegio San Martín"
              />
              <Button size="sm" onClick={handleSaveInstitution} className="gap-2">
                <Save className="h-3.5 w-3.5" />
                Guardar nombre
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Asignaturas y cursos */}
      <Card className="shadow-card mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Asignaturas y cursos</CardTitle>
          <CardDescription>
            Estas listas alimentan los selectores del nombre de archivo. El "Valor en archivo"
            es lo que aparece en el nombre final (sin espacios ni símbolos).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <CatalogManager
            title="Asignaturas"
            description="Ej: Historia → Historia"
            items={subjects}
            onChange={updateSubjects}
            onReset={handleResetSubjects}
            labelPlaceholder="Educación Física"
            valuePlaceholder="EducaciónFísica"
          />
          <CatalogManager
            title="Cursos"
            description="Ej: 7° Básico → 7Básico"
            items={grades}
            onChange={updateGrades}
            onReset={handleResetGrades}
            labelPlaceholder="7° Básico"
            valuePlaceholder="7Básico"
          />
        </CardContent>
      </Card>

      {/* Plantillas */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Plantillas de formato</h2>
          <p className="text-sm text-muted-foreground">Crea, duplica o ajusta las plantillas del colegio.</p>
        </div>
        <Button onClick={handleNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      <div className="space-y-3">
        {templates.map((t) => {
          const isEditing = editingId === t.id;
          return (
            <Card key={t.id} className="shadow-card">
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex-1 min-w-0">
                  {isEditing ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="font-semibold"
                    />
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-base">{t.name}</CardTitle>
                      {t.isBuiltIn ? (
                        <Badge variant="secondary" className="text-[10px]">Plantilla base</Badge>
                      ) : (
                        <Badge className="bg-accent text-accent-foreground text-[10px]">Personalizada</Badge>
                      )}
                    </div>
                  )}
                  <CardDescription className="mt-1.5">{t.description}</CardDescription>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isEditing && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => startEdit(t)}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t)} title="Duplicar">
                        <Copy className="h-4 w-4" />
                      </Button>
                      {t.isBuiltIn ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResetBuiltIn(t.id)}
                          title="Restaurar valores por defecto"
                        >
                          Restaurar
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDeleteId(t.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardHeader>
              {isEditing && editing && (
                <CardContent className="space-y-4">
                  <TemplateEditor template={editing} onChange={setEditing} />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={cancelEdit}>Cancelar</Button>
                    <Button onClick={saveEdit} className="gap-2">
                      <Save className="h-4 w-4" />
                      Guardar cambios
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las plantillas base no se ven afectadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Configuracion;
