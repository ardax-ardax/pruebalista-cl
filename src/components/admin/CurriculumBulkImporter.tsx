import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface ParsedRow {
  line: number;
  raw: string;
  oa_code: string;
  grade_value: string;
  subject_value: string;
  eje: string | null;
  oa_description: string;
  error?: string;
}

const parseLine = (raw: string, line: number): ParsedRow => {
  const parts = raw.split("|").map((s) => s.trim());
  if (parts.length < 5) {
    return {
      line, raw,
      oa_code: "", grade_value: "", subject_value: "", eje: null, oa_description: "",
      error: `Se esperaban 5 columnas separadas por "|" (código | curso | asignatura | eje | descripción). Recibidas: ${parts.length}`,
    };
  }
  const [oa_code, grade_value, subject_value, eje, ...rest] = parts;
  const oa_description = rest.join(" | ").trim();
  const row: ParsedRow = {
    line, raw,
    oa_code, grade_value, subject_value,
    eje: eje || null,
    oa_description,
  };
  if (!oa_code) row.error = "Código OA vacío";
  else if (!grade_value) row.error = "Curso vacío";
  else if (!subject_value) row.error = "Asignatura vacía";
  else if (!oa_description) row.error = "Descripción vacía";
  return row;
};

export default function CurriculumBulkImporter() {
  const [decree, setDecree] = useState("");
  const [period, setPeriod] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isCurrent, setIsCurrent] = useState(true);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ParsedRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [extracting, setExtracting] = useState(false);

  const parseText = (value: string) => {
    const lines = value.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    if (lines.length === 0) {
      toast.error("No hay líneas para procesar");
      return;
    }
    setPreview(lines.map((l, i) => parseLine(l, i + 1)));
  };

  const handleParse = () => parseText(text);

  const handleExtractPdf = async () => {
    const url = pdfUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error("Ingresa una URL válida que empiece con http(s)://");
      return;
    }
    setExtracting(true);
    const { data, error } = await supabase.functions.invoke("extract-curriculum-pdf", {
      body: { url },
    });
    setExtracting(false);

    if (error) {
      const ctx = (error as unknown as { context?: { error?: string } }).context;
      toast.error(ctx?.error || error.message || "Error al extraer el PDF");
      return;
    }
    const res = data as {
      error?: string;
      curriculum_decree?: string;
      curriculum_period?: string;
      source_url?: string;
      truncated?: boolean;
      oas?: Array<{ oa_code?: string; grade_value?: string; subject_value?: string; eje?: string; oa_description?: string }>;
    };
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    const oas = Array.isArray(res?.oas) ? res.oas : [];
    if (oas.length === 0) {
      toast.error("La IA no encontró Objetivos de Aprendizaje en ese PDF");
      return;
    }

    if (res.curriculum_decree) setDecree(res.curriculum_decree);
    if (res.curriculum_period) setPeriod(res.curriculum_period);
    setSourceUrl(res.source_url || url);

    const generated = oas
      .map((o) =>
        [o.oa_code ?? "", o.grade_value ?? "", o.subject_value ?? "", o.eje ?? "", o.oa_description ?? ""]
          .map((s) => String(s).replace(/\|/g, "/").trim())
          .join(" | "),
      )
      .join("\n");
    setText(generated);
    parseText(generated);
    toast.success(
      `${oas.length} OA extraídos del PDF${res.truncated ? " (PDF muy largo: revisa si faltan OA)" : ""}. Revisa y corrige antes de importar.`,
    );
  };


  const stats = useMemo(() => {
    if (!preview) return { total: 0, valid: 0, invalid: 0 };
    const invalid = preview.filter((r) => r.error).length;
    return { total: preview.length, valid: preview.length - invalid, invalid };
  }, [preview]);

  const handleConfirm = async () => {
    if (!preview) return;
    const validRows = preview.filter((r) => !r.error);
    if (validRows.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }
    setImporting(true);
    const now = new Date().toISOString();
    const payload = validRows.map((r) => ({
      oa_code: r.oa_code,
      grade_value: r.grade_value,
      subject_value: r.subject_value,
      eje: r.eje,
      oa_description: r.oa_description,
      curriculum_decree: decree.trim() || null,
      curriculum_period: period.trim() || null,
      source_url: sourceUrl.trim() || null,
      is_current: isCurrent,
      extracted_at: now,
    }));

    const { error } = await supabase
      .from("curriculum_base")
      .upsert(payload, { onConflict: "grade_value,subject_value,oa_code" });

    setImporting(false);
    if (error) {
      toast.error("Error al importar: " + error.message);
      return;
    }
    toast.success(`${validRows.length} OA(s) importados / actualizados`);
    setText("");
    setPreview(null);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" /> Importación Masiva de Currículum
        </CardTitle>
        <CardDescription>
          Pega un lote de Objetivos de Aprendizaje extraídos de los PDFs oficiales del MINEDUC.
          Los metadatos de trazabilidad (decreto, período, URL) se aplican a todo el lote.
          El upsert usa <code className="text-xs bg-muted px-1 rounded">(curso, asignatura, código)</code> como clave.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Metadatos del lote */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Decreto</Label>
            <Input placeholder="Ej: Decreto 439/2012" value={decree} onChange={(e) => setDecree(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Período de vigencia</Label>
            <Input placeholder="Ej: 2012-vigente" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">URL del PDF oficial</Label>
            <Input placeholder="https://..." value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="is_current"
            type="checkbox"
            checked={isCurrent}
            onChange={(e) => setIsCurrent(e.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <Label htmlFor="is_current" className="text-sm cursor-pointer">
            Marcar estos OA como vigentes
          </Label>
        </div>

        {/* Área de pegado */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">
            Bloque de OA — un OA por línea, campos separados por "|"
          </Label>
          <Textarea
            rows={10}
            className="font-mono text-xs"
            placeholder={`# Formato: código | curso | asignatura | eje | descripción\nOA 01 | 1basico | matematica | Números | Contar números del 0 al 100 de 1 en 1...\nOA 02 | 1basico | matematica | Números | Identificar el orden de los elementos...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Líneas vacías y las que empiezan con <code>#</code> se ignoran. Los valores de curso y asignatura deben coincidir con los códigos internos (ej. <code>1basico</code>, <code>matematica</code>).
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleParse} disabled={!text.trim()} className="gap-2">
            <Upload className="h-4 w-4" /> Procesar y previsualizar
          </Button>
        </div>

        {/* Preview */}
        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1">
                Total: {stats.total}
              </Badge>
              <Badge variant="outline" className="gap-1 text-green-700 border-green-300 bg-green-50">
                <CheckCircle2 className="h-3 w-3" /> Válidas: {stats.valid}
              </Badge>
              {stats.invalid > 0 && (
                <Badge variant="outline" className="gap-1 text-destructive border-destructive/40 bg-destructive/5">
                  <AlertCircle className="h-3 w-3" /> Con error: {stats.invalid}
                </Badge>
              )}
            </div>

            {stats.invalid > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Las filas con error se ignorarán al confirmar. Corrígelas y vuelve a procesar si quieres incluirlas.
                </AlertDescription>
              </Alert>
            )}

            <div className="border rounded-md max-h-[400px] overflow-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Asignatura</TableHead>
                    <TableHead>Eje</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r) => (
                    <TableRow key={r.line} className={r.error ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{r.line}</TableCell>
                      <TableCell className="font-mono text-xs">{r.oa_code || "—"}</TableCell>
                      <TableCell className="text-xs">{r.grade_value || "—"}</TableCell>
                      <TableCell className="text-xs">{r.subject_value || "—"}</TableCell>
                      <TableCell className="text-xs">{r.eje || "—"}</TableCell>
                      <TableCell className="text-xs max-w-md truncate" title={r.oa_description}>
                        {r.oa_description || "—"}
                      </TableCell>
                      <TableCell>
                        {r.error ? (
                          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40" title={r.error}>
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">OK</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={importing}>
                Cancelar
              </Button>
              <Button onClick={handleConfirm} disabled={importing || stats.valid === 0} className="gap-2">
                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Confirmar e importar {stats.valid} OA(s)
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
