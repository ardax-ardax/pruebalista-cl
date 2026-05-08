// Comprime una imagen (logo) en el cliente antes de subirla.
// - Redimensiona manteniendo aspect-ratio a maxDim (px) en el lado mayor.
// - Re-encodea como JPEG/PNG con calidad configurable.
export async function compressImageFile(
  file: File,
  opts: { maxDim?: number; quality?: number; mime?: "image/jpeg" | "image/png" } = {},
): Promise<File> {
  const maxDim = opts.maxDim ?? 512;
  const quality = opts.quality ?? 0.85;
  const mime = opts.mime ?? (file.type === "image/png" ? "image/png" : "image/jpeg");

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("No se pudo leer el archivo"));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("No se pudo decodificar la imagen"));
    i.src = dataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  // Fondo blanco para JPEG (que no admite alpha).
  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Compresión falló"))), mime, quality),
  );

  // Si la "compresión" terminó pesando más, devuelve el original.
  if (blob.size >= file.size) return file;
  const ext = mime === "image/png" ? "png" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, { type: mime, lastModified: Date.now() });
}
