import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import { getMyProfile, updateMyProfile, type Profile } from "@/lib/profiles";
import { listAssignmentsForTeacher, addAssignment, removeAssignment, type TeacherAssignment } from "@/lib/teacher-assignments";
import { loadSubjects, getSubjectsForGrade } from "@/lib/catalog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImagePlus, Loader2, Lock, Save, Sparkles, Trash2, User, BookOpen, Plus, X, Info, Palette } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";



export default function Perfil() {
  const { user, role, isStaff, isAdmin } = useAuth();
  const isAdminOnly = isAdmin && role !== 'utp_head';
  const { effectivePlan, maxAssignments, planLabel, creditsAvailable, planExpiresAt, loading: usageLoading } = useUserUsage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [colegioName, setColegioName] = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [secondaryEmail, setSecondaryEmail] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Assignments state
  const [assignments, setAssignments] = useState<TeacherAssignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(true);
  const [addingAssignment, setAddingAssignment] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedLetter, setSelectedLetter] = useState("A");

  const { grades } = useAdminCourses();
  const allSubjects = useMemo(() => loadSubjects(), []);
  const filteredSubjects = useMemo(
    () => selectedGrade ? getSubjectsForGrade(selectedGrade, allSubjects, grades) : [],
    [selectedGrade, allSubjects, grades]
  );

  // Sort assignments: newest first. Only the last N (by created_at) are active when plan has limit.
  const sortedAssignments = useMemo(
    () => [...assignments].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [assignments],
  );
  const hasLimit = maxAssignments !== null;
  const maxAssign = maxAssignments ?? Infinity;
  const activeAssignmentIds = useMemo(() => {
    if (!hasLimit) return new Set(assignments.map((a) => a.id));
    return new Set(sortedAssignments.slice(0, maxAssign).map((a) => a.id));
  }, [sortedAssignments, hasLimit, maxAssign]);
  const canAddMore = assignments.length < maxAssign;
  const alreadyExists = assignments.some(
    (a) => a.grade_value === selectedGrade && a.subject_value === selectedSubject
  );

  const isDocente = !!user && !isStaff;

  // Plan filtering is now handled by useAdminCourses hook

  useEffect(() => {
    getMyProfile().then(async (p) => {
      if (p) {
        setProfile(p);
        setInstitutionName(p.customInstitutionName ?? "");
        setLogoUrl(p.customLogoUrl);
        setSecondaryEmail(p.secondaryEmail ?? "");
        setDocumentId(p.documentId ?? "");
        // Load colegio name if linked
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("colegio_id")
            .eq("id", user.id)
            .maybeSingle();
          const cId = (prof as { colegio_id: string | null } | null)?.colegio_id;
          if (cId) {
            const { data: col } = await supabase
              .from("colegios")
              .select("nombre")
              .eq("id", cId)
              .maybeSingle();
            setColegioName((col as { nombre: string } | null)?.nombre ?? null);
          }
        }
      }
    });
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    setLoadingAssignments(true);
    listAssignmentsForTeacher(user.id).then((a) => {
      setAssignments(a);
      setLoadingAssignments(false);
    });
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    const res = await updateMyProfile({
      custom_institution_name: institutionName.trim() || null,
      custom_logo_url: logoUrl,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Perfil actualizado");
    } else {
      toast.error("Error: " + res.error);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Solo se permiten imágenes");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El archivo es muy grande (máx. 2 MB)");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() ?? "png";
    const path = `${user.id}/logo.${ext}`;
    const { error } = await supabase.storage
      .from("user-logos")
      .upload(path, file, { upsert: true });
    if (error) {
      toast.error("Error al subir: " + error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("user-logos").getPublicUrl(path);
    const url = urlData.publicUrl + "?t=" + Date.now();
    setLogoUrl(url);
    setUploading(false);
    toast.success("Logo subido");
  };

  const handleRemoveLogo = async () => {
    if (!user) return;
    await supabase.storage.from("user-logos").remove([`${user.id}/logo.png`, `${user.id}/logo.jpg`, `${user.id}/logo.jpeg`, `${user.id}/logo.webp`]);
    setLogoUrl(null);
    toast.info("Logo eliminado. Recuerda guardar.");
  };

  const handleAddAssignment = async () => {
    if (!user || !selectedGrade || !selectedSubject) return;
    if (!canAddMore) {
      toast.error(`Tu plan permite máximo ${maxAssign} asignaciones`);
      return;
    }
    if (alreadyExists) {
      toast.error("Esta combinación ya está asignada");
      return;
    }
    setAddingAssignment(true);
    const res = await addAssignment(user.id, selectedGrade, selectedSubject, selectedLetter);
    if (res.ok) {
      const updated = await listAssignmentsForTeacher(user.id);
      setAssignments(updated);
      setSelectedGrade("");
      setSelectedSubject("");
      setSelectedLetter("A");
      toast.success("Asignación agregada");
    } else {
      toast.error(res.error || "Error al agregar");
    }
    setAddingAssignment(false);
  };

  const handleRemoveAssignment = async (id: string) => {
    const res = await removeAssignment(id);
    if (res.ok) {
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      toast.success("Asignación eliminada");
    } else {
      toast.error(res.error || "Error al eliminar");
    }
  };

  const getGradeLabel = (value: string) => grades.find((g) => g.value === value)?.label ?? value;
  const getSubjectLabel = (value: string) => allSubjects.find((s) => s.value === value)?.label ?? value;

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = (meta.full_name as string) || (meta.name as string) || user?.email?.split("@")[0] || "Usuario";

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mi Perfil</h1>
          <p className="text-sm text-muted-foreground">
            Personaliza el nombre de tu colegio y logo. Estos datos aparecerán en el encabezado de tus evaluaciones.
          </p>
        </div>

        <Tabs defaultValue="datos" className="w-full">
          <TabsList className={`grid w-full ${isDocente ? "grid-cols-3" : "grid-cols-2"}`}>
            <TabsTrigger value="datos" className="flex items-center gap-1.5">
              <User className="h-4 w-4" /> Datos
            </TabsTrigger>
            {isDocente && (
              <TabsTrigger value="cursos" className="flex items-center gap-1.5">
                <BookOpen className="h-4 w-4" /> Mis cursos
              </TabsTrigger>
            )}
            <TabsTrigger value="branding" className="flex items-center gap-1.5">
              <Palette className="h-4 w-4" /> Branding
            </TabsTrigger>
          </TabsList>

          {/* Tab: Datos personales */}
          <TabsContent value="datos">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" /> Datos personales
                </CardTitle>
                <CardDescription>Tu información de cuenta (no editable aquí)</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  {(meta.avatar_url || meta.picture) && (
                    <AvatarImage src={(meta.avatar_url as string) || (meta.picture as string)} alt={displayName} />
                  )}
                  <AvatarFallback>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{displayName}</div>
                  <div className="text-sm text-muted-foreground">{user?.email}</div>
                </div>
              </CardContent>
            </Card>

            {/* Plan, rol y colegio */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" /> Plan y cuenta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Plan actual</span>
                    <div className="font-medium flex items-center gap-2 mt-0.5">
                      <Badge variant="outline">{planLabel}</Badge>
                      {planExpiresAt && (
                        <span className="text-xs text-muted-foreground">
                          Expira {new Date(planExpiresAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Créditos IA</span>
                    <div className="font-medium mt-0.5">{usageLoading ? "…" : creditsAvailable}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rol</span>
                    <div className="font-medium mt-0.5 capitalize">
                      {colegioName ? "Profesor de colegio" : "Docente autónomo"}
                    </div>
                  </div>
                  {colegioName && (
                    <div>
                      <span className="text-muted-foreground">Colegio</span>
                      <div className="font-medium mt-0.5">{colegioName}</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Mis cursos y asignaturas (solo docentes) */}
          {isDocente && (
            <TabsContent value="cursos">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="h-5 w-5" /> Mis cursos y asignaturas
                  </CardTitle>
                  <CardDescription>
                    Selecciona los cursos y asignaturas a los que preparas pruebas. Al crear una prueba, solo verás estas opciones.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Counter */}
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    {hasLimit ? (
                      <span className="text-muted-foreground">
                        {assignments.length} de {maxAssign} asignaciones
                        <span className="ml-1 text-xs">({planLabel})</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {assignments.length} asignaciones <span className="ml-1 text-xs">(sin límite)</span>
                      </span>
                    )}
                  </div>

                  {/* Current assignments */}
                  {loadingAssignments ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Cargando...
                    </div>
                  ) : assignments.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {sortedAssignments.map((a) => {
                        const isBlocked = !activeAssignmentIds.has(a.id);
                        return (
                          <Badge key={a.id} variant="secondary" className={`flex items-center gap-1 py-1.5 px-3 text-sm ${isBlocked ? "opacity-50" : ""}`}>
                            {isBlocked && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Lock className="h-3.5 w-3.5 text-amber-500 mr-1" />
                                </TooltipTrigger>
                                <TooltipContent>Excede el límite de tu plan actual</TooltipContent>
                              </Tooltip>
                            )}
                            {getGradeLabel(a.grade_value)} {a.section_letter ?? "A"} — {getSubjectLabel(a.subject_value)}
                            <button
                              onClick={() => handleRemoveAssignment(a.id)}
                              className="ml-1 hover:text-destructive transition-colors"
                              title="Eliminar"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No tienes asignaciones. Agrega cursos y asignaturas para filtrar al crear pruebas.
                    </p>
                  )}

                  {/* Add new assignment */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                    <Select
                      value={selectedGrade}
                      onValueChange={(v) => { setSelectedGrade(v); setSelectedSubject(""); }}
                      disabled={!canAddMore}
                    >
                      <SelectTrigger className="sm:w-[180px]">
                        <SelectValue placeholder="Curso" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((g) => (
                          <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={selectedLetter} onValueChange={setSelectedLetter} disabled={!canAddMore}>
                      <SelectTrigger className="sm:w-[80px]">
                        <SelectValue placeholder="Letra" />
                      </SelectTrigger>
                      <SelectContent>
                        {["A", "B", "C", "D", "E", "F"].map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={selectedSubject}
                      onValueChange={setSelectedSubject}
                      disabled={!selectedGrade || !canAddMore}
                    >
                      <SelectTrigger className="sm:w-[240px]">
                        <SelectValue placeholder="Asignatura" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredSubjects.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      size="sm"
                      onClick={handleAddAssignment}
                      disabled={!selectedGrade || !selectedSubject || addingAssignment || !canAddMore || alreadyExists}
                    >
                      {addingAssignment ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : (
                        <Plus className="h-4 w-4 mr-1" />
                      )}
                      Agregar
                    </Button>
                  </div>

                  {!canAddMore && (
                    <p className="text-xs text-amber-600">
                      Has alcanzado el límite de {maxAssign} asignaciones de tu plan. Elimina una para agregar otra, o actualiza tu plan.
                    </p>
                  )}
                  {alreadyExists && selectedGrade && selectedSubject && (
                    <p className="text-xs text-amber-600">
                      Esta combinación ya está en tus asignaciones.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Tab: Branding */}
          <TabsContent value="branding">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Branding de evaluaciones</CardTitle>
                <CardDescription>
                  Estos datos reemplazan el encabezado del colegio por defecto en tus pruebas.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="inst-name">Nombre de tu colegio</Label>
                  <Input
                    id="inst-name"
                    placeholder="Ej: Colegio San Patricio"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Si lo dejas vacío, se usará el nombre predeterminado del sistema.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Logo de tu colegio</Label>
                  <div className="flex items-center gap-4">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="h-16 w-16 rounded-lg border border-border object-contain bg-background p-1"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadLogo}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ImagePlus className="h-4 w-4 mr-1" />}
                        {logoUrl ? "Cambiar logo" : "Subir logo"}
                      </Button>
                      {logoUrl && (
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={handleRemoveLogo}>
                          <Trash2 className="h-4 w-4 mr-1" /> Quitar logo
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Formato JPG o PNG, máximo 2 MB. Se mostrará en el encabezado de tus pruebas.
                  </p>
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Guardar cambios
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
