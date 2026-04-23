import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FilePlus2, Library, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAssessment, listAssessments } from "@/lib/assessment-storage";
import { loadGrades, loadSubjects } from "@/lib/catalog";
import type { Assessment } from "@/lib/assessment-schema";

const MisPruebas = () => {
  const [items, setItems] = useState<Assessment[]>([]);
  const [subjects] = useState(() => loadSubjects());
  const [grades] = useState(() => loadGrades());
  const navigate = useNavigate();

  const refresh = () => setItems(listAssessments());

  useEffect(() => { refresh(); }, []);

  const handleDelete = (id: string, title: string) => {
    if (!confirm(`¿Eliminar la prueba "${title || "Sin título"}"?`)) return;
    deleteAssessment(id);
    refresh();
    toast.success("Prueba eliminada");
  };

  const labelOf = (arr: { value: string; label: string }[], v: string) =>
    arr.find((x) => x.value === v)?.label ?? "—";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Mis pruebas</h1>
            <p className="text-sm text-muted-foreground">
              Pruebas guardadas en este navegador. Puedes editarlas o eliminarlas.
            </p>
          </div>
          <Button asChild size="sm">
            <Link to="/"><FilePlus2 className="h-4 w-4" /> Nueva prueba</Link>
          </Button>
        </div>

        {items.length === 0 ? (
          <Card className="shadow-card border-dashed">
            <CardContent className="p-10 text-center text-sm text-muted-foreground">
              <Library className="mx-auto h-10 w-10 mb-3 opacity-50" />
              Aún no has guardado pruebas. Crea una y pulsa <strong>Guardar</strong>.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {items.map((a) => {
              const counted = a.questions.filter((q) => q.type !== "section-title" && q.type !== "info-block").length;
              return (
                <Card key={a.id} className="shadow-card">
                  <CardContent className="p-4 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{a.meta.title || "Sin título"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>{labelOf(subjects, a.meta.subjectValue)}</span>
                        <span>·</span>
                        <span>{labelOf(grades, a.meta.gradeValue)}</span>
                        <span>·</span>
                        <span>{counted} pregunta{counted === 1 ? "" : "s"}</span>
                        <span>·</span>
                        <span>Actualizada {new Date(a.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate(`/?id=${a.id}`)}>
                      <Pencil className="h-4 w-4" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(a.id, a.meta.title)}>
                      <Trash2 className="h-4 w-4" /> Eliminar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default MisPruebas;
