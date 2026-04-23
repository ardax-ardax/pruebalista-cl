import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crop as CropIcon, Trash2, Upload } from "lucide-react";
import type { ImageCrop, QuestionImage } from "@/lib/assessment-schema";

interface Props {
  value: QuestionImage | null | undefined;
  onChange: (img: QuestionImage | null) => void;
  compact?: boolean;
}

const fileToDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(f);
  });

const measureImage = (src: string) =>
  new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
    img.onerror = () => resolve({ w: 1, h: 1 });
    img.src = src;
  });

// Miniatura sin deformación: usa aspect-ratio basado en dimensiones naturales y crop.
const CroppedThumb = ({ img, maxW = 160 }: { img: QuestionImage; maxW?: number }) => {
  const { left: L, right: R, top: T, bottom: B } = img.crop;
  const visibleW = Math.max(1, 100 - L - R);
  const visibleH = Math.max(1, 100 - T - B);
  const natW = img.naturalW ?? 4;
  const natH = img.naturalH ?? 3;
  const ratio = (natW * (visibleW / 100)) / Math.max(1, natH * (visibleH / 100));
  return (
    <div
      className="border border-border rounded overflow-hidden bg-muted relative"
      style={{ width: maxW, aspectRatio: `${ratio}`, maxHeight: 200 }}
    >
      <img
        src={img.src}
        alt={img.alt ?? ""}
        style={{
          display: "block",
          width: `${(100 / visibleW) * 100}%`,
          height: "auto",
          marginLeft: `${-(L / visibleW) * 100}%`,
          marginTop: `${-(T / visibleH) * 100}%`,
          maxWidth: "none",
        }}
      />
    </div>
  );
};

export const ImageCropEditor = ({ value, onChange, compact }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [localCrop, setLocalCrop] = useState<ImageCrop>(value?.crop ?? { left: 0, right: 0, top: 0, bottom: 0 });

  useEffect(() => {
    setLocalCrop(value?.crop ?? { left: 0, right: 0, top: 0, bottom: 0 });
  }, [value?.src]);

  const onPick = async (f: File) => {
    const src = await fileToDataUrl(f);
    const { w, h } = await measureImage(src);
    onChange({
      src,
      alt: f.name,
      widthPct: compact ? 80 : 60,
      alignment: "center",
      crop: { left: 0, right: 0, top: 0, bottom: 0 },
      naturalW: w,
      naturalH: h,
    });
  };

  if (!value) {
    return (
      <div className={compact ? "" : "rounded-md border border-dashed border-border p-3"}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = "";
          }}
        />
        <Button variant="outline" size="sm" type="button" onClick={() => inputRef.current?.click()}>
          <Upload className="h-4 w-4" /> {compact ? "Imagen" : "Agregar imagen"}
        </Button>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-2" : "rounded-md border border-border p-3 space-y-3"}>
      <div className="flex items-start gap-3">
        <CroppedThumb img={value} maxW={compact ? 120 : 160} />
        <div className="flex-1 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Ancho (%)</Label>
              <Input
                type="number"
                min={10}
                max={100}
                value={value.widthPct}
                onChange={(e) => onChange({ ...value, widthPct: Math.max(10, Math.min(100, Number(e.target.value) || 60)) })}
              />
            </div>
            <div>
              <Label className="text-xs">Alineación</Label>
              <Select value={value.alignment} onValueChange={(v) => onChange({ ...value, alignment: v as QuestionImage["alignment"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="left">Izquierda</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="right">Derecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowCrop((s) => !s)}>
              <CropIcon className="h-4 w-4" /> {showCrop ? "Ocultar recorte" : "Recortar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <Trash2 className="h-4 w-4" /> Quitar
            </Button>
          </div>
        </div>
      </div>
      {showCrop && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
          {(["top", "bottom", "left", "right"] as const).map((side) => (
            <div key={side}>
              <Label className="text-xs capitalize">{labelOf(side)}: {localCrop[side]}%</Label>
              <Slider
                min={0}
                max={80}
                step={1}
                value={[localCrop[side]]}
                onValueChange={(v) => {
                  const next = { ...localCrop, [side]: v[0] };
                  setLocalCrop(next);
                  onChange({ ...value, crop: next });
                }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const labelOf = (s: "top" | "bottom" | "left" | "right") =>
  s === "top" ? "Recorte superior" : s === "bottom" ? "Recorte inferior" : s === "left" ? "Recorte izquierdo" : "Recorte derecho";
