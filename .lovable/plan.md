
## Control de plantillas por plan

### Enfoque

Agregar un campo `allowed_templates` (array de texto) a la tabla `plans`. Cuando es `NULL`, todas las plantillas están disponibles. Cuando tiene valores, solo se muestran las plantillas cuyos IDs estén en el array.

Las 5 plantillas built-in son:
- `ev-formativa-formal` — Ev. Formativa Formal
- `ev-sumativa` — Ev. Sumativa
- `guia-portafolio` — Guía de Portafolio
- `ensayo-simce` — Ensayo SIMCE
- `ensayo-paes` — Ensayo PAES

### Cambios

**1. Migración SQL**
- Agregar columna `allowed_templates text[] DEFAULT NULL` a `plans`.
- NULL = todas las plantillas habilitadas.

**2. `src/hooks/usePlans.tsx`**
- Agregar `allowed_templates: string[] | null` a la interfaz `Plan`.

**3. `src/hooks/useUserUsage.tsx`**
- Agregar `allowedTemplates: string[] | null` derivado del plan efectivo.

**4. `src/pages/CrearPrueba.tsx`**
- Filtrar las plantillas cargadas según `allowedTemplates`. Si es `null`, mostrar todas. Si es un array, solo mostrar las que estén en la lista.

**5. `src/components/admin/PlansManager.tsx`**
- Agregar sección de checkboxes con las 5 plantillas built-in al formulario de edición de plan.
- Cada checkbox activa/desactiva el template ID en el array.
- Un toggle "Todas las plantillas" para poner NULL (sin restricción).
