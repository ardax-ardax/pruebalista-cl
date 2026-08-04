import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { UserUsageProvider } from "@/hooks/useUserUsage";
import { PlansProvider } from "@/hooks/usePlans";
import { HelpTourProvider } from "@/components/help/HelpTour";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminGuard } from "@/components/AdminGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BrandIcon } from "@/components/BrandLogo";


// Carga inmediata para landing/auth/dashboard inicial (rutas críticas).
import DashboardDocente from "./pages/DashboardDocente.tsx";
import AuthPage from "./pages/Auth.tsx";
import ResetPasswordPage from "./pages/ResetPassword.tsx";
import Landing from "./pages/Landing.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy-load para módulos pesados (editor, PDF, dashboards, banco).
const CrearPrueba = lazy(() => import("./pages/CrearPrueba.tsx"));
const MisPruebas = lazy(() => import("./pages/MisPruebas.tsx"));
const Configuracion = lazy(() => import("./pages/Configuracion.tsx"));

const AdminDashboard = lazy(() => import("./pages/AdminDashboard.tsx"));
const Perfil = lazy(() => import("./pages/Perfil.tsx"));
const BancoPreguntas = lazy(() => import("./pages/BancoPreguntas.tsx"));
const DocenteDashboardInstitucional = lazy(() => import("./pages/DocenteDashboardInstitucional.tsx"));
const Precios = lazy(() => import("./pages/Precios.tsx"));
const Privacidad = lazy(() => import("./pages/Privacidad.tsx"));
const Terminos = lazy(() => import("./pages/Terminos.tsx"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-[40vh] flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
    <BrandIcon size="lg" className="animate-pulse" />
    Cargando…
  </div>
);


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PlansProvider>
          <UserUsageProvider>
            <HelpTourProvider>
            <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/privacidad" element={<Privacidad />} />
              <Route path="/terminos" element={<Terminos />} />
              <Route path="/dashboard" element={<AuthGuard><DashboardDocente /></AuthGuard>} />
              <Route path="/crear-prueba" element={<AuthGuard><CrearPrueba /></AuthGuard>} />
              <Route path="/pruebas" element={<AuthGuard><MisPruebas /></AuthGuard>} />
              
              <Route path="/configuracion" element={<AuthGuard><AdminGuard><Configuracion /></AdminGuard></AuthGuard>} />
              <Route path="/admin/dashboard" element={<AuthGuard><AdminGuard><AdminDashboard /></AdminGuard></AuthGuard>} />
              <Route path="/perfil" element={<AuthGuard><Perfil /></AuthGuard>} />
              <Route path="/banco-preguntas" element={<AuthGuard><BancoPreguntas /></AuthGuard>} />
              <Route path="/docente/dashboard" element={<AuthGuard><DocenteDashboardInstitucional /></AuthGuard>} />
              <Route path="/precios" element={<AuthGuard><Precios /></AuthGuard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
            </HelpTourProvider>
          </UserUsageProvider>
          </PlansProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
