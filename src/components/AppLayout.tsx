import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Building2, ExternalLink, FilePlus2, FileText, HelpCircle, Home, Library, LogOut, Settings, Shield, Sparkles, User } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { getMyProfile } from "@/lib/profiles";
import { supabase } from "@/integrations/supabase/client";
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
import { HelpModal } from "@/components/help/HelpModal";
import { PlanExpirationBanner } from "@/components/PlanExpirationBanner";

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, isAdmin, isUtpHead, isStaff, role, signOut } = useAuth();
  const isAdminOnly = isAdmin && !isUtpHead;
  const { effectivePlan, creditsAvailable, loading: usageLoading, planLabel, showWatermark, planExpiresAt, planType } = useUserUsage();
  const navigate = useNavigate();
  const isEmbedded = useIsEmbedded();
  const [helpOpen, setHelpOpen] = useState(false);
  const [hideCredits, setHideCredits] = useState(false);
  const [isInstitutional, setIsInstitutional] = useState(false);
  const [colegioNombre, setColegioNombre] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    loadAppSettings().then((s) => setHideCredits(s.hide_credits_from_teachers));
  }, []);

  // Detect institutional user (has colegio_id) and load colegio name
  useEffect(() => {
    if (!user) { setProfileLoaded(false); return; }
    setProfileLoaded(false);
    getMyProfile().then(async (p) => {
      if (p?.colegioId) {
        setIsInstitutional(true);
        const { data: col } = await supabase
          .from("colegios")
          .select("nombre")
          .eq("id", p.colegioId)
          .maybeSingle();
        setColegioNombre((col as { nombre: string } | null)?.nombre ?? null);
      } else {
        setIsInstitutional(false);
        setColegioNombre(null);
      }
      setProfileLoaded(true);
    }).catch(() => setProfileLoaded(true));
  }, [user?.id]);

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
    navigate("/landing", { replace: true });
  };

  // Si hide_credits está activo y el usuario es docente (rol user), ocultar créditos y mostrar badge institucional
  const isTeacher = role === "docente" || (!role && !isStaff && !isAdmin);
  const shouldHideCredits = hideCredits && isTeacher;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <PlanExpirationBanner />
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2.5">
            <BrandLogo size="md" />
          </NavLink>

          <nav className="flex items-center gap-1">
            <NavItem to="/" label="Inicio" icon={Home} />
            {!isAdminOnly && <NavItem to="/crear-prueba" label="Crear prueba" icon={FilePlus2} dataTour="crear-btn" />}
            {!isAdminOnly && <NavItem to="/banco-preguntas" label="Banco" icon={Library} />}
            {!isAdminOnly && <NavItem to="/pruebas" label="Mis pruebas" icon={Library} />}
            
            {isStaff && <NavItem to="/configuracion" label="Configuración" icon={Settings} dataTour="configuracion" />}
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
            {user && !usageLoading && profileLoaded && (shouldHideCredits || isInstitutional) && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] font-medium gap-1">
                <Building2 className="h-3 w-3" />
                {colegioNombre ?? "Cuenta Institucional"}
              </Badge>
            )}
            {user && !usageLoading && profileLoaded && !shouldHideCredits && !isInstitutional && (
              <Badge variant="outline" className="gap-1 text-[10px] font-normal">
                <Sparkles className="h-3 w-3" /> {creditsAvailable} créditos IA · {planLabel}
              </Badge>
            )}
            {user && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 rounded-full"
                title="Centro de Ayuda"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="h-5 w-5 text-muted-foreground" />
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
                    {!usageLoading && profileLoaded && (shouldHideCredits || isInstitutional) && (
                      <div className="pt-1">
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] font-medium gap-1">
                          <Building2 className="h-3 w-3" />
                          {colegioNombre ?? "Cuenta Institucional"}
                        </Badge>
                      </div>
                    )}
                    {!usageLoading && profileLoaded && !shouldHideCredits && !isInstitutional && (
                      <div className="pt-1 space-y-0.5">
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">{planLabel}</Badge>
                        {planExpiresAt && (
                          <div className="text-[10px] text-muted-foreground">
                            Expira {new Date(planExpiresAt).toLocaleDateString("es-CL", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        )}
                      </div>
                    )}
                    {!usageLoading && !profileLoaded && !isInstitutional && !shouldHideCredits && (
                      <div className="pt-1">
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground animate-pulse">Cargando…</Badge>
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
      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
};

const NavItem = ({ to, label, icon: Icon, dataTour }: { to: string; label: string; icon: typeof FileText; dataTour?: string }) => (
  <NavLink
    to={to}
    end={to === "/"}
    data-tour={dataTour}
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
