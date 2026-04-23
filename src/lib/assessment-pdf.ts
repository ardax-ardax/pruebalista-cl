// Exporta el HTML de evaluación a PDF reutilizando la ventana de impresión.
import { renderAssessmentHtml, ASSESSMENT_CSS, type RenderContext } from "./assessment-render";

export function exportAssessmentToPdf(ctx: RenderContext, fileName: string) {
  const html = renderAssessmentHtml(ctx);
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) {
    throw new Error("No se pudo abrir la ventana de impresión. Permite ventanas emergentes.");
  }
  const { widthCm, heightCm } = ctx.template.pageSize;
  printWindow.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  <style>
    @page { size: ${widthCm}cm ${heightCm}cm; margin: 2cm 2cm 2cm 2.5cm; }
    html, body { margin: 0; padding: 0; }
    ${ASSESSMENT_CSS}
  </style>
</head>
<body>${html}</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 400);
}
