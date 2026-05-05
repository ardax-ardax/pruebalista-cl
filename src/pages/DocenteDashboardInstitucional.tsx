import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FilePlus2, Library, FileText, Sparkles } from "lucide-react";

export default function DocenteDashboardInstitucional() {
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-8">
        {/* Welcome */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Panel Institucional
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            ¡Bienvenido! Tu colegio ya es parte de PruebaLista
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Estamos preparando tu nuevo panel institucional. Mientras tanto,
            puedes seguir creando evaluaciones y usando todas las herramientas.
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid sm:grid-cols-3 gap-4">
          <Card className="hover:shadow-[var(--shadow-elevated)] transition-shadow">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FilePlus2 className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Crear Evaluación</h3>
              <p className="text-xs text-muted-foreground">
                Genera una nueva prueba alineada al currículum
              </p>
              <Button asChild className="w-full mt-auto">
                <Link to="/crear-prueba">Crear</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-[var(--shadow-elevated)] transition-shadow">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Library className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Banco de Preguntas</h3>
              <p className="text-xs text-muted-foreground">
                Reutiliza preguntas de evaluaciones anteriores
              </p>
              <Button asChild variant="outline" className="w-full mt-auto">
                <Link to="/banco-preguntas">Ver banco</Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-[var(--shadow-elevated)] transition-shadow">
            <CardContent className="p-6 flex flex-col items-center text-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">Mis Pruebas</h3>
              <p className="text-xs text-muted-foreground">
                Revisa y gestiona tus evaluaciones creadas
              </p>
              <Button asChild variant="outline" className="w-full mt-auto">
                <Link to="/pruebas">Ver pruebas</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
