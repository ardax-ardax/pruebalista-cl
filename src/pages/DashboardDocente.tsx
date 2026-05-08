import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FilePlus2, Library, FileText, Sparkles, ArrowRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import { getMyProfile, type Profile } from "@/lib/profiles";
import { listAssessments } from "@/lib/assessment-storage";
import { ASSESSMENT_STATUS_LABEL, type Assessment, type AssessmentStatus } from "@/lib/assessment-schema";
import { supabase } from "@/integrations/supabase/client";
import { loadSubjects } from "@/lib/catalog";
import { useAdminCourses } from "@/hooks/useAdminCourses";
import { loadAppSettings } from "@/lib/app-settings";

const STATUS_COLOR: Record<AssessmentStatus, string> = {
  borrador: "bg-muted text-muted-foreground",
  pendiente_revision: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  aprobado: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rechazado: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function DashboardDocente() {
  const { user } = useAuth();
  const { effectivePlan, creditsAvailable, loading: usageLoading, maxAssessments } = useUserUsage();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [bankCount, setBankCount] = useState(0);
  const [hideCredits, setHideCredits] = useState(false);
  const [isProfesor, setIsProfesor] = useState(false);
  const [loading, setLoading] = useState(true);

  const subjects = loadSubjects();
  const { grades } = useAdminCourses();

  const navigateToCreate = () => {
    if (maxAssessments !== null && assessments.length >= maxAssessments) {
      toast.error(`Has alcanzado el límite de ${maxAssessments} pruebas en tu plan. Elimina una prueba existente o actualiza tu plan.`);
      return;
    }
    navigate("/crear-prueba?new=1");
  };

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [p, aList, settings] = await Promise.all([
        getMyProfile(),
        listAssessments(),
        loadAppSettings(),
      ]);

      setProfile(p);
      setAssessments(aList);
      setHideCredits(settings.hide_credits_from_teachers);

      // Check if profesor (has colegio_id)
      if (p) {
        const { data } = await supabase
          .from("profiles")
          .select("colegio_id")
          .eq("id", user.id)
          .maybeSingle();
        setIsProfesor(!!(data as { colegio_id: string | null } | null)?.colegio_id);
      }

      // Count own bank questions
      const { count } = await supabase
        .from("question_bank")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setBankCount(count ?? 0);

      setLoading(false);
    };
    load();
  }, [user?.id]);

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    (user?.email ? user.email.split("@")[0] : "Docente");
  const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || undefined;
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const recentAssessments = assessments.slice(0, 5);

  const subjectLabel = (v: string) => subjects.find((s) => s.value === v)?.label ?? v;
  const gradeLabel = (v: string) => grades.find((g) => g.value === v)?.label ?? v;

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">
          Cargando…
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Saludo */}
      <section className="mb-8 animate-fade-in">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Hola, {displayName.split(" ")[0]}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isProfesor ? "Panel de profesor" : "Panel de docente"}
            </p>
          </div>
        </div>
      </section>

      {/* Tarjetas de resumen */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-card">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{assessments.length}</div>
              <div className="text-xs text-muted-foreground">Pruebas creadas</div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Library className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{bankCount}</div>
              <div className="text-xs text-muted-foreground">Preguntas en banco</div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              {hideCredits ? (
                <>
                  <div className="text-sm font-semibold text-green-700 dark:text-green-400">Plan Institucional</div>
                  <div className="text-xs text-muted-foreground">Créditos IA ilimitados</div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-foreground">
                    {usageLoading ? "…" : creditsAvailable}
                  </div>
                  <div className="text-xs text-muted-foreground">Créditos IA</div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Acciones rápidas */}
      <section className="flex flex-wrap gap-3 mb-8">
        <Button onClick={navigateToCreate} className="gap-2">
          <FilePlus2 className="h-4 w-4" />
          Crear nueva prueba
        </Button>
        <Button variant="outline" onClick={() => navigate("/banco-preguntas")} className="gap-2">
          <Library className="h-4 w-4" />
          Banco de preguntas
        </Button>
        <Button variant="outline" onClick={() => navigate("/pruebas")} className="gap-2">
          <FileText className="h-4 w-4" />
          Todas mis pruebas
        </Button>
      </section>

      {/* Pruebas recientes */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            Pruebas recientes
          </h2>
          {assessments.length > 5 && (
            <Link to="/pruebas" className="text-sm text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {recentAssessments.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">Aún no has creado pruebas.</p>
              <Button onClick={navigateToCreate} className="mt-4 gap-2" size="sm">
                <FilePlus2 className="h-4 w-4" />
                Crear mi primera prueba
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentAssessments.map((a) => (
              <Link
                key={a.id}
                to={`/crear-prueba?id=${a.id}`}
                className="block"
              >
                <Card className="shadow-card hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate text-foreground">
                        {a.meta.title || "Sin título"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                        {a.meta.subjectValue && (
                          <span>{subjectLabel(a.meta.subjectValue)}</span>
                        )}
                        {a.meta.gradeValue && (
                          <>
                            <span className="text-border">·</span>
                            <span>{gradeLabel(a.meta.gradeValue)}</span>
                          </>
                        )}
                        <span className="text-border">·</span>
                        <span>{formatDate(a.updatedAt)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      {isProfesor && (
                        <Badge className={`text-[10px] ${STATUS_COLOR[a.status]}`}>
                          {ASSESSMENT_STATUS_LABEL[a.status]}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </AppLayout>
  );
}
