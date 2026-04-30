// Barra de "Optimización de papel" que vive sobre la vista previa.
// Permite a admin/UTP ajustar márgenes, espaciado y nº de columnas en vivo,
// y a los docentes verlos en modo solo lectura sin cambiar de pestaña.
import { useState } from "react";
import { ChevronDown, Lock, RotateCcw, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LAYOUT,
  LAYOUT_LIMITS,
  type AssessmentLayout,
  type AssessmentMeta,
} from "@/lib/assessment-schema";

interface Props {
  meta: AssessmentMeta;
  onMetaChange: (meta: AssessmentMeta) => void;
  canEdit: boolean;
}

export const PreviewLayoutToolbar = ({ meta, onMetaChange, canEdit }: Props) => {
  const [open, setOpen] = useState(false);
  const layout: AssessmentLayout = meta.layout ?? DEFAULT_LAYOUT;
  const { marginMinMm, marginMaxMm, spacingMinPt, spacingMaxPt } = LAYOUT_LIMITS;

  const patch = (p: Partial<AssessmentLayout>) =>
    onMetaChange({ ...meta, layout: { ...layout, ...p } });

  const reset = () => onMetaChange({ ...meta, layout: { ...DEFAULT_LAYOUT } });

  // Resumen tipo "M:20·20·25mm · 6pt · 1col" para la barra cerrada.
  const summary = `M:${layout.marginTop}·${layout.marginBottom}·${layout.marginSide}mm · ${layout.questionSpacing}pt · ${layout.optionsColumns}col`;

  return (
    <Card className="shadow-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <CollapsibleTrigger className="flex flex-1 items-center justify-between gap-3 rounded-md px-2 py-1 text-left hover:bg-muted/40">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-medium">Optimización de papel</span>
              {!canEdit && (
                <Lock className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="Solo lectura" />
              )}
              <span className="ml-2 truncate font-mono text-xs text-muted-foreground">
                {summary}
              </span>
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </CollapsibleTrigger>
          {canEdit && open && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reset}
              className="shrink-0 text-xs text-muted-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" /> Restablecer
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {!canEdit && (
              <p className="mb-3 text-xs text-muted-foreground">
                Solo Administradores y Jefe UTP pueden modificar estos valores.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              <ToolbarSlider
                label="Margen sup."
                value={layout.marginTop}
                min={marginMinMm}
                max={marginMaxMm}
                unit="mm"
                disabled={!canEdit}
                onChange={(v) => patch({ marginTop: v })}
              />
              <ToolbarSlider
                label="Margen inf."
                value={layout.marginBottom}
                min={marginMinMm}
                max={marginMaxMm}
                unit="mm"
                disabled={!canEdit}
                onChange={(v) => patch({ marginBottom: v })}
              />
              <ToolbarSlider
                label="Márgenes lat."
                value={layout.marginSide}
                min={marginMinMm}
                max={marginMaxMm}
                unit="mm"
                disabled={!canEdit}
                onChange={(v) => patch({ marginSide: v })}
              />
              <ToolbarSlider
                label="Espacio entre preguntas"
                value={layout.questionSpacing}
                min={spacingMinPt}
                max={spacingMaxPt}
                unit="pt"
                disabled={!canEdit}
                onChange={(v) => patch({ questionSpacing: v })}
              />
            </div>

            <label className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <div className="text-xs">
                <div className="font-medium">Alternativas en 2 columnas</div>
                <div className="text-muted-foreground">
                  Distribuye A/B/C/D en dos columnas para reducir el alto de cada pregunta.
                </div>
              </div>
              <Switch
                checked={layout.optionsColumns === 2}
                onCheckedChange={(v) => patch({ optionsColumns: v ? 2 : 1 })}
                disabled={!canEdit}
              />
            </label>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

interface ToolbarSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  disabled?: boolean;
  onChange: (v: number) => void;
}

const ToolbarSlider = ({ label, value, min, max, unit, disabled, onChange }: ToolbarSliderProps) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="font-mono text-xs text-muted-foreground">
        {value} {unit}
      </span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={1}
      disabled={disabled}
      onValueChange={(vals) => onChange(vals[0] ?? value)}
    />
  </div>
);
