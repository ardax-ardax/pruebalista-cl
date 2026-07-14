import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { usePlans, type Plan } from "@/hooks/usePlans";
import { resolveDestination } from "@/lib/resolve-destination";
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  GraduationCap,
  Building2,
  FileText,
  Brain,
  ClipboardList,
  BarChart3,
  ScanLine,
  ChevronRight,
  Loader2,
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "Generación con IA",
    desc: "Preguntas nuevas alineadas al OA en segundos, revisables antes de imprimir.",
  },
  {
    icon: BookOpen,
    title: "Currículum MINEDUC",
    desc: "OA vigentes por asignatura, nivel y semestre, listos para seleccionar.",
  },
  {
    icon: ClipboardList,
    title: "SIMCE y PAES",
    desc: "Plantillas específicas para ensayos SIMCE (Básica) y PAES (III–IV Medio).",
  },
  {
    icon: ScanLine,
    title: "Corrección OMR",
    desc: "Hojas de respuesta escaneables para corregir alternativas en minutos.",
  },
  {
    icon: Building2,
    title: "Panel UTP",
    desc: "Revisión, aprobación y control de calidad de las evaluaciones del colegio.",
  },
  {
    icon: BarChart3,
    title: "Reportes y consumo",
    desc: "Trazabilidad de uso por docente, curso y asignatura para la jefatura.",
  },
];

const HOW_STEPS = [
  {
    n: "1",
    title: "Elige curso y OA",
    desc: "Selecciona nivel, asignatura y objetivos de aprendizaje del currículum.",
  },
  {
    n: "2",
    title: "Genera con IA o banco",
    desc: "Combina preguntas creadas por IA con tu banco propio y edítalas a gusto.",
  },
  {
    n: "3",
    title: "Descarga el PDF",
    desc: "Encabezado con logo del colegio, hoja de respuestas y pauta de corrección.",
  },
];

const FAQ = [
  {
    q: "¿Puedo usarlo gratis?",
    a: "Sí. El plan gratuito incluye créditos iniciales para que pruebes la generación con IA y el banco de preguntas sin costo.",
  },
  {
    q: "¿Está alineado al currículum chileno?",
    a: "Sí. Los objetivos de aprendizaje corresponden al currículum vigente del MINEDUC, con decreto y período trazables.",
  },
  {
    q: "¿Sirve para colegios completos?",
    a: "Sí. El módulo institucional permite a la UTP invitar docentes, asignar cursos y revisar evaluaciones antes de aplicarlas.",
  },
  {
    q: "¿Cómo se corrigen las pruebas?",
    a: "Puedes descargar la pauta de corrección y una hoja de respuestas OMR escaneable para procesar alternativas rápidamente.",
  },
  {
    q: "¿Puedo registrarme con email o solo con Google?",
    a: "Ambos. Puedes crear tu cuenta con email + contraseña o continuar con Google.",
  },
];

function formatCLP(n: number | null | undefined): string {
  if (n == null) return "A convenir";
  if (n === 0) return "Gratis";
  return "$" + n.toLocaleString("es-CL") + " CLP";
}

function planFeatures(p: Plan): string[] {
  const items: string[] = [];
  items.push(`${p.default_credits} créditos IA iniciales`);
  items.push(
    p.max_assignments == null
      ? "Asignaciones ilimitadas"
      : `Hasta ${p.max_assignments} asignaciones de curso`,
  );
  items.push(
    p.max_assessments == null
      ? "Evaluaciones ilimitadas"
      : `Hasta ${p.max_assessments} evaluaciones`,
  );
  if (p.can_export_docx) items.push("Exportación a .docx");
  if (p.can_use_omr) items.push("Corrección OMR");
  if (p.can_use_answer_key) items.push("Pauta de corrección");
  if (!p.show_watermark) items.push("Sin marca de agua");
  return items;
}

export default function Landing() {
  const { user, loading, role } = useAuth();
  const { plans, loading: plansLoading } = usePlans();
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (loading || !user || redirecting) return;
    setRedirecting(true);
    resolveDestination(role).then((dest) => navigate(dest, { replace: true }));
  }, [user, loading, role, redirecting, navigate]);

  if (loading || (user && redirecting)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Conectando…</p>
      </div>
    );
  }

  const goAuth = (tab?: "signup") =>
    navigate(tab === "signup" ? "/auth?tab=signup" : "/auth");

  const visiblePlans = plans.length
    ? plans
    : ([] as Plan[]);

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-sm">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">
              PruebaLista<span className="text-primary">.cl</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#como-funciona" className="hover:text-foreground transition">Cómo funciona</a>
            <a href="#caracteristicas" className="hover:text-foreground transition">Características</a>
            <a href="#planes" className="hover:text-foreground transition">Planes</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
          </nav>
          <Button size="sm" onClick={() => goAuth()}>
            Ingresar / Registrarse
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-[0.04]" />
        <div className="relative max-w-5xl mx-auto px-4 pt-14 pb-16 sm:pt-20 sm:pb-24 text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Plataforma alineada al currículum MINEDUC
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
            Evaluaciones profesionales,
            <br />
            <span className="text-primary">generadas con IA en minutos.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed">
            PruebaLista ayuda a docentes y equipos UTP de Chile a crear, revisar y aplicar
            evaluaciones alineadas al currículum vigente — sin planillas, sin plantillas Word,
            sin perder horas de planificación.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button size="lg" onClick={() => goAuth("signup")}>
              Comenzar gratis
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => goAuth()}>
              Ya tengo cuenta
            </Button>
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Sin tarjeta de crédito · Créditos IA incluidos
          </p>
        </div>
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="border-t border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 py-14 sm:py-20">
          <div className="text-center space-y-2 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Cómo funciona</h2>
            <p className="text-muted-foreground">Tres pasos, una prueba lista para imprimir.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOW_STEPS.map((s) => (
              <Card key={s.n} className="border-border shadow-sm">
                <CardContent className="p-6 space-y-2">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {s.n}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Características */}
      <section id="caracteristicas" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20">
          <div className="text-center space-y-2 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Todo lo que necesitas</h2>
            <p className="text-muted-foreground">Del OA a la impresión, en una sola plataforma.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border shadow-sm hover:shadow-elevated transition-shadow">
                <CardContent className="p-5 space-y-2">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién */}
      <section className="border-t border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 py-14 sm:py-20 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card className="border-border shadow-sm">
            <CardContent className="p-6 space-y-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Docentes autónomos</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Crea pruebas para tus cursos, guarda tu banco personal y exporta PDF listos para
                imprimir. Ideal para profesores que trabajan de forma independiente.
              </p>
              <Button variant="outline" size="sm" onClick={() => goAuth("signup")}>
                Crear cuenta docente
              </Button>
            </CardContent>
          </Card>
          <Card className="border-border shadow-sm">
            <CardContent className="p-6 space-y-3">
              <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Building2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-semibold">Colegios y equipos UTP</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Gestiona docentes, cursos, asignaturas y revisa las evaluaciones antes de aplicarlas.
                Branding institucional en cada PDF y control de consumo por colegio.
              </p>
              <Button variant="outline" size="sm" onClick={() => goAuth()}>
                Hablar con nosotros
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 py-14 sm:py-20">
          <div className="text-center space-y-2 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Planes</h2>
            <p className="text-muted-foreground">Comienza gratis y escala cuando lo necesites.</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {visiblePlans.map((p) => (
                <Card
                  key={p.id}
                  className={`border-border shadow-sm relative flex flex-col ${
                    p.is_default ? "border-primary/40 shadow-elevated" : ""
                  }`}
                >
                  {p.is_default && (
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                      Recomendado
                    </Badge>
                  )}
                  <CardContent className="p-6 flex-1 flex flex-col space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-lg font-semibold text-foreground">{p.label}</h3>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-foreground">
                          {formatCLP(p.price_clp_monthly)}
                        </span>
                        {p.price_clp_monthly != null && p.price_clp_monthly > 0 && (
                          <span className="text-sm text-muted-foreground">/mes</span>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2 text-sm text-foreground flex-1">
                      {planFeatures(p).map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                          <span className="text-muted-foreground">{f}</span>
                        </li>
                      ))}
                    </ul>

                    <Button
                      className="w-full"
                      variant={p.is_default ? "default" : "outline"}
                      onClick={() => goAuth("signup")}
                    >
                      {p.price_clp_monthly === 0
                        ? "Comenzar gratis"
                        : p.price_clp_monthly == null
                          ? "Contactar ventas"
                          : "Empezar ahora"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border bg-muted/20">
        <div className="max-w-3xl mx-auto px-4 py-14 sm:py-20">
          <div className="text-center space-y-2 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Preguntas frecuentes</h2>
          </div>
          <div className="space-y-4">
            {FAQ.map((f) => (
              <Card key={f.q} className="border-border shadow-sm">
                <CardContent className="p-5 space-y-1.5">
                  <h3 className="text-base font-semibold text-foreground">{f.q}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="border-t border-border">
        <div className="max-w-4xl mx-auto px-4 py-14 sm:py-20 text-center space-y-5">
          <FileText className="h-10 w-10 text-primary mx-auto" />
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            Tu próxima prueba, lista hoy.
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Crea tu cuenta en menos de un minuto y genera tu primera evaluación con IA.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={() => goAuth("signup")}>
              Comenzar gratis
            </Button>
            <Button size="lg" variant="outline" onClick={() => goAuth()}>
              Iniciar sesión
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-primary">
              <BookOpen className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-medium text-foreground">PruebaLista.cl</span>
            <span>· Inteligencia educativa al servicio del aula</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#planes" className="hover:text-foreground transition">Planes</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
            <button onClick={() => goAuth()} className="hover:text-foreground transition">
              Ingresar
            </button>
          </div>
        </div>
      </footer>
    </main>
  );
}
