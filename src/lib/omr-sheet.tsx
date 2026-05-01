// === Hoja de Respuestas OMR (Optical Mark Recognition) ===
// Geometría calibrada en milímetros, lista para escaneo posterior.
// Layout (A4 portrait, 210 × 297 mm):
//   - 4 marcas fiduciales (cuadrados negros 10×10 mm) a 8 mm de cada esquina.
//   - Header institucional + ID de prueba (texto + Code 128).
//   - Bloque RUT: 8 dígitos + 1 dígito verificador (0–9 / K).
//   - Grilla de respuestas: 5 burbujas (A–E) por pregunta.
//   - 1 columna si N ≤ 35 preguntas; 2 columnas si N > 35.
//
// Esta hoja se renderiza como SVG en una <iframe> oculta y se imprime con
// window.print(). El SVG mantiene proporciones exactas en mm.

import type { Assessment } from "./assessment-schema";
import type { Student } from "./courses";
import { formatRut } from "./rut";

// ---- Constantes de geometría (mm) ----
const PAGE_W = 210;
const PAGE_H = 297;
const FIDUCIAL_SIZE = 10;
const FIDUCIAL_MARGIN = 8;
const CONTENT_MARGIN = 22; // margen útil interno (deja espacio para fiduciales)

const BUBBLE_R = 2.4;       // radio burbuja (mm)
const BUBBLE_DX = 7;        // separación horizontal entre burbujas
const ROW_H = 6.5;          // alto de fila (pregunta)
const ROW_LABEL_W = 9;      // ancho del label "1." "2." ...
const COL_GAP = 14;         // separación entre columnas de preguntas

const RUT_BUBBLE_R = 2.0;
const RUT_DX = 5.5;         // separación entre columnas RUT
const RUT_DY = 5.0;         // separación entre filas RUT (0–9 / K)

const OPTIONS = ["A", "B", "C", "D", "E"] as const;
const RUT_DIGITS = ["0","1","2","3","4","5","6","7","8","9","K"] as const;

export interface OmrOptions {
  /** Pre-rellena nombre/RUT del alumno (modo Operacional). Si null → modo Entrenamiento. */
  student?: Pick<Student, "first_name" | "last_name" | "rut"> | null;
  courseName?: string;
  institutionName: string;
  assessmentTitle: string;
  assessmentId: string;
}

// ---- Helpers SVG ----
const rect = (x: number, y: number, w: number, h: number, fill = "#000", stroke = "none") =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" />`;

const circle = (cx: number, cy: number, r: number, filled = false) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${filled ? "#000" : "#fff"}" stroke="#000" stroke-width="0.35" />`;

const text = (x: number, y: number, content: string, opts: { size?: number; bold?: boolean; anchor?: "start" | "middle" | "end" } = {}) => {
  const { size = 2.5, bold = false, anchor = "start" } = opts;
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" text-anchor="${anchor}" ${bold ? 'font-weight="700"' : ""}>${escapeXml(content)}</text>`;
};

const escapeXml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!),
  );

// ---- Marcas fiduciales (4 esquinas + 1 esquina superior-derecha invertida como
//      "marca de orientación" para distinguir top/bottom durante el escaneo). ----
function fiducialMarks(): string {
  const m = FIDUCIAL_MARGIN;
  const s = FIDUCIAL_SIZE;
  return [
    rect(m, m, s, s),                             // top-left
    rect(PAGE_W - m - s, m, s, s),                // top-right
    rect(m, PAGE_H - m - s, s, s),                // bottom-left
    rect(PAGE_W - m - s, PAGE_H - m - s, s, s),   // bottom-right
    // Marca de orientación (círculo blanco dentro del fiducial top-right)
    `<circle cx="${PAGE_W - m - s / 2}" cy="${m + s / 2}" r="2" fill="#fff" />`,
  ].join("");
}

// ---- Bloque RUT (9 columnas: 8 dígitos + DV) ----
function rutBlock(x: number, y: number, prefilled?: string): string {
  const cleanRut = (prefilled ?? "").replace(/[.\-\s]/g, "").toUpperCase();
  // Padding a 9 chars: 8 dígitos + DV. Si el RUT tiene menos, se alinea a la derecha.
  const padded = cleanRut.padStart(9, " ");
  const cols = 9;
  const headerH = 4;

  const out: string[] = [];
  out.push(text(x, y, "RUT", { size: 3, bold: true }));
  out.push(text(x + cols * RUT_DX, y, "(sin puntos ni guión)", { size: 2.2, anchor: "end" }));

  // Cabecera con el dígito escrito a mano por el alumno
  const boxY = y + 2;
  const boxH = 5;
  for (let c = 0; c < cols; c++) {
    const cx = x + c * RUT_DX;
    out.push(rect(cx, boxY, RUT_DX - 1, boxH, "#fff", "#000"));
    const ch = padded[c];
    if (ch && ch !== " ") {
      out.push(text(cx + (RUT_DX - 1) / 2, boxY + 3.6, ch, { size: 3, bold: true, anchor: "middle" }));
    }
  }

  // Burbujas 0–9 + K
  const bubblesY0 = boxY + boxH + headerH;
  for (let r = 0; r < RUT_DIGITS.length; r++) {
    const digit = RUT_DIGITS[r];
    const cy = bubblesY0 + r * RUT_DY;
    // Etiqueta a la izquierda
    out.push(text(x - 2, cy + 0.9, digit, { size: 2.4, anchor: "end" }));
    for (let c = 0; c < cols; c++) {
      const cx = x + c * RUT_DX + (RUT_DX - 1) / 2;
      // La última columna (DV) acepta K; el resto solo 0–9.
      if (digit === "K" && c !== cols - 1) continue;
      const filled = padded[c] === digit;
      out.push(circle(cx, cy, RUT_BUBBLE_R, filled));
    }
  }
  return out.join("");
}

// ---- Grilla de respuestas ----
interface AnswerGridResult {
  svg: string;
  /** Y final (mm) tras dibujar la grilla. */
  endY: number;
}

function answerGrid(x: number, y: number, totalQuestions: number, maxColHeight: number): AnswerGridResult {
  const rowsPerCol = Math.min(Math.ceil(totalQuestions / 2), Math.floor(maxColHeight / ROW_H));
  const useTwoCols = totalQuestions > rowsPerCol;
  const cols = useTwoCols ? 2 : 1;
  const colWidth = ROW_LABEL_W + OPTIONS.length * BUBBLE_DX;

  const out: string[] = [];

  // Cabecera de cada columna: A B C D E
  for (let c = 0; c < cols; c++) {
    const cx0 = x + c * (colWidth + COL_GAP) + ROW_LABEL_W;
    OPTIONS.forEach((opt, i) => {
      out.push(text(cx0 + i * BUBBLE_DX, y - 1, opt, { size: 2.4, bold: true, anchor: "middle" }));
    });
  }

  for (let q = 1; q <= totalQuestions; q++) {
    const colIdx = useTwoCols ? (q - 1) >= rowsPerCol ? 1 : 0 : 0;
    const rowIdx = useTwoCols ? (q - 1) % rowsPerCol : q - 1;
    if (rowIdx >= rowsPerCol) break; // saturación de espacio
    const rx = x + colIdx * (colWidth + COL_GAP);
    const ry = y + rowIdx * ROW_H + 2;
    out.push(text(rx, ry + 0.9, `${q}.`, { size: 2.6, bold: true }));
    OPTIONS.forEach((_opt, i) => {
      out.push(circle(rx + ROW_LABEL_W + i * BUBBLE_DX, ry, BUBBLE_R));
    });
  }

  const endY = y + rowsPerCol * ROW_H + 2;
  return { svg: out.join(""), endY };
}

// ---- Header institucional + ID prueba ----
function header(x: number, y: number, opts: OmrOptions): string {
  const out: string[] = [];
  out.push(text(x, y, opts.institutionName, { size: 4, bold: true }));
  out.push(text(x, y + 5, opts.assessmentTitle, { size: 3 }));
  if (opts.courseName) out.push(text(x, y + 9, `Curso: ${opts.courseName}`, { size: 2.6 }));

  // ID de prueba (legible para humanos + máquina)
  const idShort = opts.assessmentId.slice(0, 8);
  out.push(text(PAGE_W - CONTENT_MARGIN, y, `ID: ${idShort}`, { size: 2.6, bold: true, anchor: "end" }));

  // Pseudocódigo de barras visual (líneas verticales basadas en el hash del id)
  // Sirve como ancla visual; el OMR final puede usar QR posterior.
  const barX = PAGE_W - CONTENT_MARGIN - 40;
  const barY = y + 3;
  const seed = opts.assessmentId;
  const bars: string[] = [];
  for (let i = 0; i < 40; i++) {
    const ch = seed.charCodeAt(i % seed.length);
    const w = (ch % 3) * 0.3 + 0.3;
    bars.push(rect(barX + i, barY, w, 5, "#000"));
  }
  out.push(bars.join(""));
  return out.join("");
}

// ---- Identificación del alumno (apellido / nombres) ----
function studentBlock(x: number, y: number, opts: OmrOptions): string {
  const s = opts.student;
  const fullName = s ? `${s.last_name}, ${s.first_name}` : "";
  return [
    text(x, y, "Apellido y Nombres:", { size: 2.6, bold: true }),
    rect(x + 32, y - 3.5, PAGE_W - CONTENT_MARGIN - x - 32, 5, "#fff", "#000"),
    fullName ? text(x + 33, y, fullName, { size: 2.8 }) : "",
    text(x, y + 7, "Curso:", { size: 2.6, bold: true }),
    rect(x + 14, y + 3.5, 50, 5, "#fff", "#000"),
    opts.courseName ? text(x + 15, y + 7, opts.courseName, { size: 2.8 }) : "",
    text(x + 70, y + 7, "Fecha:", { size: 2.6, bold: true }),
    rect(x + 84, y + 3.5, 40, 5, "#fff", "#000"),
  ].join("");
}

// ---- Render principal ----
export function renderOmrSheetSvg(assessment: Assessment, opts: OmrOptions): string {
  // Cuenta solo preguntas reales (excluye section-title / info-block).
  const totalQ = assessment.questions.filter(
    (q) => q.type !== "section-title" && q.type !== "info-block",
  ).length;

  const safeTotal = Math.max(1, totalQ);

  // Layout
  const headerY = CONTENT_MARGIN;
  const studentY = headerY + 14;
  const rutY = studentY + 14;
  const rutBlockHeight = 4 + 4 + RUT_DIGITS.length * RUT_DY + 4;

  const gridY = rutY + rutBlockHeight + 8;
  const maxColHeight = PAGE_H - gridY - CONTENT_MARGIN;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}mm" height="${PAGE_H}mm">`);
  parts.push(`<rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff" />`);
  parts.push(fiducialMarks());
  parts.push(header(CONTENT_MARGIN, headerY, opts));
  // Línea separadora
  parts.push(rect(CONTENT_MARGIN, headerY + 11, PAGE_W - 2 * CONTENT_MARGIN, 0.3, "#000"));
  parts.push(studentBlock(CONTENT_MARGIN, studentY, opts));
  parts.push(rutBlock(CONTENT_MARGIN, rutY, opts.student?.rut));

  // Instrucciones a la derecha del bloque RUT
  const instrX = CONTENT_MARGIN + 60;
  parts.push(text(instrX, rutY, "INSTRUCCIONES", { size: 3, bold: true }));
  const lines = [
    "1. Use lápiz grafito N° 2 o portaminas HB.",
    "2. Ennegrezca completamente el círculo elegido.",
    "3. Marque solo UNA alternativa por pregunta.",
    "4. Si se equivoca, borre completamente y vuelva a marcar.",
    "5. No doble, manche ni rompa esta hoja.",
    "",
    "Ejemplo correcto:  ●",
    "Ejemplo incorrecto: ✓  ✗  ⊘",
  ];
  lines.forEach((ln, i) => parts.push(text(instrX, rutY + 4 + i * 3.5, ln, { size: 2.4 })));

  // Grilla de respuestas
  parts.push(text(CONTENT_MARGIN, gridY - 3, "RESPUESTAS", { size: 3.2, bold: true }));
  const grid = answerGrid(CONTENT_MARGIN, gridY, safeTotal, maxColHeight);
  parts.push(grid.svg);

  // Footer con conteo
  parts.push(
    text(
      PAGE_W - CONTENT_MARGIN,
      PAGE_H - CONTENT_MARGIN - 2,
      `${safeTotal} preguntas · ${OPTIONS.length} alternativas`,
      { size: 2.4, anchor: "end" },
    ),
  );

  parts.push("</svg>");
  return parts.join("");
}

// ---- Render de múltiples hojas (una por alumno o solo una en blanco) ----
export function renderOmrDocument(
  assessment: Assessment,
  baseOpts: Omit<OmrOptions, "student">,
  students: Student[] | null,
): string {
  const sheets: string[] = [];
  if (students && students.length > 0) {
    for (const s of students) {
      sheets.push(
        `<div class="omr-page">${renderOmrSheetSvg(assessment, {
          ...baseOpts,
          student: { first_name: s.first_name, last_name: s.last_name, rut: formatRut(s.rut) },
        })}</div>`,
      );
    }
  } else {
    sheets.push(`<div class="omr-page">${renderOmrSheetSvg(assessment, { ...baseOpts, student: null })}</div>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><title>Hoja de Respuestas — ${escapeXml(baseOpts.assessmentTitle)}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .omr-page { width: 210mm; height: 297mm; page-break-after: always; overflow: hidden; }
  .omr-page:last-child { page-break-after: auto; }
  svg { display: block; }
  @media screen {
    body { background: #ddd; padding: 10mm; }
    .omr-page { box-shadow: 0 2px 12px rgba(0,0,0,.2); margin: 0 auto 10mm; background: #fff; }
  }
</style></head><body>${sheets.join("")}<script>window.addEventListener('load',()=>{setTimeout(()=>window.print(),350)});</script></body></html>`;
}

// ---- Apertura en ventana nueva e impresión ----
export function openOmrPrintWindow(html: string) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) {
    throw new Error("El navegador bloqueó la ventana emergente. Permite popups para imprimir la hoja OMR.");
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
