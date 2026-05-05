import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
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
  FileText,
  BarChart3,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.09 24.09 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

type LoginIntent = "docente" | "institucional" | null;

export default function Landing() {
  const { user, loading, role, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const isEmbedded = useIsEmbedded();
  const [redirecting, setRedirecting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const intentRef = useRef<LoginIntent>(null);

  // Restore intent after OAuth redirect
  useEffect(() => {
    const stored = sessionStorage.getItem("loginIntent") as LoginIntent;
    if (stored) intentRef.current = stored;
  }, []);

  // Redirect logged-in users
  useEffect(() => {
    if (loading || !user || redirecting) return;
    setRedirecting(true);

    const intent = intentRef.current || (sessionStorage.getItem("loginIntent") as LoginIntent);
    sessionStorage.removeItem("loginIntent");

    resolveDestination(role).then((dest) => {
      // If user clicked institucional but doesn't have admin/utp permissions
      if (intent === "institucional" && role !== "admin" && role !== "utp_head") {
        toast.info("Tu cuenta no tiene permisos directivos. Entrando a tu panel docente…", {
          duration: 4000,
        });
      }
      navigate(dest, { replace: true });
    });
  }, [user, loading, role, redirecting, navigate]);

  const handleLogin = async (intent: LoginIntent) => {
    if (isEmbedded) {
      openInNewTab("/landing");
      return;
    }
    try {
      intentRef.current = intent;
      sessionStorage.setItem("loginIntent", intent || "");
      setSigningIn(true);
      await signInWithGoogle();
    } catch (e) {
      setSigningIn(false);
      toast.error("No se pudo iniciar sesión: " + (e as Error).message);
    }
  };

  // Loading / spinner overlay
  if (loading || (user && redirecting) || signingIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Conectando con Google…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-[0.04]" />
        <div className="relative max-w-5xl mx-auto px-4 py-14 sm:py-24 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Plataforma alineada al currículum Mineduc
          </div>

          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
            Potencia tu gestión pedagógica
            <br />
            <span className="text-primary">con IA alineada al Mineduc</span>
          </h1>

          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
            Estandariza tus evaluaciones, ahorra horas de trabajo y asegura la
            cobertura curricular usando tu cuenta de Google
          </p>
        </div>
      </section>

      {/* Dual access cards */}
      <section className="max-w-4xl mx-auto px-4 -mt-4 pb-12 sm:pb-16 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Card Docente */}
        <Card className="group relative overflow-hidden border-2 border-transparent hover:border-primary/30 transition-all duration-300 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)]">
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Acceso Docente</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Crea evaluaciones profesionales, accede al banco de preguntas y
              genera material con IA en segundos
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Generación de preguntas con IA",
                "Banco de preguntas reutilizable",
                "Exportación PDF y .docx",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleLogin("docente")}
              className="w-full mt-2 flex items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white px-6 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition-colors hover:bg-[#f7f8f8] active:bg-[#eee]"
            >
              <GoogleIcon />
              Ingresar con Google
            </button>
          </CardContent>
        </Card>

        {/* Card UTP / Admin */}
        <Card className="group relative overflow-hidden border-2 border-transparent hover:border-primary/30 transition-all duration-300 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-elevated)]">
          <CardContent className="p-6 sm:p-8 space-y-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">
              Gestión Institucional / UTP
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Supervisa el consumo, aprueba evaluaciones y toma el control de la
              calidad educativa de tu colegio
            </p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {[
                "Revisión y aprobación de pruebas",
                "Asignación de cursos y docentes",
                "Reportes de uso y cobertura",
              ].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleLogin("institucional")}
              className="w-full mt-2 flex items-center justify-center gap-3 rounded-md border border-[#dadce0] bg-white px-6 py-2.5 text-sm font-medium text-[#3c4043] shadow-sm transition-colors hover:bg-[#f7f8f8] active:bg-[#eee]"
            >
              <GoogleIcon />
              Ingresar con Google
            </button>
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

      {/* Trust strip */}
      <section className="border-t border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-10 sm:py-12 text-center space-y-6">
          <h3 className="text-lg font-semibold text-foreground">
            La primera plataforma que habla el lenguaje del Mineduc
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
            <div className="space-y-2">
              <div className="h-10 w-10 mx-auto rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="font-medium text-foreground">Conexión con OAs del Mineduc</p>
              <p className="text-muted-foreground">
                Objetivos de Aprendizaje e indicadores de evaluación del
                currículum nacional preconfigurados.
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-10 w-10 mx-auto rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-emerald-600" />
              </div>
              <p className="font-medium text-foreground">Formatos SIMCE / PAES</p>
              <p className="text-muted-foreground">
                Genera evaluaciones con formatos estandarizados alineados a las
                pruebas nacionales.
              </p>
            </div>
            <div className="space-y-2">
              <div className="h-10 w-10 mx-auto rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-emerald-600" />
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
