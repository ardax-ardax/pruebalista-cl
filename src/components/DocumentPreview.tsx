import { useEffect, useRef, useState } from "react";
import { Minus, Plus, Maximize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { FormatTemplate } from "@/lib/templates";

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5];
const ZOOM_KEY = "preview-zoom";

interface DocumentPreviewProps {
  originalHtml: string;
  processedHtml: string;
  originalFileName?: string;
  processedFileName: string;
  template: FormatTemplate;
  originalPages?: number;
  processedPages?: number;
}

interface PanelProps {
  title: string;
  subtitle?: string;
  html: string;
  zoom: number;
  onZoomChange: (z: number) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  template: FormatTemplate;
}

function ZoomBar({
  zoom,
  onZoomChange,
}: {
  zoom: number;
  onZoomChange: (z: number) => void;
}) {
  const dec = () => {
    const idx = ZOOM_PRESETS.findIndex((z) => z >= zoom);
    const next = ZOOM_PRESETS[Math.max(0, idx - 1)] ?? ZOOM_PRESETS[0];
    onZoomChange(next);
  };
  const inc = () => {
    const idx = ZOOM_PRESETS.findIndex((z) => z >= zoom);
    const next =
      ZOOM_PRESETS[Math.min(ZOOM_PRESETS.length - 1, idx === -1 ? ZOOM_PRESETS.length - 1 : idx + 1)];
    onZoomChange(next);
  };

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" className="h-7 w-7" onClick={dec} aria-label="Reducir zoom">
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Select value={String(zoom)} onValueChange={(v) => onZoomChange(Number(v))}>
        <SelectTrigger className="h-7 w-[84px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ZOOM_PRESETS.map((z) => (
            <SelectItem key={z} value={String(z)} className="text-xs">
              {Math.round(z * 100)}%
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" className="h-7 w-7" onClick={inc} aria-label="Aumentar zoom">
        <Plus className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={() => onZoomChange(1)}
        aria-label="Restablecer zoom"
        title="Restablecer (100%)"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function PreviewPanel({
  title,
  subtitle,
  html,
  zoom,
  onZoomChange,
  scrollRef,
  onScroll,
  template,
}: PanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-muted/40 rounded-t-lg">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{title}</div>
          {subtitle && (
            <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
          )}
        </div>
        <ZoomBar zoom={zoom} onZoomChange={onZoomChange} />
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="bg-white border-x border-b border-border rounded-b-lg overflow-auto h-[560px]"
      >
        {html ? (
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
              width: `${100 / zoom}%`,
            }}
          >
            <div
              className="docx-preview p-6 prose prose-sm max-w-none"
              style={{
                fontFamily: template.typography.bodyFont,
                textAlign: template.body.alignment,
              }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="max-w-sm space-y-2">
              <div className="text-sm font-medium text-foreground">
                Previsualización no disponible
              </div>
              <p className="text-xs text-muted-foreground">
                Este documento contiene elementos que el visor web no puede renderizar
                (cuadros de texto complejos, contenido alternativo, objetos embebidos).
                El archivo .docx procesado es válido — descárgalo y ábrelo en Word para verlo.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentPreview({
  originalHtml,
  processedHtml,
  originalFileName,
  processedFileName,
  template,
  originalPages,
  processedPages,
}: DocumentPreviewProps) {
  const [mode, setMode] = useState<"compare" | "processed" | "original">("compare");
  const [zoomLeft, setZoomLeft] = useState(1);
  const [zoomRight, setZoomRight] = useState(1);
  const [zoomFull, setZoomFull] = useState(1);
  const [syncScroll, setSyncScroll] = useState(true);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  // Cargar zoom persistido
  useEffect(() => {
    const saved = Number(localStorage.getItem(ZOOM_KEY));
    if (saved && ZOOM_PRESETS.includes(saved)) {
      setZoomLeft(saved);
      setZoomRight(saved);
      setZoomFull(saved);
    }
  }, []);

  const persistZoom = (z: number) => {
    localStorage.setItem(ZOOM_KEY, String(z));
  };

  const handleZoomLeft = (z: number) => {
    setZoomLeft(z);
    if (syncScroll) setZoomRight(z);
    persistZoom(z);
  };
  const handleZoomRight = (z: number) => {
    setZoomRight(z);
    if (syncScroll) setZoomLeft(z);
    persistZoom(z);
  };

  const handleScroll = (source: "left" | "right") => (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || syncing.current) return;
    const src = e.currentTarget;
    const target = source === "left" ? rightRef.current : leftRef.current;
    if (!target) return;
    syncing.current = true;
    const ratioY = src.scrollTop / Math.max(1, src.scrollHeight - src.clientHeight);
    const ratioX = src.scrollLeft / Math.max(1, src.scrollWidth - src.clientWidth);
    target.scrollTop = ratioY * (target.scrollHeight - target.clientHeight);
    target.scrollLeft = ratioX * (target.scrollWidth - target.clientWidth);
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  const subtitleOriginal = `${originalFileName ?? "Original"}${
    originalPages ? ` · ~${originalPages} pág.` : ""
  }`;
  const subtitleProcessed = `${processedFileName}${
    processedPages ? ` · ~${processedPages} pág.` : ""
  }`;

  return (
    <Card className="shadow-card">
      <CardContent className="pt-6">
        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <TabsList>
              <TabsTrigger value="compare">Comparar</TabsTrigger>
              <TabsTrigger value="processed">Solo estandarizado</TabsTrigger>
              <TabsTrigger value="original">Solo original</TabsTrigger>
            </TabsList>
            {mode === "compare" && (
              <div className="flex items-center gap-2">
                <Switch
                  id="sync-scroll"
                  checked={syncScroll}
                  onCheckedChange={setSyncScroll}
                />
                <Label htmlFor="sync-scroll" className="text-xs cursor-pointer">
                  Scroll sincronizado
                </Label>
              </div>
            )}
          </div>

          <TabsContent value="compare" className="mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PreviewPanel
                title="Original"
                subtitle={subtitleOriginal}
                html={originalHtml}
                zoom={zoomLeft}
                onZoomChange={handleZoomLeft}
                scrollRef={leftRef}
                onScroll={handleScroll("left")}
                template={template}
              />
              <PreviewPanel
                title="Estandarizado"
                subtitle={subtitleProcessed}
                html={processedHtml}
                zoom={zoomRight}
                onZoomChange={handleZoomRight}
                scrollRef={rightRef}
                onScroll={handleScroll("right")}
                template={template}
              />
            </div>
          </TabsContent>

          <TabsContent value="processed" className="mt-0">
            <PreviewPanel
              title="Estandarizado"
              subtitle={subtitleProcessed}
              html={processedHtml}
              zoom={zoomFull}
              onZoomChange={(z) => {
                setZoomFull(z);
                persistZoom(z);
              }}
              template={template}
            />
          </TabsContent>

          <TabsContent value="original" className="mt-0">
            <PreviewPanel
              title="Original"
              subtitle={subtitleOriginal}
              html={originalHtml}
              zoom={zoomFull}
              onZoomChange={(z) => {
                setZoomFull(z);
                persistZoom(z);
              }}
              template={template}
            />
          </TabsContent>
        </Tabs>

        <p className="text-[11px] text-muted-foreground mt-3 italic">
          Nota: la vista previa web aplica los recortes de imagen del .docx.
          Pueden persistir diferencias en objetos flotantes y layouts complejos.
          La referencia válida siempre es el archivo .docx descargado abierto en Word.
        </p>
      </CardContent>
    </Card>
  );
}
