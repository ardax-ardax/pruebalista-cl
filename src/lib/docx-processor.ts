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

/**
 * Error con contexto técnico de qué pasada falló y por qué.
 * Permite mostrar al usuario el detalle exacto en lugar del mensaje genérico
 * "elementos avanzados".
 */
export class DocxProcessingError extends Error {
  stage: string;
  detail: string;
  constructor(stage: string, detail: string, original?: unknown) {
    super(`[${stage}] ${detail}`);
    this.name = "DocxProcessingError";
    this.stage = stage;
    this.detail = detail;
    if (original instanceof Error && original.stack) {
      this.stack = `${this.stack}\nCaused by: ${original.stack}`;
    }
  }
}

export interface PreflightFinding {
  kind: "sdt" | "smartart" | "vml" | "ole" | "altchunk" | "textbox" | "altcontent";
  count: number;
  label: string;
}

export interface PreflightResult {
  ok: boolean;
  fatal?: { code: "not-docx" | "missing-document" | "missing-content-types"; message: string };
  findings: PreflightFinding[];
}

/**
 * Valida estructura mínima del .docx antes de procesar.
 * Detecta:
 *  - Archivos .doc renombrados (firma binaria D0CF11E0).
 *  - ZIP sin word/document.xml o [Content_Types].xml.
 *  - Elementos riesgosos: <w:sdt>, SmartArt, VML legacy, OLE, altChunk.
 */
export async function validateDocxStructure(
  fileBuffer: ArrayBuffer,
): Promise<PreflightResult> {
  const findings: PreflightFinding[] = [];

  // Firma de OLE Compound File (.doc legacy): D0 CF 11 E0 A1 B1 1A E1
  const head = new Uint8Array(fileBuffer.slice(0, 8));
  if (
    head[0] === 0xd0 &&
    head[1] === 0xcf &&
    head[2] === 0x11 &&
    head[3] === 0xe0
  ) {
    return {
      ok: false,
      fatal: {
        code: "not-docx",
        message:
          "El archivo parece ser un .doc antiguo (formato binario de Word 97-2003). Ábrelo en Word y guárdalo como .docx.",
      },
      findings: [],
    };
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(fileBuffer);
  } catch (e) {
    return {
      ok: false,
      fatal: {
        code: "not-docx",
        message: "El archivo no es un .docx válido (no se pudo abrir como ZIP).",
      },
      findings: [],
    };
  }

  if (!zip.file("[Content_Types].xml")) {
    return {
      ok: false,
      fatal: {
        code: "missing-content-types",
        message: "Falta [Content_Types].xml — el .docx está corrupto o incompleto.",
      },
      findings: [],
    };
  }
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    return {
      ok: false,
      fatal: {
        code: "missing-document",
        message: "Falta word/document.xml — el .docx está corrupto o incompleto.",
      },
      findings: [],
    };
  }

  const docXml = await docFile.async("string");

  const sdtCount = countOccurrences(docXml, /<w:sdt\b/g);
  if (sdtCount > 0) {
    findings.push({
      kind: "sdt",
      count: sdtCount,
      label: `${sdtCount} control(es) de contenido (casillas, fechas, listas desplegables)`,
    });
  }
  const smartArtCount = countOccurrences(
    docXml,
    /<a:graphicData\b[^>]*uri="[^"]*diagram[^"]*"/g,
  );
  if (smartArtCount > 0) {
    findings.push({
      kind: "smartart",
      count: smartArtCount,
      label: `${smartArtCount} diagrama(s) SmartArt`,
    });
  }
  const vmlCount = countOccurrences(docXml, /<v:shape\b|<v:rect\b|<v:oval\b/g);
  if (vmlCount > 0) {
    findings.push({
      kind: "vml",
      count: vmlCount,
      label: `${vmlCount} forma(s) en formato VML legacy (Word 2003 o anterior)`,
    });
  }
  const oleCount = countOccurrences(docXml, /<w:object\b/g);
  if (oleCount > 0) {
    findings.push({
      kind: "ole",
      count: oleCount,
      label: `${oleCount} objeto(s) embebido(s) (Excel, ecuaciones, etc.)`,
    });
  }
  const altChunkCount = countOccurrences(docXml, /<w:altChunk\b/g);
  if (altChunkCount > 0) {
    findings.push({
      kind: "altchunk",
      count: altChunkCount,
      label: `${altChunkCount} fragmento(s) externos (HTML/RTF embebido)`,
    });
  }
  const textboxCount = countOccurrences(docXml, /<w:txbxContent\b/g);
  if (textboxCount > 0) {
    findings.push({
      kind: "textbox",
      count: textboxCount,
      label: `${textboxCount} cuadro(s) de texto (contenido anidado, se preservará tal cual)`,
    });
  }
  // Solo reportar mc:AlternateContent si tiene Fallback no trivial (no solo un placeholder vacío)
  const altContentMatches = docXml.match(/<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g) ?? [];
  const altContentNonTrivial = altContentMatches.filter((b) =>
    /<mc:Fallback\b[\s\S]*?<w:[a-z]/i.test(b),
  ).length;
  if (altContentNonTrivial > 0) {
    findings.push({
      kind: "altcontent",
      count: altContentNonTrivial,
      label: `${altContentNonTrivial} bloque(s) de contenido alternativo (compatibilidad Word, se preservará tal cual)`,
    });
  }

  return { ok: true, findings };
}

// =====================================================================
// Protección de regiones con anidamiento OOXML
// =====================================================================
//
// Word permite anidar <w:p> y <w:r> dentro de:
//   - <w:txbxContent> (cuadros de texto dentro de drawings)
//   - <mc:AlternateContent> (contenido alternativo Word 2007+ con fallback)
//   - <w:sdt> (controles de contenido)
//
// Nuestras pasadas que iteran <w:p>/<w:r> con regex no codiciosa
// (`[\s\S]*?</w:p>`) cierran prematuramente al encontrar el </w:p> interior,
// dejando el </w:p> exterior huérfano y rompiendo el balance de tags.
// Mammoth.js entonces no encuentra <w:body> y aborta.
//
// Solución: antes de cada pasada riesgosa, "ocultar" estas regiones con un
// placeholder único. La regex no las ve, los conteos quedan balanceados, y
// al terminar restauramos el contenido original byte-a-byte.

const PROTECTED_BLOCK_PATTERNS: RegExp[] = [
  /<mc:AlternateContent\b[\s\S]*?<\/mc:AlternateContent>/g,
  /<w:txbxContent\b[\s\S]*?<\/w:txbxContent>/g,
  /<w:sdt\b[\s\S]*?<\/w:sdt>/g,
];

function withProtectedRegions(xml: string, fn: (masked: string) => string): string {
  const stash: string[] = [];
  let masked = xml;
  for (const pattern of PROTECTED_BLOCK_PATTERNS) {
    masked = masked.replace(pattern, (block) => {
      const token = `__LOV_PROTECTED_${stash.length}__`;
      stash.push(block);
      return token;
    });
  }
  const result = fn(masked);
  // Restaurar en orden inverso al ordinal — los tokens son únicos por índice.
  return result.replace(/__LOV_PROTECTED_(\d+)__/g, (_m, idx) => {
    const i = parseInt(idx, 10);
    return stash[i] ?? _m;
  });
}

// Conteo simple de aperturas/cierres para validar balance de tags clave
// después de cada pasada. No es un parser XML, pero detecta el caso típico
// de regex no codiciosa que cierra en un tag anidado.
function tagBalance(xml: string): { body: number; p: number; r: number } {
  const open = (re: RegExp) => (xml.match(re) ?? []).length;
  return {
    body: open(/<w:body\b/g) - open(/<\/w:body>/g),
    p: open(/<w:p\b(?![a-zA-Z])/g) - open(/<\/w:p>/g),
    r: open(/<w:r\b(?![a-zA-Z])/g) - open(/<\/w:r>/g),
  };
}

/**
 * Ejecuta una pasada de procesamiento atrapando errores. Si falla, devuelve
 * el XML original y registra un warning legible en lugar de abortar.
 */
function runPass<T>(
  stage: string,
  warnings: string[],
  fn: () => T,
  fallback: T,
): T {
  try {
    return fn();
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    // Intentar extraer el primer tag XML mencionado (útil para debugging)
    const tagHint = detail.match(/<\/?[\w:]+/)?.[0];
    const suffix = tagHint ? ` (cerca de \`${tagHint}\`)` : "";
    warnings.push(`No se pudo aplicar "${stage}"${suffix}. Se mantuvo el contenido original de esa pasada.`);
    console.warn(`[docx-processor] Pasada "${stage}" falló:`, e);
    return fallback;
  }
}

/**
 * Variante de runPass para transformaciones XML: valida balance de tags
 * <w:body>, <w:p>, <w:r> después de la pasada. Si la pasada deja el XML
 * desbalanceado (típico de regex no codiciosa que cierra en un <w:p> anidado),
 * descarta el resultado y mantiene el original con un warning legible.
 */
function runXmlPass(
  stage: string,
  warnings: string[],
  inputXml: string,
  fn: (xml: string) => string,
): string {
  const before = tagBalance(inputXml);
  let result: string;
  try {
    result = fn(inputXml);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    const tagHint = detail.match(/<\/?[\w:]+/)?.[0];
    const suffix = tagHint ? ` (cerca de \`${tagHint}\`)` : "";
    warnings.push(`No se pudo aplicar "${stage}"${suffix}. Se mantuvo el contenido original de esa pasada.`);
    console.warn(`[docx-processor] Pasada "${stage}" falló:`, e);
    return inputXml;
  }
  const after = tagBalance(result);
  if (after.body !== before.body || after.p !== before.p || after.r !== before.r) {
    // Buscar dónde aparece el primer desbalance para dar pista en el warning
    let hint = "";
    const firstDelta = after.p !== before.p ? "<w:p>" : after.r !== before.r ? "<w:r>" : "<w:body>";
    const idx = result.indexOf(`${firstDelta}`);
    if (idx >= 0) {
      const start = Math.max(0, idx - 60);
      hint = ` Fragmento: ${result.slice(start, start + 120).replace(/\s+/g, " ")}`;
    }
    warnings.push(
      `La pasada "${stage}" dejó el XML desbalanceado (${firstDelta}: ${before.p}→${after.p} p, ${before.r}→${after.r} r). Se revirtió.${hint}`,
    );
    console.warn(`[docx-processor] Pasada "${stage}" desbalanceó tags`, { before, after });
    return inputXml;
  }
  return result;
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

// =====================================================================
// Sanitización + validación final del .docx
// =====================================================================

/**
 * Elimina caracteres de control prohibidos por XML 1.0
 * (\x00-\x08, \x0B, \x0C, \x0E-\x1F).
 * Word rechaza el archivo con "archivo dañado" si están presentes.
 * Conserva \t (\x09), \n (\x0A), \r (\x0D).
 */
function stripInvalidXmlChars(xml: string): string {
  // eslint-disable-next-line no-control-regex
  return xml.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/**
 * Whitelist de namespaces oficiales de Microsoft Word / OOXML que sabemos
 * declarar de forma segura. Cualquier prefijo usado en el XML que esté en
 * esta tabla y no esté declarado en el root, se autorrepara.
 */
const KNOWN_WORD_NAMESPACES: Record<string, string> = {
  w: W_NS,
  r: "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
  wp: "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing",
  wp14: "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing",
  a: "http://schemas.openxmlformats.org/drawingml/2006/main",
  pic: "http://schemas.openxmlformats.org/drawingml/2006/picture",
  mc: "http://schemas.openxmlformats.org/markup-compatibility/2006",
  w14: "http://schemas.microsoft.com/office/word/2010/wordml",
  w15: "http://schemas.microsoft.com/office/word/2012/wordml",
  w16se: "http://schemas.microsoft.com/office/word/2015/wordml/symex",
  w16cid: "http://schemas.microsoft.com/office/word/2016/wordml/cid",
  w16: "http://schemas.microsoft.com/office/word/2018/wordml",
  wpg: "http://schemas.microsoft.com/office/word/2010/wordprocessingGroup",
  wps: "http://schemas.microsoft.com/office/word/2010/wordprocessingShape",
  wpi: "http://schemas.microsoft.com/office/word/2010/wordprocessingInk",
  v: "urn:schemas-microsoft-com:vml",
  o: "urn:schemas-microsoft-com:office:office",
  m: "http://schemas.openxmlformats.org/officeDocument/2006/math",
  ve: "http://schemas.openxmlformats.org/markup-compatibility/2006",
  wne: "http://schemas.microsoft.com/office/word/2006/wordml",
  c: "http://schemas.openxmlformats.org/drawingml/2006/chart",
  dgm: "http://schemas.openxmlformats.org/drawingml/2006/diagram",
  sl: "http://schemas.openxmlformats.org/schemaLibrary/2006/main",
};

const ORPHAN_PREFIX_WARNINGS = new Set<string>();

/**
 * Escanea el XML buscando prefijos usados (en tags y atributos) que no estén
 * declarados en el root. Para los conocidos, agrega el `xmlns:prefix="..."`
 * correspondiente al elemento root indicado. Para los desconocidos registra
 * un aviso (sin bloquear).
 */
function repairOrphanNamespaces(xml: string, rootTag: string): string {
  const rootRe = new RegExp(`<${rootTag}\\b([^>]*)>`);
  const rootMatch = xml.match(rootRe);
  if (!rootMatch) return xml;
  const rootAttrs = rootMatch[1];

  const declared = new Set<string>();
  // xmlns:prefix="..."
  for (const m of rootAttrs.matchAll(/\bxmlns:([A-Za-z0-9_]+)\s*=/g)) {
    declared.add(m[1]);
  }
  // xmlns="..." (default)
  if (/\bxmlns\s*=/.test(rootAttrs)) declared.add("");

  // Buscar prefijos usados en TODO el documento (tags y atributos).
  // Ej: <w14:paraId/>, w14:paraId="...", a:graphic, r:embed=...
  const used = new Set<string>();
  for (const m of xml.matchAll(/<\/?([A-Za-z][A-Za-z0-9_]*):[A-Za-z]/g)) {
    used.add(m[1]);
  }
  for (const m of xml.matchAll(/\s([A-Za-z][A-Za-z0-9_]*):[A-Za-z][A-Za-z0-9_]*\s*=/g)) {
    used.add(m[1]);
  }
  // Excluir "xmlns" y "xml" (no son prefijos)
  used.delete("xmlns");
  used.delete("xml");

  let toAdd = "";
  const ignorables: string[] = [];
  for (const prefix of used) {
    if (declared.has(prefix)) continue;
    const uri = KNOWN_WORD_NAMESPACES[prefix];
    if (uri) {
      toAdd += ` xmlns:${prefix}="${uri}"`;
      // Marcar como ignorables si son extensiones modernas que Word viejo no entiende
      if (/^(w14|w15|w16se|w16cid|w16|wp14|wpg|wps|wpi)$/.test(prefix)) {
        ignorables.push(prefix);
      }
    } else {
      const key = `${rootTag}:${prefix}`;
      if (!ORPHAN_PREFIX_WARNINGS.has(key)) {
        ORPHAN_PREFIX_WARNINGS.add(key);
        console.warn(
          `[docx-processor] Prefijo de namespace desconocido "${prefix}:" en ${rootTag}; no se pudo autorreparar.`,
        );
      }
    }
  }

  let newAttrs = rootAttrs + toAdd;

  // Manejar mc:Ignorable: agregar/extender con los nuevos prefijos modernos
  if (ignorables.length > 0 || /\bw14:|\bw15:|\bw16/.test(xml)) {
    const allIgnorables = new Set<string>(ignorables);
    // Asegurar que todos los modernos efectivamente declarados queden ignorables
    for (const p of ["w14", "w15", "w16se", "w16cid", "w16", "wp14"]) {
      if (declared.has(p) || toAdd.includes(`xmlns:${p}=`)) allIgnorables.add(p);
    }
    const ignoreMatch = newAttrs.match(/\bmc:Ignorable\s*=\s*"([^"]*)"/);
    if (ignoreMatch) {
      const existing = new Set(ignoreMatch[1].split(/\s+/).filter(Boolean));
      allIgnorables.forEach((p) => existing.add(p));
      const merged = Array.from(existing).join(" ");
      newAttrs = newAttrs.replace(/\bmc:Ignorable\s*=\s*"[^"]*"/, `mc:Ignorable="${merged}"`);
    } else if (allIgnorables.size > 0) {
      newAttrs += ` mc:Ignorable="${Array.from(allIgnorables).join(" ")}"`;
    }
  }

  if (newAttrs !== rootAttrs) {
    return xml.replace(rootRe, `<${rootTag}${newAttrs}>`);
  }
  return xml;
}

/**
 * Asegura que el `<w:document>` raíz declare los namespaces que usan los
 * elementos que inyectamos (banner, headers, footers): xmlns:wp, xmlns:a,
 * xmlns:pic, xmlns:r, además de los modernos w14/w15/w16. Sin esto, parsers
 * estrictos como Word marcan el archivo como corrupto ("unbound prefix").
 *
 * Si el XML carece por completo del root <w:document> (p. ej. una pasada
 * previa lo eliminó), lo reconstruye envolviendo el contenido existente.
 */
function ensureDocumentRootNamespaces(xml: string): string {
  const REQUIRED: Array<[string, string]> = [
    ["xmlns:w", KNOWN_WORD_NAMESPACES.w],
    ["xmlns:r", KNOWN_WORD_NAMESPACES.r],
    ["xmlns:wp", KNOWN_WORD_NAMESPACES.wp],
    ["xmlns:a", KNOWN_WORD_NAMESPACES.a],
    ["xmlns:pic", KNOWN_WORD_NAMESPACES.pic],
    ["xmlns:mc", KNOWN_WORD_NAMESPACES.mc],
  ];

  let out = xml;
  // Asegurar declaración XML
  if (!/^<\?xml\b/.test(out.trimStart())) {
    out = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${out}`;
  }

  // Caso 1: existe la apertura <w:document>
  const rootMatch = out.match(/<w:document\b([^>]*)>/);
  if (rootMatch) {
    const existingAttrs = rootMatch[1];
    let newAttrs = existingAttrs;
    for (const [prefix, uri] of REQUIRED) {
      const re = new RegExp(`\\b${prefix.replace(":", "\\:")}\\s*=`);
      if (!re.test(newAttrs)) {
        newAttrs += ` ${prefix}="${uri}"`;
      }
    }
    if (newAttrs !== existingAttrs) {
      out = out.replace(/<w:document\b([^>]*)>/, `<w:document${newAttrs}>`);
    }
    // Asegurar </w:document>
    if (!/<\/w:document>\s*$/.test(out)) {
      out = out.replace(/\s*$/, "</w:document>");
    }
    // Autoreparar cualquier prefijo huérfano que haya quedado (w14, v, m, etc.)
    out = repairOrphanNamespaces(out, "w:document");
    return out;
  }

  // Caso 2: el root se perdió en alguna pasada — reconstruirlo envolviendo
  // todo lo que tengamos (típicamente arranca en <w:body>).
  const nsAttrs = REQUIRED.map(([p, u]) => `${p}="${u}"`).join(" ");
  // Quitar declaración XML del cuerpo si quedó duplicada
  const body = out.replace(/^<\?xml[^?]*\?>\s*/, "");
  out = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${nsAttrs}>${body}</w:document>`;
  out = repairOrphanNamespaces(out, "w:document");
  return out;
}

/**
 * Versión genérica para reparar namespaces en headers, footers y otras
 * partes del .docx cuyo root es distinto a <w:document>.
 */
function ensurePartRootNamespaces(xml: string, rootTag: string): string {
  let out = xml;
  if (!/^<\?xml\b/.test(out.trimStart())) {
    out = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${out}`;
  }
  const rootRe = new RegExp(`<${rootTag}\\b([^>]*)>`);
  const m = out.match(rootRe);
  if (!m) return out;
  // Asegurar al menos los namespaces básicos para que w:/r:/wp:/a:/pic:/mc: existan
  const REQUIRED: Array<[string, string]> = [
    ["xmlns:w", KNOWN_WORD_NAMESPACES.w],
    ["xmlns:r", KNOWN_WORD_NAMESPACES.r],
    ["xmlns:mc", KNOWN_WORD_NAMESPACES.mc],
  ];
  let newAttrs = m[1];
  for (const [prefix, uri] of REQUIRED) {
    const re = new RegExp(`\\b${prefix.replace(":", "\\:")}\\s*=`);
    if (!re.test(newAttrs)) newAttrs += ` ${prefix}="${uri}"`;
  }
  if (newAttrs !== m[1]) {
    out = out.replace(rootRe, `<${rootTag}${newAttrs}>`);
  }
  out = repairOrphanNamespaces(out, rootTag);
  return out;
}

/**
 * Si el primer hijo de <w:body> es <w:tbl>, OOXML exige un <w:p/> previo.
 * Word rechaza el archivo si esto no se cumple. Lo mismo aplica al final
 * (último hijo no puede ser <w:tbl>; debe haber un <w:p> con sectPr).
 */
function ensureBodyParagraphBoundaries(xml: string): string {
  let out = xml;
  out = out.replace(/(<w:body\b[^>]*>)\s*<w:tbl\b/, (_m, open) => `${open}<w:p/><w:tbl`);
  return out;
}

export interface FinalValidationIssue {
  severity: "fatal" | "warning";
  part: string;
  message: string;
}

/**
 * Valida el ZIP final justo antes de entregarlo al usuario.
 * - Parsea cada XML clave con DOMParser y detecta <parsererror>.
 * - Verifica que cada r:id referenciado en document.xml exista en .rels.
 * Devuelve la lista de problemas (vacía si todo OK).
 */
async function validateProcessedDocx(zip: JSZip): Promise<FinalValidationIssue[]> {
  const issues: FinalValidationIssue[] = [];
  const baseParts = [
    "word/document.xml",
    "word/styles.xml",
    "word/numbering.xml",
    "[Content_Types].xml",
    "word/_rels/document.xml.rels",
  ];
  const headerFooterParts = Object.keys(zip.files).filter((p) =>
    /^word\/(header|footer)\d*\.xml$/i.test(p),
  );
  const parts = [...baseParts, ...headerFooterParts];

  // DOMParser solo está en navegador; en SSR/test cae por undefined.
  const DOMParserCtor = typeof DOMParser !== "undefined" ? DOMParser : null;

  for (const path of parts) {
    const file = zip.file(path);
    if (!file) continue;
    const content = await file.async("string");
    if (DOMParserCtor) {
      try {
        const parser = new DOMParserCtor();
        const doc = parser.parseFromString(content, "text/xml");
        const errNode = doc.querySelector("parsererror");
        if (errNode) {
          const msg = (errNode.textContent || "").replace(/\s+/g, " ").slice(0, 200);
          issues.push({
            severity: "fatal",
            part: path,
            message: `XML inválido: ${msg || "estructura malformada"}`,
          });
        }
      } catch (e) {
        issues.push({
          severity: "fatal",
          part: path,
          message: `No se pudo parsear: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
    }
  }

  // Cross-check r:id → relationships
  const docFile = zip.file("word/document.xml");
  const relsFile = zip.file("word/_rels/document.xml.rels");
  if (docFile && relsFile) {
    const docXml = await docFile.async("string");
    const relsXml = await relsFile.async("string");
    const declaredIds = new Set(
      Array.from(relsXml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"/g)).map((m) => m[1]),
    );
    const referencedIds = new Set(
      Array.from(docXml.matchAll(/\br:(?:id|embed|link)="([^"]+)"/g)).map((m) => m[1]),
    );
    const missing: string[] = [];
    referencedIds.forEach((id) => {
      if (!declaredIds.has(id)) missing.push(id);
    });
    if (missing.length > 0) {
      issues.push({
        severity: "warning",
        part: "word/_rels/document.xml.rels",
        message: `Referencias rId huérfanas en document.xml: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`,
      });
    }
  }

  return issues;
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

    // Recolector de warnings de pasadas individuales (try/catch por pasada)
    const passWarnings: string[] = [];

    // Contar inconsistencias de numeración ANTES de cualquier normalización
    const beforeCounts = runPass(
      "conteo previo de numeración",
      passWarnings,
      () => countNumberingInconsistencies(docContent),
      { options: 0, questions: 0 },
    );

    const marginsRes = runPass(
      "márgenes y tamaño de hoja",
      passWarnings,
      () => applyMarginsString(docContent, template),
      { xml: docContent, created: false },
    );
    docContent = marginsRes.xml;
    sectionCreated = marginsRes.created;

    docContent = runXmlPass(
      "formato de párrafos",
      passWarnings,
      docContent,
      (xml) => applyParagraphFormattingString(xml, template),
    );

    // Colapsar párrafos vacíos consecutivos para evitar huecos enormes entre preguntas
    let blankParagraphsRemoved = 0;
    const collapseRes = runPass(
      "colapso de líneas en blanco",
      passWarnings,
      () => collapseBlankParagraphs(docContent),
      { xml: docContent, removed: 0 },
    );
    docContent = collapseRes.xml;
    blankParagraphsRemoved = collapseRes.removed;

    // Ritmo visual para evaluaciones (preguntas vs opciones)
    let questionsRhythm = 0;
    let optionsRhythm = 0;
    const rhythmRes = runPass(
      "ritmo visual preguntas/opciones",
      passWarnings,
      () => applyQuestionRhythm(docContent, template),
      { xml: docContent, questions: 0, options: 0 },
    );
    docContent = rhythmRes.xml;
    questionsRhythm = rhythmRes.questions;
    optionsRhythm = rhythmRes.options;

    const tablesRes = runPass(
      "optimización de tablas",
      passWarnings,
      () => optimizeTablesString(docContent),
      { xml: docContent, count: 0 },
    );
    docContent = tablesRes.xml;
    tableOptimizations = tablesRes.count;

    const imagesRes = runPass(
      "ajuste de imágenes",
      passWarnings,
      () => fitOversizedImagesString(docContent, template),
      { xml: docContent, count: 0 },
    );
    docContent = imagesRes.xml;
    imageRescales = imagesRes.count;

    docContent = runXmlPass(
      "tipografía directa en runs",
      passWarnings,
      docContent,
      (xml) => forceDirectFontFormatting(xml, template),
    );

    // Normalización de numeración (texto plano + numbering.xml)
    const numberingFile = zip.file("word/numbering.xml");
    let numberingXml = numberingFile ? await numberingFile.async("string") : null;
    const beforeNumBalance = tagBalance(docContent);
    const normRes = runPass(
      "normalización de numeración",
      passWarnings,
      () => normalizeNumbering(docContent, numberingXml),
      {
        documentXml: docContent,
        numberingXml,
        optionsTextFixed: 0,
        questionsTextFixed: 0,
        optionsListFixed: 0,
        questionsListFixed: 0,
        duplicateNumberingStripped: 0,
      },
    );
    // Validar balance post-pasada de numeración; si rompió XML, descartar.
    const afterNumBalance = tagBalance(normRes.documentXml);
    if (
      afterNumBalance.body !== beforeNumBalance.body ||
      afterNumBalance.p !== beforeNumBalance.p ||
      afterNumBalance.r !== beforeNumBalance.r
    ) {
      passWarnings.push(
        `La pasada "normalización de numeración" dejó el XML desbalanceado (p: ${beforeNumBalance.p}→${afterNumBalance.p}, r: ${beforeNumBalance.r}→${afterNumBalance.r}). Se revirtió.`,
      );
      console.warn(`[docx-processor] normalización de numeración revertida`, {
        beforeNumBalance,
        afterNumBalance,
      });
    } else {
      docContent = normRes.documentXml;
      numberingXml = normRes.numberingXml;
    }
    if (numberingFile && numberingXml) {
      zip.file("word/numbering.xml", numberingXml);
    }

    processedStats = computeDocStats(docContent);
    zip.file("word/document.xml", docContent);

    // Auto-QA: comparar antes/después y generar warnings + fixes legibles
    const afterCounts = countNumberingInconsistencies(docContent);
    const autoFixesApplied: string[] = [];
    const warnings: string[] = [...passWarnings];

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
    if (normRes.duplicateNumberingStripped > 0) {
      autoFixesApplied.push(
        `Se eliminó numeración manual duplicada en ${normRes.duplicateNumberingStripped} párrafo(s) (Word ya pintaba la numeración nativa).`,
      );
      changes.push({
        category: "Numeración",
        description: `Numeración manual duplicada removida en ${normRes.duplicateNumberingStripped} párrafo(s).`,
      });
    }

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
    if (blankParagraphsRemoved > 0) {
      changes.push({
        category: "Espaciado",
        description: `Se colapsaron ${blankParagraphsRemoved} línea(s) en blanco entre preguntas para mejorar la densidad.`,
      });
    }
    if (questionsRhythm > 0 || optionsRhythm > 0) {
      changes.push({
        category: "Espaciado",
        description: `Ritmo visual aplicado: ${questionsRhythm} pregunta(s) separadas y ${optionsRhythm} opción(es) compactadas a su pregunta.`,
      });
    }
    void originalDocXml;
  }

  // 3. Encabezado y pie de página
  const headerStyle = template.header.style ?? "classic";
  const isBanner = headerStyle === "banner-evaluacion" || headerStyle === "banner-guia";

  if (isBanner) {
    const bannerRes = await insertInstitutionBanner(
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
    if (bannerRes.replaced) {
      changes.push({
        category: "Encabezado",
        description: `Se reemplazó la tabla de portada existente del documento por el banner institucional.`,
      });
    }
    if (bannerRes.coverRemoved > 0) {
      changes.push({
        category: "Encabezado",
        description: `Se eliminaron ${bannerRes.coverRemoved} párrafo(s) de portada del original (título de evaluación) para evitar duplicación.`,
      });
    }
    if (bannerRes.titlesRemoved > 0) {
      changes.push({
        category: "Encabezado",
        description: `Se eliminaron ${bannerRes.titlesRemoved} título(s) duplicado(s) inmediatamente después del banner.`,
      });
    }
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

  // ===== Sanitización + validación final del ZIP =====
  // Aplicar sanitizers a los XML clave antes de generar el blob.
  // 1) document.xml siempre
  {
    const f = zip.file("word/document.xml");
    if (f) {
      let xml = await f.async("string");
      xml = stripInvalidXmlChars(xml);
      xml = ensureDocumentRootNamespaces(xml);
      xml = ensureBodyParagraphBoundaries(xml);
      zip.file("word/document.xml", xml);
    }
  }
  // 2) Todos los header*.xml y footer*.xml (no solo header1/footer1)
  const headerFooterPaths = Object.keys(zip.files).filter((p) =>
    /^word\/(header|footer)\d*\.xml$/i.test(p),
  );
  for (const path of headerFooterPaths) {
    const f = zip.file(path);
    if (!f) continue;
    let xml = await f.async("string");
    xml = stripInvalidXmlChars(xml);
    const rootTag = /\/header\d*\.xml$/i.test(path) ? "w:hdr" : "w:ftr";
    xml = ensurePartRootNamespaces(xml, rootTag);
    zip.file(path, xml);
  }

  // Validar el resultado y registrar issues como warnings/fatales.
  const validationIssues = await validateProcessedDocx(zip);
  const fatalIssues = validationIssues.filter((i) => i.severity === "fatal");
  const warningIssues = validationIssues.filter((i) => i.severity === "warning");

  if (fatalIssues.length > 0) {
    const detail = fatalIssues
      .map((i) => `${i.part}: ${i.message}`)
      .join(" | ");
    throw new DocxProcessingError(
      "validación final del .docx",
      `El procesamiento generó un .docx inválido. ${detail}`,
    );
  }

  for (const w of warningIssues) {
    extendedDiagnostics.warnings.push(`Validación final (${w.part}): ${w.message}`);
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
 * Convierte imágenes flotantes (`<wp:anchor>`) con wrapping cuadrado/estrecho
 * a imágenes en línea (`<wp:inline>`), para que el texto NO se acomode al
 * costado de la imagen. La intención casi siempre es "imagen debajo de la
 * pregunta, opciones debajo de la imagen" — el wrapping flotante viene de
 * pegar imágenes desde Internet/otros docs y rompe el layout.
 *
 * Excepción: imágenes con `behindDoc="1"` (marca de agua) se preservan.
 *
 * Además, si el `<w:p>` que contiene el `<w:drawing>` también tiene texto,
 * se divide el párrafo para que la imagen quede sola en su propia línea.
 */
function unfloatImagesForLinearLayout(xml: string): { xml: string; converted: number } {
  let converted = 0;

  // Paso 1: convertir cada <wp:anchor> a <wp:inline>, removiendo wrapping y posicionamiento.
  let out = xml.replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/g, (drawingXml) => {
    const anchorMatch = drawingXml.match(/<wp:anchor\b([^>]*)>([\s\S]*?)<\/wp:anchor>/);
    if (!anchorMatch) return drawingXml;

    const anchorAttrs = anchorMatch[1] || "";
    const anchorInner = anchorMatch[2] || "";

    // Excepción: marca de agua / fondo (behindDoc="1")
    if (/\bbehindDoc="1"/.test(anchorAttrs)) return drawingXml;

    // Limpiar elementos de posicionamiento y wrapping
    let cleanedInner = anchorInner;
    cleanedInner = cleanedInner.replace(/<wp:positionH\b[\s\S]*?<\/wp:positionH>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:positionV\b[\s\S]*?<\/wp:positionV>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:simplePos\b[^/]*\/>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:wrapNone\b[^/]*\/>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:wrapSquare\b[\s\S]*?<\/wp:wrapSquare>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:wrapSquare\b[^/]*\/>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:wrapTight\b[\s\S]*?<\/wp:wrapTight>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:wrapThrough\b[\s\S]*?<\/wp:wrapThrough>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:wrapTopAndBottom\b[\s\S]*?<\/wp:wrapTopAndBottom>/g, "");
    cleanedInner = cleanedInner.replace(/<wp:wrapTopAndBottom\b[^/]*\/>/g, "");

    converted++;
    return `<w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">${cleanedInner}</wp:inline></w:drawing>`;
  });

  // Paso 2: aislar drawings en su propio <w:p> si comparten párrafo con texto.
  out = out.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (full, pAttrs, pInner) => {
    const inner = pInner as string;
    if (!/<w:drawing\b/.test(inner)) return full;

    // Extraer pPr (se replica en cada párrafo dividido)
    const pPrMatch = inner.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/);
    const pPr = pPrMatch?.[0] ?? "";
    const afterPPr = pPrMatch ? inner.slice(pPrMatch.index! + pPr.length) : inner;

    // Tokenizar runs y otros elementos top-level
    const runRe = /<w:r\b[^>]*\/>|<w:r\b[^>]*>[\s\S]*?<\/w:r>|<w:hyperlink\b[\s\S]*?<\/w:hyperlink>|<w:bookmarkStart\b[^/]*\/>|<w:bookmarkEnd\b[^/]*\/>|<w:proofErr\b[^/]*\/>/g;
    const tokens: { full: string; hasDrawing: boolean; hasText: boolean }[] = [];
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    while ((m = runRe.exec(afterPPr))) {
      if (m.index > lastIdx) {
        const interstitial = afterPPr.slice(lastIdx, m.index);
        if (interstitial.trim()) tokens.push({ full: interstitial, hasDrawing: false, hasText: false });
      }
      const tk = m[0];
      tokens.push({
        full: tk,
        hasDrawing: /<w:drawing\b/.test(tk),
        hasText: /<w:t\b[^>]*>[\s\S]*?<\/w:t>/.test(tk) && !!extractParagraphText(`<w:p>${tk}</w:p>`).trim(),
      });
      lastIdx = m.index + tk.length;
    }
    if (lastIdx < afterPPr.length) {
      const tail = afterPPr.slice(lastIdx);
      if (tail.trim()) tokens.push({ full: tail, hasDrawing: false, hasText: false });
    }

    const hasAnyText = tokens.some((t) => t.hasText);
    const drawingTokens = tokens.filter((t) => t.hasDrawing);
    if (!hasAnyText || drawingTokens.length === 0) return full;

    // Agrupar runs consecutivos por categoría (texto vs drawing)
    const groups: { tokens: typeof tokens; isDrawing: boolean }[] = [];
    for (const t of tokens) {
      const last = groups[groups.length - 1];
      if (last && last.isDrawing === t.hasDrawing) {
        last.tokens.push(t);
      } else {
        groups.push({ tokens: [t], isDrawing: t.hasDrawing });
      }
    }

    const paragraphs = groups
      .map((g) => {
        const body = g.tokens.map((t) => t.full).join("");
        if (!body.trim()) return "";
        return `<w:p${pAttrs}>${pPr}${body}</w:p>`;
      })
      .filter((p) => p);

    return paragraphs.join("");
  });

  return { xml: out, converted };
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

  // Cachear por r:embed para que imágenes reutilizadas (e.g. la misma foto en
  // varias celdas de una tabla) no se procesen N veces de forma independiente
  // y, sobre todo, no contemos como N reescalados algo que es 1 imagen única.
  const embedsSeen = new Set<string>();
  let count = 0;

  const out = xml.replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/g, (drawingXml) => {
    try {
      // 1) Imágenes ancladas/flotantes: preservar tal cual.
      if (/<wp:anchor\b/.test(drawingXml)) return drawingXml;

      // 2) Imágenes con recorte real: preservar tal cual.
      const srcRectMatch = drawingXml.match(/<a:srcRect\b([^/]*)\/>/);
      if (srcRectMatch) {
        const attrs = srcRectMatch[1] || "";
        const hasCropValue = /\b[lrtb]="(-?\d+)"/.test(attrs)
          && !/^\s*$/.test(attrs)
          && /[1-9]/.test(attrs);
        if (hasCropValue) return drawingXml;
      }

      // 3) Imagen inline: solo reescalar si excede el área imprimible.
      const extentMatch = drawingXml.match(/<wp:extent\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
      if (!extentMatch) return drawingXml; // sin transform: saltar en silencio
      const cx = parseInt(extentMatch[1], 10);
      const cy = parseInt(extentMatch[2], 10);

      if (cx <= usableW && cy <= limitH) return drawingXml;

      const ratioW = cx > usableW ? usableW / cx : 1;
      const ratioH = cy > limitH ? limitH / cy : 1;
      const ratio = Math.min(ratioW, ratioH);
      const newCx = Math.round(cx * ratio);
      const newCy = Math.round(cy * ratio);

      // Detectar r:embed para no contar la misma imagen varias veces.
      const embedMatch = drawingXml.match(/r:embed="([^"]+)"/);
      const embedId = embedMatch?.[1];
      if (embedId) {
        if (!embedsSeen.has(embedId)) {
          embedsSeen.add(embedId);
          count++;
        }
      } else {
        count++;
      }

      let updated = drawingXml.replace(
        /<wp:extent\s+cx="\d+"\s+cy="\d+"\s*\/>/,
        `<wp:extent cx="${newCx}" cy="${newCy}"/>`,
      );
      updated = updated.replace(
        /<a:ext\s+cx="\d+"\s+cy="\d+"\s*\/>/,
        `<a:ext cx="${newCx}" cy="${newCy}"/>`,
      );
      return updated;
    } catch {
      // Drawing con estructura inesperada: dejar intacto en silencio.
      return drawingXml;
    }
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

  // Proteger regiones con <w:p>/<w:r> anidados (cuadros de texto, AlternateContent, sdt)
  // antes de aplicar la regex no codiciosa, que de otro modo cerraría en el </w:r> interior.
  const newBody = withProtectedRegions(body, (maskedBody) =>
    maskedBody.replace(/<w:r\b([^>]*)>([\s\S]*?)<\/w:r>/g, (full, attrs, inner) => {
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
    }),
  );

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
  // Proteger regiones con <w:p> anidados antes de aplicar la regex no codiciosa.
  return withProtectedRegions(xml, (masked) =>
    masked.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (full, attrs, inner) => {
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
    }),
  );
}

/**
 * Colapsa secuencias de párrafos vacíos consecutivos a uno solo, y le quita el
 * spacingBefore/After (deja solo la altura natural de la línea).
 */
function collapseBlankParagraphs(xml: string): { xml: string; removed: number } {
  let removed = 0;

  const newXml = withProtectedRegions(xml, (masked) => {
    return masked.replace(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/, (full, bodyInner) => {
      const tokenRegex =
        /<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>|<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/g;
      const tokens: { full: string; start: number; end: number; isBlankP: boolean }[] = [];
      let tm: RegExpExecArray | null;
      while ((tm = tokenRegex.exec(bodyInner))) {
        const t = tm[0];
        let isBlankP = false;
        if (t.startsWith("<w:p")) {
          const text = extractParagraphText(t).trim();
          const hasDrawing = /<w:drawing\b/.test(t) || /<w:pict\b/.test(t) || /<w:object\b/.test(t);
          const hasNestedSect = /<w:sectPr\b/.test(t);
          isBlankP = !text && !hasDrawing && !hasNestedSect;
        }
        tokens.push({ full: t, start: tm.index, end: tm.index + t.length, isBlankP });
      }

      const toDelete: { start: number; end: number }[] = [];
      let i = 0;
      while (i < tokens.length) {
        if (tokens[i].isBlankP) {
          let j = i + 1;
          while (j < tokens.length && tokens[j].isBlankP) j++;
          for (let k = i + 1; k < j; k++) {
            toDelete.push({ start: tokens[k].start, end: tokens[k].end });
            removed++;
          }
          i = j;
        } else {
          i++;
        }
      }

      let newBodyInner = bodyInner;
      for (let k = toDelete.length - 1; k >= 0; k--) {
        newBodyInner = newBodyInner.slice(0, toDelete[k].start) + newBodyInner.slice(toDelete[k].end);
      }

      newBodyInner = newBodyInner.replace(
        /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g,
        (paragraph) => {
          const text = extractParagraphText(paragraph).trim();
          const hasDrawing = /<w:drawing\b/.test(paragraph) || /<w:pict\b/.test(paragraph) || /<w:object\b/.test(paragraph);
          if (text || hasDrawing) return paragraph;
          const tightSpacing = `<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>`;
          if (/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/.test(paragraph)) {
            return paragraph.replace(
              /<w:pPr\b([^>]*)>([\s\S]*?)<\/w:pPr>/,
              (_f, attrs, inner) => {
                let p = inner as string;
                if (/<w:spacing\b[^/]*\/>/.test(p)) {
                  p = p.replace(/<w:spacing\b[^/]*\/>/, tightSpacing);
                } else if (/<w:spacing\b[^>]*>[\s\S]*?<\/w:spacing>/.test(p)) {
                  p = p.replace(/<w:spacing\b[^>]*>[\s\S]*?<\/w:spacing>/, tightSpacing);
                } else {
                  p = tightSpacing + p;
                }
                return `<w:pPr${attrs}>${p}</w:pPr>`;
              },
            );
          }
          return paragraph.replace(/(<w:p\b[^>]*>)/, `$1<w:pPr>${tightSpacing}</w:pPr>`);
        },
      );

      return full.replace(bodyInner, newBodyInner);
    });
  });

  return { xml: newXml, removed };
}

/**
 * Aplica un ritmo visual específico para evaluaciones:
 *  - Pregunta numerada (1) ó 1.) — spacingBefore 160, after 60
 *  - Opción (a) b) c) d) — spacingBefore 0, after 0
 * Solo activo cuando la plantilla es de evaluación (prefix Ev_).
 */
function applyQuestionRhythm(xml: string, t: FormatTemplate): { xml: string; questions: number; options: number } {
  const isEvaluation = (t.fileNaming?.prefix ?? "").toLowerCase().startsWith("ev_");
  if (!isEvaluation) return { xml, questions: 0, options: 0 };

  let qCount = 0;
  let oCount = 0;
  const questionRe = /^\s*\d+\s*[\)\.\-]/;
  const optionRe = /^\s*[a-eA-E]\s*[\)\.\-]/;
  const headingPrefixRe = /^\s*(I|II|III|IV|V|VI|VII|VIII|IX|X)\s*[\)\.\-]/;

  const questionSpacing = `<w:spacing w:before="160" w:after="60" w:line="276" w:lineRule="auto"/>`;
  const optionSpacing = `<w:spacing w:before="0" w:after="0" w:line="276" w:lineRule="auto"/>`;

  const newXml = withProtectedRegions(xml, (masked) =>
    masked.replace(/<w:p\b([^>]*)>([\s\S]*?)<\/w:p>/g, (full, attrs, inner) => {
      const text = extractParagraphText(full).trim();
      if (!text) return full;
      const pPrMatch = (inner as string).match(/<w:pPr\b[^>]*>([\s\S]*?)<\/w:pPr>/);
      const pStyleMatch = pPrMatch?.[1].match(/<w:pStyle\s+w:val="([^"]+)"/);
      const styleVal = pStyleMatch?.[1] ?? "";
      if (/^Heading\d$/i.test(styleVal) || /^Ttulo\d$/i.test(styleVal) || /^Title$/i.test(styleVal)) {
        return full;
      }

      let newSpacing: string | null = null;
      if (headingPrefixRe.test(text)) {
        return full;
      } else if (questionRe.test(text)) {
        newSpacing = questionSpacing;
        qCount++;
      } else if (optionRe.test(text) && text.length < 200) {
        newSpacing = optionSpacing;
        oCount++;
      }

      if (!newSpacing) return full;

      let updatedInner = inner as string;
      if (pPrMatch) {
        updatedInner = updatedInner.replace(
          /<w:pPr\b([^>]*)>([\s\S]*?)<\/w:pPr>/,
          (_f, pAttrs, pInner) => {
            let p = pInner as string;
            if (/<w:spacing\b[^/]*\/>/.test(p)) {
              p = p.replace(/<w:spacing\b[^/]*\/>/, newSpacing!);
            } else if (/<w:spacing\b[^>]*>[\s\S]*?<\/w:spacing>/.test(p)) {
              p = p.replace(/<w:spacing\b[^>]*>[\s\S]*?<\/w:spacing>/, newSpacing!);
            } else {
              p = newSpacing! + p;
            }
            return `<w:pPr${pAttrs}>${p}</w:pPr>`;
          },
        );
      } else {
        updatedInner = `<w:pPr>${newSpacing}</w:pPr>` + updatedInner;
      }
      return `<w:p${attrs}>${updatedInner}</w:p>`;
    }),
  );

  return { xml: newXml, questions: qCount, options: oCount };
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
  // Solo eliminar la referencia "default" existente (preservar "first" y "even").
  const removeDefaultRegex = new RegExp(
    `<w:${refName}\\b[^/]*\\bw:type="default"[^/]*/>`,
    "g",
  );

  content = content.replace(/<w:sectPr\b[^>]*>([\s\S]*?)<\/w:sectPr>/g, (full, inner) => {
    let updated = (inner as string).replace(removeDefaultRegex, "");
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
/**
 * Detecta si el documento ya trae un encabezado/portada equivalente al banner del colegio.
 * Solo revisa los primeros ~6 elementos del body (suficiente para portada,
 * sin tocar contenido posterior).
 *
 *  - "table-banner": hay una tabla al inicio cuyo texto contiene 2+ palabras clave de banner.
 *  - "title-only": no hay tabla pero hay 1-4 párrafos al inicio con texto tipo "EVALUACIÓN…".
 *  - "none": ni tabla ni texto de portada — inyectar normal.
 */
type BannerDetection =
  | { kind: "none" }
  | { kind: "table-banner"; tableXml: string; hadDrawing: boolean }
  | { kind: "title-only"; paragraphs: string[] };

const BANNER_KEYWORDS = [
  "profesor",
  "asignatura",
  "curso",
  "calificación",
  "calificacion",
  "puntaje",
  "fecha",
  "nombre",
  "alumno",
  "estudiante",
];

const COVER_TITLE_KEYWORDS = [
  "evaluación",
  "evaluacion",
  "guía",
  "guia",
  "prueba",
  "control",
];

function detectExistingBanner(docContent: string): BannerDetection {
  const bodyMatch = docContent.match(/<w:body\b[^>]*>([\s\S]*?)<\/w:body>/);
  if (!bodyMatch) return { kind: "none" };
  const body = bodyMatch[1];

  // Capturar los primeros ~6 hijos directos del body (tablas o párrafos)
  const childRegex = /<w:(tbl|p)\b[^>]*>[\s\S]*?<\/w:\1>|<w:p\b[^>]*\/>/g;
  const firstChildren: { tag: "tbl" | "p"; xml: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = childRegex.exec(body)) && firstChildren.length < 6) {
    const xml = m[0];
    const tag = xml.startsWith("<w:tbl") ? "tbl" : "p";
    firstChildren.push({ tag, xml });
  }
  if (firstChildren.length === 0) return { kind: "none" };

  // Caso 1 — primera tabla en los primeros 3 elementos
  const firstThree = firstChildren.slice(0, 3);
  const firstTableIdx = firstThree.findIndex((c) => c.tag === "tbl");
  if (firstTableIdx >= 0) {
    const tableXml = firstThree[firstTableIdx].xml;
    const tableText = extractParagraphText(tableXml).toLowerCase();
    let hits = 0;
    for (const kw of BANNER_KEYWORDS) {
      if (tableText.includes(kw)) hits++;
    }
    if (hits >= 2) {
      const hadDrawing = /<w:drawing\b/.test(tableXml) || /<w:pict\b/.test(tableXml);
      return { kind: "table-banner", tableXml, hadDrawing };
    }
  }

  // Caso 2 — sin tabla al inicio, párrafos de portada
  if (firstTableIdx < 0) {
    const coverParagraphs: string[] = [];
    for (const c of firstChildren.slice(0, 4)) {
      if (c.tag !== "p") break;
      const txt = extractParagraphText(c.xml).toLowerCase().trim();
      if (!txt) {
        // párrafo vacío, lo arrastramos como "portada"
        coverParagraphs.push(c.xml);
        continue;
      }
      const isCover = COVER_TITLE_KEYWORDS.some((kw) => txt.includes(kw));
      if (isCover) {
        coverParagraphs.push(c.xml);
      } else {
        break;
      }
    }
    // Considerar portada solo si hay al menos un párrafo con palabra clave
    const hasRealCover = coverParagraphs.some((p) => {
      const t = extractParagraphText(p).toLowerCase().trim();
      return t && COVER_TITLE_KEYWORDS.some((kw) => t.includes(kw));
    });
    if (hasRealCover) return { kind: "title-only", paragraphs: coverParagraphs };
  }

  return { kind: "none" };
}

/**
 * Después de insertar el banner, eliminar los próximos 3 párrafos que dupliquen
 * texto que ya quedó dentro del banner (asignatura, curso, profesor, "EVALUACIÓN").
 */
function dedupeAdjacentTitles(
  docContent: string,
  bannerInsertedAfter: string,
  bannerKeywords: string[],
): { xml: string; removed: number } {
  const idx = docContent.indexOf(bannerInsertedAfter);
  if (idx < 0) return { xml: docContent, removed: 0 };

  // Posición justo después del banner insertado
  const startSearch = idx + bannerInsertedAfter.length;
  const tail = docContent.slice(startSearch);

  // Capturar hasta 4 párrafos siguientes (saltamos el <w:p> de cierre del banner)
  const paragraphRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>|<w:p\b[^>]*\/>/g;
  paragraphRegex.lastIndex = 0;
  const matches: { xml: string; index: number; length: number }[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = paragraphRegex.exec(tail)) && matches.length < 4) {
    matches.push({ xml: pm[0], index: pm.index, length: pm[0].length });
  }

  const lowerKeywords = bannerKeywords.map((k) => k.toLowerCase()).filter((k) => k.length >= 4);
  const toRemove: { index: number; length: number }[] = [];
  for (const p of matches) {
    const text = extractParagraphText(p.xml).toLowerCase().trim();
    if (!text) continue;
    // Si el párrafo es corto y todo su contenido aparece dentro de las keywords del banner
    const isDuplicate = lowerKeywords.some((kw) => text.includes(kw)) && text.length < 120;
    if (isDuplicate) toRemove.push({ index: p.index, length: p.length });
  }

  if (toRemove.length === 0) return { xml: docContent, removed: 0 };

  // Reconstruir tail eliminando de atrás hacia adelante
  let newTail = tail;
  for (let i = toRemove.length - 1; i >= 0; i--) {
    newTail = newTail.slice(0, toRemove[i].index) + newTail.slice(toRemove[i].index + toRemove[i].length);
  }
  return { xml: docContent.slice(0, startSearch) + newTail, removed: toRemove.length };
}

async function insertInstitutionBanner(
  zip: JSZip,
  t: FormatTemplate,
  teacherLabel: string,
  subjectLabel: string,
  gradeLabel: string,
  logoDataUrl: string | null,
  showCalificacion: boolean,
): Promise<{ replaced: boolean; coverRemoved: number; titlesRemoved: number }> {
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) return { replaced: false, coverRemoved: 0, titlesRemoved: 0 };
  let docContent = await documentFile.async("string");

  // 0) Detectar portada existente y limpiarla antes de inyectar
  const detection = detectExistingBanner(docContent);
  let replaced = false;
  let coverRemoved = 0;
  if (detection.kind === "table-banner") {
    docContent = docContent.replace(detection.tableXml, "");
    replaced = true;
  } else if (detection.kind === "title-only") {
    for (const p of detection.paragraphs) {
      docContent = docContent.replace(p, "");
      coverRemoved++;
    }
  }

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

  // OOXML: <w:tbl> no puede ser el primer ni último hijo del body. Envolvemos
  // siempre con <w:p/> antes y un <w:p> con espaciado después.
  const tableXml =
    `<w:p/>` +
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

  // 4) Asegurar namespaces en el root antes de inyectar drawing/banner.
  docContent = ensureDocumentRootNamespaces(docContent);

  // 5) Inyectar justo después de <w:body ...> (apertura)
  let bodyOpen = "";
  docContent = docContent.replace(
    /<w:body\b[^>]*>/,
    (match) => {
      bodyOpen = match;
      return `${match}${tableXml}`;
    },
  );

  // 6) Eliminar títulos sueltos inmediatamente después del banner que dupliquen
  //    contenido (asignatura, curso, etc).
  const dedupeKeywords = [
    teacherLabel,
    subjectLabel,
    gradeLabel,
    "evaluación sumativa",
    "evaluación formativa",
    "evaluacion sumativa",
    "evaluacion formativa",
    "guía de portafolio",
    "guia de portafolio",
  ].filter((s) => s && s.trim().length >= 4);
  const dedupeRes = dedupeAdjacentTitles(docContent, bodyOpen + tableXml, dedupeKeywords);
  docContent = dedupeRes.xml;

  zip.file("word/document.xml", docContent);
  return { replaced, coverRemoved, titlesRemoved: dedupeRes.removed };
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
  duplicateNumberingStripped: number;
} {
  let optionsTextFixed = 0;
  let questionsTextFixed = 0;
  let optionsListFixed = 0;
  let questionsListFixed = 0;
  let duplicateNumberingStripped = 0;

  // 1) Texto plano: solo tocar el primer <w:t> de cada párrafo cuyo TEXTO COMPLETO
  // del párrafo arranque con un patrón de opción/pregunta no canónico.
  const bodyMatch = documentXml.match(/(<w:body\b[^>]*>)([\s\S]*)(<\/w:body>)/);
  let outDoc = documentXml;
  if (bodyMatch) {
    const open = bodyMatch[1];
    const body = bodyMatch[2];
    const close = bodyMatch[3];

    // Proteger regiones con <w:p> anidados (txbxContent, mc:AlternateContent, sdt)
    // antes de iterar con regex no codiciosa.
    const newBody = withProtectedRegions(body, (maskedBody) =>
      maskedBody.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
        const text = extractParagraphText(paragraph);
        if (!text) return paragraph;

        // 1a) Doble numeración: párrafo con <w:numPr> Y texto que empieza con
        // numeración manual (1), 1., a), a., etc.). Word ya pinta la nativa,
        // así que eliminamos la manual del texto para evitar "1) 1) Texto…".
        const hasNumPr = /<w:numPr\b/.test(paragraph);
        if (hasNumPr) {
          const manualPrefix = text.match(/^(?:\d{1,2}|[a-zA-Z])\s*[.)\-]\s+/);
          if (manualPrefix) {
            const newPara = paragraph.replace(
              /(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/,
              (_full, openT, content, closeT) => {
                const updated = (content as string).replace(
                  /^(\s*)(?:\d{1,2}|[a-zA-Z])\s*[.)\-]\s+/,
                  (_m, lead) => lead,
                );
                return `${openT}${updated}${closeT}`;
              },
            );
            if (newPara !== paragraph) {
              duplicateNumberingStripped++;
              return newPara;
            }
          }
          return paragraph;
        }

        // Opción no canónica
        const optMatch = text.match(/^([a-zA-Z])\s*([.\-)])\s+/);
        if (optMatch) {
          const letter = optMatch[1];
          const sep = optMatch[2];
          if (!(letter === letter.toLowerCase() && sep === ")")) {
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
      }),
    );

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
    duplicateNumberingStripped,
  };
}
