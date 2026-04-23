// Exporta el HTML renderizado por mammoth a un PDF imprimible mediante
// la ventana de impresión del navegador. Es una solución cliente sin
// servidor que respeta la privacidad de los documentos.

export function exportHtmlToPdf(html: string, fileName: string) {
  const printWindow = window.open("", "_blank", "width=900,height=1200");
  if (!printWindow) {
    throw new Error("No se pudo abrir la ventana de impresión. Permite ventanas emergentes.");
  }
  printWindow.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${fileName}</title>
  <style>
    @page { margin: 2cm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; line-height: 1.4; }
    h1, h2, h3 { color: #1e3a8a; }
    img { max-width: 100%; }
    table { border-collapse: collapse; }
    table, th, td { border: 1px solid #cbd5e1; padding: 4px 8px; }
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
