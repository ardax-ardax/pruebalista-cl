// === Hoja de Respuestas OMR (Optical Mark Recognition) ===
// Geometría calibrada en milímetros (ver `omr-geometry.ts`), lista para
// corrección automática por foto.
//
// Layout (A4 portrait, 210 × 297 mm):
//   - 4 marcas fiduciales (cuadrados negros 10×10 mm) a 8 mm de cada esquina.
//   - QR con el ID de la prueba (identificación automática al escanear).
//   - Bloque RUT: 8 dígitos + 1 dígito verificador (0–9 / K).
//   - Grilla de respuestas: A–E en selección múltiple, V/F en verdadero-falso.

import QRCode from "qrcode";
import type { Assessment } from "./assessment-schema";
import type { Student } from "./courses";
import { formatRut } from "./rut";
import {
  BUBBLE_R,
  CONTENT_MARGIN,
  FIDUCIAL_MARGIN,
  FIDUCIAL_SIZE,
  GRID_Y,
  HEADER_Y,
  OPTIONS,
  PAGE_H,
  PAGE_W,
  QR_SIZE,
  QR_X,
  QR_Y,
  ROW_LABEL_W,
  RUT_BOX_H,
  RUT_BOX_Y,
  RUT_BUBBLE_R,
  RUT_COLS,
  RUT_DIGITS,
  RUT_DX,
  RUT_Y,
  STUDENT_Y,
  buildAnswerSlots,
  buildQrPayload,
  computeOmrLayout,
  rutBubblePositions,
  type OmrLayout,
} from "./omr-geometry";

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

const text = (
  x: number,
  y: number,
  content: string,
  opts: { size?: number; bold?: boolean; anchor?: "start" | "middle" | "end" } = {},
) => {
  const { size = 2.5, bold = false, anchor = "start" } = opts;
  return `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" text-anchor="${anchor}" ${bold ? 'font-weight="700"' : ""}>${escapeXml(content)}</text>`;
};

const escapeXml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]!),
  );

// ---- Marcas fiduciales ----
function fiducialMarks(): string {
  const m = FIDUCIAL_MARGIN;
  const s = FIDUCIAL_SIZE;
  return [
    rect(m, m, s, s),
    rect(PAGE_W - m - s, m, s, s),
    rect(m, PAGE_H - m - s, s, s),
    rect(PAGE_W - m - s, PAGE_H - m - s, s, s),
  ].join("");
}

// ---- QR (dibujado como matriz de rectángulos, sin dependencia de canvas) ----
function qrSvg(payload: string, x: number, y: number, size: number): string {
  try {
    const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
    const count = qr.modules.size;
    const data = qr.modules.data;
    const quiet = 2; // módulos de margen blanco
    const unit = size / (count + quiet * 2);
    const parts: string[] = [rect(x, y, size, size, "#fff")];
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (data[r * count + c]) {
          parts.push(
            rect(
              x + (c + quiet) * unit,
              y + (r + quiet) * unit,
              unit + 0.02,
              unit + 0.02,
              "#000",
            ),
          );
        }
      }
    }
    return parts.join("");
  } catch {
    return "";
  }
}

// ---- Bloque RUT ----
function rutBlock(prefilled?: string): string {
  const x = CONTENT_MARGIN;
  const y = RUT_Y;
  const cleanRut = (prefilled ?? "").replace(/[.\-\s]/g, "").toUpperCase();
  const padded = cleanRut.padStart(RUT_COLS, " ");

  const out: string[] = [];
  out.push(text(x, y, "RUT", { size: 3, bold: true }));
  out.push(text(x + RUT_COLS * RUT_DX, y, "(sin puntos ni guión)", { size: 2.2, anchor: "end" }));

  for (let c = 0; c < RUT_COLS; c++) {
    const cx = x + c * RUT_DX;
    out.push(rect(cx, RUT_BOX_Y, RUT_DX - 1, RUT_BOX_H, "#fff", "#000"));
    const ch = padded[c];
    if (ch && ch !== " ") {
      out.push(text(cx + (RUT_DX - 1) / 2, RUT_BOX_Y + 3.6, ch, { size: 3, bold: true, anchor: "middle" }));
    }
  }

  // Etiquetas 0–9 / K a la izquierda
  const positions = rutBubblePositions();
  const seenRows = new Set<string>();
  for (const p of positions) {
    if (!seenRows.has(p.digit)) {
      seenRows.add(p.digit);
      out.push(text(x - 2, p.yMm + 0.9, p.digit, { size: 2.4, anchor: "end" }));
    }
    out.push(circle(p.xMm, p.yMm, RUT_BUBBLE_R, padded[p.col] === p.digit));
  }
  return out.join("");
}

// ---- Grilla de respuestas ----
function answerGrid(layout: OmrLayout): string {
  const out: string[] = [];

  // Cabecera A B C D E por columna
  for (let c = 0; c < layout.cols; c++) {
    const cx0 = CONTENT_MARGIN + c * (layout.colWidth + 14) + ROW_LABEL_W;
    OPTIONS.forEach((opt, i) => {
      out.push(text(cx0 + i * 7, layout.gridY - 1, opt, { size: 2.4, bold: true, anchor: "middle" }));
    });
  }

  for (const row of layout.rows) {
    const slot = layout.slots[row.slotIndex];
    out.push(text(row.xMm, row.yMm + 0.9, `${slot.num}.`, { size: 2.6, bold: true }));
  }

  for (const b of layout.bubbles) {
    const slot = layout.slots[b.slotIndex];
    out.push(circle(b.xMm, b.yMm, BUBBLE_R));
    // En V/F, se rotula V y F bajo las dos primeras burbujas.
    if (slot.kind === "tf") {
      out.push(
        text(b.xMm, b.yMm + 0.9, b.optionIndex === 0 ? "V" : "F", {
          size: 1.9,
          anchor: "middle",
        }),
      );
    }
  }

  return out.join("");
}

// ---- Header institucional + ID prueba ----
function header(opts: OmrOptions, slotCount: number): string {
  const x = CONTENT_MARGIN;
  const y = HEADER_Y;
  const out: string[] = [];
  out.push(text(x, y, opts.institutionName, { size: 4, bold: true }));
  out.push(text(x, y + 5, opts.assessmentTitle, { size: 3 }));
  if (opts.courseName) out.push(text(x, y + 9, `Curso: ${opts.courseName}`, { size: 2.6 }));

  // QR + ID legible
  out.push(qrSvg(buildQrPayload(opts.assessmentId, slotCount), QR_X, QR_Y, QR_SIZE));
  out.push(
    text(QR_X + QR_SIZE / 2, QR_Y + QR_SIZE + 2.6, `ID ${opts.assessmentId.slice(0, 8)}`, {
      size: 2.2,
      bold: true,
      anchor: "middle",
    }),
  );
  return out.join("");
}

// ---- Identificación del alumno ----
function studentBlock(opts: OmrOptions): string {
  const x = CONTENT_MARGIN;
  const y = STUDENT_Y;
  const s = opts.student;
  const fullName = s ? `${s.last_name}, ${s.first_name}` : "";
  const nameW = QR_X - x - 36;
  return [
    text(x, y, "Apellido y Nombres:", { size: 2.6, bold: true }),
    rect(x + 32, y - 3.5, Math.max(40, nameW), 5, "#fff", "#000"),
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
  const slots = buildAnswerSlots(assessment);
  const layout = computeOmrLayout(slots);

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PAGE_W} ${PAGE_H}" width="${PAGE_W}mm" height="${PAGE_H}mm">`,
  );
  parts.push(`<rect width="${PAGE_W}" height="${PAGE_H}" fill="#fff" />`);
  parts.push(fiducialMarks());
  parts.push(header(opts, slots.length));
  parts.push(rect(CONTENT_MARGIN, HEADER_Y + 11, QR_X - CONTENT_MARGIN - 4, 0.3, "#000"));
  parts.push(studentBlock(opts));
  parts.push(rutBlock(opts.student?.rut));

  // Instrucciones a la derecha del bloque RUT
  const instrX = CONTENT_MARGIN + 60;
  parts.push(text(instrX, RUT_Y, "INSTRUCCIONES", { size: 3, bold: true }));
  const lines = [
    "1. Use lápiz grafito N° 2 o portaminas HB.",
    "2. Ennegrezca completamente el círculo elegido.",
    "3. Marque solo UNA alternativa por pregunta.",
    "4. Si se equivoca, borre completamente y vuelva a marcar.",
    "5. No doble, manche ni rompa esta hoja.",
    "",
    "En Verdadero/Falso: V = primera burbuja, F = segunda.",
    "No escriba sobre los cuadrados negros de las esquinas",
    "ni sobre el código QR: son necesarios para corregir.",
  ];
  lines.forEach((ln, i) => parts.push(text(instrX, RUT_Y + 4 + i * 3.5, ln, { size: 2.4 })));

  // Grilla de respuestas
  parts.push(text(CONTENT_MARGIN, GRID_Y - 3, "RESPUESTAS", { size: 3.2, bold: true }));
  parts.push(answerGrid(layout));

  parts.push(
    text(
      PAGE_W - CONTENT_MARGIN,
      PAGE_H - CONTENT_MARGIN - 2,
      `${layout.slots.length - layout.overflow} respuestas corregibles automáticamente`,
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
