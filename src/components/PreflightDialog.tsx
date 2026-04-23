import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { PreflightFinding } from "@/lib/docx-processor";

interface Props {
  open: boolean;
  fileName?: string;
  findings: PreflightFinding[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function PreflightDialog({ open, fileName, findings, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Elementos potencialmente conflictivos
          </DialogTitle>
          <DialogDescription>
            {fileName ? <span className="font-mono text-xs">{fileName}</span> : "El documento"}{" "}
            contiene elementos que la estandarización podría no preservar correctamente. Puedes
            continuar (lo más común es que funcione), pero revisa el resultado con cuidado.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 text-sm">
          {findings.map((f) => (
            <li key={f.kind} className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="text-warning mt-0.5">•</span>
              <span className="text-foreground">{f.label}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Procesar de todas formas</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
