// Página de Administración de Cursos. Acceso restringido a staff
// (admin/utp_head) vía AdminGuard. Permite crear/eliminar cursos,
// ver el roster de estudiantes y cargar listas masivas.

import { useEffect, useState } from "react";
import { GraduationCap, Loader2, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { AdminGuard } from "@/components/AdminGuard";
import { StudentImporter } from "@/components/courses/StudentImporter";
import {
  createCourse,
  deleteCourse,
  deleteStudent,
  listCourses,
  listStudentsByCourse,
  type Course,
  type Student,
} from "@/lib/courses";
import { formatRut } from "@/lib/rut";

const LEVELS = [
  "Pre Kínder",
  "Kínder",
  "1° Básico",
  "2° Básico",
  "3° Básico",
  "4° Básico",
  "5° Básico",
  "6° Básico",
  "7° Básico",
  "8° Básico",
  "I° Medio",
  "II° Medio",
  "III° Medio",
  "IV° Medio",
];

function CursosInner() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // form de creación
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState<string>("");
  const [creating, setCreating] = useState(false);

  const refreshCourses = async () => {
    setLoadingCourses(true);
    try {
      const data = await listCourses();
      setCourses(data);
      if (!selectedId && data.length > 0) setSelectedId(data[0].id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar cursos.");
    } finally {
      setLoadingCourses(false);
    }
  };

  const refreshStudents = async (courseId: string) => {
    if (!courseId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    try {
      const data = await listStudentsByCourse(courseId);
      setStudents(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar estudiantes.");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    refreshCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refreshStudents(selectedId);
  }, [selectedId]);

  const handleCreate = async () => {
    if (!newName.trim() || !newLevel) {
      toast.error("Nombre y nivel son obligatorios.");
      return;
    }
    setCreating(true);
    try {
      const c = await createCourse({ name: newName, level: newLevel });
      setNewName("");
      setNewLevel("");
      await refreshCourses();
      setSelectedId(c.id);
      toast.success(`Curso "${c.name}" creado.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear el curso.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourse = async (c: Course) => {
    try {
      await deleteCourse(c.id);
      toast.success(`Curso "${c.name}" eliminado.`);
      const remaining = courses.filter((x) => x.id !== c.id);
      setCourses(remaining);
      setSelectedId(remaining[0]?.id ?? "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar el curso.");
    }
  };

  const handleDeleteStudent = async (s: Student) => {
    try {
      await deleteStudent(s.id);
      setStudents((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar.");
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedId) ?? null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            Administración de Cursos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los cursos del colegio y carga las listas de estudiantes para evaluaciones SIMCE/PAES.
          </p>
        </header>

        {/* Crear curso */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crear curso</CardTitle>
            <CardDescription>
              Usa nombres únicos como “8°A”, “II°B” o “4° Básico C”.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="course-name">Nombre</Label>
                <Input
                  id="course-name"
                  placeholder="Ej. 8°A"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="course-level">Nivel</Label>
                <Select value={newLevel} onValueChange={setNewLevel}>
                  <SelectTrigger id="course-level">
                    <SelectValue placeholder="Selecciona el nivel…" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={creating} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Crear curso
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Importador */}
        {courses.length > 0 && (
          <StudentImporter
            courses={courses}
            onImported={() => refreshStudents(selectedId)}
          />
        )}

        {/* Listado */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Roster del curso
              </CardTitle>
              <CardDescription>
                {courses.length === 0
                  ? "Crea tu primer curso para empezar."
                  : "Selecciona un curso para ver y gestionar sus estudiantes."}
              </CardDescription>
            </div>
            {courses.length > 0 && (
              <div className="w-64">
                <Select value={selectedId} onValueChange={setSelectedId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un curso…" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — {c.level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loadingCourses ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : courses.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Aún no hay cursos creados.
              </div>
            ) : selectedCourse ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{selectedCourse.level}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {students.length} estudiantes
                    </span>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive gap-2">
                        <Trash2 className="h-4 w-4" />
                        Eliminar curso
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Eliminar curso?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se eliminará “{selectedCourse.name}” y los {students.length} estudiantes vinculados. Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteCourse(selectedCourse)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                {loadingStudents ? (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : students.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Este curso aún no tiene estudiantes. Usa el importador arriba.
                  </div>
                ) : (
                  <div className="overflow-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>RUT</TableHead>
                          <TableHead>Apellidos</TableHead>
                          <TableHead>Nombres</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {students.map((s) => (
                          <TableRow key={s.id}>
                            <TableCell className="font-mono text-xs">{formatRut(s.rut)}</TableCell>
                            <TableCell className="text-sm">{s.last_name}</TableCell>
                            <TableCell className="text-sm">{s.first_name}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => handleDeleteStudent(s)}
                                title="Eliminar estudiante"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default function Cursos() {
  return (
    <AdminGuard>
      <CursosInner />
    </AdminGuard>
  );
}
