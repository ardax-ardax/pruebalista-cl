// Exporta el HTML de evaluación a PDF reutilizando la ventana de impresión.
// Mantiene paridad visual completa con el preview HTML y con el .docx:
//   - Tamaño de página del template
//   - Márgenes per-prueba (meta.layout) en mm si están definidos
//   - Reglas de columnas (SIMCE/PAES) heredadas del CSS de assessment-render
import { renderAssessmentHtml, ASSESSMENT_CSS, type RenderContext } from "./assessment-render";

export function exportAssessmentToPdf(ctx: RenderContext, fileName: string) {
  const html = renderAssessmentHtml(ctx);
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) {
    throw new Error("No se pudo abrir la ventana de impresión. Permite ventanas emergentes.");
  }
  const { widthCm, heightCm } = ctx.template.pageSize;

  // Márgenes: si la prueba define meta.layout (mm), priorízalos. Si no, usa los del template.
  const layout = ctx.assessment.meta.layout;
  const marginCss = layout
    ? `${layout.marginTop}mm ${layout.marginSide}mm ${layout.marginBottom}mm ${layout.marginSide}mm`
    : `${ctx.template.spacing.marginTop}cm ${ctx.template.spacing.marginRight}cm ${ctx.template.spacing.marginBottom}cm ${ctx.template.spacing.marginLeft}cm`;

  printWindow.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  <style>
    @page { size: ${widthCm}cm ${heightCm}cm; margin: ${marginCss}; }
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
