import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { UserUsageProvider } from "@/hooks/useUserUsage";
import { PlansProvider } from "@/hooks/usePlans";
import { HelpTourProvider } from "@/components/help/HelpTour";
import { AuthGuard } from "@/components/AuthGuard";
import { AdminGuard } from "@/components/AdminGuard";
import CrearPrueba from "./pages/CrearPrueba.tsx";
import DashboardDocente from "./pages/DashboardDocente.tsx";
import MisPruebas from "./pages/MisPruebas.tsx";
import Configuracion from "./pages/Configuracion.tsx";
import Cursos from "./pages/Cursos.tsx";
import AdminDashboard from "./pages/AdminDashboard.tsx";
import AuthPage from "./pages/Auth.tsx";
import Landing from "./pages/Landing.tsx";
import Perfil from "./pages/Perfil.tsx";
import NotFound from "./pages/NotFound.tsx";
import BancoPreguntas from "./pages/BancoPreguntas.tsx";
import DocenteDashboardInstitucional from "./pages/DocenteDashboardInstitucional.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <PlansProvider>
          <UserUsageProvider>
            <Routes>
              <Route path="/landing" element={<Landing />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/" element={<AuthGuard><DashboardDocente /></AuthGuard>} />
              <Route path="/crear-prueba" element={<AuthGuard><CrearPrueba /></AuthGuard>} />
              <Route path="/pruebas" element={<AuthGuard><MisPruebas /></AuthGuard>} />
              <Route path="/cursos" element={<AuthGuard><AdminGuard><Cursos /></AdminGuard></AuthGuard>} />
              <Route path="/configuracion" element={<AuthGuard><AdminGuard><Configuracion /></AdminGuard></AuthGuard>} />
              <Route path="/admin/dashboard" element={<AuthGuard><AdminGuard><AdminDashboard /></AdminGuard></AuthGuard>} />
              <Route path="/perfil" element={<AuthGuard><Perfil /></AuthGuard>} />
              <Route path="/banco-preguntas" element={<AuthGuard><BancoPreguntas /></AuthGuard>} />
              <Route path="/docente/dashboard" element={<AuthGuard><DocenteDashboardInstitucional /></AuthGuard>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </UserUsageProvider>
          </PlansProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
