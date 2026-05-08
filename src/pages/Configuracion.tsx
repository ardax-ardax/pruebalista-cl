import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, BookOpen, ClipboardCheck, Copy, LayoutTemplate, Plus, Save, Shield, Trash2, Upload, Users, X, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/profiles";

import { AppLayout } from "@/components/AppLayout";
import { TemplateEditor } from "@/components/TemplateEditor";
import { CatalogManager } from "@/components/CatalogManager";
import { CurriculumManager } from "@/components/admin/CurriculumManager";
import { StaffManager } from "@/components/admin/StaffManager";
import { ColegiosManager } from "@/components/admin/ColegiosManager";
import { UtpTeamManager } from "@/components/admin/UtpTeamManager";
import { UtpReviewCenter } from "@/components/admin/UtpReviewCenter";
import { UtpUsageManager } from "@/components/admin/UtpUsageManager";
import UtpCoursesManager from "@/components/utp/UtpCoursesManager";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  loadTeachers,
  resetGrades,
  resetSubjects,
  resetTeachers,
  saveGrades,
  saveSubjects,
  saveTeachers,
  type GradeOption,
  type SubjectOption,
  type TeacherOption,
} from "@/lib/catalog";
import {
  loadAppSettings,
  loadDefaultInstitutionLogo,
  setAllowSelfAssignment,
  setInstitutionName as setInstitutionNameRemote,
  setInstitutionLogo as setInstitutionLogoRemote,
  setHideCreditsFromTeachers,
  DEFAULT_APP_SETTINGS,
  DEFAULT_INSTITUTION_NAME,
  type AppSettings,
} from "@/lib/app-settings";
import { Switch } from "@/components/ui/switch";

const Configuracion = () => {
  const { isAdmin, isUtpHead } = useAuth();
  const [templates, setTemplates] = useState<FormatTemplate[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormatTemplate | null>(null);
  const [editingName, setEditingName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [grades, setGrades] = useState<GradeOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [savingSetting, setSavingSetting] = useState(false);
  const [utpColegioNombre, setUtpColegioNombre] = useState<string | null>(null);
  const [utpColegioLogo, setUtpColegioLogo] = useState<string | null>(null);

  // UTP: load colegio branding (readonly)
  useEffect(() => {
    if (!isUtpHead || isAdmin) return;
    getMyProfile().then(async (p) => {
      if (!p?.colegioId) return;
      const { data: col } = await supabase
        .from("colegios")
        .select("nombre, logo_url")
        .eq("id", p.colegioId)
        .maybeSingle();
      if (col) {
        const c = col as { nombre: string; logo_url: string | null };
        setUtpColegioNombre(c.nombre ?? null);
        let resolvedLogo = c.logo_url ?? null;
        if (resolvedLogo && !resolvedLogo.startsWith("http") && !resolvedLogo.startsWith("data:")) {
          const { data: urlData } = supabase.storage.from("user-logos").getPublicUrl(resolvedLogo);
          resolvedLogo = urlData?.publicUrl ?? resolvedLogo;
        }
        setUtpColegioLogo(resolvedLogo);
      }
    });
  }, [isUtpHead, isAdmin]);

  useEffect(() => {
    setTemplates(loadTemplates());
    setSubjects(loadSubjects());
    setGrades(loadGrades());
    setTeachers(loadTeachers());
    setLogo(loadLogo());
    setInstitutionName(loadInstitutionName() || DEFAULT_INSTITUTION_NAME);
    const localLogo = loadLogo();
    const localName = loadInstitutionName();
    loadAppSettings()
      .then(async (s) => {
        setAppSettings(s);
        const fallbackLogo = localLogo || await loadDefaultInstitutionLogo();
        let sharedLogo = s.institution_logo;
        if (isAdmin && !sharedLogo && fallbackLogo) {
          const r = await setInstitutionLogoRemote(fallbackLogo);
          if (r.ok) sharedLogo = fallbackLogo;
        }
        if (isAdmin && (!s.institution_name || s.institution_name === DEFAULT_INSTITUTION_NAME) && localName && localName !== DEFAULT_INSTITUTION_NAME) {
          const r = await setInstitutionNameRemote(localName);
          if (r.ok) s.institution_name = localName;
        }
        const backendName = s.institution_name || DEFAULT_INSTITUTION_NAME;
        setInstitutionName(backendName);
        saveInstitutionName(backendName);
        setLogo(sharedLogo);
        saveLogo(sharedLogo);
      })
      .catch(() => {/* ignore */});
  }, [isAdmin]);

  const handleToggleSelfAssignment = async (value: boolean) => {
    setSavingSetting(true);
    const res = await setAllowSelfAssignment(value);
    setSavingSetting(false);
    if (!res.ok) {
      toast.error("No se pudo guardar: " + (res.error ?? ""));
      return;
    }
    setAppSettings((s) => ({ ...s, allow_self_assignment: value }));
    toast.success(value
      ? "Auto-asignación activada: docentes ven todo el catálogo."
      : "Auto-asignación desactivada: docentes solo ven sus asignaciones.");
  };

  const handleToggleHideCredits = async (value: boolean) => {
    setSavingSetting(true);
    const res = await setHideCreditsFromTeachers(value);
    setSavingSetting(false);
    if (!res.ok) {
      toast.error("No se pudo guardar: " + (res.error ?? ""));
      return;
    }
    setAppSettings((s) => ({ ...s, hide_credits_from_teachers: value }));
    toast.success(value
      ? "Créditos ocultos: los docentes verán 'Plan Institucional' en lugar del contador."
      : "Créditos visibles: los docentes verán su saldo de créditos IA.");
  };

  const updateSubjects = (next: SubjectOption[]) => { setSubjects(next); saveSubjects(next); };
  const updateGrades = (next: GradeOption[]) => { setGrades(next); saveGrades(next); };
  const updateTeachers = (next: TeacherOption[]) => { setTeachers(next); saveTeachers(next); };
  const handleResetSubjects = () => { setSubjects(resetSubjects()); toast.success("Asignaturas restauradas"); };
  const handleResetGrades = () => { setGrades(resetGrades()); toast.success("Cursos restaurados"); };
  const handleResetTeachers = () => { setTeachers(resetTeachers()); toast.success("Docentes restaurados"); };

  const persist = (next: FormatTemplate[]) => { setTemplates(next); saveTemplates(next); };

  const handleLogoUpload = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Sube una imagen (PNG, JPG)"); return; }
    if (file.size > 500 * 1024) { toast.error("La imagen supera 500 KB. Usa una versión más liviana."); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setLogo(dataUrl);
      saveLogo(dataUrl);
      const r = await setInstitutionLogoRemote(dataUrl);
      if (!r.ok) { toast.error("Logo guardado localmente, pero no se pudo subir al servidor: " + (r.error ?? "")); return; }
      toast.success("Logo guardado y compartido con todo el colegio");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setLogo(null);
    saveLogo(null);
    const r = await setInstitutionLogoRemote(null);
    if (!r.ok) { toast.error("No se pudo eliminar del servidor: " + (r.error ?? "")); return; }
    toast.success("Logo eliminado");
  };

  const handleSaveInstitution = async () => {
    saveInstitutionName(institutionName);
    const r = await setInstitutionNameRemote(institutionName);
    if (!r.ok) { toast.error("Guardado localmente, pero no se pudo subir al servidor: " + (r.error ?? "")); return; }
    toast.success("Nombre del colegio guardado");
  };

  const startEdit = (t: FormatTemplate) => { setEditingId(t.id); setEditing({ ...t }); setEditingName(t.name); };
  const cancelEdit = () => { setEditingId(null); setEditing(null); };
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
    persist([...templates, dup]);
    toast.success(`Plantilla duplicada como "${dup.name}"`);
  };
  const handleDelete = (id: string) => {
    persist(templates.filter((t) => t.id !== id));
    toast.success("Plantilla eliminada");
    setConfirmDeleteId(null);
    if (editingId === id) cancelEdit();
  };
  const handleResetBuiltIn = (id: string) => {
    const original = BUILT_IN_TEMPLATES.find((t) => t.id === id);
    if (!original) return;
    persist(templates.map((t) => (t.id === id ? { ...original } : t)));
    toast.success(`"${original.name}" restaurada a valores por defecto`);
  };
  const handleNew = () => {
    const t = emptyTemplate();
    t.name = "Nueva plantilla";
    persist([...templates, t]);
    startEdit(t);
  };

  /* ── Sección reutilizable: Plantillas (Admin) ── */
  const renderAdminTemplates = () => (
    <>
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
                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="font-semibold" />
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
                      <Button variant="outline" size="sm" onClick={() => startEdit(t)}>Editar</Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                      {t.isBuiltIn ? (
                        <Button variant="ghost" size="sm" onClick={() => handleResetBuiltIn(t.id)} title="Restaurar valores por defecto">Restaurar</Button>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteId(t.id)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                    <Button onClick={saveEdit} className="gap-2"><Save className="h-4 w-4" />Guardar cambios</Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );

  /* ── Sección reutilizable: Datos del colegio ── */
  const renderColegioData = () => (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-lg">Datos del colegio</CardTitle>
        <CardDescription>El logo se reutiliza automáticamente en cualquier plantilla que lo incluya en el encabezado.</CardDescription>
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
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }} />
                </label>
                {logo && (
                  <Button variant="ghost" size="sm" onClick={handleRemoveLogo} className="gap-2 text-destructive">
                    <X className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">PNG o JPG. Recomendado: fondo transparente, máx 1 MB.</p>
          </div>
          <div className="space-y-3">
            <Label htmlFor="institution">Nombre del colegio</Label>
            <Input id="institution" value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} placeholder="Ej: Colegio San Martín" />
            <Button size="sm" onClick={handleSaveInstitution} className="gap-2"><Save className="h-3.5 w-3.5" />Guardar nombre</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="mb-6">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver
        </Link>
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-foreground mb-1">Configuración</h1>
      <p className="text-muted-foreground mb-6">
        Gestiona el colegio, personal, currículum y plantillas.
      </p>

      {/* ════════════════ ADMIN: 4 pestañas ════════════════ */}
      {isAdmin && (
        <Tabs defaultValue="colegios" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="colegios" className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" /> Colegios
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Personal
            </TabsTrigger>
            <TabsTrigger value="curriculum" className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" /> Currículum
            </TabsTrigger>
            <TabsTrigger value="plantillas" className="flex items-center gap-1.5">
              <LayoutTemplate className="h-4 w-4" /> Plantillas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="colegios" className="space-y-6">
            <ColegiosManager />
          </TabsContent>

          <TabsContent value="personal">
            <StaffManager />
          </TabsContent>

          <TabsContent value="curriculum">
            <CurriculumManager />
          </TabsContent>

          <TabsContent value="plantillas">
            {renderAdminTemplates()}
          </TabsContent>
        </Tabs>
      )}

      {/* ════════════════ UTP: 3 pestañas ════════════════ */}
      {isUtpHead && (
        <Tabs defaultValue="equipo" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6">
            <TabsTrigger value="equipo" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Users className="h-4 w-4" /> <span className="hidden sm:inline">Mi Equipo</span>
            </TabsTrigger>
            <TabsTrigger value="evaluaciones" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <ClipboardCheck className="h-4 w-4" /> <span className="hidden sm:inline">Evaluaciones</span>
            </TabsTrigger>
            <TabsTrigger value="catalogos" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Catálogos</span>
            </TabsTrigger>
            <TabsTrigger value="politicas" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Shield className="h-4 w-4" /> <span className="hidden sm:inline">Políticas</span>
            </TabsTrigger>
            <TabsTrigger value="docentes" className="flex items-center gap-1.5 text-xs sm:text-sm">
              <BarChart3 className="h-4 w-4" /> <span className="hidden sm:inline">Consumo</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equipo">
            <UtpTeamManager />
          </TabsContent>

          <TabsContent value="evaluaciones">
            <UtpReviewCenter />
          </TabsContent>

          <TabsContent value="catalogos">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg">Asignaturas, cursos y docentes</CardTitle>
                <CardDescription>
                  Estas listas alimentan los selectores del nombre de archivo.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <CatalogManager title="Asignaturas" description="Ej: Historia → Historia" items={subjects} onChange={updateSubjects} onReset={handleResetSubjects} labelPlaceholder="Educación Física" valuePlaceholder="EducaciónFísica" />
                <CatalogManager title="Cursos" description="Ej: 7° Básico → 7Básico" items={grades} onChange={updateGrades} onReset={handleResetGrades} labelPlaceholder="7° Básico" valuePlaceholder="7Básico" />
                <CatalogManager title="Docentes" description="Quien crea el documento." items={teachers} onChange={updateTeachers} onReset={handleResetTeachers} labelPlaceholder="Jorge Villablanca" valuePlaceholder="JorgeVillablanca" />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="politicas" className="space-y-6">
            {/* Branding del colegio (solo lectura para UTP) */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  Datos del colegio
                </CardTitle>
                <CardDescription>El branding del colegio es gestionado por el Administrador.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>Logo del colegio</Label>
                    <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 overflow-hidden">
                      {utpColegioLogo ? (
                        <img src={utpColegioLogo} alt="Logo del colegio" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Solo el Administrador puede cambiar el logo.</p>
                  </div>
                  <div className="space-y-3">
                    <Label>Nombre del colegio</Label>
                    <p className="text-sm font-medium">{utpColegioNombre ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">Solo el Administrador puede cambiar el nombre.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-primary/40">
              <CardHeader>
                <CardTitle className="text-lg">Política de asignación de docentes</CardTitle>
                <CardDescription>Decide si los docentes deben usar solo los cursos que les asignó el equipo o si pueden elegir libremente.</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                  <div className="text-sm">
                    <div className="font-medium">Permitir que los docentes elijan sus propios cursos y asignaturas</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Si está <strong>activo</strong>, cada docente verá todo el catálogo. Si está <strong>inactivo</strong>, solo podrá usar los pares registrados en sus asignaciones.
                    </div>
                  </div>
                  <Switch checked={appSettings.allow_self_assignment} onCheckedChange={handleToggleSelfAssignment} disabled={savingSetting} />
                </label>
              </CardContent>
            </Card>

            <Card className="shadow-card border-primary/40">
              <CardHeader>
                <CardTitle className="text-lg">Visibilidad de créditos IA</CardTitle>
                <CardDescription>Controla si los docentes pueden ver su contador de créditos de IA.</CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
                  <div className="text-sm">
                    <div className="font-medium">Ocultar créditos a los docentes</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Si está <strong>activo</strong>, los docentes verán "Plan Institucional" en lugar de su saldo de créditos.
                    </div>
                  </div>
                  <Switch checked={appSettings.hide_credits_from_teachers} onCheckedChange={handleToggleHideCredits} disabled={savingSetting} />
                </label>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="docentes">
            <UtpUsageManager />
          </TabsContent>
        </Tabs>
      )}

      {/* ════════════════ Docente: Plantillas sin pestañas ════════════════ */}
      {!isAdmin && !isUtpHead && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Plantillas de formato</h2>
              <p className="text-sm text-muted-foreground">Puedes duplicar las plantillas base para crear tus propias versiones personalizadas.</p>
            </div>
            <Button onClick={handleNew} className="gap-2"><Plus className="h-4 w-4" />Nueva plantilla</Button>
          </div>
          <div className="space-y-3">
            {templates.map((t) => {
              const isEditing = editingId === t.id;
              return (
                <Card key={t.id} className="shadow-card">
                  <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                    <div className="flex-1 min-w-0">
                      {isEditing && !t.isBuiltIn ? (
                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="font-semibold" />
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base">{t.name}</CardTitle>
                          {t.isBuiltIn ? (
                            <Badge variant="secondary" className="text-[10px]">Plantilla base · Solo lectura</Badge>
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
                          <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t)} title="Duplicar"><Copy className="h-4 w-4" /></Button>
                          {!t.isBuiltIn && (
                            <>
                              <Button variant="outline" size="sm" onClick={() => startEdit(t)}>Editar</Button>
                              <Button variant="ghost" size="icon" onClick={() => setConfirmDeleteId(t.id)} title="Eliminar"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </CardHeader>
                  {isEditing && !t.isBuiltIn && editing && (
                    <CardContent className="space-y-4">
                      <TemplateEditor template={editing} onChange={setEditing} />
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={cancelEdit}>Cancelar</Button>
                        <Button onClick={saveEdit} className="gap-2"><Save className="h-4 w-4" />Guardar cambios</Button>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => !o && setConfirmDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta plantilla?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer. Las plantillas base no se ven afectadas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Configuracion;
