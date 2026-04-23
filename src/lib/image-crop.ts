// Pre-recorta imágenes (dataURL) usando <canvas> antes de embedirlas en .docx,
// porque docx-js no expone la API de srcRect de Word y no puede delegar el crop.
// Para el preview/PDF (HTML) seguimos usando CSS overflow + márgenes negativos.

import type { Assessment, QuestionImage } from "./assessment-schema";

export interface ProcessedImage {
  data: Uint8Array;
  type: "png";
  width: number; // dimensiones en px del recorte resultante
  height: number;
}

const cache = new Map<string, ProcessedImage>();

const cacheKey = (img: QuestionImage): string =>
  `${img.src}|${img.crop.left},${img.crop.right},${img.crop.top},${img.crop.bottom}`;

export const hasCrop = (img: QuestionImage): boolean => {
  const { left, right, top, bottom } = img.crop;
  return left > 0 || right > 0 || top > 0 || bottom > 0;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("No se pudo cargar imagen para recortar"));
    i.crossOrigin = "anonymous";
    i.src = src;
  });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function cropImageDataUrl(img: QuestionImage): Promise<ProcessedImage> {
  const key = cacheKey(img);
  const cached = cache.get(key);
  if (cached) return cached;

  const el = await loadImage(img.src);
  const natW = img.naturalW ?? el.naturalWidth ?? el.width ?? 1;
  const natH = img.naturalH ?? el.naturalHeight ?? el.height ?? 1;
  const { left: L, right: R, top: T, bottom: B } = img.crop;
  const sx = (L / 100) * natW;
  const sy = (T / 100) * natH;
  const sw = Math.max(1, ((100 - L - R) / 100) * natW);
  const sh = Math.max(1, ((100 - T - B) / 100) * natH);

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.drawImage(el, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const out = canvas.toDataURL("image/png");
  const result: ProcessedImage = {
    data: dataUrlToBytes(out),
    type: "png",
    width: canvas.width,
    height: canvas.height,
  };
  cache.set(key, result);
  return result;
}

export async function processAssessmentImages(
  assessment: Assessment,
): Promise<Map<string, ProcessedImage>> {
  const map = new Map<string, ProcessedImage>();
  const tasks: Array<Promise<void>> = [];
  const enqueue = (img?: QuestionImage | null) => {
    if (!img || !hasCrop(img)) return;
    const key = cacheKey(img);
    if (map.has(key)) return;
    tasks.push(
      cropImageDataUrl(img).then((p) => {
        map.set(key, p);
      }),
    );
  };
  for (const q of assessment.questions) {
    enqueue(q.image);
    (q.options ?? []).forEach((o) => enqueue(o.image));
    (q.statements ?? []).forEach((s) => enqueue(s.image));
  }
  await Promise.all(tasks);
  return map;
}

export const imageCacheKey = cacheKey;
