import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedbackForm } from "@/components/FeedbackForm";
import { cn } from "@/lib/utils";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {open && (
        <Card className="w-[min(92vw,360px)] shadow-xl border border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Ayuda y feedback</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-4">
            <FeedbackForm onSubmitted={() => setOpen(false)} showTitle={false} />
          </div>
        </Card>
      )}
      <Button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "h-12 w-12 rounded-full shadow-lg transition-transform hover:scale-105",
          open && "bg-muted hover:bg-muted text-foreground",
        )}
        size="icon"
        aria-label={open ? "Cerrar ayuda" : "Abrir ayuda y feedback"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </Button>
    </div>
  );
}
