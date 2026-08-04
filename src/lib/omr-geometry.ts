// === Geometría OMR compartida (impresión + escaneo) ===
// Todas las coordenadas están en milímetros sobre una hoja A4 portrait.
// Este módulo es la ÚNICA fuente de verdad de la geometría: `omr-sheet.tsx`
// la usa para dibujar y `omr-scan.ts` para muestrear las burbujas de la foto.

import type { Assessment } from "./assessment-schema";

// ---- Página ----
export const PAGE_W = 210;
export const PAGE_H = 297;

// ---- Marcas fiduciales (cuadrados negros en las 4 esquinas) ----
export const FIDUCIAL_SIZE = 10;
export const FIDUCIAL_MARGIN = 8;
export const CONTENT_MARGIN = 22;

/** Centros de los 4 fiduciales, en mm: [TL, TR, BL, BR]. */
export const FIDUCIAL_CENTERS: Array<{ xMm: number; yMm: number }> = [
  { xMm: FIDUCIAL_MARGIN + FIDUCIAL_SIZE / 2, yMm: FIDUCIAL_MARGIN + FIDUCIAL_SIZE / 2 },
  { xMm: PAGE_W - FIDUCIAL_MARGIN - FIDUCIAL_SIZE / 2, yMm: FIDUCIAL_MARGIN + FIDUCIAL_SIZE / 2 },
  { xMm: FIDUCIAL_MARGIN + FIDUCIAL_SIZE / 2, yMm: PAGE_H - FIDUCIAL_MARGIN - FIDUCIAL_SIZE / 2 },
  { xMm: PAGE_W - FIDUCIAL_MARGIN - FIDUCIAL_SIZE / 2, yMm: PAGE_H - FIDUCIAL_MARGIN - FIDUCIAL_SIZE / 2 },
];

// ---- Burbujas de respuestas ----
export const BUBBLE_R = 2.4;
export const BUBBLE_DX = 7;
export const ROW_H = 6.5;
export const ROW_LABEL_W = 9;
export const COL_GAP = 14;
export const MAX_COLUMNS = 3;

export const OPTIONS = ["A", "B", "C", "D", "E"] as const;
export type OptionLetter = (typeof OPTIONS)[number];

// ---- Bloque RUT ----
export const RUT_BUBBLE_R = 2.0;
export const RUT_DX = 5.5;
export const RUT_DY = 5.0;
export const RUT_COLS = 9; // 8 dígitos + dígito verificador
export const RUT_DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "K"] as const;

// ---- Layout vertical fijo de la hoja ----
export const HEADER_Y = CONTENT_MARGIN;      // 22
export const STUDENT_Y = HEADER_Y + 14;      // 36
export const RUT_Y = STUDENT_Y + 14;         // 50
export const RUT_BOX_Y = RUT_Y + 2;
export const RUT_BOX_H = 5;
export const RUT_BUBBLES_Y0 = RUT_BOX_Y + RUT_BOX_H + 4;
export const RUT_BLOCK_H = 4 + 4 + RUT_DIGITS.length * RUT_DY + 4;
export const GRID_Y = RUT_Y + RUT_BLOCK_H + 8;
export const GRID_MAX_H = PAGE_H - GRID_Y - CONTENT_MARGIN;

// ---- QR con el identificador de la prueba ----
export const QR_SIZE = 20;
export const QR_X = PAGE_W - CONTENT_MARGIN - QR_SIZE;
export const QR_Y = CONTENT_MARGIN - 4;

// ============================================================
// Slots de respuesta (una fila de burbujas por slot)
// ============================================================

export interface AnswerSlot {
  /** Número visible de la pregunta en la prueba impresa. */
  num: number;
  kind: "mc" | "tf";
  /** Cantidad de alternativas válidas (2 para V/F, hasta 5 en selección múltiple). */
  optionCount: number;
  /** Alternativa correcta ("A".."E") o null si la prueba no la define. */
  expected: OptionLetter | null;
}

/**
 * Enumera los slots corregibles automáticamente, manteniendo la numeración
 * real de la prueba (idéntica a la pauta de corrección):
 *  - selección múltiple → 1 slot (A–E)
 *  - verdadero/falso    → 1 slot por afirmación (V = A, F = B)
 *  - desarrollo         → consume número, pero no genera slot (corrección manual)
 */
export function buildAnswerSlots(assessment: Assessment): AnswerSlot[] {
  const slots: AnswerSlot[] = [];
  let num = 1;
  for (const q of assessment.questions) {
    if (q.type === "section-title" || q.type === "info-block") continue;

    if (q.type === "multiple-choice") {
      const opts = q.options ?? [];
      const idx = opts.findIndex((o) => o.correct);
      slots.push({
        num,
        kind: "mc",
        optionCount: Math.min(Math.max(opts.length, 2), OPTIONS.length),
        expected: idx >= 0 && idx < OPTIONS.length ? OPTIONS[idx] : null,
      });
      num++;
      continue;
    }

    if (q.type === "true-false") {
      const statements = q.statements ?? [];
      for (const st of statements) {
        const ans = String(st.answer ?? "").toUpperCase();
        slots.push({
          num,
          kind: "tf",
          optionCount: 2,
          expected: ans.startsWith("V") ? "A" : ans.startsWith("F") ? "B" : null,
        });
        num++;
      }
      continue;
    }

    // Desarrollo u otros: consume numeración, sin burbujas.
    num++;
  }
  return slots;
}

// ============================================================
// Layout de la grilla de respuestas
// ============================================================

export interface BubblePos {
  /** Índice en el array de slots. */
  slotIndex: number;
  optionIndex: number;
  optionLetter: OptionLetter;
  xMm: number;
  yMm: number;
}

export interface RowPos {
  slotIndex: number;
  /** X del label ("12.") */
  xMm: number;
  /** Y del centro de la fila */
  yMm: number;
}

export interface OmrLayout {
  slots: AnswerSlot[];
  cols: number;
  rowsPerCol: number;
  colWidth: number;
  gridY: number;
  rows: RowPos[];
  bubbles: BubblePos[];
  /** Slots que no cupieron en la hoja (no se imprimen ni se corrigen). */
  overflow: number;
}

export function computeOmrLayout(slots: AnswerSlot[]): OmrLayout {
  const colWidth = ROW_LABEL_W + OPTIONS.length * BUBBLE_DX;
  const maxRows = Math.max(1, Math.floor(GRID_MAX_H / ROW_H));
  const n = slots.length;
  const cols = Math.min(MAX_COLUMNS, Math.max(1, Math.ceil(n / maxRows)));
  const rowsPerCol = Math.min(maxRows, Math.max(1, Math.ceil(n / cols)));
  const capacity = cols * rowsPerCol;

  const rows: RowPos[] = [];
  const bubbles: BubblePos[] = [];

  for (let i = 0; i < Math.min(n, capacity); i++) {
    const colIdx = Math.floor(i / rowsPerCol);
    const rowIdx = i % rowsPerCol;
    const rx = CONTENT_MARGIN + colIdx * (colWidth + COL_GAP);
    const ry = GRID_Y + rowIdx * ROW_H + 2;
    rows.push({ slotIndex: i, xMm: rx, yMm: ry });
    for (let o = 0; o < slots[i].optionCount; o++) {
      bubbles.push({
        slotIndex: i,
        optionIndex: o,
        optionLetter: OPTIONS[o],
        xMm: rx + ROW_LABEL_W + o * BUBBLE_DX,
        yMm: ry,
      });
    }
  }

  return {
    slots,
    cols,
    rowsPerCol,
    colWidth,
    gridY: GRID_Y,
    rows,
    bubbles,
    overflow: Math.max(0, n - capacity),
  };
}

/** Posiciones de las burbujas del bloque RUT. */
export interface RutBubblePos {
  col: number; // 0..8 (8 = dígito verificador)
  digit: string;
  xMm: number;
  yMm: number;
}

export function rutBubblePositions(): RutBubblePos[] {
  const out: RutBubblePos[] = [];
  for (let r = 0; r < RUT_DIGITS.length; r++) {
    const digit = RUT_DIGITS[r];
    const yMm = RUT_BUBBLES_Y0 + r * RUT_DY;
    for (let c = 0; c < RUT_COLS; c++) {
      if (digit === "K" && c !== RUT_COLS - 1) continue;
      out.push({
        col: c,
        digit,
        xMm: CONTENT_MARGIN + c * RUT_DX + (RUT_DX - 1) / 2,
        yMm,
      });
    }
  }
  return out;
}

// ---- Payload del QR ----
export const QR_PREFIX = "PL1";

export function buildQrPayload(assessmentId: string, slotCount: number): string {
  return `${QR_PREFIX}:${assessmentId}:${slotCount}`;
}

export function parseQrPayload(raw: string): { assessmentId: string; slotCount: number } | null {
  const parts = (raw || "").trim().split(":");
  if (parts.length < 2 || parts[0] !== QR_PREFIX) return null;
  const assessmentId = parts[1];
  if (!/^[0-9a-fA-F-]{8,}$/.test(assessmentId)) return null;
  return { assessmentId, slotCount: Number(parts[2] ?? 0) || 0 };
}
