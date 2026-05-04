
## Cambios propuestos

### 1. Mostrar fecha de expiración en el dropdown del avatar

En el menú desplegable del avatar (AppLayout.tsx), junto al badge del plan, mostrar la fecha de expiración cuando el usuario tiene un plan de pago (no free). Por ejemplo: "Plan Pro · Expira 3 jun 2026".

**Archivo:** `src/components/AppLayout.tsx`
- Importar `planExpiresAt` y `effectivePlan` desde `useUserUsage()`
- En el `DropdownMenuLabel`, modificar el badge del plan para incluir la fecha formateada cuando `planExpiresAt` no sea null y el plan no sea free

### 2. Mejoras al perfil docente

Propongo agregar las siguientes mejoras a la página de perfil del docente (`src/pages/Perfil.tsx`):

- **Mostrar plan y expiración:** En la pestaña "Datos", agregar una sección que muestre el plan actual del docente, créditos disponibles y fecha de expiración (si aplica). Actualmente esa info solo aparece en el header.
- **Mostrar colegio asociado:** Si el docente pertenece a un colegio, mostrar el nombre del colegio en la pestaña "Datos".
- **Mostrar rol:** Indicar si es docente autónomo o profesor de colegio.

**Archivos afectados:**
- `src/pages/Perfil.tsx` — Agregar sección de plan/créditos/expiración y colegio en la pestaña "Datos"
- `src/components/AppLayout.tsx` — Fecha de expiración en dropdown

No se requieren cambios de base de datos.
