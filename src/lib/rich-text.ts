// Helpers para texto enriquecido mínimo (negrita / cursiva / subrayado / saltos).
// Soporta solo: <b>, <strong>, <i>, <em>, <u>, <br>.
// Cualquier otro tag o atributo se descarta. El texto restante se escapa.

import { TextRun } from "docx";

const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "br"]);

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * Sanitiza HTML reducido: deja pasar solo los tags de la whitelist (sin atributos)
 * y escapa el resto del contenido. Devuelve HTML seguro para inyectar.
 */
export function sanitizeRichText(input: string): string {
  if (!input) return "";
  // Tokeniza en partes: texto vs tag.
  const out: string[] = [];
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    const before = input.slice(lastIndex, m.index);
    if (before) out.push(escapeHtml(before));
    const tag = m[1].toLowerCase();
    const isClose = m[0].startsWith("</");
    if (ALLOWED_TAGS.has(tag)) {
      if (tag === "br") {
        out.push("<br/>");
      } else {
        out.push(isClose ? `</${tag}>` : `<${tag}>`);
      }
    }
    // tags no permitidos: se descartan completamente
    lastIndex = m.index + m[0].length;
  }
  const tail = input.slice(lastIndex);
  if (tail) out.push(escapeHtml(tail));
  return out.join("");
}

/**
 * Extrae texto plano de un HTML reducido (para previews, búsqueda, etc.).
 */
export function richTextToPlain(input: string): string {
  if (!input) return "";
  return input
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ");
}

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  size?: number;
}

interface BaseStyle {
  size?: number;
  bold?: boolean;
}

/**
 * Convierte HTML reducido en un array de TextRun para docx.
 * Aplica bold/italic/underline según los tags activos en cada fragmento.
 */
export function richTextToRuns(input: string, base: BaseStyle = {}): TextRun[] {
  const html = sanitizeRichText(input ?? "");
  const runs: TextRun[] = [];
  const stack: { bold: boolean; italics: boolean; underline: boolean }[] = [
    { bold: !!base.bold, italics: false, underline: false },
  ];

  const pushText = (text: string) => {
    if (!text) return;
    // Decodifica entidades básicas (sanitize ya escapó).
    const decoded = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/g, " ");
    const top = stack[stack.length - 1];
    const opts: RunStyle & { text: string } = {
      text: decoded,
      bold: top.bold,
      italics: top.italics,
      size: base.size,
    };
    if (top.underline) {
      runs.push(new TextRun({ ...opts, underline: {} }));
    } else {
      runs.push(new TextRun(opts));
    }
  };

  const re = /<\/?([a-zA-Z]+)\s*\/?>/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const before = html.slice(lastIndex, m.index);
    if (before) pushText(before);
    const tag = m[1].toLowerCase();
    const isClose = m[0].startsWith("</");
    const top = stack[stack.length - 1];
    if (tag === "br") {
      runs.push(new TextRun({ break: 1, size: base.size }));
    } else if (tag === "b" || tag === "strong") {
      stack.push({ ...top, bold: !isClose ? true : top.bold });
      if (isClose) stack.pop();
    } else if (tag === "i" || tag === "em") {
      if (!isClose) stack.push({ ...top, italics: true });
      else stack.pop();
    } else if (tag === "u") {
      if (!isClose) stack.push({ ...top, underline: true });
      else stack.pop();
    }
    lastIndex = m.index + m[0].length;
  }
  const tail = html.slice(lastIndex);
  if (tail) pushText(tail);

  if (runs.length === 0) {
    runs.push(new TextRun({ text: "", size: base.size, bold: !!base.bold }));
  }
  return runs;
}
