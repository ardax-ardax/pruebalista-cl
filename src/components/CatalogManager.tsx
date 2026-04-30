import { useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sanitizeFileToken, type CatalogOption } from "@/lib/catalog";

interface CatalogManagerProps {
  title: string;
  description: string;
  items: CatalogOption[];
  onChange: (items: CatalogOption[]) => void;
  onReset: () => void;
  labelPlaceholder: string;
  valuePlaceholder: string;
}

export const CatalogManager = ({
  title,
  description,
  items,
  onChange,
  onReset,
  labelPlaceholder,
  valuePlaceholder,
}: CatalogManagerProps) => {
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");

  const handleAdd = () => {
    const label = newLabel.trim();
    const value = sanitizeFileToken(newValue || newLabel);
    if (!label || !value) return;
    if (items.some((i) => i.value === value)) return;
    onChange([...items, { label, value }]);
    setNewLabel("");
    setNewValue("");
  };

  const handleRemove = (value: string) => {
    onChange(items.filter((i) => i.value !== value));
  };

  const handleEdit = (idx: number, field: "label" | "value", v: string) => {
    const next = [...items];
    next[idx] = {
      ...next[idx],
      [field]: field === "value" ? sanitizeFileToken(v) : v,
    };
    onChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 shrink-0">
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar
        </Button>
      </div>

      <div className="rounded-md border border-border">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-1.5 bg-muted/40 text-[11px] font-medium text-muted-foreground sticky top-0 rounded-t-md">
          <div>Etiqueta</div>
          <div>Valor en archivo</div>
          <div className="w-7" />
        </div>
        <div className="max-h-[260px] overflow-y-auto divide-y divide-border">
          {items.map((item, idx) => (
            <div key={`${item.value}-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-1.5 items-center">
              <Input
                value={item.label}
                onChange={(e) => handleEdit(idx, "label", e.target.value)}
                className="h-7 text-sm"
              />
              <Input
                value={item.value}
                onChange={(e) => handleEdit(idx, "value", e.target.value)}
                className="h-7 font-mono text-xs"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleRemove(item.value)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))}
          {items.length === 0 && (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No hay elementos. Agrega uno abajo.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[11px]">Etiqueta</Label>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={labelPlaceholder}
            className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px]">Valor en archivo</Label>
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={valuePlaceholder}
            className="h-8 font-mono text-xs"
          />
        </div>
        <Button onClick={handleAdd} size="sm" className="gap-1.5 h-8">
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
    </div>
  );
};
