import { NavLink, useNavigate } from "react-router-dom";
import { ExternalLink, FilePlus2, FileText, GraduationCap, Library, LogOut, Settings, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import { useIsEmbedded, openInNewTab } from "@/hooks/useIsEmbedded";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isStaff, signOut } = useAuth();
  const { planType, creditsAvailable } = useUserUsage();
  const navigate = useNavigate();
  const isEmbedded = useIsEmbedded();

  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const displayName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    (user?.email ? user.email.split("@")[0] : "Usuario");
  const avatarUrl = (meta.avatar_url as string) || (meta.picture as string) || undefined;
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth", { replace: true });
  };

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
            {isStaff && <NavItem to="/cursos" label="Cursos" icon={GraduationCap} />}
            {isAdmin && <NavItem to="/configuracion" label="Configuración" icon={Settings} />}
            {isEmbedded && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openInNewTab(window.location.pathname)}
                className="ml-1 gap-2"
                title="Abrir en pantalla completa"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Pantalla completa</span>
              </Button>
            )}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="ml-1 rounded-full">
                    <Avatar className="h-8 w-8">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                      <AvatarFallback className="text-xs">{initials || "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{displayName}</span>
                      {isAdmin && (
                        <Badge variant="secondary" className="text-[10px]">Admin</Badge>
                      )}
                    </div>
                    {user.email && (
                      <div className="text-xs font-normal text-muted-foreground truncate">
                        {user.email}
                      </div>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 text-destructive focus:text-destructive">
                    <LogOut className="h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>
        </div>
      </header>
      <main className="container py-8">{children}</main>
      {!isEmbedded && (
        <footer className="border-t border-border py-6 mt-12">
          <div className="container text-center text-xs text-muted-foreground">
            Procesamiento 100% en el navegador. Tus documentos no se suben a ningún servidor.
          </div>
        </footer>
      )}
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
