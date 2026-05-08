import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell,
  CheckCircle2,
  FilePlus2,
  FileText,
  Library,
  Sparkles,
  XCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import { getMyProfile, type Profile } from "@/lib/profiles";
import { supabase } from "@/integrations/supabase/client";
import { loadAppSettings } from "@/lib/app-settings";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  status: string;
  feedback: string;
  updatedAt: string;
}

export default function DocenteDashboardInstitucional() {
  const { user } = useAuth();
  const { creditsAvailable, loading: usageLoading, maxAssessments } = useUserUsage();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [colegioName, setColegioName] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [assessmentCount, setAssessmentCount] = useState(0);
  const [bankCount, setBankCount] = useState(0);
  const [hideCredits, setHideCredits] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [p, settings] = await Promise.all([getMyProfile(), loadAppSettings()]);
      setProfile(p);
      setHideCredits(settings.hide_credits_from_teachers);

      // Get colegio name
      if (p?.colegioId) {
        const { data: colegio } = await supabase
          .from("colegios")
          .select("nombre")
          .eq("id", p.colegioId)
          .maybeSingle();
        if (colegio) setColegioName(colegio.nombre);
      }

      // Get assessments count
      const { count: aCount } = await supabase
        .from("assessments")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setAssessmentCount(aCount ?? 0);

      // Get notifications (assessments with UTP feedback)
      const { data: feedbackData } = await supabase
        .from("assessments")
        .select("id, title, status, utp_feedback, updated_at")
        .eq("user_id", user.id)
        .not("utp_feedback", "is", null)
        .in("status", ["aprobado", "rechazado"])
        .order("updated_at", { ascending: false })
        .limit(10);

      if (feedbackData) {
        setNotifications(
          feedbackData
            .filter((a) => a.utp_feedback && a.utp_feedback.trim() !== "")
            .map((a) => ({
              id: a.id,
              title: a.title || "Sin título",
              status: a.status,
              feedback: a.utp_feedback!,
              updatedAt: a.updated_at,
            }))
        );
      }

      // Bank count
      const { count: bCount } = await supabase
        .from("question_bank")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      setBankCount(bCount ?? 0);

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

  const navigateToCreate = () => {
    if (maxAssessments !== null && assessmentCount >= maxAssessments) {
      toast.error(`Has alcanzado el límite de ${maxAssessments} pruebas en tu plan.`);
      return;
    }
    navigate("/crear-prueba?new=1");
  };

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground">Cargando…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div data-tour="dashboard">
      {/* Greeting */}
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
              {colegioName
                ? `Bienvenido al panel de ${colegioName}`
                : "Panel Institucional"}
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <Card className="shadow-card">
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{assessmentCount}</div>
              <div className="text-xs text-muted-foreground">Evaluaciones creadas</div>
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

      {/* Quick actions */}
      <section className="flex flex-wrap gap-3 mb-8">
        <Button onClick={navigateToCreate} className="gap-2">
          <FilePlus2 className="h-4 w-4" />
          Crear Evaluación
        </Button>
        <Button variant="outline" onClick={() => navigate("/pruebas")} className="gap-2">
          <FileText className="h-4 w-4" />
          Mis Evaluaciones
        </Button>
        <Button variant="outline" onClick={() => navigate("/banco-preguntas")} className="gap-2">
          <Library className="h-4 w-4" />
          Banco de Preguntas
        </Button>
      </section>

      {/* Notifications */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            Notificaciones
            {notifications.length > 0 && (
              <Badge variant="secondary" className="text-[10px] ml-1">{notifications.length}</Badge>
            )}
          </h2>
        </div>

        {notifications.length === 0 ? (
          <Card className="shadow-card">
            <CardContent className="py-10 text-center">
              <Bell className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-40" />
              <p className="text-muted-foreground text-sm">No tienes notificaciones por ahora.</p>
              <p className="text-muted-foreground text-xs mt-1">
                Aquí aparecerán los mensajes de la UTP cuando revisen tus evaluaciones.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => (
              <Link key={n.id} to={`/crear-prueba?id=${n.id}`} className="block">
                <Card className="shadow-card hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5">
                        {n.status === "aprobado" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground truncate">{n.title}</span>
                          <Badge
                            className={`text-[10px] ${
                              n.status === "aprobado"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            }`}
                          >
                            {n.status === "aprobado" ? "Aprobada" : "Rechazada"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.feedback}</p>
                        <div className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(n.updatedAt)}
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
      </div>
    </AppLayout>
  );
}
