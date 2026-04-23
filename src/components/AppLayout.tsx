import { NavLink } from "react-router-dom";
import { FilePlus2, FileText, Library, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-primary shadow-card">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-foreground">Estandarizador</div>
              <div className="text-xs text-muted-foreground">Documentos del colegio</div>
            </div>
          </NavLink>
          <nav className="flex items-center gap-1">
            <NavItem to="/" label="Crear prueba" icon={FilePlus2} />
            <NavItem to="/pruebas" label="Mis pruebas" icon={Library} />
            <NavItem to="/configuracion" label="Configuración" icon={Settings} />
          </nav>
        </div>
      </header>
      <main className="container py-8">{children}</main>
      <footer className="border-t border-border py-6 mt-12">
        <div className="container text-center text-xs text-muted-foreground">
          Procesamiento 100% en el navegador. Tus documentos no se suben a ningún servidor.
        </div>
      </footer>
    </div>
  );
};

const NavItem = ({ to, label, icon: Icon }: { to: string; label: string; icon: typeof FileText }) => (
  <NavLink
    to={to}
    end={to === "/"}
    className={({ isActive }) =>
      cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-smooth",
        isActive
          ? "bg-primary text-primary-foreground shadow-card"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )
    }
  >
    <Icon className="h-4 w-4" />
    <span className="hidden sm:inline">{label}</span>
  </NavLink>
);
