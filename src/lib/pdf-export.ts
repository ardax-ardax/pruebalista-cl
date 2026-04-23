// Exporta el HTML renderizado por mammoth a un PDF imprimible mediante
// la ventana de impresión del navegador. Es una solución cliente sin
// servidor que respeta la privacidad de los documentos.

import type { ImageCropInfo } from "./docx-processor";

/**
 * Aplica los recortes (`<a:srcRect>`) extraídos del .docx sobre los `<img>`
 * del HTML emitido por mammoth. Mammoth ignora el cropping de OOXML, así
 * que reproducimos visualmente el recorte usando un wrapper `overflow:hidden`
 * y márgenes negativos en la imagen interna.
 *
 * El emparejamiento es por orden de aparición: el N-ésimo `<img>` en el HTML
 * recibe el N-ésimo crop del XML.
 */
export function applyCropsToHtml(html: string, crops: ImageCropInfo[]): string {
  if (!html || !crops || crops.length === 0) return html;
  let i = 0;
  // Reemplazo no reentrante: una vez que envolvemos un <img>, el wrapper
  // contiene otro <img>, pero el regex avanza después del wrapper.
  return html.replace(/<img\b([^>]*)>/g, (full, attrs: string) => {
    const crop = crops[i++];
    if (!crop) return full;
    const { left: L, right: R, top: T, bottom: B } = crop;
    if (L <= 0 && R <= 0 && T <= 0 && B <= 0) return full;
    const visibleW = Math.max(1, 100 - L - R); // % visible horizontal
    const visibleH = Math.max(1, 100 - T - B); // % visible vertical

    // Extraer width/height del <img> (atributos o style) para fijar el
    // tamaño del wrapper. Si no hay, dejamos 100% y el navegador escala.
    const widthAttr = attrs.match(/\bwidth\s*=\s*"(\d+(?:\.\d+)?)(px)?"/i);
    const heightAttr = attrs.match(/\bheight\s*=\s*"(\d+(?:\.\d+)?)(px)?"/i);
    const styleMatch = attrs.match(/\bstyle\s*=\s*"([^"]*)"/i);
    const styleStr = styleMatch ? styleMatch[1] : "";
    const widthStyle = styleStr.match(/(?:^|;)\s*width\s*:\s*([^;]+)/i);
    const heightStyle = styleStr.match(/(?:^|;)\s*height\s*:\s*([^;]+)/i);

    const wrapperW = widthStyle?.[1]?.trim() ?? (widthAttr ? `${widthAttr[1]}px` : "auto");
    const wrapperH = heightStyle?.[1]?.trim() ?? (heightAttr ? `${heightAttr[1]}px` : "auto");

    // Quitar width/height/style del <img> interno: el wrapper define el área
    // visible y el <img> se escala relativo a él.
    const cleanedAttrs = attrs
      .replace(/\bwidth\s*=\s*"[^"]*"/i, "")
      .replace(/\bheight\s*=\s*"[^"]*"/i, "")
      .replace(/\bstyle\s*=\s*"[^"]*"/i, "");

    // Tamaño "natural" del <img>: 100/visibleW % horizontal, 100/visibleH % vertical
    // Margen negativo: desplaza hacia arriba/izquierda la fracción recortada.
    const innerW = (100 / visibleW) * 100; // porcentaje sobre el wrapper
    const innerH = (100 / visibleH) * 100;
    const marginLeft = -(L / visibleW) * 100; // % sobre el wrapper
    const marginTop = -(T / visibleH) * 100;

    const wrapperStyle = [
      "display:inline-block",
      "overflow:hidden",
      "vertical-align:top",
      `width:${wrapperW}`,
      `height:${wrapperH}`,
    ].join(";");

    const imgStyle = [
      "display:block",
      `width:${innerW.toFixed(3)}%`,
      `height:${innerH.toFixed(3)}%`,
      `margin-left:${marginLeft.toFixed(3)}%`,
      `margin-top:${marginTop.toFixed(3)}%`,
      "max-width:none",
    ].join(";");

    return `<span class="img-crop" style="${wrapperStyle}"><img${cleanedAttrs} style="${imgStyle}"></span>`;
  });
}

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
    .img-crop { max-width: 100%; }
    .img-crop img { max-width: none; }
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
