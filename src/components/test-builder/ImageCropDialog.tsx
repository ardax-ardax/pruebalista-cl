// Lightbox-style visual crop editor: drag/resize a rectangle directly on the
// image. Outputs ImageCrop in 0–100% coords, independent of display size.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ImageCrop } from "@/lib/assessment-schema";

interface Props {
  open: boolean;
  src: string;
  initial: ImageCrop;
  onCancel: () => void;
  onApply: (crop: ImageCrop) => void;
}

type Handle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

interface Rect {
  x: number; // px relative to image box
  y: number;
  w: number;
  h: number;
}

const MIN_PCT = 5; // minimum 5% width/height

export const ImageCropDialog = ({ open, src, initial, onCancel, onApply }: Props) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgBox, setImgBox] = useState<{ w: number; h: number } | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const dragRef = useRef<{ handle: Handle; startX: number; startY: number; startRect: Rect } | null>(null);

  // Recompute rendered image box (object-fit: contain) and seed rect from initial crop.
  const recompute = () => {
    const img = imgRef.current;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const containerW = img.parentElement?.clientWidth ?? 0;
    const containerH = img.parentElement?.clientHeight ?? 0;
    const ratio = img.naturalWidth / img.naturalHeight;
    let w = containerW;
    let h = w / ratio;
    if (h > containerH) {
      h = containerH;
      w = h * ratio;
    }
    setImgBox({ w, h });
    const L = (initial.left / 100) * w;
    const T = (initial.top / 100) * h;
    const R = (initial.right / 100) * w;
    const B = (initial.bottom / 100) * h;
    setRect({ x: L, y: T, w: Math.max(w - L - R, (MIN_PCT / 100) * w), h: Math.max(h - T - B, (MIN_PCT / 100) * h) });
  };

  useLayoutEffect(() => {
    if (!open) return;
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) {
      setImgBox(null);
      setRect(null);
    }
  }, [open]);

  const onPointerDown = (handle: Handle) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { handle, startX: e.clientX, startY: e.clientY, startRect: { ...rect } };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !rect || !imgBox) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const minW = (MIN_PCT / 100) * imgBox.w;
    const minH = (MIN_PCT / 100) * imgBox.h;
    let { x, y, w, h } = drag.startRect;
    const right = x + w;
    const bottom = y + h;

    if (drag.handle === "move") {
      x = Math.max(0, Math.min(imgBox.w - w, x + dx));
      y = Math.max(0, Math.min(imgBox.h - h, y + dy));
    } else {
      if (drag.handle.includes("w")) {
        const nx = Math.max(0, Math.min(right - minW, x + dx));
        w = right - nx;
        x = nx;
      }
      if (drag.handle.includes("e")) {
        w = Math.max(minW, Math.min(imgBox.w - x, drag.startRect.w + dx));
      }
      if (drag.handle.includes("n")) {
        const ny = Math.max(0, Math.min(bottom - minH, y + dy));
        h = bottom - ny;
        y = ny;
      }
      if (drag.handle.includes("s")) {
        h = Math.max(minH, Math.min(imgBox.h - y, drag.startRect.h + dy));
      }
    }
    setRect({ x, y, w, h });
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const handleApply = () => {
    if (!rect || !imgBox) {
      onApply({ left: 0, right: 0, top: 0, bottom: 0 });
      return;
    }
    const left = clampPct((rect.x / imgBox.w) * 100);
    const top = clampPct((rect.y / imgBox.h) * 100);
    const right = clampPct(((imgBox.w - rect.x - rect.w) / imgBox.w) * 100);
    const bottom = clampPct(((imgBox.h - rect.y - rect.h) / imgBox.h) * 100);
    onApply({ left, right, top, bottom });
  };

  const handleReset = () => {
    if (!imgBox) return;
    setRect({ x: 0, y: 0, w: imgBox.w, h: imgBox.h });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Recortar imagen</DialogTitle>
        </DialogHeader>
        <div
          ref={wrapRef}
          className="relative bg-black/90 rounded-md overflow-hidden flex items-center justify-center select-none"
          style={{ height: "70vh" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div className="relative" style={imgBox ? { width: imgBox.w, height: imgBox.h } : undefined}>
            <img
              ref={imgRef}
              src={src}
              alt="Recortar"
              onLoad={recompute}
              style={{ display: "block", maxWidth: "100%", maxHeight: "70vh", width: "auto", height: "auto" }}
              draggable={false}
            />
            {imgBox && rect && (
              <>
                {/* Dark overlay outside the crop rect */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute bg-black/60" style={{ left: 0, top: 0, width: "100%", height: rect.y }} />
                  <div className="absolute bg-black/60" style={{ left: 0, top: rect.y + rect.h, width: "100%", bottom: 0 }} />
                  <div className="absolute bg-black/60" style={{ left: 0, top: rect.y, width: rect.x, height: rect.h }} />
                  <div className="absolute bg-black/60" style={{ left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h }} />
                </div>
                {/* Crop rect */}
                <div
                  className="absolute border-2 border-primary"
                  style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, cursor: "move", touchAction: "none" }}
                  onPointerDown={onPointerDown("move")}
                >
                  {/* Handles */}
                  {(["nw","n","ne","e","se","s","sw","w"] as Handle[]).map((h) => (
                    <span
                      key={h}
                      onPointerDown={onPointerDown(h)}
                      className="absolute bg-primary border border-background"
                      style={{ ...handleStyle(h), touchAction: "none" }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={handleReset}>Restablecer</Button>
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="button" onClick={handleApply}>Aplicar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const clampPct = (v: number) => Math.max(0, Math.min(95, Math.round(v * 10) / 10));

const HSIZE = 12;
const half = HSIZE / 2;
const handleStyle = (h: Handle): React.CSSProperties => {
  const base: React.CSSProperties = { width: HSIZE, height: HSIZE, borderRadius: 2 };
  switch (h) {
    case "nw": return { ...base, left: -half, top: -half, cursor: "nwse-resize" };
    case "ne": return { ...base, right: -half, top: -half, cursor: "nesw-resize" };
    case "sw": return { ...base, left: -half, bottom: -half, cursor: "nesw-resize" };
    case "se": return { ...base, right: -half, bottom: -half, cursor: "nwse-resize" };
    case "n":  return { ...base, left: `calc(50% - ${half}px)`, top: -half, cursor: "ns-resize" };
    case "s":  return { ...base, left: `calc(50% - ${half}px)`, bottom: -half, cursor: "ns-resize" };
    case "w":  return { ...base, top: `calc(50% - ${half}px)`, left: -half, cursor: "ew-resize" };
    case "e":  return { ...base, top: `calc(50% - ${half}px)`, right: -half, cursor: "ew-resize" };
    default:   return base;
  }
};
