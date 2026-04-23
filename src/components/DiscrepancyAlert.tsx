import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DocDiagnostics } from "@/lib/docx-processor";

interface DiscrepancyAlertProps {
  diagnostics: DocDiagnostics;
  bannerAddsPageBreak?: boolean;
}

interface Finding {
  level: "warn" | "info";
  message: string;
}

function buildFindings(d: DocDiagnostics, bannerAddsPageBreak = true): Finding[] {
  const findings: Finding[] = [];

  // Páginas
  if (d.processedPages > d.originalPages) {
    findings.push({
      level: "warn",
      message: `El documento aumentó de ~${d.originalPages} a ~${d.processedPages} página(s). Algún elemento se desplazó.`,
    });
  } else if (d.processedPages < d.originalPages) {
    findings.push({
      level: "info",
      message: `El documento se compactó: pasó de ~${d.originalPages} a ~${d.processedPages} página(s).`,
    });
  }

  // Saltos de página añadidos (descontando el del banner si aplica)
  const expectedAdded = bannerAddsPageBreak ? 0 : 0; // banner usa párrafo, no salto duro
  const realAdded = Math.max(0, d.addedPageBreaks - expectedAdded);
  if (realAdded > 0) {
    findings.push({
      level: "warn",
      message: `Se añadieron ${realAdded} salto(s) de página inesperado(s).`,
    });
  }

  // Imágenes
  if (d.processedImages !== d.originalImages) {
    const diff = d.processedImages - d.originalImages;
    findings.push({
      level: "warn",
      message:
        diff > 0
          ? `Se detectan ${diff} imagen(es) más que en el original.`
          : `Faltan ${Math.abs(diff)} imagen(es) respecto al original.`,
    });
  }

  // Tablas
  if (d.processedTables < d.originalTables) {
    findings.push({
      level: "warn",
      message: `Se eliminó/aplanó ${d.originalTables - d.processedTables} tabla(s) respecto al original.`,
    });
  } else if (d.processedTables > d.originalTables) {
    findings.push({
      level: "info",
      message: `Se añadieron ${d.processedTables - d.originalTables} tabla(s) (banner u otros bloques).`,
    });
  }

  return findings;
}

export function DiscrepancyAlert({ diagnostics, bannerAddsPageBreak }: DiscrepancyAlertProps) {
  const findings = buildFindings(diagnostics, bannerAddsPageBreak);
  const warnings = findings.filter((f) => f.level === "warn");

  if (warnings.length === 0) {
    return (
      <Alert className="border-emerald-500/40 bg-emerald-500/5">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <AlertTitle className="text-emerald-700 dark:text-emerald-400">
          Sin diferencias estructurales detectadas
        </AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground">
          El documento procesado conserva la cantidad de páginas, imágenes y tablas del original.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-amber-500/40 bg-amber-500/5">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-700 dark:text-amber-400">
        Posibles discrepancias detectadas
      </AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-1.5 text-sm">
          {findings.map((f, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                className={
                  f.level === "warn"
                    ? "mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0"
                    : "mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0"
                }
              />
              <span className={f.level === "warn" ? "text-foreground" : "text-muted-foreground"}>
                {f.message}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          Usa la vista de comparación para identificar visualmente qué bloque se desplazó.
        </p>
      </AlertDescription>
    </Alert>
  );
}
