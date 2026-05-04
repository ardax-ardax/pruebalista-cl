
## Control de Hoja OMR por plan

### Situación actual

- La hoja OMR se muestra a **todos** los usuarios cuando la plantilla es SIMCE o PAES (`essayMode`). No hay control por plan.
- Las plantillas (Ev. Formativa, Ev. Sumativa, Guía, Ensayo SIMCE, Ensayo PAES) son built-in y se cargan desde `src/lib/templates.ts`. Actualmente no hay control de visibilidad por plan.

### Propuesta

Agregar un nuevo campo `can_use_omr` (boolean) a la tabla `plans` para que el admin pueda activar/desactivar la hoja OMR por plan. Por defecto `false` para Free y `true` para planes superiores.

### Cambios

**1. Migración SQL**
- Agregar columna `can_use_omr boolean NOT NULL DEFAULT false` a `plans`.

**2. `src/hooks/usePlans.tsx`**
- Agregar `can_use_omr` a la interfaz `Plan` y al `DEFAULT_PLAN_LIMITS`.

**3. `src/hooks/useUserUsage.tsx`**
- Agregar `canUseOmr: boolean` a `UserUsage` y derivarlo del plan efectivo.

**4. `src/pages/CrearPrueba.tsx`**
- Condicionar el botón "Hoja OMR" a `canUseOmr` además del `essayMode`.

**5. `src/components/admin/PlansManager.tsx`**
- Agregar switch "Hoja de respuesta OMR" al formulario de edición de plan.

### Sobre las plantillas

Las plantillas actualmente son estáticas (built-in). Controlar qué plantillas ve cada plan requeriría un sistema más complejo (tabla de plantillas en DB + campo de visibilidad por plan). Si quieres avanzar con eso también, lo podemos hacer en un segundo paso. Por ahora el control de OMR es lo más inmediato.
