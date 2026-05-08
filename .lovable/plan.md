# Plan: Sistema de Onboarding Tour Interactivo

## 1. Dependencia
- Instalar `driver.js` (liviano, ~5kb, sin dependencias).

## 2. Persistencia (`has_seen_tour`)
- **Migración SQL**: agregar columna `has_seen_tour boolean default false` a `profiles`.
- Actualizar `src/lib/profiles.ts`: incluir `hasSeenTour` en `Profile`, `getMyProfile`, `updateMyProfile`.
- Trigger automático: si `hasSeenTour === false` al cargar dashboard → iniciar tour y luego marcar `true`.

## 3. Componente `HelpTour`
**Archivo nuevo**: `src/components/help/HelpTour.tsx`
- Hook `useHelpTour()` que expone `startTour(role)`.
- Define los pasos por rol (`docenteSteps`, `utpSteps`) con selectores CSS (`data-tour="..."`).
- Wrapper de `driver.js` con configuración de marca:
  - `nextBtnText: "Siguiente"`, `prevBtnText: "Anterior"`, `doneBtnText: "Finalizar"`
  - Estilos custom vía `popoverClass: "pl-tour"` en `index.css` usando tokens (`hsl(var(--primary))`, `--card`, `--foreground`).
- Provider opcional: `HelpTourProvider` montado en `App.tsx` para acceso global.

## 4. Botón de Ayuda en Header
**Editar**: `src/components/AppLayout.tsx`
- Agregar `DropdownMenu` con `<HelpCircle />` (lucide) entre el badge institucional y el avatar.
- Opciones:
  - **Iniciar Tour Guiado** → llama `startTour(role)` según `useAuth().role`.
  - **Centro de Ayuda (Próximamente)** → `disabled`, tooltip "Disponible pronto".

## 5. Marcadores `data-tour` en UI
Agregar atributos discretos (no afectan estilos):

**Tour Docente**:
- `DashboardDocente.tsx` → wrapper principal: `data-tour="dashboard"`
- `AppLayout.tsx` NavItem "Crear prueba": `data-tour="crear-btn"`
- `AssessmentMetaForm.tsx` selector de Grado/Nivel: `data-tour="nivel-selector"`
- `AssessmentMetaForm.tsx` botones formato (SIMCE/PAES): `data-tour="formatos"`
- `CrearPrueba.tsx` botón generar IA: `data-tour="ia-generar"`

**Tour UTP**:
- `AppLayout.tsx` NavItem "Configuración": `data-tour="configuracion"`
- `Configuracion.tsx` TabsTrigger "cursos": `data-tour="tab-cursos"`
- `UtpReviewCenter` (si visible) o tab evaluaciones: `data-tour="revisiones"`

## 6. Auto-disparo
- En `DashboardDocente.tsx` y `Configuracion.tsx` (root del rol), efecto que:
  - Lee `getMyProfile()`, si `!hasSeenTour` → `startTour(role)` y al `onDestroyed` → `updateMyProfile({ has_seen_tour: true })`.

## 7. Estilo de marca
- En `src/index.css`: override `.pl-tour` y `.pl-tour .driver-popover-*` con `bg-card`, `text-foreground`, `border-primary`, botones con `bg-primary text-primary-foreground`.

## Detalles técnicos

**Archivos nuevos**:
- `src/components/help/HelpTour.tsx`
- `src/components/help/tour-steps.ts` (definiciones por rol)
- `supabase/migrations/<timestamp>_add_has_seen_tour.sql`

**Archivos modificados**:
- `src/components/AppLayout.tsx` (botón ayuda + data-tour en nav)
- `src/lib/profiles.ts` (campo hasSeenTour)
- `src/pages/DashboardDocente.tsx`, `DocenteDashboardInstitucional.tsx`, `Configuracion.tsx`, `CrearPrueba.tsx` (auto-disparo + data-tour)
- `src/components/test-builder/AssessmentMetaForm.tsx` (data-tour)
- `src/index.css` (estilos `.pl-tour`)
- `package.json` (dep `driver.js`)

**Comportamiento**:
- Si un selector no existe (ej. PAES en docente básica), `driver.js` salta el paso silenciosamente con `allowClose: true`.
- El tour del docente solo navega visualmente; no fuerza cambios de ruta entre pasos (cada paso destaca lo visible o explica con texto si no aplica).
