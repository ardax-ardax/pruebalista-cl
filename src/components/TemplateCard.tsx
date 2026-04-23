import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FormatTemplate } from "@/lib/templates";
import { Check, Image as ImageIcon } from "lucide-react";

interface Props {
  template: FormatTemplate;
  selected: boolean;
  onSelect: () => void;
}

export const TemplateCard = ({ template, selected, onSelect }: Props) => {
  const t = template;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group text-left transition-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl",
      )}
    >
      <Card
        className={cn(
          "h-full overflow-hidden border-2 transition-smooth",
          selected
            ? "border-primary shadow-elevated"
            : "border-border hover:border-primary/40 hover:shadow-card",
        )}
      >
        {/* Mini preview */}
        <div
          className="relative h-36 border-b border-border bg-white p-3 overflow-hidden"
          style={{ fontFamily: t.typography.bodyFont }}
        >
          {t.header.enabled && (
            <div
              className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-slate-200"
              style={{ justifyContent: t.header.alignment === "center" ? "center" : t.header.alignment === "right" ? "flex-end" : "flex-start" }}
            >
              {t.header.showLogo && (
                <div className="flex h-4 w-4 items-center justify-center rounded bg-slate-100">
                  <ImageIcon className="h-2.5 w-2.5 text-slate-400" />
                </div>
              )}
              <span className="text-[7px] font-medium text-slate-700 truncate max-w-[70%]">
                {t.header.institutionName || "Institución"}
              </span>
            </div>
          )}
          <div
            className="text-[9px] font-bold mb-1"
            style={{
              fontFamily: t.typography.headingFont,
              color: `#${t.typography.headingColor}`,
              textAlign: t.headings.h1Alignment,
            }}
          >
            Título principal
          </div>
          <div
            className="text-[6px] leading-tight text-slate-700 space-y-0.5"
            style={{ textAlign: t.body.alignment }}
          >
            <div>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod.</div>
            <div>Tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim.</div>
            <div>Veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea.</div>
          </div>
          {t.footer.enabled && (
            <div className="absolute bottom-1.5 left-3 right-3 flex justify-between border-t border-slate-200 pt-1 text-[6px] text-slate-500">
              <span className="truncate">{t.footer.text || " "}</span>
              {t.footer.showPageNumber && <span>1</span>}
            </div>
          )}
          {selected && (
            <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated">
              <Check className="h-3.5 w-3.5" />
            </div>
          )}
        </div>
        <div className="p-4 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-sm text-foreground">{t.name}</h3>
            {t.isBuiltIn ? (
              <Badge variant="secondary" className="text-[10px] shrink-0">
                Plantilla base
              </Badge>
            ) : (
              <Badge className="bg-accent text-accent-foreground text-[10px] shrink-0">Personalizada</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{t.description}</p>
        </div>
      </Card>
    </button>
  );
};
