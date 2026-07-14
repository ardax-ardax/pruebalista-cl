import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useIsEmbedded, openInNewTab } from "@/hooks/useIsEmbedded";
import { resolveDestination } from "@/lib/resolve-destination";
import { supabase } from "@/integrations/supabase/client";
import { ExternalLink, Info, Loader2 } from "lucide-react";
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

const AuthPage = () => {
  const { user, loading, role, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const isEmbedded = useIsEmbedded();
  const [redirecting, setRedirecting] = useState(false);

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  // Login
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup
  const [suName, setSuName] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suPassword2, setSuPassword2] = useState("");
  const [signupSent, setSignupSent] = useState<string | null>(null);

  // Recovery
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");

  useEffect(() => {
    if (loading || !user || redirecting) return;
    setRedirecting(true);
    resolveDestination(role).then((dest) => {
      navigate(dest, { replace: true });
    });
  }, [user, loading, role, redirecting, navigate]);

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch (e) {
      toast.error("No se pudo iniciar sesión: " + (e as Error).message);
    }
  };

  const handleOpenFullscreen = () => {
    openInNewTab("/landing");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail.trim(),
      password: loginPassword,
    });
    setBusy(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    // El AuthProvider redirige automáticamente vía useEffect.
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
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: suEmail.trim(),
      password: suPassword,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: suName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    setSignupSent(suEmail.trim());
    toast.success("Te enviamos un correo de confirmación.");
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    toast.success("Si el email existe, te enviamos un enlace para restablecer la contraseña.");
    setRecoveryOpen(false);
    setRecoveryEmail("");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Prueba Lista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEmbedded ? (
            <>
              <div className="flex gap-3 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                <p className="text-muted-foreground">
                  Por motivos de seguridad, el inicio de sesión con Google no funciona dentro de
                  marcos. Abre la app en una pestaña nueva para iniciar sesión con Google, o usa
                  email y contraseña aquí abajo.
                </p>
              </div>
              <Button onClick={handleOpenFullscreen} className="w-full" size="lg">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir en pantalla completa
              </Button>
            </>
          ) : (
            <Button onClick={handleGoogle} variant="outline" className="w-full" size="lg">
              Continuar con Google
            </Button>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">o con email</span>
            </div>
          </div>

          {signupSent ? (
            <div className="space-y-3 text-sm">
              <p className="rounded-md border border-border bg-muted/40 p-3">
                Te enviamos un correo a <strong>{signupSent}</strong> con un enlace para activar
                tu cuenta. Revisa tu bandeja de entrada (y la carpeta de spam) y vuelve a iniciar
                sesión.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSignupSent(null);
                  setTab("login");
                  setLoginEmail(signupSent);
                }}
              >
                Volver a inicio de sesión
              </Button>
            </div>
          ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Iniciar sesión</TabsTrigger>
                <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-3 pt-3">
                <form onSubmit={handleLogin} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <Input
                      id="login-password"
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
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Iniciar sesión
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-3 pt-3">
                <form onSubmit={handleSignup} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="su-name">Nombre</Label>
                    <Input
                      id="su-name"
                      type="text"
                      autoComplete="name"
                      required
                      value={suName}
                      onChange={(e) => setSuName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-email">Email</Label>
                    <Input
                      id="su-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="su-password">Contraseña</Label>
                    <Input
                      id="su-password"
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
                    <Label htmlFor="su-password2">Confirmar contraseña</Label>
                    <Input
                      id="su-password2"
                      type="password"
                      autoComplete="new-password"
                      required
                      minLength={8}
                      value={suPassword2}
                      onChange={(e) => setSuPassword2(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
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
              <Label htmlFor="rec-email">Email</Label>
              <Input
                id="rec-email"
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
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar enlace
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AuthPage;
