## Gestión dinámica de planes desde el panel admin

### Resumen

Crear una tabla `plans` en la base de datos con las características configurables de cada plan. El admin podrá crear, editar y eliminar planes desde una nueva pestaña en el panel de administración. Todo el código que hoy compara strings hardcoded (`"free"`, `"pro"`, `"institucional"`) pasará a consultar los límites del plan del usuario dinámicamente.

---

### 1. Base de datos

**Nueva tabla `plans`:**

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | text (PK) | Slug identificador (ej: `free`, `pro`, `premium`) |
| `label` | text | Nombre visible (ej: "Plan Gratuito") |
| `max_assessments` | int | Límite de pruebas (null = sin límite) |
| `max_assignments` | int | Límite de asignaciones (null = sin límite) |
| `can_export_docx` | boolean | Puede exportar .docx |
| `show_watermark` | boolean | Muestra marca de agua en PDF |
| `can_edit_layout` | boolean | Puede editar layout (margen, etc.) |
| `default_credits` | int | Créditos IA al crear cuenta |
| `is_default` | boolean | Plan asignado a nuevos usuarios (solo 1) |
| `sort_order` | int | Orden en selectores |
| `created_at` | timestamptz | — |

**Migración adicional:**
- Reemplazar trigger `validate_plan_type` para que valide contra la tabla `plans` en vez de un enum hardcoded.
- Insertar los 3 planes actuales como datos iniciales (`free`, `pro`, `institucional`).
- RLS: lectura pública para autenticados, escritura solo admin.

---

### 2. Nuevo hook: `usePlans`

Un hook/contexto que carga los planes una vez y expone:
- `plans`: lista completa de planes.
- `getPlan(id)`: obtener un plan por su slug.
- `userPlanLimits`: los límites del plan efectivo del usuario actual (derivado de `useUserUsage`).

Archivo: `src/hooks/usePlans.tsx`

---

### 3. Refactorizar `useUserUsage`

- Cambiar `PlanType` de union literal a `string`.
- Agregar campos derivados del plan: `maxAssessments`, `maxAssignments`, `canExportDocx`, `showWatermark`, `canEditLayout`.
- Estos campos se obtienen cruzando `effectivePlan` con la tabla `plans`.

---

### 4. Panel admin — nueva pestaña "Planes"

En `AdminDashboard.tsx`, agregar una pestaña "Planes" con:
- Tabla con los planes existentes y sus límites.
- Botón "Nuevo plan" que abre un formulario con todos los campos.
- Edición inline o en dialog para cada plan.
- No se puede eliminar el plan marcado como `is_default`.
- No se puede eliminar un plan si hay usuarios asignados a él (mostrar conteo).

---

### 5. Refactorizar comparaciones hardcoded

Archivos a modificar (reemplazar `=== "free"`, `=== "pro"`, etc. por los campos del plan):

| Archivo | Cambio |
|---|---|
| `src/pages/CrearPrueba.tsx` | `maxAssessments`, `canExportDocx`, `canEditLayout` |
| `src/pages/DashboardDocente.tsx` | `maxAssessments` |
| `src/pages/Perfil.tsx` | `maxAssignments` |
| `src/components/AppLayout.tsx` | Badge dinámico con `plan.label` en vez de switch |
| `src/lib/assessment-render.tsx` | `showWatermark` |
| `src/hooks/useUserUsage.tsx` | Tipo `PlanType` → `string`, campos derivados |
| `src/pages/AdminDashboard.tsx` | Select dinámico de planes, badge dinámico, bulk assign |
| `src/components/admin/UtpUsageManager.tsx` | Badge dinámico |

---

### 6. Trigger de asignaciones

Actualizar `validate_teacher_assignment_limit()` para leer `max_assignments` de la tabla `plans` en vez de hardcodear el número 5.

---

### Archivos nuevos
- `supabase/migrations/..._create_plans_table.sql`
- `src/hooks/usePlans.tsx`
- `src/components/admin/PlansManager.tsx`

### Archivos editados
- `src/hooks/useUserUsage.tsx`
- `src/pages/AdminDashboard.tsx`
- `src/pages/CrearPrueba.tsx`
- `src/pages/DashboardDocente.tsx`
- `src/pages/Perfil.tsx`
- `src/components/AppLayout.tsx`
- `src/components/admin/UtpUsageManager.tsx`
- `src/lib/assessment-render.tsx`

No se crean edge functions nuevas.