import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { resolveDestination } from "@/lib/resolve-destination";
import { useIsEmbedded, openInNewTab } from "@/hooks/useIsEmbedded";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Info,
  Shield,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";

export default function Landing() {
  const { user, loading, role, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const isEmbedded = useIsEmbedded();
  const [redirecting, setRedirecting] = useState(false);

  // If already logged in, redirect based on role
  useEffect(() => {
    if (loading || !user || redirecting) return;
    setRedirecting(true);
    resolveDestination(role).then((dest) => {
      navigate(dest, { replace: true });
    });
  }, [user, loading, role, redirecting, navigate]);

  const handleLogin = async () => {
    if (isEmbedded) {
      openInNewTab("/landing");
      return;
    }
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error("No se pudo iniciar sesión: " + (e as Error).message);
    }
  };

  if (loading || (user && redirecting)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-[0.04]" />
        <div className="relative max-w-5xl mx-auto px-4 py-16 sm:py-24 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Plataforma alineada al currículum Mineduc
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            Potencia tu gestión pedagógica
            <br />
            <span className="text-primary">con IA alineada al Mineduc</span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg text-muted-foreground leading-relaxed">
            Estandariza tus evaluaciones, ahorra horas de trabajo y asegura la
            cobertura curricular con objetivos de aprendizaje e indicadores
            oficiales.
          </p>
        </div>
      </section>

      {/* Dual access cards */}
      <section className="max-w-4xl mx-auto px-4 -mt-4 pb-16 grid sm:grid-cols-2 gap-6">
        <Card
          className="group relative overflow-hidden border-2 border-transparent hover:border-primary/30 transition-all duration-300 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] cursor-pointer"
          onClick={handleLogin}
        >
          <CardContent className="p-8 space-y-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Acceso Docente</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Crea evaluaciones estandarizadas, genera preguntas con IA y
              administra tu banco de preguntas personal.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Generación de preguntas con IA",
                "Banco de preguntas reutilizable",
                "Exportación PDF y .docx",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                  {t}
                </li>
              ))}
            </ul>
            <Button className="w-full mt-2" size="lg">
              <BookOpen className="h-4 w-4 mr-2" />
              Ingresar como Docente
            </Button>
          </CardContent>
        </Card>

        <Card
          className="group relative overflow-hidden border-2 border-transparent hover:border-primary/30 transition-all duration-300 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)] cursor-pointer"
          onClick={handleLogin}
        >
          <CardContent className="p-8 space-y-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Gestión Institucional / UTP
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Supervisa la creación de evaluaciones, gestiona docentes y asegura
              la cobertura curricular del colegio.
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Revisión y aprobación de pruebas",
                "Asignación de cursos y docentes",
                "Reportes de uso y cobertura",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
                  {t}
                </li>
              ))}
            </ul>
            <Button className="w-full mt-2" variant="outline" size="lg">
              <Shield className="h-4 w-4 mr-2" />
              Ingresar como UTP / Admin
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Embedded warning */}
      {isEmbedded && (
        <div className="max-w-4xl mx-auto px-4 pb-8">
          <div className="flex gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              Por motivos de seguridad de Google, el inicio de sesión no funciona
              dentro de marcos.{" "}
              <button
                onClick={() => openInNewTab("/landing")}
                className="underline underline-offset-2 text-foreground hover:text-primary"
              >
                Abre en una pestaña nueva
              </button>
              .
            </p>
          </div>
        </div>
      )}

      {/* Trust section */}
      <section className="border-t border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center space-y-6">
          <h3 className="text-lg font-semibold text-foreground">
            La primera plataforma que habla el lenguaje del Mineduc
          </h3>
          <div className="grid sm:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="h-10 w-10 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium text-foreground">OAs Oficiales Cargados</p>
              <p className="text-muted-foreground">
                Objetivos de Aprendizaje e indicadores de evaluación del
                currículum nacional preconfigurados.
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-10 w-10 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium text-foreground">IA Alineada al Currículum</p>
              <p className="text-muted-foreground">
                Genera preguntas vinculadas a OAs específicos, asegurando
                cobertura curricular en cada evaluación.
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-10 w-10 mx-auto rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <p className="font-medium text-foreground">Flujo UTP Integrado</p>
              <p className="text-muted-foreground">
                Los docentes crean, la UTP revisa y aprueba. Control total de
                calidad institucional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} PruebaLista.cl — Plataforma de gestión pedagógica
      </footer>
    </main>
  );
}
