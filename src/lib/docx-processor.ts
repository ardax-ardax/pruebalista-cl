// Procesador de documentos .docx en el navegador.
// Descomprime el .docx, modifica los XML internos según los parámetros,
// y vuelve a empaquetar. Genera un reporte de cambios aplicados.

import JSZip from "jszip";
import type { FormatTemplate, Alignment } from "./templates";

export interface ChangeReport {
  category: string;
  description: string;
}

export interface ProcessResult {
  blob: Blob;
  changes: ChangeReport[];
  originalSummary: {
    bodyFont?: string;
    bodySize?: number;
  };
}

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

function parseXml(content: string): Document {
  return new DOMParser().parseFromString(content, "application/xml");
}

function serializeXml(doc: Document): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + new XMLSerializer().serializeToString(doc);
}

function cmToTwips(cm: number): number {
  // 1 cm = 567 twips (aprox), 1 inch = 1440 twips, 1 inch = 2.54 cm
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
  // En OOXML, line value es 240 = simple
  return Math.round(spacing * 240);
}

function ensureChild(parent: Element, ns: string, localName: string, doc: Document): Element {
  const existing = Array.from(parent.children).find((c) => c.localName === localName && c.namespaceURI === ns);
  if (existing) return existing;
  const el = doc.createElementNS(ns, `w:${localName}`);
  parent.appendChild(el);
  return el;
}

function getOrCreateDirect(parent: Element, localName: string, doc: Document): Element {
  return ensureChild(parent, W_NS, localName, doc);
}

/**
 * Aplica una plantilla a un buffer .docx y devuelve el blob modificado + reporte.
 */
export async function applyTemplate(
  fileBuffer: ArrayBuffer,
  template: FormatTemplate,
  logoDataUrl: string | null,
): Promise<ProcessResult> {
  const zip = await JSZip.loadAsync(fileBuffer);
  const changes: ChangeReport[] = [];
  const originalSummary: ProcessResult["originalSummary"] = {};

  // 1. Procesar styles.xml — fuentes, tamaños, colores y estilos de títulos
  const stylesFile = zip.file("word/styles.xml");
  if (stylesFile) {
    const stylesContent = await stylesFile.async("string");
    const stylesDoc = parseXml(stylesContent);

    // Detectar fuente original
    const docDefaults = stylesDoc.getElementsByTagNameNS(W_NS, "docDefaults")[0];
    if (docDefaults) {
      const rPrDefault = docDefaults.getElementsByTagNameNS(W_NS, "rPrDefault")[0];
      if (rPrDefault) {
        const rPr = rPrDefault.getElementsByTagNameNS(W_NS, "rPr")[0];
        if (rPr) {
          const rFonts = rPr.getElementsByTagNameNS(W_NS, "rFonts")[0];
          if (rFonts) originalSummary.bodyFont = rFonts.getAttributeNS(W_NS, "ascii") || undefined;
          const sz = rPr.getElementsByTagNameNS(W_NS, "sz")[0];
          if (sz) {
            const v = sz.getAttributeNS(W_NS, "val");
            if (v) originalSummary.bodySize = parseInt(v, 10) / 2;
          }
        }
      }
    }

    applyStyles(stylesDoc, template);
    zip.file("word/styles.xml", serializeXml(stylesDoc));

    if (originalSummary.bodyFont && originalSummary.bodyFont !== template.typography.bodyFont) {
      changes.push({
        category: "Tipografía",
        description: `Fuente del cuerpo cambiada de ${originalSummary.bodyFont} a ${template.typography.bodyFont}`,
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

  // 2. Procesar document.xml — márgenes, interlineado, runs/parrafos
  const documentFile = zip.file("word/document.xml");
  if (documentFile) {
    const docContent = await documentFile.async("string");
    const docDoc = parseXml(docContent);

    applyMargins(docDoc, template);
    applyParagraphFormatting(docDoc, template);

    zip.file("word/document.xml", serializeXml(docDoc));

    changes.push({
      category: "Márgenes",
      description: `Márgenes: sup ${template.spacing.marginTop}cm, inf ${template.spacing.marginBottom}cm, izq ${template.spacing.marginLeft}cm, der ${template.spacing.marginRight}cm`,
    });
    changes.push({
      category: "Espaciado",
      description: `Interlineado ${template.spacing.lineSpacing.toFixed(2)}, espacio después de párrafo ${template.spacing.paragraphSpacingAfter}pt`,
    });
  }

  // 3. Encabezado y pie de página + logo
  if (template.header.enabled) {
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

  return { blob, changes, originalSummary };
}

function applyStyles(stylesDoc: Document, t: FormatTemplate) {
  // docDefaults — fuente y tamaño del cuerpo
  let docDefaults = stylesDoc.getElementsByTagNameNS(W_NS, "docDefaults")[0];
  const root = stylesDoc.documentElement;
  if (!docDefaults) {
    docDefaults = stylesDoc.createElementNS(W_NS, "w:docDefaults");
    root.insertBefore(docDefaults, root.firstChild);
  }
  let rPrDefault = docDefaults.getElementsByTagNameNS(W_NS, "rPrDefault")[0];
  if (!rPrDefault) {
    rPrDefault = stylesDoc.createElementNS(W_NS, "w:rPrDefault");
    docDefaults.appendChild(rPrDefault);
  }
  let rPr = rPrDefault.getElementsByTagNameNS(W_NS, "rPr")[0];
  if (!rPr) {
    rPr = stylesDoc.createElementNS(W_NS, "w:rPr");
    rPrDefault.appendChild(rPr);
  }
  setRunFont(stylesDoc, rPr, t.typography.bodyFont);
  setRunSize(stylesDoc, rPr, t.typography.bodySize);
  setRunColor(stylesDoc, rPr, t.typography.bodyColor);

  // Estilos Heading1, Heading2, Heading3
  const headingConfigs: Array<{
    id: string;
    size: number;
    align: Alignment;
  }> = [
    { id: "Heading1", size: t.typography.h1Size, align: t.headings.h1Alignment },
    { id: "Heading2", size: t.typography.h2Size, align: t.headings.h2Alignment },
    { id: "Heading3", size: t.typography.h3Size, align: t.headings.h3Alignment },
  ];

  for (const cfg of headingConfigs) {
    let style = findStyleById(stylesDoc, cfg.id);
    if (!style) {
      style = stylesDoc.createElementNS(W_NS, "w:style");
      style.setAttributeNS(W_NS, "w:type", "paragraph");
      style.setAttributeNS(W_NS, "w:styleId", cfg.id);
      const name = stylesDoc.createElementNS(W_NS, "w:name");
      name.setAttributeNS(W_NS, "w:val", `heading ${cfg.id.replace("Heading", "")}`);
      style.appendChild(name);
      root.appendChild(style);
    }
    // pPr
    let pPr = Array.from(style.children).find((c) => c.localName === "pPr") as Element | undefined;
    if (!pPr) {
      pPr = stylesDoc.createElementNS(W_NS, "w:pPr");
      style.appendChild(pPr);
    }
    setAlignment(stylesDoc, pPr, cfg.align);

    // rPr del estilo
    let sRPr = Array.from(style.children).find((c) => c.localName === "rPr") as Element | undefined;
    if (!sRPr) {
      sRPr = stylesDoc.createElementNS(W_NS, "w:rPr");
      style.appendChild(sRPr);
    }
    setRunFont(stylesDoc, sRPr, t.typography.headingFont);
    setRunSize(stylesDoc, sRPr, cfg.size);
    setRunColor(stylesDoc, sRPr, t.typography.headingColor);
    setRunBold(stylesDoc, sRPr, t.headings.bold);
  }
}

function findStyleById(doc: Document, id: string): Element | null {
  const styles = doc.getElementsByTagNameNS(W_NS, "style");
  for (let i = 0; i < styles.length; i++) {
    if (styles[i].getAttributeNS(W_NS, "styleId") === id) return styles[i];
  }
  return null;
}

function setRunFont(doc: Document, rPr: Element, font: string) {
  const existing = rPr.getElementsByTagNameNS(W_NS, "rFonts")[0];
  const el = existing ?? doc.createElementNS(W_NS, "w:rFonts");
  el.setAttributeNS(W_NS, "w:ascii", font);
  el.setAttributeNS(W_NS, "w:hAnsi", font);
  el.setAttributeNS(W_NS, "w:cs", font);
  el.setAttributeNS(W_NS, "w:eastAsia", font);
  if (!existing) rPr.insertBefore(el, rPr.firstChild);
}

function setRunSize(doc: Document, rPr: Element, sizePt: number) {
  const halfPts = ptToHalfPoints(sizePt).toString();
  const sz = rPr.getElementsByTagNameNS(W_NS, "sz")[0] ?? doc.createElementNS(W_NS, "w:sz");
  sz.setAttributeNS(W_NS, "w:val", halfPts);
  if (!sz.parentNode) rPr.appendChild(sz);
  const szCs = rPr.getElementsByTagNameNS(W_NS, "szCs")[0] ?? doc.createElementNS(W_NS, "w:szCs");
  szCs.setAttributeNS(W_NS, "w:val", halfPts);
  if (!szCs.parentNode) rPr.appendChild(szCs);
}

function setRunColor(doc: Document, rPr: Element, hex: string) {
  const color = rPr.getElementsByTagNameNS(W_NS, "color")[0] ?? doc.createElementNS(W_NS, "w:color");
  color.setAttributeNS(W_NS, "w:val", hex.replace("#", "").toUpperCase());
  if (!color.parentNode) rPr.appendChild(color);
}

function setRunBold(doc: Document, rPr: Element, bold: boolean) {
  const existing = rPr.getElementsByTagNameNS(W_NS, "b")[0];
  if (bold) {
    if (!existing) {
      const b = doc.createElementNS(W_NS, "w:b");
      rPr.appendChild(b);
    }
  } else if (existing) {
    existing.parentNode?.removeChild(existing);
  }
}

function setAlignment(doc: Document, pPr: Element, align: Alignment) {
  const jc = pPr.getElementsByTagNameNS(W_NS, "jc")[0] ?? doc.createElementNS(W_NS, "w:jc");
  jc.setAttributeNS(W_NS, "w:val", alignmentToWord(align));
  if (!jc.parentNode) pPr.appendChild(jc);
}

function applyMargins(docDoc: Document, t: FormatTemplate) {
  // sectPr puede estar en body o en último párrafo
  const sectPrs = docDoc.getElementsByTagNameNS(W_NS, "sectPr");
  for (let i = 0; i < sectPrs.length; i++) {
    const sectPr = sectPrs[i];
    let pgMar = sectPr.getElementsByTagNameNS(W_NS, "pgMar")[0];
    if (!pgMar) {
      pgMar = docDoc.createElementNS(W_NS, "w:pgMar");
      sectPr.appendChild(pgMar);
    }
    pgMar.setAttributeNS(W_NS, "w:top", cmToTwips(t.spacing.marginTop).toString());
    pgMar.setAttributeNS(W_NS, "w:bottom", cmToTwips(t.spacing.marginBottom).toString());
    pgMar.setAttributeNS(W_NS, "w:left", cmToTwips(t.spacing.marginLeft).toString());
    pgMar.setAttributeNS(W_NS, "w:right", cmToTwips(t.spacing.marginRight).toString());
    pgMar.setAttributeNS(W_NS, "w:header", "720");
    pgMar.setAttributeNS(W_NS, "w:footer", "720");
    pgMar.setAttributeNS(W_NS, "w:gutter", "0");
  }
}

function applyParagraphFormatting(docDoc: Document, t: FormatTemplate) {
  const paragraphs = docDoc.getElementsByTagNameNS(W_NS, "p");
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    let pPr = Array.from(p.children).find((c) => c.localName === "pPr") as Element | undefined;
    if (!pPr) {
      pPr = docDoc.createElementNS(W_NS, "w:pPr");
      p.insertBefore(pPr, p.firstChild);
    }

    // spacing
    const spacing = pPr.getElementsByTagNameNS(W_NS, "spacing")[0] ?? docDoc.createElementNS(W_NS, "w:spacing");
    spacing.setAttributeNS(W_NS, "w:before", ptToHalfPoints(t.spacing.paragraphSpacingBefore * 10).toString());
    spacing.setAttributeNS(W_NS, "w:after", ptToHalfPoints(t.spacing.paragraphSpacingAfter * 10).toString());
    spacing.setAttributeNS(W_NS, "w:line", lineSpacingToTwips(t.spacing.lineSpacing).toString());
    spacing.setAttributeNS(W_NS, "w:lineRule", "auto");
    if (!spacing.parentNode) pPr.appendChild(spacing);

    // Detectar si es heading
    const pStyle = pPr.getElementsByTagNameNS(W_NS, "pStyle")[0];
    const styleVal = pStyle?.getAttributeNS(W_NS, "val") ?? "";
    const isHeading = /^Heading\d$/i.test(styleVal) || /^Ttulo\d$/i.test(styleVal) || /^Title$/i.test(styleVal);

    // Reformatear runs del cuerpo (no headings) para fuente y tamaño consistentes
    if (!isHeading) {
      const runs = Array.from(p.children).filter((c) => c.localName === "r") as Element[];
      for (const r of runs) {
        let rPr = Array.from(r.children).find((c) => c.localName === "rPr") as Element | undefined;
        if (!rPr) {
          rPr = docDoc.createElementNS(W_NS, "w:rPr");
          r.insertBefore(rPr, r.firstChild);
        }
        setRunFont(docDoc, rPr, t.typography.bodyFont);
        setRunSize(docDoc, rPr, t.typography.bodySize);
        setRunColor(docDoc, rPr, t.typography.bodyColor);
      }
    }
  }
}

// --- Encabezado / Pie ---

const CONTENT_TYPES_PATH = "[Content_Types].xml";
const RELS_PATH = "word/_rels/document.xml.rels";

async function ensureRel(zip: JSZip, target: string, type: string): Promise<string> {
  const relsFile = zip.file(RELS_PATH);
  if (!relsFile) throw new Error("Faltan relaciones del documento");
  const content = await relsFile.async("string");
  const doc = parseXml(content);
  const rels = doc.documentElement;
  const existing = Array.from(rels.getElementsByTagNameNS(REL_NS, "Relationship")).find(
    (r) => r.getAttribute("Target") === target,
  );
  if (existing) return existing.getAttribute("Id")!;

  const ids = Array.from(rels.getElementsByTagNameNS(REL_NS, "Relationship")).map(
    (r) => parseInt((r.getAttribute("Id") ?? "rId0").replace("rId", ""), 10) || 0,
  );
  const nextId = `rId${Math.max(0, ...ids) + 1}`;
  const rel = doc.createElementNS(REL_NS, "Relationship");
  rel.setAttribute("Id", nextId);
  rel.setAttribute("Type", type);
  rel.setAttribute("Target", target);
  rels.appendChild(rel);
  zip.file(RELS_PATH, serializeXml(doc));
  return nextId;
}

async function ensureContentType(zip: JSZip, partName: string, contentType: string) {
  const file = zip.file(CONTENT_TYPES_PATH);
  if (!file) return;
  const content = await file.async("string");
  const doc = parseXml(content);
  const ns = "http://schemas.openxmlformats.org/package/2006/content-types";
  const overrides = doc.getElementsByTagNameNS(ns, "Override");
  for (let i = 0; i < overrides.length; i++) {
    if (overrides[i].getAttribute("PartName") === partName) return;
  }
  const override = doc.createElementNS(ns, "Override");
  override.setAttribute("PartName", partName);
  override.setAttribute("ContentType", contentType);
  doc.documentElement.appendChild(override);
  zip.file(CONTENT_TYPES_PATH, serializeXml(doc));
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
    // Imagen inline 3cm x 3cm aprox (914400 EMU = 1 inch, 1 inch = 2.54 cm)
    const cx = Math.round((3 / 2.54) * 914400);
    const cy = Math.round((3 / 2.54) * 914400);
    logoRun = `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="${logoRelId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r><w:r><w:br/></w:r>`;
  }

  const text = escapeXml(t.header.institutionName || "");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="${W_NS}">
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
<w:ftr xmlns:w="${W_NS}">
  <w:p>
    <w:pPr><w:tabs><w:tab w:val="right" w:pos="9072"/></w:tabs></w:pPr>
    <w:r><w:rPr><w:rFonts w:ascii="${fontName}" w:hAnsi="${fontName}"/><w:sz w:val="${sz}"/></w:rPr><w:t xml:space="preserve">${leftText}</w:t></w:r>
    ${pageNumberRun}
  </w:p>
</w:ftr>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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
  const content = await documentFile.async("string");
  const doc = parseXml(content);
  const sectPrs = doc.getElementsByTagNameNS(W_NS, "sectPr");
  for (let i = 0; i < sectPrs.length; i++) {
    const sectPr = sectPrs[i];
    // Eliminar referencias previas del mismo tipo
    const existing = sectPr.getElementsByTagNameNS(W_NS, refName);
    while (existing.length > 0) existing[0].parentNode?.removeChild(existing[0]);

    const ref = doc.createElementNS(W_NS, `w:${refName}`);
    ref.setAttributeNS(W_NS, "w:type", "default");
    ref.setAttributeNS(R_NS, "r:id", relId);
    sectPr.insertBefore(ref, sectPr.firstChild);
  }
  zip.file("word/document.xml", serializeXml(doc));
}
