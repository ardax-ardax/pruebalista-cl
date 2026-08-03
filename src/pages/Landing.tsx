import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { usePlans, type Plan } from "@/hooks/usePlans";
import { resolveDestination } from "@/lib/resolve-destination";
import { loadPublicLandingSettings } from "@/lib/global-settings";

import {
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Building2,
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
    desc: "Plantillas para ensayos SIMCE (Básica) y PAES (III–IV Medio).",
  },
  {
    icon: ScanLine,
    title: "Corrección OMR",
    desc: "Hojas escaneables para corregir alternativas en minutos.",
  },
  {
    icon: Building2,
    title: "Panel UTP",
    desc: "Revisión y control de calidad de evaluaciones del colegio.",
  },
  {
    icon: BarChart3,
    title: "Reportes y consumo",
    desc: "Trazabilidad de uso por docente, curso y asignatura.",
  },
];

const HOW_STEPS = [
  {
    n: "1",
    title: "Elige curso y OA",
    desc: "Selecciona nivel, asignatura y objetivos del currículum.",
  },
  {
    n: "2",
    title: "Genera con IA o banco",
    desc: "Combina preguntas de IA con tu banco propio y edítalas.",
  },
  {
    n: "3",
    title: "Descarga el PDF",
    desc: "Con logo del colegio, hoja de respuestas y pauta.",
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
  const [showUtp, setShowUtp] = useState<boolean | null>(null);

  useEffect(() => {
    loadPublicLandingSettings()
      .then((s) => setShowUtp(s.show_institutional_landing))
      .catch(() => setShowUtp(true));
  }, []);

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

  const institutional = showUtp === true;
  const features = institutional
    ? FEATURES
    : FEATURES.filter((f) => f.title !== "Panel UTP");
  const faqItems = institutional
    ? FAQ
    : FAQ.filter((f) => f.q !== "¿Sirve para colegios completos?");
  const isInstitutionalPlan = (p: Plan) =>
    p.id === "institucional" || /institucional/i.test(p.label);
  const visiblePlans = institutional ? plans : plans.filter((p) => !isInstitutionalPlan(p));


  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-12 sm:h-14">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-sm">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
            </div>
            <span className="text-sm sm:text-base font-bold tracking-tight text-foreground">
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
            Ingresar
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-[0.04]" />
        <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-8 sm:pt-12 sm:pb-14 text-center space-y-3 sm:space-y-4">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground leading-[1.15]">
            Evaluaciones profesionales,{" "}
            <span className="text-primary">generadas con IA en minutos.</span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            {institutional
              ? "PruebaLista ayuda a docentes y equipos UTP de Chile a crear, revisar y aplicar evaluaciones alineadas al currículum vigente del MINEDUC."
              : "PruebaLista ayuda a docentes de Chile a crear y aplicar evaluaciones alineadas al currículum vigente del MINEDUC."}
          </p>

          <div className="flex flex-row items-center justify-center gap-2 sm:gap-3">
            <Button onClick={() => goAuth("signup")}>
              Comenzar gratis
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <Button variant="outline" onClick={() => goAuth()}>
              Ya tengo cuenta
            </Button>
          </div>
        </div>
      </section>

      {/* Cómo funciona + Características */}
      <section id="como-funciona" className="border-t border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
          <div className="text-center space-y-1 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Cómo funciona</h2>
            <p className="text-sm text-muted-foreground">Tres pasos, una prueba lista para imprimir.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-6 sm:mb-8">
            {HOW_STEPS.map((s) => (
              <div key={s.n} className="flex items-start gap-2.5">
                <div className="h-7 w-7 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">
                  {s.n}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground leading-tight">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-snug">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div id="caracteristicas" className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border shadow-sm">
                <CardContent className="p-3 sm:p-4 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <f.icon className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground leading-tight">{f.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Para quién */}
      <section className="border-t border-border">
        <div className={`max-w-5xl mx-auto px-4 py-6 sm:py-10 grid grid-cols-1 gap-2 sm:gap-4 ${institutional ? "md:grid-cols-2" : ""}`}>
          <Card className="border-border shadow-sm">
            <CardContent className="p-4 space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <GraduationCap className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold">Docentes autónomos</h3>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                Crea pruebas para tus cursos, guarda tu banco personal y exporta PDF listos para imprimir.
              </p>
            </CardContent>
          </Card>
          {institutional && (
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <h3 className="text-base font-semibold">Colegios y equipos UTP</h3>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground leading-snug">
                  Gestiona docentes, cursos y revisa evaluaciones antes de aplicarlas. Branding institucional en cada PDF.
                </p>
              </CardContent>
            </Card>
          )}

        </div>
      </section>

      {/* Planes */}
      <section id="planes" className="border-t border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
          <div className="text-center space-y-1 mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Planes</h2>
            <p className="text-sm text-muted-foreground">Comienza gratis y escala cuando lo necesites.</p>
          </div>

          {plansLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0 pb-2 md:pb-0">
              {visiblePlans.map((p) => {
                const feats = planFeatures(p);
                const shown = feats.slice(0, 4);
                const rest = feats.length - shown.length;
                return (
                  <Card
                    key={p.id}
                    className={`border-border shadow-sm relative flex flex-col shrink-0 w-[80%] sm:w-[55%] md:w-auto snap-center ${
                      p.is_default ? "border-primary/40 shadow-elevated" : ""
                    }`}
                  >
                    {p.is_default && (
                      <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        Recomendado
                      </Badge>
                    )}
                    <CardContent className="p-4 sm:p-5 flex-1 flex flex-col space-y-3">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-semibold text-foreground">{p.label}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl sm:text-2xl font-bold text-foreground">
                            {formatCLP(p.price_clp_monthly)}
                          </span>
                          {p.price_clp_monthly != null && p.price_clp_monthly > 0 && (
                            <span className="text-xs text-muted-foreground">/mes</span>
                          )}
                        </div>
                      </div>

                      <ul className="space-y-1 text-sm flex-1">
                        {shown.map((f) => (
                          <li key={f} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                            <span className="text-xs sm:text-sm text-muted-foreground leading-snug">{f}</span>
                          </li>
                        ))}
                        {rest > 0 && (
                          <li className="text-xs text-muted-foreground pl-[1.375rem]">y {rest} más</li>
                        )}
                      </ul>

                      <Button
                        className="w-full"
                        size="sm"
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
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-border">
        <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground text-center mb-4 sm:mb-6">
            Preguntas frecuentes
          </h2>
          <Accordion type="single" collapsible className="w-full">
            {FAQ.map((f, i) => (
              <AccordionItem key={f.q} value={`item-${i}`}>
                <AccordionTrigger className="py-3 text-left text-sm font-semibold text-foreground">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-primary">
              <BookOpen className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-medium text-foreground">PruebaLista.cl</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <a href="#planes" className="hover:text-foreground transition">Planes</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
            <Button size="sm" onClick={() => goAuth("signup")}>Comenzar gratis</Button>
          </div>
        </div>
      </footer>

    </main>
  );
}
