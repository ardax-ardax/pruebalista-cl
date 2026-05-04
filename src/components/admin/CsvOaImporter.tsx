import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { saveBulkOAs, type OverrideOA } from "@/lib/curriculum-overrides";
import type { Indicator } from "@/lib/curriculum-data";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}

interface ParsedOA {
  grade_value: string;
  subject_value: string;
  oa_code: string;
  oa_description: string;
  eje: string;
  indicators: Indicator[];
}

const parseCSV = (text: string): { oas: ParsedOA[]; errors: string[] } => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { oas: [], errors: ["El archivo está vacío o solo tiene encabezado."] };

  const errors: string[] = [];
  const map = new Map<string, ParsedOA>();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[;,](?=(?:[^"]*"[^"]*")*[^"]*$)/).map((c) => c.replace(/^"|"$/g, "").trim());
    if (cols.length < 4) {
      errors.push(`Fila ${i + 1}: menos de 4 columnas.`);
      continue;
    }
    const [curso, asignatura, codigo, descripcion, eje = "", indCodigo = "", indDescripcion = ""] = cols;
    if (!curso || !asignatura || !codigo || !descripcion) {
      errors.push(`Fila ${i + 1}: faltan campos obligatorios.`);
      continue;
    }
    const key = `${curso}|${asignatura}|${codigo}`;
    if (!map.has(key)) {
      map.set(key, {
        grade_value: curso,
        subject_value: asignatura,
        oa_code: codigo,
        oa_description: descripcion,
        eje,
        indicators: [],
      });
    }
    const entry = map.get(key)!;
    if (indCodigo && indDescripcion) {
      entry.indicators.push({ code: indCodigo, description: indDescripcion });
    }
  }

  return { oas: Array.from(map.values()), errors };
};

export const CsvOaImporter = ({ open, onOpenChange, onImported }: Props) => {
  const [parsed, setParsed] = useState<ParsedOA[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [fileName, setFileName] = useState("");

  const reset = () => {
    setParsed(null);
    setParseErrors([]);
    setFileName("");
  };

  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { oas, errors } = parseCSV(text);
      setParsed(oas);
      setParseErrors(errors);
    };
    reader.readAsText(file, "UTF-8");
  }, []);

  const handleImport = async () => {
    if (!parsed?.length) return;
    setSaving(true);
    try {
      const entries: OverrideOA[] = parsed;
      const res = await saveBulkOAs(entries);
      if (res.cloud) {
        toast.success(`${res.count} OAs importados correctamente.`);
        onImported();
        onOpenChange(false);
        reset();
      } else {
        toast.error("Error al importar: " + (res.error ?? "desconocido"));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar OAs desde CSV</DialogTitle>
          <DialogDescription>
            Formato: <code className="text-xs bg-muted px-1 rounded">curso,asignatura,codigo_oa,descripcion,eje,indicador_codigo,indicador_descripcion</code>.
            Varias filas con el mismo código agrupan indicadores.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <label className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center cursor-pointer border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/40 transition-all">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="font-medium text-foreground">Arrastra tu archivo CSV aquí</div>
              <div className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</div>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3.5 w-3.5" /> Archivos .csv (separados por coma o punto y coma)
            </div>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="font-medium">{fileName}</span>
              <Badge variant="secondary">{parsed.length} OAs</Badge>
              <Badge variant="secondary">
                {parsed.reduce((s, o) => s + o.indicators.length, 0)} indicadores
              </Badge>
              <Button size="sm" variant="ghost" className="ml-auto text-xs" onClick={reset}>
                Cambiar archivo
              </Button>
            </div>

            {parseErrors.length > 0 && (
              <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                  <AlertCircle className="h-4 w-4" /> {parseErrors.length} advertencia{parseErrors.length > 1 ? "s" : ""}
                </div>
                {parseErrors.slice(0, 5).map((e, i) => (
                  <div key={i} className="text-xs text-destructive/80">{e}</div>
                ))}
                {parseErrors.length > 5 && <div className="text-xs text-destructive/60">...y {parseErrors.length - 5} más.</div>}
              </div>
            )}

            <div className="rounded-md border border-border p-2 space-y-1.5">
              {parsed.slice(0, 10).map((oa, i) => (
                <div key={i} className="text-xs leading-snug p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{oa.oa_code}</span>
                    <span className="text-muted-foreground">{oa.grade_value} · {oa.subject_value}</span>
                    {oa.eje && <span className="text-muted-foreground">· {oa.eje}</span>}
                  </div>
                  <div className="text-muted-foreground mt-0.5 line-clamp-2">{oa.oa_description}</div>
                  {oa.indicators.length > 0 && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {oa.indicators.length} indicador{oa.indicators.length > 1 ? "es" : ""}
                    </div>
                  )}
                </div>
              ))}
              {parsed.length > 10 && (
                <div className="text-xs text-muted-foreground text-center py-1">...y {parsed.length - 10} más.</div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { reset(); onOpenChange(false); }} disabled={saving}>Cancelar</Button>
          <Button onClick={handleImport} disabled={saving || !parsed?.length} className="gap-2">
            <Upload className="h-4 w-4" /> {saving ? "Importando…" : `Importar ${parsed?.length ?? 0} OAs`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
