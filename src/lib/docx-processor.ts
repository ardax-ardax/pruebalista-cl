// Procesador de documentos .docx en el navegador.
// Usa edición de strings con regex para preservar namespaces OOXML
// (mc:AlternateContent, drawings, tablas, etc.) sin corromper el archivo.

import JSZip from "jszip";
import type { FormatTemplate, Alignment } from "./templates";

export interface ChangeReport {
  category: string;
  description: string;
}

export interface BannerData {
  teacherLabel?: string;
  subjectLabel?: string;
  gradeLabel?: string;
}

export interface DocDiagnostics {
  originalPages: number;
  processedPages: number;
  originalImages: number;
  processedImages: number;
  originalTables: number;
  processedTables: number;
  originalPageBreaks: number;
  processedPageBreaks: number;
  addedPageBreaks: number;
  optionFormatInconsistencies: { before: number; after: number };
  questionFormatInconsistencies: { before: number; after: number };
  autoFixesApplied: string[];
  warnings: string[];
}

export interface ProcessResult {
  blob: Blob;
  changes: ChangeReport[];
  originalSummary: {
    bodyFont?: string;
    bodySize?: number;
  };
  diagnostics: DocDiagnostics;
}

function countOccurrences(xml: string, regex: RegExp): number {
  const matches = xml.match(regex);
  return matches ? matches.length : 0;
}

function computeDocStats(xml: string): {
  pages: number;
  images: number;
  tables: number;
  pageBreaks: number;
} {
  const pageBreaks = countOccurrences(xml, /<w:br\b[^/]*w:type="page"/g);
  const images = countOccurrences(xml, /<w:drawing\b/g);
  const tables = countOccurrences(xml, /<w:tbl\b(?!Pr)/g);
  return {
    pages: pageBreaks + 1,
    images,
    tables,
    pageBreaks,
  };
}

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function cmToTwips(cm: number): number {
  return Math.round((cm / 2.54) * 1440);
}

function ptToHalfPoints(pt: number): number {
  return Math.round(pt * 2);
}

function alignmentToWord(a: Alignment): string {
  if (a === "justify") return "both";
  return a;
}

function lineSpacingToTwips(spacing: number): number {
  return Math.round(spacing * 240);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Aplica una plantilla a un buffer .docx y devuelve el blob modificado + reporte.
 */
export async function applyTemplate(
  fileBuffer: ArrayBuffer,
  template: FormatTemplate,
  logoDataUrl: string | null,
  bannerData?: BannerData,
): Promise<ProcessResult> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const changes: ChangeReport[] = [];
  const originalSummary: ProcessResult["originalSummary"] = {};

  // 1. styles.xml — fuentes, tamaños y colores con DOMParser (es seguro aquí)
  const stylesFile = zip.file("word/styles.xml");
  if (stylesFile) {
    const stylesContent = await stylesFile.async("string");
    const detected = detectOriginalFont(stylesContent);
    originalSummary.bodyFont = detected.font;
    originalSummary.bodySize = detected.size;

    const newStyles = applyStylesString(stylesContent, template);
    zip.file("word/styles.xml", newStyles);

    if (detected.font && detected.font !== template.typography.bodyFont) {
      changes.push({
        category: "Tipografía",
        description: `Fuente del cuerpo cambiada de ${detected.font} a ${template.typography.bodyFont}`,
      });
    } else {
      changes.push({
        category: "Tipografía",
        description: `Fuente del cuerpo establecida en ${template.typography.bodyFont} (${template.typography.bodySize} pt)`,
      });
    }
    changes.push({
      category: "Tipografía",
      description: `Títulos en ${template.typography.headingFont} — H1 ${template.typography.h1Size}pt, H2 ${template.typography.h2Size}pt, H3 ${template.typography.h3Size}pt`,
    });
    changes.push({
      category: "Estilos de títulos",
      description: `Color de títulos: #${template.typography.headingColor.toUpperCase()}, ${template.headings.bold ? "negrita" : "normal"}`,
    });
  }

  // 2. document.xml — márgenes, tamaño de hoja, alineación e interlineado vía regex
  const documentFile = zip.file("word/document.xml");
  let tableOptimizations = 0;
  let imageRescales = 0;
  let sectionCreated = false;
  let originalStats = { pages: 1, images: 0, tables: 0, pageBreaks: 0 };
  let processedStats = { pages: 1, images: 0, tables: 0, pageBreaks: 0 };
  let extendedDiagnostics: {
    optionFormatInconsistencies: { before: number; after: number };
    questionFormatInconsistencies: { before: number; after: number };
    autoFixesApplied: string[];
    warnings: string[];
  } = {
    optionFormatInconsistencies: { before: 0, after: 0 },
    questionFormatInconsistencies: { before: 0, after: 0 },
    autoFixesApplied: [],
    warnings: [],
  };
  if (documentFile) {
    let docContent = await documentFile.async("string");
    originalStats = computeDocStats(docContent);
    const originalDocXml = docContent;

    // Contar inconsistencias de numeración ANTES de cualquier normalización
    const beforeCounts = countNumberingInconsistencies(docContent);

    const marginsRes = applyMarginsString(docContent, template);
    docContent = marginsRes.xml;
    sectionCreated = marginsRes.created;
    docContent = applyParagraphFormattingString(docContent, template);
    const tablesRes = optimizeTablesString(docContent);
    docContent = tablesRes.xml;
    tableOptimizations = tablesRes.count;
    const imagesRes = fitOversizedImagesString(docContent, template);
    docContent = imagesRes.xml;
    imageRescales = imagesRes.count;
    // Normalizar formato directo de runs en el cuerpo: forzar tipografía/tamaño
    // para que Word no use la fuente original almacenada en cada <w:rPr>.
    docContent = forceDirectFontFormatting(docContent, template);

    // Normalización de numeración (texto plano + numbering.xml)
    const numberingFile = zip.file("word/numbering.xml");
    let numberingXml = numberingFile ? await numberingFile.async("string") : null;
    const normRes = normalizeNumbering(docContent, numberingXml);
    docContent = normRes.documentXml;
    numberingXml = normRes.numberingXml;
    if (numberingFile && numberingXml) {
      zip.file("word/numbering.xml", numberingXml);
    }

    processedStats = computeDocStats(docContent);
    zip.file("word/document.xml", docContent);

    // Auto-QA: comparar antes/después y generar warnings + fixes legibles
    const afterCounts = countNumberingInconsistencies(docContent);
    const autoFixesApplied: string[] = [];
    const warnings: string[] = [];

    const optionsFixed = Math.max(0, beforeCounts.options - afterCounts.options);
    const questionsFixed = Math.max(0, beforeCounts.questions - afterCounts.questions);
    if (normRes.optionsTextFixed > 0 || optionsFixed > 0 || normRes.optionsListFixed > 0) {
      const total = Math.max(optionsFixed, normRes.optionsTextFixed + normRes.optionsListFixed);
      autoFixesApplied.push(
        `Se uniformó la numeración de ${total} opción(es) de respuesta a formato \`a)\`, \`b)\`, \`c)\`.`,
      );
      changes.push({
        category: "Numeración",
        description: `Opciones de respuesta uniformadas a formato \`a)\` (${total} ítem(s)).`,
      });
    }
    if (normRes.questionsTextFixed > 0 || questionsFixed > 0 || normRes.questionsListFixed > 0) {
      const total = Math.max(questionsFixed, normRes.questionsTextFixed + normRes.questionsListFixed);
      autoFixesApplied.push(
        `Se uniformó la numeración de ${total} pregunta(s) a formato \`1)\`, \`2)\`, \`3)\`.`,
      );
      changes.push({
        category: "Numeración",
        description: `Preguntas uniformadas a formato \`1)\` (${total} ítem(s)).`,
      });
    }

    // Warnings estructurales
    const addedPageBreaks = Math.max(0, processedStats.pageBreaks - originalStats.pageBreaks);
    // El banner añade un párrafo, no un page break duro; cualquier salto extra es notable
    if (addedPageBreaks > 0) {
      warnings.push(
        `Se añadieron ${addedPageBreaks} salto(s) de página al procesar (probablemente por el banner institucional).`,
      );
    }
    const extraPages = processedStats.pages - originalStats.pages;
    if (extraPages > 1) {
      warnings.push(
        `El documento creció en ${extraPages} página(s) respecto al original. Revisa si una imagen o tabla quedó al inicio de una página nueva.`,
      );
    }
    if (processedStats.images < originalStats.images) {
      warnings.push(
        `Faltan ${originalStats.images - processedStats.images} imagen(es) respecto al original.`,
      );
    }
    if (processedStats.tables < originalStats.tables) {
      warnings.push(
        `Se eliminó/aplanó ${originalStats.tables - processedStats.tables} tabla(s) respecto al original.`,
      );
    }
    if (afterCounts.options > 0) {
      warnings.push(
        `Quedan ${afterCounts.options} opción(es) con formato no canónico que no se pudieron normalizar automáticamente.`,
      );
    }

    // Guardar diagnósticos extendidos para uso posterior
    extendedDiagnostics = {
      optionFormatInconsistencies: { before: beforeCounts.options, after: afterCounts.options },
      questionFormatInconsistencies: { before: beforeCounts.questions, after: afterCounts.questions },
      autoFixesApplied,
      warnings,
    };

    changes.push({
      category: "Tamaño de hoja",
      description: `Hoja ${template.pageSize.widthCm} × ${template.pageSize.heightCm} cm${sectionCreated ? " (sección creada)" : ""}`,
    });
    changes.push({
      category: "Márgenes",
      description: `Sup ${template.spacing.marginTop} cm, inf ${template.spacing.marginBottom} cm, izq ${template.spacing.marginLeft} cm, der ${template.spacing.marginRight} cm`,
    });
    changes.push({
      category: "Alineación",
      description: `Cuerpo ${
        template.body.alignment === "justify" ? "justificado" :
        template.body.alignment === "center" ? "centrado" :
        template.body.alignment === "right" ? "a la derecha" : "a la izquierda"
      }, interlineado ${template.spacing.lineSpacing.toFixed(2)}`,
    });
    if (tableOptimizations > 0) {
      changes.push({
        category: "Tablas",
        description: `Se optimizaron ${tableOptimizations} ajuste(s) en tablas para permitir división entre páginas y aprovechar mejor el espacio.`,
      });
    }
    if (imageRescales > 0) {
      changes.push({
        category: "Imágenes",
        description: `Se redimensionaron ${imageRescales} imagen(es) que excedían el área imprimible.`,
      });
    }
    void originalDocXml;
  }

  // 3. Encabezado y pie de página
  const headerStyle = template.header.style ?? "classic";
  const isBanner = headerStyle === "banner-evaluacion" || headerStyle === "banner-guia";

  if (isBanner) {
    await insertInstitutionBanner(
      zip,
      template,
      bannerData?.teacherLabel ?? "",
      bannerData?.subjectLabel ?? "",
      bannerData?.gradeLabel ?? "",
      logoDataUrl,
      headerStyle === "banner-evaluacion",
    );
    changes.push({
      category: "Encabezado",
      description: `Banner institucional insertado al inicio del documento${
        template.header.showLogo && logoDataUrl ? " con logo del colegio" : ""
      }${headerStyle === "banner-evaluacion" ? " y recuadro de Calificación" : ""}.`,
    });
  } else if (template.header.enabled) {
    await applyHeader(zip, template, logoDataUrl);
    changes.push({
      category: "Encabezado",
      description: `Encabezado aplicado${template.header.showLogo && logoDataUrl ? " con logo institucional" : ""} — alineación ${template.header.alignment}`,
    });
  }
  if (template.footer.enabled) {
    await applyFooter(zip, template);
    const parts: string[] = [];
    if (template.footer.text) parts.push(`"${template.footer.text}"`);
    if (template.footer.showPageNumber) parts.push("número de página");
    if (template.footer.showDate) parts.push("fecha");
    changes.push({
      category: "Pie de página",
      description: `Pie de página aplicado: ${parts.join(", ") || "vacío"}`,
    });
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const diagnostics: DocDiagnostics = {
    originalPages: originalStats.pages,
    processedPages: processedStats.pages,
    originalImages: originalStats.images,
    processedImages: processedStats.images,
    originalTables: originalStats.tables,
    processedTables: processedStats.tables,
    originalPageBreaks: originalStats.pageBreaks,
    processedPageBreaks: processedStats.pageBreaks,
    addedPageBreaks: Math.max(0, processedStats.pageBreaks - originalStats.pageBreaks),
    optionFormatInconsistencies: extendedDiagnostics.optionFormatInconsistencies,
    questionFormatInconsistencies: extendedDiagnostics.questionFormatInconsistencies,
    autoFixesApplied: extendedDiagnostics.autoFixesApplied,
    warnings: extendedDiagnostics.warnings,
  };

  return { blob, changes, originalSummary, diagnostics };
}

// ===================== styles.xml (DOMParser, seguro) =====================

function detectOriginalFont(stylesXml: string): { font?: string; size?: number } {
  const result: { font?: string; size?: number } = {};
  const fontMatch = stylesXml.match(
    /<w:docDefaults>[\s\S]*?<w:rPrDefault>[\s\S]*?<w:rFonts[^/]*?w:ascii="([^"]+)"/,
  );
  if (fontMatch) result.font = fontMatch[1];
  const sizeMatch = stylesXml.match(
    /<w:docDefaults>[\s\S]*?<w:rPrDefault>[\s\S]*?<w:sz\s+w:val="(\d+)"/,
  );
  if (sizeMatch) result.size = parseInt(sizeMatch[1], 10) / 2;
  return result;
}

function applyStylesString(stylesXml: string, t: FormatTemplate): string {
  let out = stylesXml;
  const font = t.typography.bodyFont;
  const sz = ptToHalfPoints(t.typography.bodySize).toString();
  const color = t.typography.bodyColor.replace("#", "").toUpperCase();

  // 1. Asegurar/forzar docDefaults > rPrDefault > rPr con la fuente del cuerpo
  const newRPrDefault =
    `<w:rPrDefault><w:rPr>` +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>` +
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` +
    `<w:color w:val="${color}"/>` +
    `<w:lang w:val="es-ES"/>` +
    `</w:rPr></w:rPrDefault>`;

  if (/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/.test(out)) {
    if (/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/.test(out)) {
      out = out.replace(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/, newRPrDefault);
    } else {
      out = out.replace(/<w:docDefaults>/, `<w:docDefaults>${newRPrDefault}`);
    }
  } else {
    // Insertar docDefaults justo después de <w:styles ...>
    out = out.replace(
      /(<w:styles\b[^>]*>)/,
      `$1<w:docDefaults>${newRPrDefault}</w:docDefaults>`,
    );
  }

  // 2. Forzar el estilo "Normal" para que use la fuente del cuerpo
  out = forceStyleRPr(out, "Normal", font, sz, color, false);

  // 3. Forzar Heading1/2/3 con la fuente y tamaños de títulos
  const headingColor = t.typography.headingColor.replace("#", "").toUpperCase();
  const headings: Array<{ id: string; size: number; align: Alignment }> = [
    { id: "Heading1", size: t.typography.h1Size, align: t.headings.h1Alignment },
    { id: "Heading2", size: t.typography.h2Size, align: t.headings.h2Alignment },
    { id: "Heading3", size: t.typography.h3Size, align: t.headings.h3Alignment },
  ];
  for (const h of headings) {
    const hsz = ptToHalfPoints(h.size).toString();
    out = forceHeadingStyle(out, h.id, t.typography.headingFont, hsz, headingColor, t.headings.bold, h.align);
  }

  return out;
}

function forceStyleRPr(
  xml: string,
  styleId: string,
  font: string,
  sz: string,
  color: string,
  bold: boolean,
): string {
  const newRPr =
    `<w:rPr>` +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>` +
    (bold ? `<w:b/><w:bCs/>` : "") +
    `<w:color w:val="${color}"/>` +
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` +
    `</w:rPr>`;

  const styleRegex = new RegExp(
    `(<w:style\\s+[^>]*w:styleId="${escapeRegex(styleId)}"[^>]*>)([\\s\\S]*?)(</w:style>)`,
  );
  const m = xml.match(styleRegex);
  if (!m) return xml;
  let inner = m[2];
  if (/<w:rPr>[\s\S]*?<\/w:rPr>/.test(inner)) {
    inner = inner.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, newRPr);
  } else {
    inner = inner + newRPr;
  }
  return xml.replace(styleRegex, `${m[1]}${inner}${m[3]}`);
}

function forceHeadingStyle(
  xml: string,
  styleId: string,
  font: string,
  sz: string,
  color: string,
  bold: boolean,
  align: Alignment,
): string {
  const styleRegex = new RegExp(
    `(<w:style\\s+[^>]*w:styleId="${escapeRegex(styleId)}"[^>]*>)([\\s\\S]*?)(</w:style>)`,
  );
  const newRPr =
    `<w:rPr>` +
    `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>` +
    (bold ? `<w:b/><w:bCs/>` : "") +
    `<w:color w:val="${color}"/>` +
    `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>` +
    `</w:rPr>`;
  const newPPr = `<w:pPr><w:jc w:val="${alignmentToWord(align)}"/></w:pPr>`;

  const m = xml.match(styleRegex);
  if (m) {
    let inner = m[2];
    if (/<w:rPr>[\s\S]*?<\/w:rPr>/.test(inner)) {
      inner = inner.replace(/<w:rPr>[\s\S]*?<\/w:rPr>/, newRPr);
    } else {
      inner = inner + newRPr;
    }
    if (/<w:pPr>[\s\S]*?<\/w:pPr>/.test(inner)) {
      inner = inner.replace(
        /<w:pPr>([\s\S]*?)<\/w:pPr>/,
        (_full, innerP) => {
          let p = innerP;
          if (/<w:jc\s+[^/]*\/>/.test(p)) {
            p = p.replace(/<w:jc\s+[^/]*\/>/, `<w:jc w:val="${alignmentToWord(align)}"/>`);
          } else {
            p = p + `<w:jc w:val="${alignmentToWord(align)}"/>`;
          }
          return `<w:pPr>${p}</w:pPr>`;
        },
      );
    } else {
      inner = newPPr + inner;
    }
    return xml.replace(styleRegex, `${m[1]}${inner}${m[3]}`);
  }

  // Crear estilo si no existe — insertar antes de </w:styles>
  const headingNum = styleId.replace("Heading", "");
  const newStyle =
    `<w:style w:type="paragraph" w:styleId="${styleId}">` +
    `<w:name w:val="heading ${headingNum}"/>` +
    `<w:basedOn w:val="Normal"/>` +
    `<w:next w:val="Normal"/>` +
    newPPr +
    newRPr +
    `</w:style>`;
  return xml.replace(/<\/w:styles>/, `${newStyle}</w:styles>`);
}

// ===================== document.xml (regex puro) =====================

function applyMarginsString(xml: string, t: FormatTemplate): { xml: string; created: boolean } {
  const top = cmToTwips(t.spacing.marginTop).toString();
  const bottom = cmToTwips(t.spacing.marginBottom).toString();
  const left = cmToTwips(t.spacing.marginLeft).toString();
  const right = cmToTwips(t.spacing.marginRight).toString();
  const w = cmToTwips(t.pageSize.widthCm).toString();
  const h = cmToTwips(t.pageSize.heightCm).toString();

  const newPgMar = `<w:pgMar w:top="${top}" w:right="${right}" w:bottom="${bottom}" w:left="${left}" w:header="720" w:footer="720" w:gutter="0"/>`;
  const newPgSz = `<w:pgSz w:w="${w}" w:h="${h}"/>`;

  let created = false;
  if (!/<w:sectPr\b/.test(xml)) {
    // Crear sectPr mínimo justo antes de </w:body>
    const sectPr = `<w:sectPr>${newPgSz}${newPgMar}</w:sectPr>`;
    xml = xml.replace(/<\/w:body>/, `${sectPr}</w:body>`);
    created = true;
    return { xml, created };
  }

  const out = xml.replace(/<w:sectPr\b[^>]*>([\s\S]*?)<\/w:sectPr>/g, (full, inner) => {
    let updated = inner as string;

    // pgSz
    if (/<w:pgSz\b[^/]*\/>/.test(updated)) {
      updated = updated.replace(/<w:pgSz\b[^/]*\/>/, newPgSz);
    } else if (/<w:pgSz\b[^>]*>[\s\S]*?<\/w:pgSz>/.test(updated)) {
      updated = updated.replace(/<w:pgSz\b[^>]*>[\s\S]*?<\/w:pgSz>/, newPgSz);
    } else {
      updated = newPgSz + updated;
    }

    // pgMar
    if (/<w:pgMar\b[^/]*\/>/.test(updated)) {
      updated = updated.replace(/<w:pgMar\b[^/]*\/>/, newPgMar);
    } else if (/<w:pgMar\b[^>]*>[\s\S]*?<\/w:pgMar>/.test(updated)) {
      updated = updated.replace(/<w:pgMar\b[^>]*>[\s\S]*?<\/w:pgMar>/, newPgMar);
    } else {
      updated = updated.replace(
        new RegExp(escapeRegex(newPgSz)),
        newPgSz + newPgMar,
      );
    }

    return full.replace(inner, updated);
  });
  return { xml: out, created };
}

/**
 * Optimiza tablas para permitir división entre páginas:
 * - Quita <w:cantSplit/> en filas
 * - Convierte hRule="exact" a "atLeast"
 * - Quita <w:keepNext/> en tblPr
 *
 * NOTA: el aplanado de "tablas marco" se eliminó porque producía falsos
 * positivos en tablas legítimas con drawings o listas anidadas.
 */
function optimizeTablesString(xml: string): { xml: string; count: number } {
  let count = 0;
  let out = xml;

  // 1. Quitar w:cantSplit
  out = out.replace(/<w:cantSplit\s*\/>/g, () => {
    count++;
    return "";
  });

  // 2. hRule="exact" -> "atLeast"
  out = out.replace(/(<w:trHeight\b[^>]*?w:hRule=")exact(")/g, (_m, a, b) => {
    count++;
    return `${a}atLeast${b}`;
  });

  // 3. Quitar keepNext dentro de tblPr
  out = out.replace(/<w:tblPr\b[^>]*>([\s\S]*?)<\/w:tblPr>/g, (full, inner) => {
    if (/<w:keepNext\s*\/>/.test(inner)) {
      count++;
      const cleaned = (inner as string).replace(/<w:keepNext\s*\/>/g, "");
      return full.replace(inner, cleaned);
    }
    return full;
  });

  return { xml: out, count };
}

/**
 * Escala proporcionalmente imágenes que excedan el área imprimible
 * para evitar recortes en Word. Usa unidades EMU (1 cm = 360 000 EMU).
 *
 * IMPORTANTE: NO toca imágenes con recorte (`<a:srcRect>` con valores) ni
 * imágenes ancladas/flotantes (`<wp:anchor>`), porque ahí el layout está
 * cuidadosamente diseñado por el autor en Word y reescalar provoca que el
 * documento refluya (típicamente empuja la imagen a una página nueva).
 */
function fitOversizedImagesString(xml: string, t: FormatTemplate): { xml: string; count: number } {
  const usableWcm = t.pageSize.widthCm - t.spacing.marginLeft - t.spacing.marginRight;
  const usableHcm = t.pageSize.heightCm - t.spacing.marginTop - t.spacing.marginBottom;
  const usableW = Math.round(usableWcm * 360000);
  const usableH = Math.round(usableHcm * 360000);
  const limitH = Math.round(usableH * 0.95);

  let count = 0;
  const out = xml.replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/g, (drawingXml) => {
    // 1) Imágenes ancladas/flotantes: preservar tal cual.
    if (/<wp:anchor\b/.test(drawingXml)) return drawingXml;

    // 2) Imágenes con recorte real: preservar tal cual.
    //    Un srcRect "vacío" (`<a:srcRect/>`) NO cuenta como recorte.
    const srcRectMatch = drawingXml.match(/<a:srcRect\b([^/]*)\/>/);
    if (srcRectMatch) {
      const attrs = srcRectMatch[1] || "";
      const hasCropValue = /\b[lrtb]="(-?\d+)"/.test(attrs)
        && !/^\s*$/.test(attrs)
        && /[1-9]/.test(attrs); // al menos un dígito distinto de 0
      if (hasCropValue) return drawingXml;
    }

    // 3) Imagen inline simple: solo reescalar si excede el área imprimible.
    const extentMatch = drawingXml.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
    if (!extentMatch) return drawingXml;
    const cx = parseInt(extentMatch[1], 10);
    const cy = parseInt(extentMatch[2], 10);

    if (cx <= usableW && cy <= limitH) return drawingXml;

    const ratioW = cx > usableW ? usableW / cx : 1;
    const ratioH = cy > limitH ? limitH / cy : 1;
    const ratio = Math.min(ratioW, ratioH);
    const newCx = Math.round(cx * ratio);
    const newCy = Math.round(cy * ratio);

    count++;
    let updated = drawingXml.replace(
      /<wp:extent\s+cx="\d+"\s+cy="\d+"\s*\/>/,
      `<wp:extent cx="${newCx}" cy="${newCy}"/>`,
    );
    // Actualizar el a:ext del transform principal del mismo drawing.
    updated = updated.replace(
      /<a:ext\s+cx="\d+"\s+cy="\d+"\s*\/>/,
      `<a:ext cx="${newCx}" cy="${newCy}"/>`,
    );
    return updated;
  });

  return { xml: out, count };
}

/**
 * Normaliza formato directo de runs en `word/document.xml` para forzar la
 * tipografía y el tamaño del cuerpo. Word prioriza el formato directo
 * (`<w:rPr>` dentro de cada `<w:r>`) sobre `styles.xml`/`docDefaults`, así
 * que sin esta pasada el archivo descargado puede seguir mostrando la fuente
 * original.
 *
 * Conserva: negritas, cursivas, subrayados, color directo, vertAlign, etc.
 * Reemplaza/inserta: <w:rFonts>, <w:sz>, <w:szCs>.
 *
 * No toca runs que contengan campos especiales, símbolos, drawings o saltos
 * (esos viven en sus propios <w:r> y no necesitan normalización tipográfica).
 */
function forceDirectFontFormatting(xml: string, t: FormatTemplate): string {
  const font = t.typography.bodyFont;
  const sz = ptToHalfPoints(t.typography.bodySize).toString();
  const rFontsTag = `<w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/>`;
  const szTag = `<w:sz w:val="${sz}"/><w:szCs w:val="${sz}"/>`;

  // Solo procesamos runs del cuerpo del documento.
  const bodyMatch = xml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) return xml;
  const body = bodyMatch[1];

  const newBody = body.replace(/<w:r\b([^>]*)>([\s\S]*?)<\/w:r>/g, (full, attrs, inner) => {
    // Saltar runs que contienen drawings, símbolos especiales o instrucciones de campo.
    if (/<w:drawing\b|<w:sym\b|<w:pict\b|<w:object\b|<w:fldChar\b|<w:instrText\b/.test(inner)) {
      return full;
    }
    // Si no contiene texto, saltar (evita normalizar runs estructurales).
    if (!/<w:t\b|<w:tab\b|<w:br\b/.test(inner)) return full;

    const rPrMatch = (inner as string).match(/^<w:rPr\b[^>]*>([\s\S]*?)<\/w:rPr>/);
    if (rPrMatch) {
      let rPrInner = rPrMatch[1];
      // Reemplazar/insertar rFonts
      if (/<w:rFonts\b[^/]*\/>/.test(rPrInner)) {
        rPrInner = rPrInner.replace(/<w:rFonts\b[^/]*\/>/, rFontsTag);
      } else {
        rPrInner = rFontsTag + rPrInner;
      }
      // Reemplazar/insertar sz y szCs
      if (/<w:sz\b[^/]*\/>/.test(rPrInner)) {
        rPrInner = rPrInner.replace(/<w:sz\b[^/]*\/>/, `<w:sz w:val="${sz}"/>`);
      } else {
        rPrInner = rPrInner + `<w:sz w:val="${sz}"/>`;
      }
      if (/<w:szCs\b[^/]*\/>/.test(rPrInner)) {
        rPrInner = rPrInner.replace(/<w:szCs\b[^/]*\/>/, `<w:szCs w:val="${sz}"/>`);
      } else {
        rPrInner = rPrInner + `<w:szCs w:val="${sz}"/>`;
      }
      const newInner = (inner as string).replace(
        /^<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/,
        `<w:rPr>${rPrInner}</w:rPr>`,
      );
      return `<w:r${attrs}>${newInner}</w:r>`;
    }

    // No tiene rPr — insertar uno mínimo al inicio del run.
    const newRPr = `<w:rPr>${rFontsTag}${szTag}</w:rPr>`;
    return `<w:r${attrs}>${newRPr}${inner}</w:r>`;
  });

  return xml.replace(
    /(<w:body\b[^>]*>)[\s\S]*(<\/w:body>)/,
    (_m, open, close) => `${open}${newBody}${close}`,
  );
}

function applyParagraphFormattingString(xml: string, t: FormatTemplate): string {
  const jcVal = alignmentToWord(t.body.alignment);
  const lineTwips = lineSpacingToTwips(t.spacing.lineSpacing).toString();
  const beforeTwips = Math.round(t.spacing.paragraphSpacingBefore * 20).toString();
  const afterTwips = Math.round(t.spacing.paragraphSpacingAfter * 20).toString();

  const newSpacing = `<w:spacing w:before="${beforeTwips}" w:after="${afterTwips}" w:line="${lineTwips}" w:lineRule="auto"/>`;

  // Procesar solo párrafos — <w:p ...> ... </w:p>
  return xml.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (full, attrs, inner) => {
    // Detectar si tiene pStyle de heading
    const pPrMatch = (inner as string).match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
    const pStyleMatch = pPrMatch?.[1].match(/<w:pStyle\s+w:val="([^"]+)"/);
    const styleVal = pStyleMatch?.[1] ?? "";
    const isHeading = /^Heading\d$/i.test(styleVal) || /^Ttulo\d$/i.test(styleVal) || /^Title$/i.test(styleVal);

    let updatedInner = inner as string;

    if (pPrMatch) {
      // Reemplazar/insertar spacing y jc dentro del pPr existente
      updatedInner = updatedInner.replace(
        /<w:pPr\b([^>]*)>([\s\S]*?)<\/w:pPr>/,
        (_f, pAttrs, pInner) => {
          let p = pInner as string;
          // spacing
          if (/<w:spacing\b[^/]*\/>/.test(p)) {
            p = p.replace(/<w:spacing\b[^/]*\/>/, newSpacing);
          } else if (/<w:spacing\b[^>]*>[\s\S]*?<\/w:spacing>/.test(p)) {
            p = p.replace(/<w:spacing\b[^>]*>[\s\S]*?<\/w:spacing>/, newSpacing);
          } else {
            p = p + newSpacing;
          }
          // jc — solo para el cuerpo, no headings
          if (!isHeading) {
            const jcTag = `<w:jc w:val="${jcVal}"/>`;
            if (/<w:jc\s+[^/]*\/>/.test(p)) {
              p = p.replace(/<w:jc\s+[^/]*\/>/, jcTag);
            } else {
              p = p + jcTag;
            }
          }
          return `<w:pPr${pAttrs}>${p}</w:pPr>`;
        },
      );
    } else {
      // Crear pPr al inicio del párrafo
      const jcTag = !isHeading ? `<w:jc w:val="${jcVal}"/>` : "";
      const newPPr = `<w:pPr>${newSpacing}${jcTag}</w:pPr>`;
      updatedInner = newPPr + updatedInner;
    }

    return `<w:p${attrs}>${updatedInner}</w:p>`;
  });
}

// ===================== Encabezado / Pie =====================

const CONTENT_TYPES_PATH = "[Content_Types].xml";
const RELS_PATH = "word/_rels/document.xml.rels";

async function ensureRel(zip: JSZip, target: string, type: string): Promise<string> {
  const relsFile = zip.file(RELS_PATH);
  if (!relsFile) throw new Error("Faltan relaciones del documento");
  let content = await relsFile.async("string");

  // Buscar relación existente con el mismo target
  const existing = content.match(
    new RegExp(`<Relationship\\s+[^>]*Target="${escapeRegex(target)}"[^>]*Id="([^"]+)"`),
  ) || content.match(
    new RegExp(`<Relationship\\s+[^>]*Id="([^"]+)"[^>]*Target="${escapeRegex(target)}"`),
  );
  if (existing) return existing[1];

  // Calcular siguiente Id
  const ids = Array.from(content.matchAll(/Id="rId(\d+)"/g)).map((m) => parseInt(m[1], 10));
  const nextId = `rId${(ids.length ? Math.max(...ids) : 0) + 1}`;
  const rel = `<Relationship Id="${nextId}" Type="${type}" Target="${target}"/>`;
  content = content.replace(/<\/Relationships>/, `${rel}</Relationships>`);
  zip.file(RELS_PATH, content);
  return nextId;
}

async function ensureContentType(zip: JSZip, partName: string, contentType: string) {
  const file = zip.file(CONTENT_TYPES_PATH);
  if (!file) return;
  let content = await file.async("string");
  const partEscaped = escapeRegex(partName);
  if (new RegExp(`<Override\\s+[^>]*PartName="${partEscaped}"`).test(content)) return;
  const override = `<Override PartName="${partName}" ContentType="${contentType}"/>`;
  content = content.replace(/<\/Types>/, `${override}</Types>`);
  zip.file(CONTENT_TYPES_PATH, content);
}

function dataUrlToUint8(dataUrl: string): { bytes: Uint8Array; ext: string } {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("Logo inválido");
  const ext = match[1].toLowerCase();
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, ext };
}

function buildHeaderXml(t: FormatTemplate, logoRelId: string | null): string {
  const align = alignmentToWord(t.header.alignment);
  const fontName = t.typography.headingFont;

  let logoRun = "";
  if (logoRelId && t.header.showLogo) {
    const cx = Math.round((3 / 2.54) * 914400);
    const cy = Math.round((3 / 2.54) * 914400);
    logoRun = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${logoRelId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r><w:r><w:br/></w:r>`;
  }

  const text = escapeXml(t.header.institutionName || "");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="${W_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:p>
    <w:pPr><w:jc w:val="${align}"/></w:pPr>
    ${logoRun}
    <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="${ptToHalfPoints(t.typography.h3Size)}"/></w:rPr><w:t xml:space="preserve">${text}</w:t></w:r>
  </w:p>
</w:hdr>`;
}

function buildFooterXml(t: FormatTemplate): string {
  const fontName = t.typography.bodyFont;
  const sz = ptToHalfPoints(Math.max(9, t.typography.bodySize - 2));
  const parts: string[] = [];
  if (t.footer.text) parts.push(escapeXml(t.footer.text));
  if (t.footer.showDate) {
    const today = new Date().toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" });
    parts.push(today);
  }
  const leftText = parts.join(" — ");

  const pageNumberRun = t.footer.showPageNumber
    ? `<w:r><w:tab/></w:r><w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">Página </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${W_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:p>
    <w:pPr><w:tabs><w:tab w:val="right" w:pos="9072"/></w:tabs></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${leftText}</w:t></w:r>
    ${pageNumberRun}
  </w:p>
</w:ftr>`;
}

async function applyHeader(zip: JSZip, t: FormatTemplate, logoDataUrl: string | null) {
  let logoRelId: string | null = null;
  if (t.header.showLogo && logoDataUrl) {
    const { bytes, ext } = dataUrlToUint8(logoDataUrl);
    const mediaPath = `word/media/logo.${ext}`;
    zip.file(mediaPath, bytes);
    await ensureContentType(zip, `/${mediaPath}`, `image/${ext === "jpg" ? "jpeg" : ext}`);
    logoRelId = await ensureRel(
      zip,
      `media/logo.${ext}`,
      "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
    );
  }

  const headerXml = buildHeaderXml(t, logoRelId);
  zip.file("word/header1.xml", headerXml);
  await ensureContentType(
    zip,
    "/word/header1.xml",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml",
  );
  const headerRelId = await ensureRel(
    zip,
    "header1.xml",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/header",
  );

  await linkPartToSections(zip, "headerReference", headerRelId);
}

async function applyFooter(zip: JSZip, t: FormatTemplate) {
  const footerXml = buildFooterXml(t);
  zip.file("word/footer1.xml", footerXml);
  await ensureContentType(
    zip,
    "/word/footer1.xml",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml",
  );
  const footerRelId = await ensureRel(
    zip,
    "footer1.xml",
    "http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer",
  );

  await linkPartToSections(zip, "footerReference", footerRelId);
}

async function linkPartToSections(zip: JSZip, refName: "headerReference" | "footerReference", relId: string) {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return;
  let content = await documentFile.async("string");

  const refTag = `<w:${refName} w:type="default" r:id="${relId}"/>`;
  const removeRegex = new RegExp(`<w:${refName}\\b[^/]*/>`, "g");

  content = content.replace(/<w:sectPr\b[^>]*>([\s\S]*?)<\/w:sectPr>/g, (full, inner) => {
    let updated = (inner as string).replace(removeRegex, "");
    updated = refTag + updated;
    return full.replace(inner, updated);
  });

  zip.file("word/document.xml", content);
}

// ===================== Banner institucional (tabla en el cuerpo) =====================

/**
 * Construye una tabla de 2 o 3 columnas (logo | datos | recuadro Calificación)
 * y la inyecta al inicio del <w:body>. Reemplaza al header clásico para los
 * formatos del colegio porque permite el layout pedido (3 columnas + recuadro).
 *
 * Tamaños en twips (1 cm ≈ 567 twips). Ancho útil de hoja Oficio (21,59 cm)
 * con márgenes 2,5/2 = 16,9 cm ≈ 9580 twips.
 */
async function insertInstitutionBanner(
  zip: JSZip,
  t: FormatTemplate,
  teacherLabel: string,
  subjectLabel: string,
  gradeLabel: string,
  logoDataUrl: string | null,
  showCalificacion: boolean,
) {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return;
  let docContent = await documentFile.async("string");

  // 1) Embed del logo (si corresponde)
  let logoRelId: string | null = null;
  let logoCx = 0;
  let logoCy = 0;
  if (t.header.showLogo && logoDataUrl) {
    try {
      const { bytes, ext, mime } = dataUrlToImage(logoDataUrl);
      const mediaPath = `word/media/banner-logo.${ext}`;
      zip.file(mediaPath, bytes);
      await ensureContentType(zip, `/${mediaPath}`, mime);
      logoRelId = await ensureRel(
        zip,
        `media/banner-logo.${ext}`,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image",
      );
      // ~2,5 cm en EMU (1 cm = 360 000 EMU)
      logoCx = Math.round(2.5 * 360000);
      logoCy = Math.round(2.5 * 360000);
    } catch (e) {
      console.warn("No se pudo embebir el logo del banner:", e);
      logoRelId = null;
    }
  }

  // 2) Anchos de columna (en twips)
  const colLogo = 1700;            // ~3 cm
  const colCalif = showCalificacion ? 1700 : 0;
  const totalWidth = 9580;
  const colData = totalWidth - colLogo - colCalif;

  const fontName = t.typography.bodyFont;
  const sz = ptToHalfPoints(t.typography.bodySize).toString();

  // 3) XML de cada celda
  const logoCell = buildLogoCell(colLogo, logoRelId, logoCx, logoCy);
  const dataCell = buildDataCell(colData, fontName, sz, teacherLabel, subjectLabel, gradeLabel);
  const califCell = showCalificacion ? buildCalificacionCell(colCalif, fontName, sz) : "";

  const tableXml =
    `<w:tbl>` +
    `<w:tblPr>` +
    `<w:tblW w:w="${totalWidth}" w:type="dxa"/>` +
    `<w:tblBorders>` +
    `<w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/>` +
    `<w:insideH w:val="nil"/><w:insideV w:val="nil"/>` +
    `</w:tblBorders>` +
    `<w:tblLayout w:type="fixed"/>` +
    `</w:tblPr>` +
    `<w:tblGrid>` +
    `<w:gridCol w:w="${colLogo}"/>` +
    `<w:gridCol w:w="${colData}"/>` +
    (showCalificacion ? `<w:gridCol w:w="${colCalif}"/>` : "") +
    `</w:tblGrid>` +
    `<w:tr>${logoCell}${dataCell}${califCell}</w:tr>` +
    `</w:tbl>` +
    `<w:p><w:pPr><w:spacing w:before="0" w:after="120"/></w:pPr></w:p>`;

  // 4) Inyectar justo después de <w:body ...> (apertura)
  docContent = docContent.replace(
    /<w:body\b[^>]*>/,
    (match) => `${match}${tableXml}`,
  );

  zip.file("word/document.xml", docContent);
}

function buildLogoCell(width: number, relId: string | null, cx: number, cy: number): string {
  let inner: string;
  if (relId) {
    inner =
      `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr>` +
      `<w:r><w:drawing>` +
      `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
      `<wp:extent cx="${cx}" cy="${cy}"/>` +
      `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
      `<wp:docPr id="100" name="LogoColegio" descr="Logo institucional"/>` +
      `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
      `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
      `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
      `<pic:nvPicPr>` +
      `<pic:cNvPr id="101" name="LogoColegio" descr="Logo institucional"/>` +
      `<pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr>` +
      `</pic:nvPicPr>` +
      `<pic:blipFill>` +
      `<a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${relId}"/>` +
      `<a:srcRect/>` +
      `<a:stretch><a:fillRect/></a:stretch>` +
      `</pic:blipFill>` +
      `<pic:spPr bwMode="auto">` +
      `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
      `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
      `<a:noFill/>` +
      `<a:ln><a:noFill/></a:ln>` +
      `</pic:spPr>` +
      `</pic:pic>` +
      `</a:graphicData>` +
      `</a:graphic>` +
      `</wp:inline>` +
      `</w:drawing></w:r></w:p>`;
  } else {
    inner = `<w:p><w:pPr><w:jc w:val="center"/></w:pPr></w:p>`;
  }
  return (
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:tcW w:w="${width}" w:type="dxa"/>` +
    `<w:vAlign w:val="center"/>` +
    `</w:tcPr>` +
    inner +
    `</w:tc>`
  );
}

function buildDataLine(label: string, value: string, fontName: string, sz: string): string {
  const safeValue = escapeXml(value || "");
  // El label termina con ":" — añadimos un espacio después para separar del valor.
  // El valor termina con un espacio extra antes del filler para que la línea de
  // guiones bajos no quede pegada al texto en negrita.
  const labelText = `${label} `;
  const fillerLen = Math.max(10, 55 - (value?.length ?? 0) - label.length);
  const filler = "_".repeat(fillerLen);
  const valueRun = value
    ? `<w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${safeValue}  </w:t></w:r>`
    : "";
  return (
    `<w:p>` +
    `<w:pPr><w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/><w:jc w:val="left"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${escapeXml(labelText)}</w:t></w:r>` +
    valueRun +
    `<w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${filler}</w:t></w:r>` +
    `</w:p>`
  );
}

function buildDataCell(
  width: number,
  fontName: string,
  sz: string,
  teacher: string,
  subject: string,
  grade: string,
): string {
  return (
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:tcW w:w="${width}" w:type="dxa"/>` +
    `<w:vAlign w:val="center"/>` +
    `<w:tcMar><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>` +
    `</w:tcPr>` +
    buildDataLine("Profesor/a:", teacher, fontName, sz) +
    buildDataLine("Asignatura:", subject, fontName, sz) +
    buildDataLine("Curso:", grade, fontName, sz) +
    `</w:tc>`
  );
}

function buildCalificacionCell(width: number, fontName: string, sz: string): string {
  const border =
    `<w:top w:val="single" w:sz="6" w:space="0" w:color="000000"/>` +
    `<w:left w:val="single" w:sz="6" w:space="0" w:color="000000"/>` +
    `<w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>` +
    `<w:right w:val="single" w:sz="6" w:space="0" w:color="000000"/>`;
  return (
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:tcW w:w="${width}" w:type="dxa"/>` +
    `<w:tcBorders>${border}</w:tcBorders>` +
    `<w:vAlign w:val="center"/>` +
    `</w:tcPr>` +
    `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="40" w:after="40"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:b/><w:sz w:val="${sz}"/></w:rPr><w:t>Calificación</w:t></w:r>` +
    `</w:p>` +
    `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="80" w:after="80"/></w:pPr>` +
    `<w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve"> </w:t></w:r>` +
    `</w:p>` +
    `</w:tc>`
  );
}

function dataUrlToImage(dataUrl: string): { bytes: Uint8Array; ext: string; mime: string } {
  const match = dataUrl.match(/^data:image\/([\w+-]+);base64,(.+)$/);
  if (!match) throw new Error("Logo inválido");
  let ext = match[1].toLowerCase();
  if (ext === "jpeg") ext = "jpg";
  const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, ext, mime };
}

// ===================== Normalización de numeración =====================

/**
 * Extrae el texto plano de un párrafo concatenando todos los <w:t>.
 */
function extractParagraphText(paragraphXml: string): string {
  const matches = paragraphXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g);
  if (!matches) return "";
  return matches
    .map((m) => m.replace(/<w:t\b[^>]*>/, "").replace(/<\/w:t>/, ""))
    .join("")
    .trim();
}

/**
 * Cuenta inconsistencias de formato de numeración en texto plano del cuerpo.
 * - Opción canónica: `a)`, `b)`, ... seguido de espacio.
 * - Opción NO canónica: `a.`, `a-`, `A)`, `A.`, etc.
 * - Pregunta canónica: `1)`, `2)`, ... al inicio.
 * - Pregunta NO canónica: `1.`, `1-`, etc. (cuando se usa como enunciado).
 */
function countNumberingInconsistencies(documentXml: string): {
  options: number;
  questions: number;
} {
  const bodyMatch = documentXml.match(/<w:body\b[^>]*>([\s\S]*)<\/w:body>/);
  if (!bodyMatch) return { options: 0, questions: 0 };
  const body = bodyMatch[1];

  let options = 0;
  let questions = 0;

  const paragraphs = body.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g) || [];
  for (const p of paragraphs) {
    const text = extractParagraphText(p);
    if (!text) continue;

    // Opciones: una sola letra (a-z o A-Z) seguida de un separador
    const optMatch = text.match(/^([a-zA-Z])\s*([.\-)])\s+/);
    if (optMatch) {
      const letter = optMatch[1];
      const sep = optMatch[2];
      // Canónico: minúscula + ")"
      if (!(letter === letter.toLowerCase() && sep === ")")) {
        options++;
      }
      continue;
    }

    // Preguntas: número 1-99 seguido de separador
    const qMatch = text.match(/^(\d{1,2})\s*([.\-)])\s+/);
    if (qMatch) {
      const sep = qMatch[2];
      if (sep !== ")") {
        questions++;
      }
    }
  }

  return { options, questions };
}

/**
 * Normaliza la numeración de opciones y preguntas en el cuerpo del documento.
 *
 * - Texto plano: reemplaza separadores `a.`, `a-`, `A)` → `a)` y `1.`, `1-` → `1)`
 *   dentro de los <w:t> al inicio de cada párrafo. Solo cuando el patrón es claro
 *   (una sola letra/número + separador + espacio) para no romper texto narrativo.
 * - numbering.xml: cuando una definición tiene `numFmt="lowerLetter"` con `lvlText`
 *   que use `.` o `-` como separador, lo cambia a `)`. Lo mismo para `decimal` con
 *   sufijo claramente de pregunta (`%1.` → `%1)`) — pero SOLO si `numFmt` es
 *   `lowerLetter`. Para decimales no tocamos numbering.xml porque suele usarse
 *   también para listas de indicadores donde `1.` es lo correcto.
 *
 * Devuelve los conteos de cuántos arreglos aplicó.
 */
function normalizeNumbering(
  documentXml: string,
  numberingXml: string | null,
): {
  documentXml: string;
  numberingXml: string | null;
  optionsTextFixed: number;
  questionsTextFixed: number;
  optionsListFixed: number;
  questionsListFixed: number;
} {
  let optionsTextFixed = 0;
  let questionsTextFixed = 0;
  let optionsListFixed = 0;
  let questionsListFixed = 0;

  // 1) Texto plano: solo tocar el primer <w:t> de cada párrafo cuyo TEXTO COMPLETO
  // del párrafo arranque con un patrón de opción/pregunta no canónico.
  const bodyMatch = documentXml.match(/(<w:body\b[^>]*>)([\s\S]*)(<\/w:body>)/);
  let outDoc = documentXml;
  if (bodyMatch) {
    const open = bodyMatch[1];
    const body = bodyMatch[2];
    const close = bodyMatch[3];

    const newBody = body.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
      const text = extractParagraphText(paragraph);
      if (!text) return paragraph;

      // Opción no canónica
      const optMatch = text.match(/^([a-zA-Z])\s*([.\-)])\s+/);
      if (optMatch) {
        const letter = optMatch[1];
        const sep = optMatch[2];
        if (!(letter === letter.toLowerCase() && sep === ")")) {
          // Reemplazar dentro del primer <w:t>: encontrar el patrón al inicio
          // del primer texto y normalizar a `<letra-minúscula>) `.
          const newPara = paragraph.replace(
            /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/,
            (_full, openT, content, closeT) => {
              const updated = (content as string).replace(
                /^(\s*)([a-zA-Z])\s*[.\-)]\s+/,
                (_m, lead, l) => `${lead}${(l as string).toLowerCase()}) `,
              );
              return `${openT}${updated}${closeT}`;
            },
          );
          if (newPara !== paragraph) optionsTextFixed++;
          return newPara;
        }
        return paragraph;
      }

      // Pregunta no canónica
      const qMatch = text.match(/^(\d{1,2})\s*([.\-])\s+/);
      if (qMatch) {
        const newPara = paragraph.replace(
          /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/,
          (_full, openT, content, closeT) => {
            const updated = (content as string).replace(
              /^(\s*)(\d{1,2})\s*[.\-]\s+/,
              (_m, lead, n) => `${lead}${n}) `,
            );
            return `${openT}${updated}${closeT}`;
          },
        );
        if (newPara !== paragraph) questionsTextFixed++;
        return newPara;
      }

      return paragraph;
    });

    outDoc = `${open}${newBody}${close}`;
  }

  // 2) numbering.xml: para definiciones con lowerLetter, normalizar lvlText
  let outNumbering = numberingXml;
  if (outNumbering) {
    outNumbering = outNumbering.replace(
      /<w:lvl\b[^>]*>([\s\S]*?)<\/w:lvl>/g,
      (full, inner) => {
        const innerStr = inner as string;
        const fmtMatch = innerStr.match(/<w:numFmt\s+w:val="([^"]+)"/);
        if (!fmtMatch) return full;
        const fmt = fmtMatch[1];

        if (fmt === "lowerLetter" || fmt === "upperLetter") {
          // Forzar lvlText a `%N)` y numFmt a lowerLetter
          let updated = innerStr;
          let changed = false;
          updated = updated.replace(
            /<w:lvlText\s+w:val="([^"]+)"\s*\/>/,
            (_m, val) => {
              const v = val as string;
              // Detectar el placeholder %1, %2, etc.
              const phMatch = v.match(/(%\d+)/);
              if (!phMatch) return _m;
              const ph = phMatch[1];
              const canonical = `${ph})`;
              if (v !== canonical) {
                changed = true;
                return `<w:lvlText w:val="${canonical}"/>`;
              }
              return _m;
            },
          );
          if (fmt === "upperLetter") {
            updated = updated.replace(
              /<w:numFmt\s+w:val="upperLetter"\s*\/>/,
              `<w:numFmt w:val="lowerLetter"/>`,
            );
            changed = true;
          }
          if (changed) optionsListFixed++;
          return full.replace(innerStr, updated);
        }

        return full;
      },
    );
  }

  return {
    documentXml: outDoc,
    numberingXml: outNumbering,
    optionsTextFixed,
    questionsTextFixed,
    optionsListFixed,
    questionsListFixed,
  };
}
