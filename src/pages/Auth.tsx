import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useIsEmbedded, openInNewTab } from "@/hooks/useIsEmbedded";
import { resolveDestination } from "@/lib/resolve-destination";
import { ExternalLink, Info } from "lucide-react";
import { toast } from "sonner";

const AuthPage = () => {
  const { user, loading, role, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const isEmbedded = useIsEmbedded();
  const [redirecting, setRedirecting] = useState(false);

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
                  Por motivos de seguridad de Google, el inicio de sesión no funciona
                  dentro de marcos. Abre la app en una pestaña nueva para iniciar sesión.
                </p>
              </div>
              <Button onClick={handleOpenFullscreen} className="w-full" size="lg">
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir en pantalla completa
              </Button>
              <button
                onClick={handleGoogle}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Intentar igualmente con Google
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Inicia sesión con tu cuenta Google para acceder a tus pruebas.
              </p>
              <Button onClick={handleGoogle} className="w-full" size="lg">
                Continuar con Google
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default AuthPage;
