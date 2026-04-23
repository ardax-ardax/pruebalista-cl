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
}

const fileToDataUrl = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(f);
  });

export const ImageCropEditor = ({ value, onChange }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [localCrop, setLocalCrop] = useState<ImageCrop>(value?.crop ?? { left: 0, right: 0, top: 0, bottom: 0 });

  useEffect(() => {
    setLocalCrop(value?.crop ?? { left: 0, right: 0, top: 0, bottom: 0 });
  }, [value?.src]);

  const onPick = async (f: File) => {
    const src = await fileToDataUrl(f);
    onChange({
      src,
      alt: f.name,
      widthPct: 60,
      alignment: "center",
      crop: { left: 0, right: 0, top: 0, bottom: 0 },
    });
  };

  if (!value) {
    return (
      <div className="rounded-md border border-dashed border-border p-3">
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
          <Upload className="h-4 w-4" /> Agregar imagen
        </Button>
      </div>
    );
  }

  const { left: L, right: R, top: T, bottom: B } = localCrop;
  const visibleW = Math.max(1, 100 - L - R);
  const visibleH = Math.max(1, 100 - T - B);

  return (
    <div className="rounded-md border border-border p-3 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="border border-border rounded overflow-hidden bg-muted relative"
          style={{ width: 160, height: 120 }}
        >
          <img
            src={value.src}
            alt={value.alt ?? ""}
            style={{
              position: "absolute",
              top: `-${(T / visibleH) * 120}px`,
              left: `-${(L / visibleW) * 160}px`,
              width: `${(160 / visibleW) * 100}px`,
              height: `${(120 / visibleH) * 100}px`,
              objectFit: "cover",
              maxWidth: "none",
            }}
          />
        </div>
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
