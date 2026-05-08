import { useState } from "react";
import { Sparkles, HelpCircle, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useHelpTour, type TourVariant } from "@/components/help/HelpTour";

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_BY_VARIANT: Record<TourVariant, FaqItem[]> = {
  utp: [
    {
      q: "¿Cómo recupero créditos de pruebas rechazadas?",
      a: "En el panel de Consumo verás el detalle por docente. Los créditos se devuelven automáticamente a la bolsa del colegio cuando rechazas una prueba con motivo justificado.",
    },
    {
      q: "¿Cómo subo el logo del colegio?",
      a: "Ve a Configuración → Identidad institucional. Puedes subir un logo (PNG/JPG) que se aplicará automáticamente al encabezado de todas las pruebas del colegio.",
    },
    {
      q: "¿Cómo apruebo o rechazo pruebas de mis docentes?",
      a: "Desde Configuración → Revisiones puedes ver la cola de pruebas pendientes, revisarlas y dejar feedback al docente.",
    },
  ],
  docente_inst: [
    {
      q: "¿Por qué mi saldo de créditos es cero?",
      a: "Tu cuenta es institucional: usas la bolsa común de créditos del colegio gestionada por UTP. No necesitas saldo personal.",
    },
    {
      q: "¿Quién aprueba mis evaluaciones?",
      a: "Tu Jefe de UTP revisa cada prueba enviada y puede aprobarla o devolverla con feedback antes de que se considere oficial.",
    },
    {
      q: "¿Puedo crear cursos propios?",
      a: "No. Los cursos institucionales los gestiona UTP para mantener una estructura unificada del colegio.",
    },
  ],
  docente_auto: [
    {
      q: "¿Mis pruebas son privadas?",
      a: "Sí, completamente. Como docente autónomo, solo tú puedes ver y editar tus pruebas. Nadie más tiene acceso.",
    },
    {
      q: "¿Cómo funcionan mis créditos?",
      a: "Tienes una bolsa personal de créditos que se descuenta cada vez que generas preguntas con IA. Puedes ver tu saldo en el header.",
    },
    {
      q: "¿Cómo creo mis propios cursos?",
      a: "Desde Mi Perfil puedes definir los cursos y asignaturas con los que trabajas. Estos quedan asociados solo a tu cuenta.",
    },
  ],
};

const VARIANT_LABEL: Record<TourVariant, string> = {
  utp: "Jefe UTP",
  docente_inst: "Docente Institucional",
  docente_auto: "Docente Autónomo",
};

interface HelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  const { startTour, variant } = useHelpTour();
  const [tab, setTab] = useState<"guia" | "faq">("guia");
  const faqs = FAQ_BY_VARIANT[variant];

  const handleStartTour = () => {
    onOpenChange(false);
    setTimeout(() => startTour(), 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Centro de Ayuda
          </DialogTitle>
          <DialogDescription>
            Contenido personalizado para tu perfil:{" "}
            <span className="font-medium text-foreground">{VARIANT_LABEL[variant]}</span>
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "guia" | "faq")} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="guia">Guía Rápida</TabsTrigger>
            <TabsTrigger value="faq">Preguntas Frecuentes</TabsTrigger>
          </TabsList>

          <TabsContent value="guia" className="space-y-4 pt-4">
            <div className="rounded-lg border border-border bg-gradient-subtle p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-base font-semibold">Tour interactivo</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Recorre las funciones principales adaptadas a tu rol. Puedes reiniciar el tour en cualquier momento.
              </p>
              <Button onClick={handleStartTour} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Iniciar Tour Guiado
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="faq" className="pt-4">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((item, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-sm">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="mt-6 flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground">
              <MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-foreground">Próximamente:</strong> Sistema de soporte por tickets para mayor trazabilidad.
              </span>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
