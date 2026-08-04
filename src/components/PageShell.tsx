import type { ReactNode } from "react";
import { AppLayout } from "@/components/AppLayout";

/**
 * Envoltura de página: usa AppLayout en la ruta normal y un contenedor plano
 * cuando la vista se incrusta dentro de otra página (ej. pestañas del admin).
 */
export function PageShell({ embedded = false, children }: { embedded?: boolean; children: ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AppLayout>{children}</AppLayout>;
}
