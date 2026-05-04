
## Expiración de plan Pro con degradación suave

Cuando un plan Pro expira (1 mes por defecto), el usuario baja a Free pero conserva todos sus datos. Solo se restringe cuántos puede usar activamente.

### Lógica de negocio

- **Créditos**: se mantienen tal cual, no se restan.
- **Asignaciones**: si tiene más de las permitidas en Free (ej. 5), solo las últimas N creadas quedan activas; las anteriores se bloquean (no se eliminan).
- **Pruebas**: si tiene más de las permitidas en Free (ej. 10), solo las últimas N (por `updated_at`) se pueden editar/eliminar; las anteriores son de solo lectura.
- Al renovar/subir plan, todo se desbloquea automáticamente (no hay que restaurar nada).

### Ya existe: `effectivePlan`

El hook `useUserUsage` ya calcula `effectivePlan`: si `plan_expires_at` pasó, devuelve el plan por defecto (Free). Los límites (`maxAssessments`, `maxAssignments`) ya se derivan del `effectivePlan`. Esto significa que la restricción de "no crear más" ya funciona.

### Lo que falta: restringir los existentes que exceden el límite

**1. Asignaciones — bloqueo visual en Perfil**

En `src/pages/Perfil.tsx`, ordenar las asignaciones por `created_at DESC`. Si `maxAssignments` es N y hay más de N, marcar las que exceden (las más antiguas) como bloqueadas: no se pueden seleccionar al crear pruebas, y en la UI muestran un candado con tooltip "Excede el límite de tu plan".

**2. Pruebas — bloqueo de edición en MisPruebas y CrearPrueba**

En `src/pages/MisPruebas.tsx`, ordenar por `updated_at DESC`. Si `maxAssessments` es N y hay más de N, las pruebas fuera del límite muestran botones Editar/Eliminar deshabilitados con tooltip "Excede el límite de tu plan". Se pueden ver pero no modificar.

En `src/pages/CrearPrueba.tsx`, si el usuario intenta abrir una prueba bloqueada vía URL, mostrar alerta y redirigir.

**3. Filtrar asignaciones disponibles en CrearPrueba**

En `src/pages/CrearPrueba.tsx`, cuando se cargan las asignaciones para elegir curso/asignatura, filtrar solo las activas (las últimas N por `created_at`).

**4. Valor por defecto de `plan_expires_at` al asignar plan Pro**

En `src/pages/AdminDashboard.tsx`, cuando el admin asigna un plan diferente a Free, setear `plan_expires_at = now() + 1 mes` automáticamente. Si asigna Free, `plan_expires_at = null`.

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Perfil.tsx` | Ordenar asignaciones, marcar excedentes como bloqueadas |
| `src/pages/MisPruebas.tsx` | Ordenar pruebas, deshabilitar edición/eliminación en excedentes |
| `src/pages/CrearPrueba.tsx` | Filtrar asignaciones activas; bloquear apertura de prueba excedente |
| `src/pages/DashboardDocente.tsx` | Ajustar conteo de pruebas activas vs total |
| `src/pages/AdminDashboard.tsx` | Auto-setear `plan_expires_at` al cambiar plan |
| `src/hooks/useUserUsage.tsx` | Exportar `planExpiresAt` (ya existe) para mostrar en UI |

No se requieren migraciones de base de datos. La columna `plan_expires_at` ya existe en `user_usage`.
