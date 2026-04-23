import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FONT_OPTIONS, type FormatTemplate, type Alignment } from "@/lib/templates";

interface Props {
  template: FormatTemplate;
  onChange: (t: FormatTemplate) => void;
}

const ALIGNMENTS: { value: Alignment; label: string }[] = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
  { value: "justify", label: "Justificado" },
];

export const TemplateEditor = ({ template, onChange }: Props) => {
  const update = <K extends keyof FormatTemplate>(key: K, value: FormatTemplate[K]) =>
    onChange({ ...template, [key]: value });

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="text-base">Personalización de "{template.name}"</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="typography">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="typography">Tipografía</TabsTrigger>
            <TabsTrigger value="spacing">Espaciado</TabsTrigger>
            <TabsTrigger value="header">Encabezado</TabsTrigger>
            <TabsTrigger value="footer">Pie</TabsTrigger>
          </TabsList>

          <TabsContent value="typography" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Fuente del cuerpo">
                <Select
                  value={template.typography.bodyFont}
                  onValueChange={(v) => update("typography", { ...template.typography, bodyFont: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Fuente de títulos">
                <Select
                  value={template.typography.headingFont}
                  onValueChange={(v) => update("typography", { ...template.typography, headingFont: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              <SliderField
                label="Cuerpo"
                unit="pt"
                value={template.typography.bodySize}
                min={8} max={16} step={1}
                onChange={(v) => update("typography", { ...template.typography, bodySize: v })}
              />
              <SliderField
                label="H1"
                unit="pt"
                value={template.typography.h1Size}
                min={12} max={28} step={1}
                onChange={(v) => update("typography", { ...template.typography, h1Size: v })}
              />
              <SliderField
                label="H2"
                unit="pt"
                value={template.typography.h2Size}
                min={11} max={22} step={1}
                onChange={(v) => update("typography", { ...template.typography, h2Size: v })}
              />
              <SliderField
                label="H3"
                unit="pt"
                value={template.typography.h3Size}
                min={10} max={18} step={1}
                onChange={(v) => update("typography", { ...template.typography, h3Size: v })}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <ColorField
                label="Color del cuerpo"
                value={template.typography.bodyColor}
                onChange={(v) => update("typography", { ...template.typography, bodyColor: v })}
              />
              <ColorField
                label="Color de títulos"
                value={template.typography.headingColor}
                onChange={(v) => update("typography", { ...template.typography, headingColor: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Títulos en negrita</div>
                <div className="text-xs text-muted-foreground">Aplica a H1, H2 y H3</div>
              </div>
              <Switch
                checked={template.headings.bold}
                onCheckedChange={(v) => update("headings", { ...template.headings, bold: v })}
              />
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              {(["h1Alignment", "h2Alignment", "h3Alignment"] as const).map((k, i) => (
                <Field key={k} label={`Alineación H${i + 1}`}>
                  <Select
                    value={template.headings[k]}
                    onValueChange={(v) => update("headings", { ...template.headings, [k]: v as Alignment })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALIGNMENTS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="spacing" className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-4 gap-4">
              {(["marginTop", "marginBottom", "marginLeft", "marginRight"] as const).map((k) => (
                <SliderField
                  key={k}
                  label={
                    k === "marginTop" ? "Margen sup."
                    : k === "marginBottom" ? "Margen inf."
                    : k === "marginLeft" ? "Margen izq."
                    : "Margen der."
                  }
                  unit="cm"
                  value={template.spacing[k]}
                  min={1} max={5} step={0.25}
                  onChange={(v) => update("spacing", { ...template.spacing, [k]: v })}
                />
              ))}
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Interlineado">
                <Select
                  value={String(template.spacing.lineSpacing)}
                  onValueChange={(v) => update("spacing", { ...template.spacing, lineSpacing: parseFloat(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Sencillo (1.0)</SelectItem>
                    <SelectItem value="1.15">1.15</SelectItem>
                    <SelectItem value="1.5">1.5</SelectItem>
                    <SelectItem value="2">Doble (2.0)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <SliderField
                label="Espacio antes párrafo"
                unit="pt"
                value={template.spacing.paragraphSpacingBefore}
                min={0} max={24} step={1}
                onChange={(v) => update("spacing", { ...template.spacing, paragraphSpacingBefore: v })}
              />
              <SliderField
                label="Espacio después párrafo"
                unit="pt"
                value={template.spacing.paragraphSpacingAfter}
                min={0} max={24} step={1}
                onChange={(v) => update("spacing", { ...template.spacing, paragraphSpacingAfter: v })}
              />
            </div>
          </TabsContent>

          <TabsContent value="header" className="space-y-4 mt-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Activar encabezado</div>
                <div className="text-xs text-muted-foreground">Mostrar nombre y/o logo en cada página</div>
              </div>
              <Switch
                checked={template.header.enabled}
                onCheckedChange={(v) => update("header", { ...template.header, enabled: v })}
              />
            </div>
            {template.header.enabled && (
              <>
                <Field label="Texto del encabezado">
                  <Input
                    value={template.header.institutionName}
                    onChange={(e) => update("header", { ...template.header, institutionName: e.target.value })}
                    placeholder="Nombre de la institución"
                  />
                </Field>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Alineación">
                    <Select
                      value={template.header.alignment}
                      onValueChange={(v) => update("header", { ...template.header, alignment: v as Alignment })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALIGNMENTS.filter((a) => a.value !== "justify").map((a) => (
                          <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <div className="text-sm font-medium">Mostrar logo</div>
                      <div className="text-xs text-muted-foreground">Configurable en "Configuración"</div>
                    </div>
                    <Switch
                      checked={template.header.showLogo}
                      onCheckedChange={(v) => update("header", { ...template.header, showLogo: v })}
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="footer" className="space-y-4 mt-4">
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div>
                <div className="text-sm font-medium">Activar pie de página</div>
                <div className="text-xs text-muted-foreground">Texto fijo, fecha y/o número de página</div>
              </div>
              <Switch
                checked={template.footer.enabled}
                onCheckedChange={(v) => update("footer", { ...template.footer, enabled: v })}
              />
            </div>
            {template.footer.enabled && (
              <>
                <Field label="Texto del pie">
                  <Input
                    value={template.footer.text}
                    onChange={(e) => update("footer", { ...template.footer, text: e.target.value })}
                    placeholder="Ej: Documento oficial"
                  />
                </Field>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <span className="text-sm font-medium">Número de página</span>
                    <Switch
                      checked={template.footer.showPageNumber}
                      onCheckedChange={(v) => update("footer", { ...template.footer, showPageNumber: v })}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border p-3">
                    <span className="text-sm font-medium">Fecha</span>
                    <Switch
                      checked={template.footer.showDate}
                      onCheckedChange={(v) => update("footer", { ...template.footer, showDate: v })}
                    />
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    {children}
  </div>
);

const SliderField = ({
  label, unit, value, min, max, step, onChange,
}: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}</Label>
      <span className="text-xs text-muted-foreground tabular-nums">{value}{unit}</span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
    />
  </div>
);

const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label className="text-xs">{label}</Label>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={`#${value}`}
        onChange={(e) => onChange(e.target.value.replace("#", "").toUpperCase())}
        className="h-10 w-14 rounded-md border border-input bg-background cursor-pointer"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value.replace("#", "").toUpperCase())}
        maxLength={6}
        className="font-mono uppercase"
      />
    </div>
  </div>
);
