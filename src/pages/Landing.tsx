import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { resolveDestination } from "@/lib/resolve-destination";
import { useIsEmbedded, openInNewTab } from "@/hooks/useIsEmbedded";
import { supabase } from "@/integrations/supabase/client";
import {
  BookOpen,
  Building2,
  CheckCircle2,
  Info,
  Shield,
  Sparkles,
  GraduationCap,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Send,
} from "lucide-react";
import { toast } from "sonner";

function translateAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials"))
    return "Email o contraseña incorrectos.";
  if (m.includes("email not confirmed"))
    return "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Este email ya está registrado. Inicia sesión o recupera tu contraseña.";
  if (m.includes("password") && m.includes("6"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("pwned") || m.includes("hibp") || m.includes("compromised"))
    return "Esta contraseña aparece en filtraciones conocidas. Elige otra más segura.";
  if (m.includes("rate limit") || m.includes("over_email_send_rate_limit"))
    return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
  return msg;
}

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" className="shrink-0">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.09 24.09 0 0 0 0 21.56l7.98-6.19z"/>
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
);
const LinkedInIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
);
const YouTubeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/></svg>
);

type LoginIntent = "docente" | "institucional" | null;

export default function Landing() {
  const { user, loading, role, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const isEmbedded = useIsEmbedded();
  const [redirecting, setRedirecting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const intentRef = useRef<LoginIntent>(null);
  const [demoEmail, setDemoEmail] = useState("");
  const [authTab, setAuthTab] = useState<"login" | "signup">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suPassword2, setSuPassword2] = useState("");
  const [signupSent, setSignupSent] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");

  useEffect(() => {
    const stored = sessionStorage.getItem("loginIntent") as LoginIntent;
    if (stored) intentRef.current = stored;
  }, []);

  useEffect(() => {
    if (loading || !user || redirecting) return;
    setRedirecting(true);
    const intent = intentRef.current || (sessionStorage.getItem("loginIntent") as LoginIntent);
    sessionStorage.removeItem("loginIntent");
    resolveDestination(role).then((dest) => {
      if (intent === "institucional" && role !== "admin" && role !== "utp_head") {
        toast.info("Tu cuenta no tiene permisos directivos. Entrando a tu panel docente…", { duration: 4000 });
      }
      navigate(dest, { replace: true });
    });
  }, [user, loading, role, redirecting, navigate]);

  const handleLogin = async (intent: LoginIntent) => {
    if (isEmbedded) { openInNewTab("/landing"); return; }
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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) return;
    setEmailBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setEmailBusy(false);
    if (error) {
      toast.error(translateAuthError(error.message));
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suPassword !== suPassword2) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (suPassword.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setEmailBusy(true);
    const { error } = await supabase.auth.signUp({
      email: suEmail.trim(),
      password: suPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: suName.trim() },
      },
    });
    setEmailBusy(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    setSignupSent(suEmail.trim());
    toast.success("Te enviamos un correo de confirmación.");
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) return;
    setEmailBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setEmailBusy(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    toast.success("Si el email existe, te enviamos un enlace para restablecer la contraseña.");
    setRecoveryOpen(false);
    setRecoveryEmail("");
  };

  const handleDemoRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoEmail.trim()) return;
    toast.success("¡Solicitud enviada! Nos pondremos en contacto pronto.");
    setDemoEmail("");
  };

  if (loading || (user && redirecting) || signingIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium">Conectando…</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-sm">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">
              PruebaLista<span className="text-primary">.cl</span>
            </span>
          </div>
          <p className="hidden sm:block text-xs font-medium text-muted-foreground tracking-wide">
            Inteligencia Educativa al Servicio del Aula
          </p>
        </div>
      </header>

      {/* Hero — compact */}
      <section className="relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-[var(--gradient-primary)] opacity-[0.03]" />
        <div className="relative max-w-5xl mx-auto px-4 pt-4 pb-1 sm:pt-10 sm:pb-4 text-center space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3 w-3 text-primary" />
            Plataforma alineada al currículum Mineduc
          </div>

          <h1 className="text-xl sm:text-4xl font-bold tracking-tight text-foreground leading-tight">
            Potencia tu gestión pedagógica
            <br />
            <span className="text-primary">con IA alineada al Mineduc</span>
          </h1>

          <p className="max-w-xl mx-auto text-xs sm:text-base text-muted-foreground leading-relaxed">
            Estandariza evaluaciones, ahorra horas de trabajo y asegura la
            cobertura curricular con Google o email y contraseña
          </p>
        </div>
      </section>

      {/* Dual access cards — tighter */}
      <section className="max-w-4xl mx-auto px-4 pt-3 pb-4 sm:pb-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Docente */}
        <Card className="group relative overflow-hidden rounded-xl border border-border hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-elevated">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Acceso Docente</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Crea evaluaciones profesionales, accede al banco de preguntas y genera material con IA en segundos
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {["Generación de preguntas con IA", "Banco de preguntas reutilizable", "Exportación PDF y .docx"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleLogin("docente")}
              className="w-full mt-1 flex items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/40 active:scale-[0.98]"
            >
              <GoogleIcon />
              Ingresar con Google
            </button>
          </CardContent>
        </Card>

        {/* UTP */}
        <Card className="group relative overflow-hidden rounded-xl border border-border hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-elevated">
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Gestión Institucional / UTP</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Supervisa el consumo, aprueba evaluaciones y controla la calidad educativa de tu colegio
            </p>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              {["Revisión y aprobación de pruebas", "Asignación de cursos y docentes", "Reportes de uso y cobertura"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleLogin("institucional")}
              className="w-full mt-1 flex items-center justify-center gap-3 rounded-xl border border-border bg-card px-5 py-2 text-sm font-medium text-foreground shadow-sm transition-all duration-200 hover:shadow-md hover:border-primary/40 active:scale-[0.98]"
            >
              <GoogleIcon />
              Ingresar con Google
            </button>
          </CardContent>
        </Card>
      </section>

      {/* Email/password access */}
      <section className="max-w-4xl mx-auto px-4 pb-4 sm:pb-8 w-full">
        <Card className="rounded-xl border border-border shadow-sm">
          <CardContent className="p-5 sm:p-6 space-y-4">
            <div className="space-y-1 text-center">
              <h2 className="text-lg font-semibold text-foreground">Acceso con email</h2>
              <p className="text-xs text-muted-foreground">
                También puedes iniciar sesión o crear tu cuenta con correo personal.
              </p>
            </div>

            {signupSent ? (
              <div className="max-w-md mx-auto space-y-3 text-sm">
                <p className="rounded-md border border-border bg-muted/40 p-3 text-muted-foreground">
                  Te enviamos un correo a <strong className="text-foreground">{signupSent}</strong> con un enlace para activar tu cuenta.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSignupSent(null);
                    setAuthTab("login");
                    setLoginEmail(signupSent);
                  }}
                >
                  Volver a inicio de sesión
                </Button>
              </div>
            ) : (
              <Tabs value={authTab} onValueChange={(v) => setAuthTab(v as "login" | "signup")} className="max-w-md mx-auto">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                  <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="space-y-3 pt-3">
                  <form onSubmit={handleEmailLogin} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="landing-login-email">Email</Label>
                      <Input
                        id="landing-login-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="landing-login-password">Contraseña</Label>
                      <Input
                        id="landing-login-password"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                      />
                    </div>
                    <div className="text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryEmail(loginEmail);
                          setRecoveryOpen(true);
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        ¿Olvidaste tu contraseña?
                      </button>
                    </div>
                    <Button type="submit" className="w-full" disabled={emailBusy}>
                      {emailBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Iniciar sesión
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-3 pt-3">
                  <form onSubmit={handleSignup} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="landing-su-name">Nombre</Label>
                      <Input
                        id="landing-su-name"
                        type="text"
                        autoComplete="name"
                        required
                        value={suName}
                        onChange={(e) => setSuName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="landing-su-email">Email</Label>
                      <Input
                        id="landing-su-email"
                        type="email"
                        autoComplete="email"
                        required
                        value={suEmail}
                        onChange={(e) => setSuEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="landing-su-password">Contraseña</Label>
                      <Input
                        id="landing-su-password"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={suPassword}
                        onChange={(e) => setSuPassword(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="landing-su-password2">Confirmar contraseña</Label>
                      <Input
                        id="landing-su-password2"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={suPassword2}
                        onChange={(e) => setSuPassword2(e.target.value)}
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={emailBusy}>
                      {emailBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Crear cuenta
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      Te enviaremos un correo para confirmar tu cuenta.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Embedded warning */}
      {isEmbedded && (
        <div className="max-w-4xl mx-auto px-4 pb-4">
          <div className="flex gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm">
            <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              Por motivos de seguridad de Google, el inicio de sesión no funciona dentro de marcos.{" "}
              <button onClick={() => openInNewTab("/landing")} className="underline underline-offset-2 text-foreground hover:text-primary">
                Abre en una pestaña nueva
              </button>.
            </p>
          </div>
        </div>
      )}

      {/* Trust strip — compact */}
      <section className="border-t border-border bg-card">
        <div className="max-w-4xl mx-auto px-4 py-8 text-center space-y-5">
          <h3 className="text-base font-semibold text-foreground">
            La primera plataforma que habla el lenguaje del Mineduc
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 text-sm">
            {[
              { icon: BookOpen, title: "Conexión con OAs del Mineduc", desc: "Objetivos de Aprendizaje e indicadores de evaluación del currículum nacional preconfigurados." },
              { icon: FileText, title: "Formatos SIMCE / PAES", desc: "Genera evaluaciones con formatos estandarizados alineados a las pruebas nacionales." },
              { icon: Shield, title: "Flujo UTP Integrado", desc: "Los docentes crean, la UTP revisa y aprueba. Control total de calidad institucional." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="space-y-2">
                <div className="h-10 w-10 mx-auto rounded-xl bg-success/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-success" />
                </div>
                <p className="font-medium text-foreground text-sm">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 mt-auto">
        <div className="max-w-6xl mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {/* Brand + Contact */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-primary shadow-sm">
                  <BookOpen className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="text-sm font-bold text-foreground">
                  PruebaLista<span className="text-primary">.cl</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Plataforma de gestión pedagógica con IA alineada al currículum Mineduc.
              </p>
              <div className="space-y-2 text-xs text-muted-foreground">
                <a href="mailto:soporte@pruebalista.cl" className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <Mail className="h-3.5 w-3.5" /> soporte@pruebalista.cl
                </a>
                <a href="https://wa.me/56900000000" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-foreground transition-colors">
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </a>
              </div>
            </div>

            {/* Demo form */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">Solicita una Demo para tu Colegio</h4>
              <p className="text-xs text-muted-foreground">Déjanos tu correo y te contactaremos.</p>
              <form onSubmit={handleDemoRequest} className="flex gap-2">
                <input
                  type="email"
                  placeholder="correo@colegio.cl"
                  value={demoEmail}
                  onChange={(e) => setDemoEmail(e.target.value)}
                  className="flex-1 h-9 rounded-xl border border-border bg-background px-3 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  required
                />
                <button
                  type="submit"
                  className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:bg-primary/90 transition-colors flex items-center gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Enviar
                </button>
              </form>
            </div>

            {/* Social + Legal */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-foreground">Síguenos</h4>
              <div className="flex items-center gap-3">
                <a href="https://instagram.com/ardax" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                  <InstagramIcon />
                </a>
                <a href="https://linkedin.com/company/ardax" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                  <LinkedInIcon />
                </a>
                <a href="https://youtube.com/@ardax" target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                  <YouTubeIcon />
                </a>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <a href="#" className="block hover:text-foreground transition-colors">Términos de Servicio</a>
                <a href="#" className="block hover:text-foreground transition-colors">Políticas de Privacidad</a>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-border text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} PruebaLista.cl — Inteligencia Educativa al Servicio del Aula
          </div>
        </div>
      </footer>

      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recuperar contraseña</DialogTitle>
            <DialogDescription>
              Ingresa tu email y te enviaremos un enlace para crear una nueva contraseña.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRecovery} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="landing-rec-email">Email</Label>
              <Input
                id="landing-rec-email"
                type="email"
                required
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRecoveryOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={emailBusy}>
                {emailBusy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar enlace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
