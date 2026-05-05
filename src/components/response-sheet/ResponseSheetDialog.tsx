import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import type { Assessment, Question } from "@/lib/assessment-schema";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assessment: Assessment;
  institutionName: string;
}

type AnswerEntry = {
  num: number;
  type: "mc";
  options: string[];
} | {
  num: number;
  type: "tf";
};

function buildEntries(questions: Question[]): AnswerEntry[] {
  const entries: AnswerEntry[] = [];
  let num = 1;
  for (const q of questions) {
    if (q.type === "section-title" || q.type === "info-block" || q.type === "short-answer") continue;
    if (q.type === "multiple-choice" && q.options) {
      const letters = q.options.map((_, i) => String.fromCharCode(65 + i));
      entries.push({ num, type: "mc", options: letters });
    } else if (q.type === "true-false") {
      entries.push({ num, type: "tf" });
    }
    num++;
  }
  return entries;
}

function generateResponseSheetHtml(
  entries: AnswerEntry[],
  title: string,
  institutionName: string,
): string {
  const COLS = entries.length > 30 ? 4 : entries.length > 15 ? 3 : 2;
  const perCol = Math.ceil(entries.length / COLS);

  const columns: string[] = [];
  for (let c = 0; c < COLS; c++) {
    const slice = entries.slice(c * perCol, (c + 1) * perCol);
    const rows = slice
      .map((e) => {
        const bubbles =
          e.type === "mc"
            ? e.options.map((l) => `<span class="rs-bubble">${l}</span>`).join("")
            : `<span class="rs-bubble">V</span><span class="rs-bubble">F</span>`;
        return `<tr><td class="rs-num">${e.num}.</td><td class="rs-opts">${bubbles}</td></tr>`;
      })
      .join("");
    columns.push(`<table class="rs-col"><tbody>${rows}</tbody></table>`);
  }

  return `
<div class="rs-page">
  <div class="rs-header">
    <div class="rs-institution">${institutionName}</div>
    <div class="rs-title">Hoja de Respuestas — ${title}</div>
    <div class="rs-fields">
      <div class="rs-field"><span class="rs-field-label">Nombre:</span><span class="rs-field-line"></span></div>
      <div class="rs-field-row">
        <div class="rs-field rs-field-half"><span class="rs-field-label">Curso:</span><span class="rs-field-line"></span></div>
        <div class="rs-field rs-field-half"><span class="rs-field-label">Fecha:</span><span class="rs-field-line"></span></div>
      </div>
    </div>
  </div>
  <div class="rs-grid">${columns.join("")}</div>
  <div class="rs-footer">Total: ${entries.length} preguntas</div>
</div>`;
}

const RESPONSE_SHEET_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: letter; margin: 15mm; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #000; }
  .rs-page { max-width: 100%; }
  .rs-header { margin-bottom: 16pt; border-bottom: 1.5pt solid #000; padding-bottom: 10pt; }
  .rs-institution { font-size: 11pt; font-weight: bold; text-align: center; margin-bottom: 2pt; }
  .rs-title { font-size: 12pt; font-weight: bold; text-align: center; margin-bottom: 10pt; }
  .rs-fields { margin-top: 8pt; }
  .rs-field { display: flex; align-items: baseline; gap: 4pt; margin-bottom: 6pt; }
  .rs-field-label { font-weight: bold; white-space: nowrap; font-size: 9pt; }
  .rs-field-line { flex: 1; border-bottom: 0.5pt solid #000; min-width: 100pt; }
  .rs-field-row { display: flex; gap: 16pt; }
  .rs-field-half { flex: 1; }
  .rs-grid { display: flex; gap: 12pt; justify-content: space-between; }
  .rs-col { flex: 1; border-collapse: collapse; }
  .rs-col tr { border-bottom: 0.5pt solid #ddd; }
  .rs-num { padding: 3pt 4pt 3pt 0; font-weight: bold; font-size: 9pt; text-align: right; width: 24pt; vertical-align: middle; }
  .rs-opts { padding: 3pt 0; vertical-align: middle; }
  .rs-bubble {
    display: inline-flex; align-items: center; justify-content: center;
    width: 18pt; height: 18pt; border: 1pt solid #000; border-radius: 50%;
    font-size: 8pt; font-weight: bold; margin-right: 4pt; text-align: center;
  }
  .rs-footer { margin-top: 10pt; font-size: 8pt; color: #666; text-align: right; }
`;

export function ResponseSheetDialog({ open, onOpenChange, assessment, institutionName }: Props) {
  const entries = useMemo(() => buildEntries(assessment.questions), [assessment.questions]);

  const handlePrint = () => {
    if (entries.length === 0) return;
    const html = generateResponseSheetHtml(entries, assessment.meta.title, institutionName);
    const win = window.open("", "_blank", "width=900,height=1200");
    if (!win) return;
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"/><title>Hoja de Respuestas</title><style>${RESPONSE_SHEET_CSS}</style></head><body>${html}</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hoja de Respuestas</DialogTitle>
          <DialogDescription>
            Genera una hoja imprimible con la grilla de respuestas para {entries.length} preguntas objetivas.
          </DialogDescription>
        </DialogHeader>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No hay preguntas de selección múltiple o verdadero/falso en esta evaluación.
          </p>
        ) : (
          <div className="text-sm text-muted-foreground space-y-1 py-2">
            <p>Incluye campos para: <strong>Nombre</strong>, <strong>Curso</strong> y <strong>Fecha</strong>.</p>
            <p>Se organizará en columnas para ahorrar papel.</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handlePrint} disabled={entries.length === 0} className="gap-1">
            <Printer className="h-4 w-4" /> Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
