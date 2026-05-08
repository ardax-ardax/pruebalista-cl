// Panel de roster de estudiantes para UTP. Vive dentro de
// Configuración → pestaña Cursos. La creación de cursos quedó
// 100% bajo el asistente de UtpCoursesManager (admin_courses);
// este panel solo administra el listado de estudiantes asociados
// a cursos legacy de la tabla `courses` (usados por OMR).

import { useEffect, useState } from "react";
import { Loader2, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StudentImporter } from "@/components/courses/StudentImporter";
import {
  deleteStudent,
  listCourses,
  listStudentsByCourse,
  type Course,
  type Student,
} from "@/lib/courses";
import { formatRut } from "@/lib/rut";

export default function StudentRosterPanel() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

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
    if (!courseId) { setStudents([]); return; }
    setLoadingStudents(true);
    try {
      setStudents(await listStudentsByCourse(courseId));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al cargar estudiantes.");
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => { refreshCourses(); }, []);
  useEffect(() => { refreshStudents(selectedId); }, [selectedId]);

  const handleDeleteStudent = async (s: Student) => {
    try {
      await deleteStudent(s.id);
      setStudents((prev) => prev.filter((x) => x.id !== s.id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar.");
    }
  };

  const selectedCourse = courses.find((c) => c.id === selectedId) ?? null;

  if (!loadingCourses && courses.length === 0) {
    return null; // Sin cursos legacy: ocultar panel para no confundir.
  }

  return (
    <div className="space-y-4">
      {courses.length > 0 && (
        <StudentImporter courses={courses} onImported={() => refreshStudents(selectedId)} />
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Roster de estudiantes
            </CardTitle>
            <CardDescription>
              Selecciona un curso para ver y gestionar sus estudiantes (usado en hojas OMR).
            </CardDescription>
          </div>
          {courses.length > 0 && (
            <div className="w-64">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Selecciona un curso…" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} — {c.level}</SelectItem>
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
          ) : selectedCourse ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{selectedCourse.level}</Badge>
                <span className="text-sm text-muted-foreground">{students.length} estudiantes</span>
              </div>
              {loadingStudents ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : students.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Este curso aún no tiene estudiantes. Usa el importador de arriba.
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
                              variant="ghost" size="icon"
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
  );
}
