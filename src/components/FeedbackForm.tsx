import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupportTicket, type TicketCategory } from "@/lib/support-tickets";
import { toast } from "sonner";

interface FeedbackFormProps {
  onSubmitted?: () => void;
  showTitle?: boolean;
}

const categoryOptions: { value: TicketCategory; label: string }[] = [
  { value: "bug", label: "Error/Bug" },
  { value: "duda", label: "Duda" },
  { value: "mejora", label: "Mejora" },
  { value: "cuenta", label: "Problema de cuenta" },
];

export function FeedbackForm({ onSubmitted, showTitle = true }: FeedbackFormProps) {
  const [category, setCategory] = useState<TicketCategory>("bug");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error("Escribe un mensaje antes de enviar");
      return;
    }
    setLoading(true);
    const res = await createSupportTicket({
      message: trimmed,
      category,
      page_url: typeof window !== "undefined" ? window.location.href : null,
      user_agent: typeof window !== "undefined" ? navigator.userAgent : null,
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Mensaje enviado. Te responderemos lo antes posible.");
      setMessage("");
      setCategory("bug");
      onSubmitted?.();
    } else {
      toast.error(res.error ?? "No se pudo enviar el mensaje");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showTitle && (
        <div className="flex items-center gap-2 text-foreground">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Reportar un problema</span>
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="feedback-category" className="text-xs">
          Tipo de solicitud
        </Label>
        <Select value={category} onValueChange={(v) => setCategory(v as TicketCategory)}>
          <SelectTrigger id="feedback-category" className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categoryOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="feedback-message" className="text-xs">
          Cuéntanos qué ocurre
        </Label>
        <Textarea
          id="feedback-message"
          placeholder="Describe el problema con el mayor detalle posible..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="resize-none text-sm"
        />
      </div>
      <Button type="submit" disabled={loading || !message.trim()} className="w-full gap-2">
        {loading ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Enviar mensaje
      </Button>
    </form>
  );
}
