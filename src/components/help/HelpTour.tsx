import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { getMyProfile, updateMyProfile } from "@/lib/profiles";

export type TourVariant = "utp" | "docente_inst" | "docente_auto";

const DOCENTE_AUTO_STEPS: DriveStep[] = [
  {
    element: '[data-tour="dashboard"]',
    popover: {
      title: "Tu panel personal",
      description: "Como docente autónomo, gestionas tus propias pruebas y cursos desde aquí.",
    },
  },
  {
    element: '[data-tour="crear-btn"]',
    popover: {
      title: "Crea tu prueba",
      description: "Genera evaluaciones desde cero o con IA. Tus pruebas son 100% privadas: solo tú las ves.",
    },
  },
  {
    element: '[data-tour="nivel-selector"]',
    popover: {
      title: "Cursos propios",
      description: "Define el nivel y curso para tus evaluaciones. Puedes administrar tus cursos desde tu panel.",
    },
  },
  {
    element: '[data-tour="ia-generar"]',
    popover: {
      title: "Créditos personales",
      description: "Cada generación con IA descuenta de tu bolsa personal de créditos.",
    },
  },
];

const DOCENTE_INST_STEPS: DriveStep[] = [
  {
    element: '[data-tour="dashboard"]',
    popover: {
      title: "Tu panel docente",
      description: "Estás vinculado a un colegio: tu UTP gestiona créditos, cursos y revisa tus pruebas.",
    },
  },
  {
    element: '[data-tour="crear-btn"]',
    popover: {
      title: "Generación de pruebas",
      description: "Crea evaluaciones siguiendo la planificación institucional. Una vez listas, envíalas a revisión UTP.",
    },
  },
  {
    element: '[data-tour="ia-generar"]',
    popover: {
      title: "Créditos del colegio",
      description: "La IA consume créditos de la bolsa común del colegio, gestionada por UTP.",
    },
  },
  {
    element: '[data-tour="formatos"]',
    popover: {
      title: "Revisión UTP",
      description: "Tus pruebas pasan por aprobación de UTP antes de ser oficiales. Recibirás feedback si requieren ajustes.",
    },
  },
];

const UTP_STEPS: DriveStep[] = [
  {
    element: '[data-tour="configuracion"]',
    popover: {
      title: "Centro de Configuración",
      description: "Administra todo tu colegio desde este panel centralizado.",
    },
  },
  {
    element: '[data-tour="tab-equipo"]',
    popover: {
      title: "Equipo docente",
      description: "Invita y gestiona a los docentes de tu institución.",
    },
  },
  {
    element: '[data-tour="tab-cursos"]',
    popover: {
      title: "Asistente de Cursos",
      description: "Estructura oficial del colegio con el asistente Nivel · Grado · Letra.",
    },
  },
  {
    element: '[data-tour="revisiones"]',
    popover: {
      title: "Flujo de Aprobación",
      description: "Aprueba o rechaza pruebas enviadas por tus docentes y entrega feedback.",
    },
  },
  {
    element: '[data-tour="consumo"]',
    popover: {
      title: "Consumo de créditos",
      description: "Monitorea el uso de IA del colegio y recupera créditos de pruebas rechazadas.",
    },
  },
];

const STEPS_BY_VARIANT: Record<TourVariant, DriveStep[]> = {
  utp: UTP_STEPS,
  docente_inst: DOCENTE_INST_STEPS,
  docente_auto: DOCENTE_AUTO_STEPS,
};

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
  variant: TourVariant;
}

const HelpTourContext = createContext<HelpTourContextValue>({
  startTour: () => {},
  variant: "docente_auto",
});

export const useHelpTour = () => useContext(HelpTourContext);

const variantFor = (role: AppRole | null, hasColegio: boolean): TourVariant => {
  if (role === "utp_head" || role === "admin") return "utp";
  if (hasColegio) return "docente_inst";
  return "docente_auto";
};

export function HelpTourProvider({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const [autoChecked, setAutoChecked] = useState(false);
  const [hasColegio, setHasColegio] = useState(false);
  const driverRef = useRef<Driver | null>(null);

  const variant = variantFor(role, hasColegio);

  const startTour = useCallback(() => {
    driverRef.current?.destroy();
    const d = buildDriver(STEPS_BY_VARIANT[variant], () => {
      updateMyProfile({ has_seen_tour: true }).catch(() => undefined);
    });
    driverRef.current = d;
    setTimeout(() => d.drive(), 150);
  }, [variant]);

  // Auto-disparo: primera vez que el usuario inicia sesión.
  useEffect(() => {
    if (loading || !user || autoChecked) return;
    setAutoChecked(true);
    getMyProfile()
      .then((p) => {
        if (!p) return;
        setHasColegio(!!p.colegioId);
        if (!p.hasSeenTour) {
          setTimeout(() => {
            const v = variantFor(role, !!p.colegioId);
            driverRef.current?.destroy();
            const d = buildDriver(STEPS_BY_VARIANT[v], () => {
              updateMyProfile({ has_seen_tour: true }).catch(() => undefined);
            });
            driverRef.current = d;
            d.drive();
          }, 800);
        }
      })
      .catch(() => undefined);
  }, [user?.id, loading, autoChecked, role]);

  return (
    <HelpTourContext.Provider value={{ startTour, variant }}>{children}</HelpTourContext.Provider>
  );
}
