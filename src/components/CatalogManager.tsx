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

      <div className="rounded-md border border-border divide-y divide-border">
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 bg-muted/40 text-xs font-medium text-muted-foreground">
          <div>Etiqueta</div>
          <div>Valor en archivo</div>
          <div className="w-8" />
        </div>
        {items.map((item, idx) => (
          <div key={`${item.value}-${idx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2 px-3 py-2 items-center">
            <Input
              value={item.label}
              onChange={(e) => handleEdit(idx, "label", e.target.value)}
              className="h-8"
            />
            <Input
              value={item.value}
              onChange={(e) => handleEdit(idx, "value", e.target.value)}
              className="h-8 font-mono text-xs"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleRemove(item.value)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {items.length === 0 && (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">
            No hay elementos. Agrega uno abajo.
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Etiqueta</Label>
          <Input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder={labelPlaceholder}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor en archivo</Label>
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={valuePlaceholder}
            className="h-9 font-mono text-xs"
          />
        </div>
        <Button onClick={handleAdd} className="gap-1.5 h-9">
          <Plus className="h-4 w-4" />
          Agregar
        </Button>
      </div>
    </div>
  );
};
