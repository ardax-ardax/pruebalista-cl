import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { getMyProfile, updateMyProfile } from "@/lib/profiles";

const DOCENTE_STEPS: DriveStep[] = [
  {
    element: '[data-tour="dashboard"]',
    popover: {
      title: "Tu panel docente",
      description: "Gestiona tus evaluaciones y revisa tu estado desde este panel.",
    },
  },
  {
    element: '[data-tour="crear-btn"]',
    popover: {
      title: "Crear prueba",
      description: "Comienza aquí para generar una nueva prueba.",
    },
  },
  {
    element: '[data-tour="nivel-selector"]',
    popover: {
      title: "Nivel y curso",
      description: "Define el nivel para cargar los OA correspondientes.",
    },
  },
  {
    element: '[data-tour="formatos"]',
    popover: {
      title: "Formatos disponibles",
      description: "Los botones SIMCE/PAES se habilitan automáticamente según el curso.",
    },
  },
  {
    element: '[data-tour="ia-generar"]',
    popover: {
      title: "Generación con IA",
      description: "Genera preguntas inteligentes en segundos.",
    },
  },
];

const UTP_STEPS: DriveStep[] = [
  {
    element: '[data-tour="configuracion"]',
    popover: {
      title: "Centro de Configuración",
      description: "Administra tu institución desde este panel centralizado.",
    },
  },
  {
    element: '[data-tour="tab-cursos"]',
    popover: {
      title: "Estructura de cursos",
      description: "Usa el asistente triple (Nivel · Grado · Letra) para crear la estructura oficial del colegio.",
    },
  },
  {
    element: '[data-tour="revisiones"]',
    popover: {
      title: "Revisión de pruebas",
      description: "Aprueba o rechaza pruebas enviadas por tus docentes.",
    },
  },
];

const buildDriver = (steps: DriveStep[], onDone?: () => void): Driver =>
  driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: "Siguiente",
    prevBtnText: "Anterior",
    doneBtnText: "Finalizar",
    progressText: "{{current}} de {{total}}",
    popoverClass: "pl-tour",
    steps,
    onDestroyed: () => onDone?.(),
  });

interface HelpTourContextValue {
  startTour: () => void;
}

const HelpTourContext = createContext<HelpTourContextValue>({ startTour: () => {} });

export const useHelpTour = () => useContext(HelpTourContext);

const stepsForRole = (role: AppRole | null): DriveStep[] => {
  if (role === "utp_head") return UTP_STEPS;
  return DOCENTE_STEPS;
};

export function HelpTourProvider({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const [autoChecked, setAutoChecked] = useState(false);
  const driverRef = useRef<Driver | null>(null);

  const startTour = useCallback(() => {
    driverRef.current?.destroy();
    const d = buildDriver(stepsForRole(role), () => {
      updateMyProfile({ has_seen_tour: true }).catch(() => undefined);
    });
    driverRef.current = d;
    // Pequeño retardo para asegurar que los selectores existen al iniciar.
    setTimeout(() => d.drive(), 150);
  }, [role]);

  // Auto-disparo: primera vez que el usuario inicia sesión.
  useEffect(() => {
    if (loading || !user || autoChecked) return;
    setAutoChecked(true);
    getMyProfile()
      .then((p) => {
        if (p && !p.hasSeenTour) {
          // Esperar a que la UI esté pintada
          setTimeout(() => startTour(), 800);
        }
      })
      .catch(() => undefined);
  }, [user?.id, loading, autoChecked, startTour]);

  return (
    <HelpTourContext.Provider value={{ startTour }}>{children}</HelpTourContext.Provider>
  );
}
