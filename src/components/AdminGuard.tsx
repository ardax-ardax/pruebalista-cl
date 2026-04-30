import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

/**
 * Permite acceso a personal autorizado del colegio: Admin o Jefe UTP.
 * El nombre se mantiene por compatibilidad con imports existentes.
 */
export function AdminGuard({ children }: { children: ReactNode }) {
  const { isStaff, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user && !isStaff) {
      toast.error("Solo personal autorizado puede acceder a Configuración");
      navigate("/", { replace: true });
    }
  }, [isStaff, loading, user, navigate]);

  if (loading || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }

  return <>{children}</>;
}
