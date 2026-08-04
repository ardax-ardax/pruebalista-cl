// === Escaneo OMR en el navegador (sin IA, sin servidor) ===
// Flujo:
//   1. La foto se dibuja en un <canvas> reducido (máx. 1600 px de ancho).
//   2. Se lee el QR con jsQR para identificar la prueba.
//   3. Se detectan los 4 cuadrados fiduciales de las esquinas.
//   4. Con esos 4 puntos se calcula una homografía mm → píxeles, lo que
//      corrige perspectiva, rotación y escala de la foto.
//   5. Se muestrea el interior de cada burbuja y se mide qué tan oscura está.

import jsQR from "jsqr";
import {
  FIDUCIAL_CENTERS,
  RUT_BUBBLE_R,
  BUBBLE_R,
  buildAnswerSlots,
  computeOmrLayout,
  parseQrPayload,
  rutBubblePositions,
  type AnswerSlot,
  type OptionLetter,
} from "./omr-geometry";
import type { Assessment } from "./assessment-schema";

const MAX_WIDTH = 1600;

export interface ScanMark {
  slotIndex: number;
  num: number;
  kind: "mc" | "tf";
  /** Alternativa detectada, o null si quedó en blanco. */
  marked: OptionLetter | null;
  /** true si hay dos marcas fuertes o la marca es dudosa. */
  ambiguous: boolean;
  /** Intensidad de llenado 0–1 de cada alternativa. */
  fills: number[];
}

export interface ScanResult {
  /** ID de prueba leído del QR (null si no se pudo leer). */
  assessmentId: string | null;
  qrFound: boolean;
  /** RUT leído de las burbujas (sin puntos ni guión), null si no se detectó. */
  rut: string | null;
  marks: ScanMark[];
  /** 0–1: qué tan confiable fue la detección de fiduciales/marcas. */
  confidence: number;
  /** Recorte normalizado (dataURL) para revisión visual. */
  previewDataUrl: string;
  warnings: string[];
}

// ------------------------------------------------------------------
// Carga de imagen a canvas
// ------------------------------------------------------------------

async function fileToCanvas(file: File | Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return canvas;
}

interface Gray {
  data: Uint8ClampedArray; // 0..255, 1 byte por píxel
  w: number;
  h: number;
}

function toGray(canvas: HTMLCanvasElement): Gray {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = new Uint8ClampedArray(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < img.data.length; i += 4, p++) {
    out[p] = (img.data[i] * 299 + img.data[i + 1] * 587 + img.data[i + 2] * 114) / 1000;
  }
  return { data: out, w: canvas.width, h: canvas.height };
}

/** Umbral global por el método de Otsu. */
function otsuThreshold(g: Gray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < g.data.length; i++) hist[g.data[i]]++;
  const total = g.data.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let bestVar = -1;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > bestVar) {
      bestVar = between;
      best = t;
    }
  }
  return best;
}

// ------------------------------------------------------------------
// Detección de fiduciales
// ------------------------------------------------------------------

interface Point {
  x: number;
  y: number;
}

/**
 * Busca el blob oscuro más grande y compacto dentro de una región.
 * Se trabaja sobre una rejilla reducida (step) para que el flood fill sea rápido.
 */
function findDarkBlob(
  g: Gray,
  threshold: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { center: Point; area: number; squareness: number } | null {
  const step = 2;
  const gw = Math.floor((x1 - x0) / step);
  const gh = Math.floor((y1 - y0) / step);
  if (gw <= 2 || gh <= 2) return null;

  const dark = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const px = x0 + gx * step;
      const py = y0 + gy * step;
      dark[gy * gw + gx] = g.data[py * g.w + px] < threshold ? 1 : 0;
    }
  }

  const seen = new Uint8Array(gw * gh);
  let best: { center: Point; area: number; squareness: number } | null = null;
  const stack: number[] = [];

  for (let i = 0; i < dark.length; i++) {
    if (!dark[i] || seen[i]) continue;
    stack.length = 0;
    stack.push(i);
    seen[i] = 1;
    let area = 0;
    let sx = 0;
    let sy = 0;
    let minX = gw;
    let maxX = 0;
    let minY = gh;
    let maxY = 0;

    while (stack.length) {
      const idx = stack.pop()!;
      const gx = idx % gw;
      const gy = (idx - gx) / gw;
      area++;
      sx += gx;
      sy += gy;
      if (gx < minX) minX = gx;
      if (gx > maxX) maxX = gx;
      if (gy < minY) minY = gy;
      if (gy > maxY) maxY = gy;

      const neighbors = [
        gx > 0 ? idx - 1 : -1,
        gx < gw - 1 ? idx + 1 : -1,
        gy > 0 ? idx - gw : -1,
        gy < gh - 1 ? idx + gw : -1,
      ];
      for (const nb of neighbors) {
        if (nb >= 0 && dark[nb] && !seen[nb]) {
          seen[nb] = 1;
          stack.push(nb);
        }
      }
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const fillRatio = area / (bw * bh);
    const aspect = Math.min(bw, bh) / Math.max(bw, bh);
    // Un fiducial es un cuadrado macizo: relleno alto y proporción ~1.
    if (fillRatio < 0.6 || aspect < 0.55 || area < 12) continue;
    const squareness = fillRatio * aspect;
    if (!best || area > best.area) {
      best = {
        center: { x: x0 + (sx / area) * step, y: y0 + (sy / area) * step },
        area,
        squareness,
      };
    }
  }

  return best;
}

/** Detecta los 4 fiduciales buscando en cada esquina (35 % del alto/ancho). */
function detectFiducials(g: Gray, threshold: number): { points: Point[] | null; quality: number } {
  const rw = Math.floor(g.w * 0.35);
  const rh = Math.floor(g.h * 0.35);
  const regions: Array<[number, number, number, number]> = [
    [0, 0, rw, rh],
    [g.w - rw, 0, g.w, rh],
    [0, g.h - rh, rw, g.h],
    [g.w - rw, g.h - rh, g.w, g.h],
  ];
  const points: Point[] = [];
  let quality = 0;
  for (const [x0, y0, x1, y1] of regions) {
    const blob = findDarkBlob(g, threshold, x0, y0, x1, y1);
    if (!blob) return { points: null, quality: 0 };
    points.push(blob.center);
    quality += blob.squareness;
  }
  return { points, quality: quality / 4 };
}

// ------------------------------------------------------------------
// Homografía mm → px (4 puntos)
// ------------------------------------------------------------------

type Homography = number[]; // [a,b,c,d,e,f,g,h]

function solveHomography(src: Point[], dst: Point[]): Homography | null {
  // Resuelve A·x = b (8×8) por eliminación gaussiana.
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]);
    b.push(v);
  }

  const n = 8;
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    }
    if (Math.abs(A[pivot][col]) < 1e-9) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    [b[col], b[pivot]] = [b[pivot], b[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col] / A[col][col];
      if (!f) continue;
      for (let c = col; c < n; c++) A[r][c] -= f * A[col][c];
      b[r] -= f * b[col];
    }
  }
  return A.map((row, i) => b[i] / row[i]);
}

function mapPoint(H: Homography, xMm: number, yMm: number): Point {
  const [a, bb, c, d, e, f, g, h] = H;
  const den = g * xMm + h * yMm + 1;
  return { x: (a * xMm + bb * yMm + c) / den, y: (d * xMm + e * yMm + f) / den };
}

/** Escala aproximada px por mm (promedio de los lados horizontales/verticales). */
function pxPerMm(H: Homography): number {
  const p0 = mapPoint(H, 0, 0);
  const px = mapPoint(H, 10, 0);
  const py = mapPoint(H, 0, 10);
  const dx = Math.hypot(px.x - p0.x, px.y - p0.y) / 10;
  const dy = Math.hypot(py.x - p0.x, py.y - p0.y) / 10;
  return (dx + dy) / 2;
}

// ------------------------------------------------------------------
// Muestreo de burbujas
// ------------------------------------------------------------------

/** Fracción de píxeles oscuros dentro del círculo (0 = vacío, 1 = totalmente relleno). */
function bubbleFill(
  g: Gray,
  H: Homography,
  xMm: number,
  yMm: number,
  rMm: number,
  threshold: number,
): number {
  const center = mapPoint(H, xMm, yMm);
  const rPx = Math.max(2, rMm * pxPerMm(H) * 0.72); // 72 % del radio: ignora el borde impreso
  let dark = 0;
  let total = 0;
  const r = Math.ceil(rPx);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > rPx * rPx) continue;
      const x = Math.round(center.x + dx);
      const y = Math.round(center.y + dy);
      if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
      total++;
      if (g.data[y * g.w + x] < threshold) dark++;
    }
  }
  return total ? dark / total : 0;
}

const FILL_MIN = 0.35;      // mínimo para considerar una burbuja marcada
const FILL_MARGIN = 0.14;   // diferencia mínima con la segunda más oscura

function decideMark(slot: AnswerSlot, fills: number[]): { marked: OptionLetter | null; ambiguous: boolean } {
  const letters: OptionLetter[] = ["A", "B", "C", "D", "E"];
  let bestIdx = -1;
  let best = 0;
  let second = 0;
  fills.forEach((f, i) => {
    if (f > best) {
      second = best;
      best = f;
      bestIdx = i;
    } else if (f > second) {
      second = f;
    }
  });
  if (best < FILL_MIN) return { marked: null, ambiguous: false };
  if (best - second < FILL_MARGIN) return { marked: letters[bestIdx], ambiguous: true };
  return { marked: letters[bestIdx], ambiguous: false };
}

// ------------------------------------------------------------------
// Lectura del RUT desde las burbujas
// ------------------------------------------------------------------

function readRut(g: Gray, H: Homography, threshold: number): string | null {
  const positions = rutBubblePositions();
  const byCol = new Map<number, Array<{ digit: string; fill: number }>>();
  for (const p of positions) {
    const fill = bubbleFill(g, H, p.xMm, p.yMm, RUT_BUBBLE_R, threshold);
    const arr = byCol.get(p.col) ?? [];
    arr.push({ digit: p.digit, fill });
    byCol.set(p.col, arr);
  }
  let out = "";
  let detected = 0;
  const cols = [...byCol.keys()].sort((a, b) => a - b);
  for (const col of cols) {
    const arr = byCol.get(col)!.sort((a, b) => b.fill - a.fill);
    if (arr[0].fill >= FILL_MIN && arr[0].fill - (arr[1]?.fill ?? 0) >= FILL_MARGIN) {
      out += arr[0].digit;
      detected++;
    } else {
      out += " ";
    }
  }
  const clean = out.trim().replace(/\s/g, "");
  return detected >= 7 ? clean : null;
}

// ------------------------------------------------------------------
// API principal
// ------------------------------------------------------------------

export async function scanOmrSheet(file: File | Blob, assessment: Assessment): Promise<ScanResult> {
  const canvas = await fileToCanvas(file);
  const gray = toGray(canvas);
  const threshold = Math.max(60, Math.min(200, otsuThreshold(gray)));
  const warnings: string[] = [];

  // --- QR ---
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);
  let assessmentId: string | null = null;
  try {
    const qr = jsQR(rgba.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
    const parsed = qr ? parseQrPayload(qr.data) : null;
    if (parsed) assessmentId = parsed.assessmentId;
  } catch {
    /* QR ilegible: se continúa sin identificación automática */
  }
  if (!assessmentId) warnings.push("No se pudo leer el código QR de la hoja.");

  // --- Fiduciales + homografía ---
  const { points, quality } = detectFiducials(gray, threshold);
  if (!points) {
    throw new Error(
      "No se detectaron las 4 marcas negras de las esquinas. Toma la foto completa, de frente y con buena luz.",
    );
  }
  const H = solveHomography(
    FIDUCIAL_CENTERS.map((f) => ({ x: f.xMm, y: f.yMm })),
    points,
  );
  if (!H) {
    throw new Error("No se pudo alinear la hoja. Intenta con otra foto más nítida y sin inclinación.");
  }

  // --- Burbujas de respuesta ---
  const slots = buildAnswerSlots(assessment);
  const layout = computeOmrLayout(slots);
  const fillsBySlot = new Map<number, number[]>();
  for (const b of layout.bubbles) {
    const arr = fillsBySlot.get(b.slotIndex) ?? [];
    arr[b.optionIndex] = bubbleFill(gray, H, b.xMm, b.yMm, BUBBLE_R, threshold);
    fillsBySlot.set(b.slotIndex, arr);
  }

  const marks: ScanMark[] = layout.rows.map((row) => {
    const slot = layout.slots[row.slotIndex];
    const fills = (fillsBySlot.get(row.slotIndex) ?? []).map((f) => f ?? 0);
    const { marked, ambiguous } = decideMark(slot, fills);
    return { slotIndex: row.slotIndex, num: slot.num, kind: slot.kind, marked, ambiguous, fills };
  });

  const rut = readRut(gray, H, threshold);

  const ambiguousCount = marks.filter((m) => m.ambiguous).length;
  const confidence = Math.max(
    0,
    Math.min(1, quality * 0.6 + (assessmentId ? 0.2 : 0) + (marks.length ? 0.2 * (1 - ambiguousCount / marks.length) : 0)),
  );
  if (ambiguousCount > 0) {
    warnings.push(`${ambiguousCount} respuesta(s) dudosa(s): revísalas antes de guardar.`);
  }
  if (layout.overflow > 0) {
    warnings.push(`${layout.overflow} pregunta(s) no caben en la hoja y deben corregirse a mano.`);
  }

  return {
    assessmentId,
    qrFound: !!assessmentId,
    rut,
    marks,
    confidence,
    previewDataUrl: canvas.toDataURL("image/jpeg", 0.6),
    warnings,
  };
}

/** Lee solo el QR (para identificar la prueba antes de elegirla a mano). */
export async function readSheetAssessmentId(file: File | Blob): Promise<string | null> {
  const canvas = await fileToCanvas(file);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height);
  try {
    const qr = jsQR(rgba.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
    return qr ? (parseQrPayload(qr.data)?.assessmentId ?? null) : null;
  } catch {
    return null;
  }
}
