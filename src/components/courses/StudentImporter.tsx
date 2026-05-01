// Importador masivo de estudiantes desde CSV o XLSX.
// Flujo: usuario selecciona curso destino → sube archivo → preview con
// limpieza/validación de RUT → confirma → bulk insert.

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Loader2, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cleanRut, isValidRut, formatRut } from "@/lib/rut";
import { bulkInsertStudents, type Course, type NewStudent } from "@/lib/courses";

interface ParsedRow {
  index: number;            // fila del archivo (1-based, sin contar header)
  rawRut: string;
  rawNombres: string;
  rawApellidos: string;
  cleanedRut: string;
  valid: boolean;
  error?: string;
}

interface Props {
  courses: Course[];
  onImported: () => void;
}

export const StudentImporter = ({ courses, onImported }: Props) => {
  const [courseId, setCourseId] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const valid = useMemo(() => rows.filter((r) => r.valid), [rows]);
  const invalid = useMemo(() => rows.filter((r) => !r.valid), [rows]);

  const downloadTemplate = () => {
    // CSV simple con BOM para Excel y los encabezados pedidos.
    const content = "\ufeffRUT,Nombres,Apellidos\n12345678-9,Juan Andrés,Pérez Soto\n";
    const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "plantilla_estudiantes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const parsed = parseRows(json);
      setRows(parsed);
      if (parsed.length === 0) toast.warning("El archivo está vacío.");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo leer el archivo. Verifica el formato.");
      setRows([]);
    }
  };

  const handleImport = async () => {
    if (!courseId) {
      toast.error("Selecciona el curso de destino.");
      return;
    }
    if (valid.length === 0) {
      toast.error("No hay filas válidas para importar.");
      return;
    }
    setImporting(true);
    try {
      const payload: NewStudent[] = valid.map((r) => ({
        rut: r.cleanedRut,
        first_name: r.rawNombres.trim(),
        last_name: r.rawApellidos.trim(),
        course_id: courseId,
      }));
      const result = await bulkInsertStudents(payload);
      const parts: string[] = [];
      if (result.inserted) parts.push(`${result.inserted} importados`);
      if (result.duplicates) parts.push(`${result.duplicates} duplicados ignorados`);
      if (result.failed.length) parts.push(`${result.failed.length} con error`);
      toast.success(parts.join(" · ") || "Sin cambios.");
      setRows([]);
      setFileName("");
      if (fileRef.current) fileRef.current.value = "";
      onImported();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Error al importar estudiantes.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Importador masivo</h3>
          <p className="text-sm text-muted-foreground">
            Sube un archivo CSV o Excel con las columnas <strong>RUT</strong>, <strong>Nombres</strong> y <strong>Apellidos</strong>.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2">
          <Download className="h-4 w-4" />
          Plantilla CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="import-course">Curso de destino *</Label>
          <Select value={courseId} onValueChange={setCourseId}>
            <SelectTrigger id="import-course">
              <SelectValue placeholder="Selecciona un curso…" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} — {c.level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="import-file">Archivo CSV o Excel</Label>
          <input
            id="import-file"
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            disabled={!courseId}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-primary-foreground file:hover:bg-primary/90 disabled:opacity-50"
          />
          {!courseId && (
            <p className="text-xs text-muted-foreground">Selecciona el curso antes de subir el archivo.</p>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{fileName}</span>
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {valid.length} válidos
            </Badge>
            {invalid.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {invalid.length} con error
              </Badge>
            )}
          </div>

          {invalid.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Filas con problemas</AlertTitle>
              <AlertDescription>
                Estas filas serán ignoradas. Corrígelas en el archivo y vuelve a subirlo si las necesitas.
              </AlertDescription>
            </Alert>
          )}

          <div className="max-h-72 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>RUT</TableHead>
                  <TableHead>Nombres</TableHead>
                  <TableHead>Apellidos</TableHead>
                  <TableHead className="w-24">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 200).map((r) => (
                  <TableRow key={r.index} className={r.valid ? "" : "bg-destructive/5"}>
                    <TableCell className="text-xs text-muted-foreground">{r.index}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {r.valid ? formatRut(r.cleanedRut) : r.rawRut}
                    </TableCell>
                    <TableCell className="text-sm">{r.rawNombres}</TableCell>
                    <TableCell className="text-sm">{r.rawApellidos}</TableCell>
                    <TableCell>
                      {r.valid ? (
                        <Badge variant="secondary" className="text-[10px]">OK</Badge>
                      ) : (
                        <span className="text-xs text-destructive" title={r.error}>
                          {r.error}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length > 200 && (
              <div className="p-2 text-center text-xs text-muted-foreground">
                Mostrando primeras 200 filas de {rows.length}.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setRows([]);
                setFileName("");
                if (fileRef.current) fileRef.current.value = "";
              }}
              disabled={importing}
            >
              Cancelar
            </Button>
            <Button onClick={handleImport} disabled={importing || valid.length === 0 || !courseId} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Importar {valid.length} estudiantes
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

// Encabezados aceptados (insensible a mayúsculas/acentos).
const HEADER_MAP: Record<string, "rut" | "nombres" | "apellidos"> = {
  rut: "rut",
  rol: "rut",
  run: "rut",
  nombres: "nombres",
  nombre: "nombres",
  apellidos: "apellidos",
  apellido: "apellidos",
};

const norm = (s: string) =>
  s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function parseRows(json: Record<string, unknown>[]): ParsedRow[] {
  if (json.length === 0) return [];
  // Mapea encabezados reales del archivo a campos canónicos.
  const firstRow = json[0];
  const colMap: Record<string, "rut" | "nombres" | "apellidos"> = {};
  for (const key of Object.keys(firstRow)) {
    const mapped = HEADER_MAP[norm(key)];
    if (mapped) colMap[key] = mapped;
  }
  const seen = new Set<string>();
  return json.map((row, i) => {
    const get = (target: "rut" | "nombres" | "apellidos") => {
      const k = Object.keys(colMap).find((kk) => colMap[kk] === target);
      return k ? String(row[k] ?? "").trim() : "";
    };
    const rawRut = get("rut");
    const rawNombres = get("nombres");
    const rawApellidos = get("apellidos");
    const cleanedRut = cleanRut(rawRut);

    let valid = true;
    let error: string | undefined;

    if (!rawRut || !rawNombres || !rawApellidos) {
      valid = false;
      error = "Campos vacíos";
    } else if (!isValidRut(cleanedRut)) {
      valid = false;
      error = "RUT inválido";
    } else if (seen.has(cleanedRut)) {
      valid = false;
      error = "Duplicado en archivo";
    } else {
      seen.add(cleanedRut);
    }

    return {
      index: i + 1,
      rawRut,
      rawNombres,
      rawApellidos,
      cleanedRut,
      valid,
      error,
    };
  });
}
