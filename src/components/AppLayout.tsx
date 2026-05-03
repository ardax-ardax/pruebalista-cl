import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ExternalLink, FilePlus2, FileText, GraduationCap, Library, LogOut, Settings, Shield, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserUsage } from "@/hooks/useUserUsage";
import { useIsEmbedded, openInNewTab } from "@/hooks/useIsEmbedded";
import { loadAppSettings } from "@/lib/app-settings";
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
  const { user, isAdmin, isUtpHead, isStaff, role, signOut } = useAuth();
  const { effectivePlan, creditsAvailable, loading: usageLoading } = useUserUsage();
  const navigate = useNavigate();
  const isEmbedded = useIsEmbedded();
  const [hideCredits, setHideCredits] = useState(false);

  useEffect(() => {
    loadAppSettings().then((s) => setHideCredits(s.hide_credits_from_teachers));
  }, []);

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

  // Si hide_credits está activo y el usuario es docente (rol user), ocultar créditos y mostrar badge institucional
  const isTeacher = role === "user" || (!role && !isStaff && !isAdmin);
  const shouldHideCredits = hideCredits && isTeacher;

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
            <NavItem to="/banco-preguntas" label="Banco" icon={Library} />
            <NavItem to="/pruebas" label="Mis pruebas" icon={Library} />
            {isUtpHead && <NavItem to="/cursos" label="Cursos" icon={GraduationCap} />}
            {isStaff && <NavItem to="/configuracion" label="Configuración" icon={Settings} />}
            {isAdmin && <NavItem to="/admin/dashboard" label="Admin" icon={Shield} />}
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
            {user && !usageLoading && shouldHideCredits && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] font-medium">Plan Institucional</Badge>
            )}
            {user && !usageLoading && !shouldHideCredits && effectivePlan === "free" && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                <Sparkles className="h-3 w-3" /> {creditsAvailable} créditos IA
              </Badge>
            )}
            {user && !usageLoading && !shouldHideCredits && effectivePlan === "pro" && (
              <Badge className="bg-primary/10 text-primary text-[10px] font-medium border-primary/20">Pro</Badge>
            )}
            {user && !usageLoading && !shouldHideCredits && effectivePlan === "institucional" && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] font-medium">Institucional</Badge>
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
                  <DropdownMenuItem onClick={() => navigate("/perfil")} className="gap-2">
                    <User className="h-4 w-4" />
                    Mi Perfil
                  </DropdownMenuItem>
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
