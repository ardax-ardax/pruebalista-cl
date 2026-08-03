import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/BrandLogo";


interface Props {
  children: React.ReactNode;
  /** Mensaje contextual (ej: "No pudimos cargar el editor"). */
  fallbackTitle?: string;
}

interface State {
  error: Error | null;
}

/**
 * Captura errores de render/lifecycle en el árbol React y muestra una pantalla
 * amigable con opción de reintentar, en lugar de pantalla en blanco.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="flex justify-center">
            <BrandIcon size="lg" className="opacity-70" />
          </div>
          <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">
            {this.props.fallbackTitle ?? "Algo salió mal"}
          </h2>

          <p className="text-sm text-muted-foreground">
            Tuvimos un problema al cargar esta sección. Puedes reintentar o
            recargar la página. Si el error persiste, contáctanos.
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={this.handleRetry}>
              <RefreshCw className="h-4 w-4" /> Reintentar
            </Button>
            <Button size="sm" onClick={this.handleReload}>
              Recargar
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
