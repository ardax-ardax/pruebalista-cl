import { AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DocDiagnostics } from "@/lib/docx-processor";

interface DiscrepancyAlertProps {
  diagnostics: DocDiagnostics;
}

export function DiscrepancyAlert({ diagnostics }: DiscrepancyAlertProps) {
  const fixes = diagnostics.autoFixesApplied ?? [];
  const warnings = diagnostics.warnings ?? [];

  const hasFixes = fixes.length > 0;
  const hasWarnings = warnings.length > 0;

  // Caso 1: todo limpio
  if (!hasFixes && !hasWarnings) {
    return (
      <Alert className="border-emerald-500/40 bg-emerald-500/5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-700 dark:text-emerald-400">
          Documento estandarizado y verificado
        </AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          La verificación automática no detectó inconsistencias estructurales ni de numeración.
          Puedes descargar con confianza.
        </AlertDescription>
      </Alert>
    );
  }

  // Caso 2: solo correcciones, sin warnings → verde con detalle
  if (hasFixes && !hasWarnings) {
    return (
      <Alert className="border-emerald-500/40 bg-emerald-500/5">
        <Wand2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-700 dark:text-emerald-400">
          Verificación automática: correcciones aplicadas
        </AlertTitle>
        <AlertDescription>
          <ul className="mt-2 space-y-1.5 text-sm">
            {fixes.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <span className="text-foreground">{f}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Sin discrepancias bloqueantes detectadas.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // Caso 3: hay warnings (con o sin fixes)
  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-700 dark:text-amber-400">
        Verificación automática: revisa los avisos
      </AlertTitle>
      <AlertDescription>
        {hasFixes && (
          <>
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Correcciones automáticas
            </div>
            <ul className="mt-1 space-y-1.5 text-sm">
              {fixes.map((f, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="text-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-3 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
          Avisos
        </div>
        <ul className="mt-1 space-y-1.5 text-sm">
          {warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="text-foreground">{w}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Puedes descargar el .docx igualmente; abre la "Comparación detallada" más abajo para
          inspeccionar visualmente los puntos marcados.
        </p>
      </AlertDescription>
    </Alert>
  );
}
