import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Página de restablecimiento de contraseña.
 * Se abre desde el link enviado por email (resetPasswordForEmail).
 * Supabase deja al usuario con una sesión temporal de tipo "recovery";
 * updateUser({ password }) consume ese token y setea la nueva contraseña.
 */
const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // Supabase JS procesa automáticamente el hash del link de recovery
    // y crea la sesión temporal. Esperamos a que la sesión esté disponible.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasSession(!!session);
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
      setReady(true);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error("No se pudo actualizar la contraseña: " + error.message);
      return;
    }
    toast.success("Contraseña actualizada. Iniciando sesión…");
    navigate("/", { replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Nueva contraseña</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ready ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validando enlace…
            </div>
          ) : !hasSession ? (
            <div className="space-y-3 text-sm">
              <p className="rounded-md border border-border bg-muted/40 p-3 text-muted-foreground">
                El enlace no es válido o ha expirado. Solicita uno nuevo desde la pantalla de
                inicio de sesión.
              </p>
              <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                Volver a iniciar sesión
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Ingresa una nueva contraseña para tu cuenta.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="rp-password">Nueva contraseña</Label>
                <Input
                  id="rp-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rp-password2">Confirmar contraseña</Label>
                <Input
                  id="rp-password2"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Guardar nueva contraseña
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default ResetPasswordPage;
