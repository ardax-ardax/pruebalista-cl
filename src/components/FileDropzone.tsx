import { useCallback, useState } from "react";
import { Upload, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export const FileDropzone = ({ onFile, disabled }: Props) => {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file && file.name.endsWith(".docx")) onFile(file);
    },
    [onFile, disabled],
  );

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-smooth cursor-pointer",
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/40",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-primary shadow-card">
        <Upload className="h-6 w-6 text-primary-foreground" />
      </div>
      <div>
        <div className="font-medium text-foreground">Arrastra tu documento Word aquí</div>
        <div className="text-sm text-muted-foreground mt-1">
          o haz clic para seleccionar un archivo .docx
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
        Solo archivos .docx (Word 2007+)
      </div>
      <input
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />
    </label>
  );
};
