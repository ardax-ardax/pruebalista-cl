import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { isAdmin, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      toast.error("Solo administradores pueden acceder a Configuración");
      navigate("/", { replace: true });
    }
  }, [isAdmin, loading, user, navigate]);

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
