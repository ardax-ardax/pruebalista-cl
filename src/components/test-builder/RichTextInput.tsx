import { useEffect, useRef } from "react";
import { Bold, Italic, Underline, RemoveFormatting } from "lucide-react";
import { cn } from "@/lib/utils";
import { sanitizeRichText } from "@/lib/rich-text";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export const RichTextInput = ({ value, onChange, placeholder, rows = 3, className }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string>(value ?? "");

  // Sincroniza contenido externo solo cuando difiere del último emitido
  // (evita resetear el cursor en cada render).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if ((value ?? "") !== lastEmitted.current) {
      el.innerHTML = sanitizeRichText(value ?? "");
      lastEmitted.current = value ?? "";
    }
  }, [value]);

  // Mount inicial
  useEffect(() => {
    if (ref.current && !ref.current.innerHTML) {
      ref.current.innerHTML = sanitizeRichText(value ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false);
    handleInput();
  };

  const handleInput = () => {
    const el = ref.current;
    if (!el) return;
    const html = sanitizeRichText(el.innerHTML);
    lastEmitted.current = html;
    onChange(html);
  };

  const minHeight = `${Math.max(1, rows) * 1.5}rem`;

  return (
    <div className={cn("rounded-md border border-input bg-background", className)}>
      <div className="flex items-center gap-1 border-b border-border px-1 py-1">
        <ToolbarBtn label="Negrita" onClick={() => exec("bold")}>
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Cursiva" onClick={() => exec("italic")}>
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Subrayado" onClick={() => exec("underline")}>
          <Underline className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn label="Quitar formato" onClick={() => exec("removeFormat")}>
          <RemoveFormatting className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder ?? ""}
        onInput={handleInput}
        onBlur={handleInput}
        className={cn(
          "rich-text-input px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 rounded-b-md",
          "[&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground [&:empty]:before:pointer-events-none",
        )}
        style={{ minHeight }}
      />
    </div>
  );
};

const ToolbarBtn = ({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
  >
    {children}
  </button>
);
